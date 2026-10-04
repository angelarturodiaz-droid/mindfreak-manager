"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { SearchSelect, searchKey } from "@/components/ui/search-select";
import { suggestClassification, type ClassificationSuggestion } from "@/features/suppliers/suggest-classification";

type Option = { id: string; name: string };
type ServiceTypeOption = Option & { category_id: string };

/**
 * Categoría (Configuración > Categorías) + Tipo de servicio
 * (Configuración > Tipos de servicio) del proveedor. El tipo de servicio
 * se filtra según la categoría elegida.
 *
 * Sugerencia por el nombre: mientras se escribe el NOMBRE DEL NEGOCIO
 * (campo name del mismo formulario) se propone categoría y tipo de servicio
 * (features/suppliers/suggest-classification.ts). Si el proveedor todavía no
 * tiene categoría y el usuario no la eligió a mano, se aplica sola; las otras
 * opciones salen como botones.
 */
export function SupplierCategoryFields({
  categories,
  serviceTypes,
  defaultCategoryId = "",
  defaultServiceTypeId = "",
  legacyCategory,
  legacyServiceType,
}: {
  categories: Option[];
  serviceTypes: ServiceTypeOption[];
  defaultCategoryId?: string;
  defaultServiceTypeId?: string;
  /** Texto viejo que no se pudo enlazar con el catálogo (solo informativo). */
  legacyCategory?: string | null;
  legacyServiceType?: string | null;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [serviceTypeId, setServiceTypeId] = useState(defaultServiceTypeId);
  const typesForCategory = serviceTypes.filter((t) => t.category_id === categoryId);
  const [suggestions, setSuggestions] = useState<ClassificationSuggestion[]>([]);
  // La sugerencia aplicada sola (para explicarla y poder quitarla si cambia el nombre).
  const [autoApplied, setAutoApplied] = useState<ClassificationSuggestion | null>(null);
  // El usuario eligió la categoría a mano (o el proveedor ya tenía una): ya no se cambia sola.
  const touchedRef = useRef(Boolean(defaultCategoryId));

  // Al guardar, React limpia el formulario (form.reset): las listas volvían
  // a la primera opción aunque aquí seguía el valor elegido. Se sincroniza
  // con los valores de partida para que lo que se ve sea lo que se envía.
  const anchor = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const onReset = () => {
      setCategoryId(defaultCategoryId);
      setServiceTypeId(defaultServiceTypeId);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultCategoryId, defaultServiceTypeId]);

  // Sugerencia según el nombre del negocio.
  useEffect(() => {
    const form = anchor.current?.closest("form");
    const nameInput = form?.elements.namedItem("name");
    if (!(nameInput instanceof HTMLInputElement)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const list = suggestClassification(nameInput.value, categories, serviceTypes);
      setSuggestions(list);
      if (touchedRef.current) return;
      const best = list[0] ?? null;
      setAutoApplied(best);
      setCategoryId(best?.categoryId ?? "");
      setServiceTypeId(best?.serviceTypeId ?? "");
    };
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(run, 300);
    };
    run();
    nameInput.addEventListener("input", onInput);
    return () => {
      clearTimeout(timer);
      nameInput.removeEventListener("input", onInput);
    };
  }, [categories, serviceTypes]);

  function applySuggestion(sg: ClassificationSuggestion) {
    touchedRef.current = true;
    setAutoApplied(null);
    setCategoryId(sg.categoryId);
    setServiceTypeId(sg.serviceTypeId);
  }
  // Proveedor que ya tenía categoría (editar): no se insiste con sugerencias.
  const others =
    defaultCategoryId && categoryId === defaultCategoryId
      ? []
      : suggestions.filter((sg) => sg.serviceTypeId !== serviceTypeId);

  return (
    <>
      <span ref={anchor} hidden />
      <SearchSelect
        label="Categoría"
        name="category_id"
        value={categoryId}
        onChange={(v, query) => {
          touchedRef.current = true;
          setAutoApplied(null);
          setCategoryId(v);
          // Si se encontró escribiendo un servicio (ej. "drones"), se elige también ese tipo.
          const q = searchKey(query);
          const hits = q ? serviceTypes.filter((t) => t.category_id === v && searchKey(t.name).includes(q)) : [];
          setServiceTypeId(hits.length === 1 ? hits[0].id : "");
        }}
        emptyLabel="Sin categoría"
        placeholder="Busca la categoría o un servicio (ej. fotografía)…"
        options={categories.map((c) => ({
          value: c.id,
          label: c.name,
          // Se encuentra también por sus tipos de servicio.
          keywords: serviceTypes.filter((t) => t.category_id === c.id).map((t) => t.name),
        }))}
        hint={
          autoApplied && autoApplied.categoryId === categoryId
            ? `Sugerida por el nombre del negocio (por la palabra “${autoApplied.words[0]}”). Puedes cambiarla.`
            : !defaultCategoryId && legacyCategory
              ? `Antes decía "${legacyCategory}": elige la categoría equivalente de la lista.`
              : "Escribe para buscar. También la encuentras por un servicio (ej. drones) y ese servicio queda elegido."
        }
      />
      {others.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-brand-muted">
            <Lightbulb size={13} className="text-brand-warning" aria-hidden />
            {autoApplied || categoryId ? "Otras opciones según el nombre:" : "Sugerencias según el nombre:"}
          </span>
          {others.map((sg) => (
            <button
              key={sg.serviceTypeId}
              type="button"
              onClick={() => applySuggestion(sg)}
              className="rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-brand-text hover:border-brand-accent hover:text-brand-accent"
              title={`Por la palabra “${sg.words[0]}”`}
            >
              {sg.categoryName} → {sg.serviceTypeName}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <SearchSelect
          label="Tipo de servicio"
          name="service_type_id"
          value={serviceTypeId}
          onChange={setServiceTypeId}
          disabled={!categoryId}
          emptyLabel={
            !categoryId
              ? "Elige primero la categoría"
              : typesForCategory.length === 0
                ? "Esta categoría no tiene tipos de servicio"
                : "Sin especificar"
          }
          options={typesForCategory.map((t) => ({ value: t.id, label: t.name }))}
          hint={
            !defaultServiceTypeId && legacyServiceType
              ? `Antes decía "${legacyServiceType}".`
              : undefined
          }
        />
        <p className="text-xs text-brand-muted">
          ¿No está en la lista? Agrégalo en{" "}
          <Link href="/settings/service-types" className="text-brand-accent hover:underline" target="_blank">
            Configuración → Tipos de servicio
          </Link>{" "}
          y recarga esta página.
        </p>
      </div>
    </>
  );
}
