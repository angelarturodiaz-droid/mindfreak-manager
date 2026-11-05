"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { ECF_FIELD_INFO, PROVINCES, placesOfProvince } from "@/lib/dgii/catalogs";

/** 5b — Datos que pide el Facturador DGII (opcionales): ID extranjero, provincia y municipio del cliente. */
export function ClientEcfFields({
  defaults,
}: {
  defaults?: { foreign_id?: string | null; province_code?: string | null; municipality_code?: string | null };
}) {
  const [province, setProvince] = useState(defaults?.province_code ?? "");
  const [place, setPlace] = useState(defaults?.municipality_code ?? "");
  const groups = placesOfProvince(province);

  return (
    <fieldset className="space-y-3 rounded-[var(--radius-md)] border border-brand-border p-3">
      <legend className="px-1 text-xs font-medium text-brand-muted">Para la factura electrónica (opcional)</legend>
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
    </fieldset>
  );
}
