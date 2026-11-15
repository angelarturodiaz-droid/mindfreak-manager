"use client";

import { useMemo, useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import {
  COUNTRIES,
  FAVORITE_COUNTRIES,
  HOME_COUNTRY,
  formatClientLocation,
  isForeignCountry,
  regionLabel,
  regionsOf,
} from "@/lib/geo/countries";
import { ECF_FIELD_INFO, PROVINCES, placesOfProvince } from "@/lib/dgii/catalogs";

const FAVORITES = new Set<string>(FAVORITE_COUNTRIES);
const COUNTRY_OPTIONS: SearchOption[] = [
  ...FAVORITE_COUNTRIES.map((code) => ({ value: code, label: COUNTRIES.find((c) => c.code === code)!.name, group: "Más usados" })),
  ...COUNTRIES.filter((c) => !FAVORITES.has(c.code)).map((c) => ({ value: c.code, label: c.name, group: "Todos los países" })),
];

/** Ubicación y datos fiscales del cliente (opcionales): país, ID extranjero y, en RD, provincia y municipio (códigos
 * oficiales DGII); en otro país, estado/provincia y ciudad en texto (migración 107). */
export function ClientEcfFields({
  defaults,
  collapsible = false,
}: {
  defaults?: {
    foreign_id?: string | null;
    province_code?: string | null;
    municipality_code?: string | null;
    country_code?: string | null;
    region?: string | null;
    city?: string | null;
  };
  /** En la ficha del cliente: plegable, con un resumen de lo guardado (la página queda más corta). */
  collapsible?: boolean;
}) {
  const [country, setCountry] = useState(defaults?.country_code || HOME_COUNTRY);
  const [province, setProvince] = useState(defaults?.province_code ?? "");
  const [place, setPlace] = useState(defaults?.municipality_code ?? "");
  const [region, setRegion] = useState(defaults?.region ?? "");
  const [city, setCity] = useState(defaults?.city ?? "");
  const groups = placesOfProvince(province);
  const foreign = isForeignCountry(country);
  const regionList = regionsOf(country);
  const regionOptions = useMemo(() => {
    const list = regionList ?? [];
    const opts = list.map((r) => ({ value: r.name, label: r.name, keywords: r.keywords }));
    if (region && !list.some((r) => r.name === region)) opts.unshift({ value: region, label: region, keywords: undefined });
    return opts;
  }, [regionList, region]);

  const location = foreign
    ? formatClientLocation({ country_code: country, region, city })
    : formatClientLocation({ province_code: province, municipality_code: place });
  const summary = location || (defaults?.foreign_id ? `ID extranjero ${defaults.foreign_id}` : "sin datos");
  const fields = (
    <div className="space-y-3">
      <SearchSelect
        label="País"
        name="country_code"
        options={COUNTRY_OPTIONS}
        value={country}
        emptyLabel={null}
        placeholder="Escribe el país…"
        info="Dónde está el cliente. República Dominicana usa la provincia y el municipio oficiales de la DGII; para otro país escribe su estado o provincia y la ciudad."
        onChange={(v) => {
          setCountry(v || HOME_COUNTRY);
          setRegion("");
          if (isForeignCountry(v)) {
            setProvince("");
            setPlace("");
          } else setCity("");
        }}
      />
      {foreign ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {regionList ? (
              <SearchSelect
                label={regionLabel(country)}
                name="region"
                options={regionOptions}
                value={region}
                emptyLabel="— Sin especificar —"
                onChange={(v) => setRegion(v)}
                info="Elige de la lista. Se muestra en la ficha del cliente y en el PDF de cotizaciones y facturas."
              />
            ) : (
              <Input
                label={regionLabel(country)}
                name="region"
                value={region}
                maxLength={80}
                onChange={(e) => setRegion(e.currentTarget.value)}
                placeholder="Ej. Ontario, Bavaria…"
                info="Escribe el estado, provincia o región. Se muestra en la ficha del cliente y en el PDF de cotizaciones y facturas."
              />
            )}
            <Input
              label="Ciudad"
              name="city"
              value={city}
              maxLength={80}
              onChange={(e) => setCity(e.currentTarget.value)}
              placeholder="Ej. Miami"
              info="La ciudad de la dirección del cliente."
            />
          </div>
        </>
      ) : (
        <>
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
        </>
      )}
      <Input
        label="ID extranjero"
        name="foreign_id"
        defaultValue={defaults?.foreign_id ?? ""}
        placeholder={foreign ? "Su número fiscal o pasaporte" : "Solo clientes del exterior sin RNC"}
        info={ECF_FIELD_INFO.foreignId}
        hint={foreign ? "Si no tiene RNC dominicano, completa su ID extranjero para poder facturarle." : undefined}
      />
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
                Ubicación y datos fiscales <span className="text-xs font-normal text-brand-muted">(opcional)</span>
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
      <legend className="px-1 text-xs font-medium text-brand-muted">Ubicación y datos fiscales (opcional)</legend>
      {fields}
    </fieldset>
  );
}
