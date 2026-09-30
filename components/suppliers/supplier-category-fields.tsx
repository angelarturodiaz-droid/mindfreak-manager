"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/field";

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
      <Select
        label="Categoría"
        name="category_id"
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setServiceTypeId("");
        }}
        hint={
          !defaultCategoryId && legacyCategory
            ? `Antes decía "${legacyCategory}": elige la categoría equivalente de la lista.`
            : "Se sugiere sola al registrar un gasto de este proveedor."
        }
      >
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-1">
        <Select
          label="Tipo de servicio"
          name="service_type_id"
          value={serviceTypeId}
          onChange={(e) => setServiceTypeId(e.target.value)}
          disabled={!categoryId}
          hint={
            !defaultServiceTypeId && legacyServiceType
              ? `Antes decía "${legacyServiceType}".`
              : undefined
          }
        >
          <option value="">
            {!categoryId
              ? "Elige primero la categoría"
              : typesForCategory.length === 0
                ? "Esta categoría no tiene tipos de servicio"
                : "Sin especificar"}
          </option>
          {typesForCategory.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
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
