"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { ECF_FIELD_INFO, PROVINCES, placeName, placesOfProvince, provinceName } from "@/lib/dgii/catalogs";

/** 5b — Datos que pide el Facturador DGII (opcionales): ID extranjero, provincia y municipio del cliente. */
export function ClientEcfFields({
  defaults,
  collapsible = false,
}: {
  defaults?: { foreign_id?: string | null; province_code?: string | null; municipality_code?: string | null };
  /** En la ficha del cliente: plegable, con un resumen de lo guardado (la página queda más corta). */
  collapsible?: boolean;
}) {
  const [province, setProvince] = useState(defaults?.province_code ?? "");
  const [place, setPlace] = useState(defaults?.municipality_code ?? "");
  const groups = placesOfProvince(province);

  const summary =
    [placeName(place), provinceName(province)].filter(Boolean).join(", ") || (defaults?.foreign_id ? `ID extranjero ${defaults.foreign_id}` : "sin datos");
  const fields = (
    <div className="space-y-3">
      <Input label="ID extranjero" name="foreign_id" defaultValue={defaults?.foreign_id ?? ""} placeholder="Solo clientes del exterior sin RNC" info={ECF_FIELD_INFO.foreignId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Provincia"
          name="province_code"
          value={province}
          info={ECF_FIELD_INFO.province}
          onChange={(e) => {
            setProvince(e.currentTarget.value);
            setPlace("");
          }}
        >
          <option value="">— Sin provincia —</option>
          {PROVINCES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select
          label="Municipio"
          name="municipality_code"
          value={place}
          disabled={!province}
          info={ECF_FIELD_INFO.municipality}
          onChange={(e) => setPlace(e.currentTarget.value)}
        >
          <option value="">{province ? "— Sin municipio —" : "Elige primero la provincia"}</option>
          {groups.map((g) =>
            g.distritos.length === 0 ? (
              <option key={g.municipio.code} value={g.municipio.code}>
                {g.municipio.name}
              </option>
            ) : (
              <optgroup key={g.municipio.code} label={g.municipio.name}>
                <option value={g.municipio.code}>{g.municipio.name} (municipio)</option>
                {g.distritos.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} (distrito municipal)
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </Select>
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <details className="group rounded-[var(--radius-md)] border border-brand-accent/40 bg-brand-surface-hover">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm hover:bg-brand-accent/10">
          <span className="flex min-w-0 items-start gap-2">
            <FileText size={15} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
            <span className="min-w-0">
              <span className="block font-medium text-brand-text">
                Para la factura electrónica <span className="text-xs font-normal text-brand-muted">(opcional)</span>
              </span>
              <span className="block text-xs text-brand-muted">{summary}</span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-brand-accent/50 bg-brand-surface px-2 py-1 text-xs font-medium text-brand-accent">
            <span className="group-open:hidden">Ver / cambiar</span>
            <span className="hidden group-open:inline">Ocultar</span>
            <ChevronDown size={13} className="transition group-open:rotate-180" aria-hidden />
          </span>
        </summary>
        <div className="border-t border-brand-border bg-brand-surface p-3">{fields}</div>
      </details>
    );
  }

  return (
    <fieldset className="space-y-3 rounded-[var(--radius-md)] border border-brand-border p-3">
      <legend className="px-1 text-xs font-medium text-brand-muted">Para la factura electrónica (opcional)</legend>
      {fields}
    </fieldset>
  );
}
