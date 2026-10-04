"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SearchSelect, searchKey } from "@/components/ui/search-select";

type Option = { id: string; name: string };
type ServiceTypeOption = Option & { category_id: string };

/**
 * Categoría (Configuración > Categorías) + Tipo de servicio
 * (Configuración > Tipos de servicio) del proveedor. El tipo de servicio
 * se filtra según la categoría elegida.
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

  return (
    <>
      <span ref={anchor} hidden />
      <SearchSelect
        label="Categoría"
        name="category_id"
        value={categoryId}
        onChange={(v, query) => {
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
          !defaultCategoryId && legacyCategory
            ? `Antes decía "${legacyCategory}": elige la categoría equivalente de la lista.`
            : "Escribe para buscar. También la encuentras por un servicio (ej. drones) y ese servicio queda elegido."
        }
      />
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
