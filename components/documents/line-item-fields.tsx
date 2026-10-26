"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { MoneyInput } from "@/components/ui/money-input";
import { InfoHint } from "@/components/ui/info-hint";

export type LineTaxRateRef = { id: string; name: string; rate: number; treatment: string };
export type LineService = {
  id: string;
  name: string;
  unit: string | null;
  default_price: number;
  default_cost?: number;
  default_tax_rate_id: string | null;
  tax_rates: LineTaxRateRef | LineTaxRateRef[] | null;
  service_categories?: { name: string } | { name: string }[] | null;
};
export type LineTaxRate = { id: string; name: string; rate: number; is_default?: boolean };
export type LinePrefill = { description: string; unit_price: number; quantity: number };

function one<T>(v: T | T[] | null | undefined): T | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/** Opciones del buscador: agrupadas por categoría, se encuentran con o sin tildes. */
function serviceOptions(services: LineService[]): SearchOption[] {
  return services.map((s) => ({
    value: s.id,
    label: s.name,
    group: one(s.service_categories)?.name ?? "Sin categoría",
  }));
}

function serviceTaxRateId(service: LineService | null): string | null {
  if (!service) return null;
  return one(service.tax_rates)?.id ?? service.default_tax_rate_id ?? null;
}

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat("es-DO", { style: "currency", currency }).format(Number.isFinite(n) ? n : 0);

/**
 * Campos de una línea nueva de cotización o factura, ordenados en 3 pasos:
 * 1 qué se vende (buscador de servicios + descripción), 2 cantidad, precio,
 * descuento e impuesto, 3 vista previa del total de la línea. El montaje
 * con `key` distinto (al agregar una línea) lo deja en blanco.
 *
 * Mismo cálculo que el servidor: base = cantidad × precio − descuento;
 * impuesto sobre la base. La vista previa es solo informativa.
 */
export function LineItemFields({
  services,
  taxRates,
  defaultTaxRate,
  currency,
  showCost = false,
  prefill = null,
  onServiceChange,
}: {
  services: LineService[];
  taxRates: LineTaxRate[];
  defaultTaxRate: LineTaxRateRef | null;
  currency: string;
  /** Costo unitario estimado (cotizaciones): interno, no lo ve el cliente. */
  showCost?: boolean;
  /** Datos traídos de otra parte (ej. "Copiar del proyecto" en facturas). */
  prefill?: LinePrefill | null;
  onServiceChange?: (service: LineService | null) => void;
}) {
  const fallbackTax = defaultTaxRate?.id ?? taxRates[0]?.id ?? "";
  const [serviceId, setServiceId] = useState("");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [quantity, setQuantity] = useState(String(prefill?.quantity ?? 1));
  const [price, setPrice] = useState(prefill?.unit_price ?? 0);
  const [discount, setDiscount] = useState("0");
  const [taxId, setTaxId] = useState(fallbackTax);
  const [cost, setCost] = useState(0);
  // Clave para volver a montar los campos de dinero cuando cambian desde fuera.
  const [moneyKey, setMoneyKey] = useState(0);

  // "Copiar del proyecto" (facturas) cambia el prefill: se aplica una vez.
  const [seenPrefill, setSeenPrefill] = useState(prefill);
  if (prefill !== seenPrefill) {
    setSeenPrefill(prefill);
    if (prefill) {
      setDescription(prefill.description);
      setQuantity(String(prefill.quantity));
      setPrice(prefill.unit_price);
      setMoneyKey((k) => k + 1);
    }
  }

  function pickService(id: string) {
    const svc = services.find((s) => s.id === id) ?? null;
    setServiceId(id);
    onServiceChange?.(svc);
    if (svc) {
      setDescription(svc.name);
      setPrice(Number(svc.default_price) || 0);
      setCost(Number(svc.default_cost ?? 0) || 0);
      setTaxId(serviceTaxRateId(svc) ?? fallbackTax);
      setMoneyKey((k) => k + 1);
    }
  }

  const qty = Number(quantity) || 0;
  const disc = Math.min(100, Math.max(0, Number(discount) || 0));
  const gross = qty * price;
  const discAmount = Math.round(gross * (disc / 100) * 100) / 100;
  const base = gross - discAmount;
  const rate = taxRates.find((r) => r.id === taxId)?.rate ?? 0;
  const tax = Math.round(base * (Number(rate) / 100) * 100) / 100;
  const total = base + tax;
  // Precio unitario después del descuento (para el margen estimado).
  const net = price * (1 - disc / 100);
  const selected = services.find((s) => s.id === serviceId) ?? null;
  const unit = selected?.unit;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Qué se vende */}
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <SearchSelect
          label="Producto o servicio"
          name="service_id"
          options={serviceOptions(services)}
          value={serviceId}
          onChange={(value) => pickService(value)}
          emptyLabel="Línea libre (sin catálogo)"
          placeholder="Buscar: pantalla, catering, producción…"
          hint={
            selected
              ? `${one(selected.service_categories)?.name ?? "Sin categoría"}${unit ? ` · por ${unit}` : ""}`
              : `${services.length} en el catálogo. Escribe parte del nombre, con o sin tildes.`
          }
        />
        <Input
          label="Descripción (sale en el documento)"
          name="description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. Pantalla LED 3×2 m con operador"
          hint="Se llena con el nombre del servicio; puedes detallarla."
        />
      </div>

      {/* 2. Cantidad, precio, descuento e impuesto */}
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-4">
        <Input
          label={unit ? `Cantidad (${unit})` : "Cantidad"}
          name="quantity"
          type="number"
          step="any"
          min="0.01"
          info="Las flechas suben y bajan de 1 en 1 (números enteros). Si hace falta una fracción, escríbela a mano (ej. 1.5 horas)."
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <MoneyInput
          key={`price-${moneyKey}`}
          label={`Precio unitario (${currency})`}
          name="unit_price"
          defaultValue={price}
          onValueChange={setPrice}
        />
        <Input
          label="Descuento (%)"
          name="discount_percent"
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
        <Select
          label="Impuesto"
          name="tax_rate_id"
          required
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          info="Sale del catálogo de Configuración → Impuestos. Si el servicio tiene uno propio, se usa ese; si no, el predeterminado."
        >
          {taxRates.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>

      {/* 3. Vista previa (+ costo interno en cotizaciones) */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-background/60 p-3 sm:flex-row sm:items-end sm:justify-between">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-brand-muted">Importe</dt>
            <dd className="tabular-nums">{fmt(gross, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Descuento</dt>
            <dd className="tabular-nums">{discAmount ? `−${fmt(discAmount, currency)}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Impuesto</dt>
            <dd className="tabular-nums">{fmt(tax, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-brand-muted">Total de la línea</dt>
            <dd className="font-semibold tabular-nums text-brand-text">{fmt(total, currency)}</dd>
          </div>
        </dl>
        {showCost && (
          <div className="sm:w-56">
            <MoneyInput
              key={`cost-${moneyKey}`}
              label="Costo unitario estimado"
              name="estimated_unit_cost"
              defaultValue={cost}
              onValueChange={setCost}
              hint={
                cost > 0 && net > 0
                  ? `Margen estimado ${Math.round(((net - cost) / net) * 100)}% · no lo ve el cliente`
                  : "Interno: para el margen. No lo ve el cliente."
              }
            />
          </div>
        )}
      </div>
      {!services.length && (
        <p className="flex items-center gap-1.5 text-xs text-brand-muted">
          <Package size={13} /> No hay productos ni servicios activos: agrégalos en Productos y servicios.
          <InfoHint text="Mientras tanto puedes escribir una línea libre." />
        </p>
      )}
    </div>
  );
}
