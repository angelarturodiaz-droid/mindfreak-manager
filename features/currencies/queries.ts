import { createClient } from "@/lib/supabase/server";
import type { RateSource } from "./schema";

export type Currency = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  is_active: boolean;
};

/** Catálogo de monedas (Configuración → Monedas y tasas). */
export async function listCurrencies(onlyActive = true): Promise<Currency[]> {
  const supabase = await createClient();
  let query = supabase.from("currencies").select("id, code, name, symbol, decimals, is_active").order("code");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Currency[];
}

/** Opciones para los selectores de moneda: la funcional primero, luego el resto por código. */
export async function listCurrencyOptions(functional?: string): Promise<{ code: string; name: string }[]> {
  const list = await listCurrencies(true);
  return [...list]
    .sort((a, b) => (a.code === functional ? -1 : b.code === functional ? 1 : a.code.localeCompare(b.code)))
    .map((c) => ({ code: c.code, name: c.name }));
}

/**
 * Valida en el servidor que la moneda esté activa en el catálogo (además de
 * la moneda que ya tenía el registro, para poder editar documentos viejos
 * aunque su moneda se haya desactivado después).
 */
export async function isAllowedCurrency(code: string, keep?: string | null): Promise<boolean> {
  if (keep && code === keep) return true;
  const list = await listCurrencies(true);
  return list.some((c) => c.code === code);
}

export type CurrencySettings = {
  reference_rate_source: RateSource;
  reference_source_name: string | null;
  rounding_tolerance: number;
  updated_at: string | null;
};

export async function getCurrencySettings(): Promise<CurrencySettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("currency_settings")
    .select("reference_rate_source, reference_source_name, rounding_tolerance, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    reference_rate_source: (data?.reference_rate_source as RateSource) ?? "MANUAL",
    reference_source_name: data?.reference_source_name ?? null,
    rounding_tolerance: Number(data?.rounding_tolerance ?? 1),
    updated_at: data?.updated_at ?? null,
  };
}

export type ExchangeRateRow = {
  id: string;
  currency_code: string;
  rate_to_base: number;
  effective_date: string;
  source: string;
  source_name: string | null;
  notes: string | null;
  created_at: string;
};

/** Historial de tasas de referencia (más recientes primero). */
export async function listExchangeRates(limit = 60): Promise<ExchangeRateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("id, currency_code, rate_to_base, effective_date, source, source_name, notes, created_at")
    .order("effective_date", { ascending: false })
    .order("currency_code")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, rate_to_base: Number(r.rate_to_base) })) as ExchangeRateRow[];
}

/**
 * Tasa de referencia vigente para una moneda en una fecha: la del mismo día
 * o, si no hay, la más reciente anterior. null si nunca se registró. (La
 * usarán los pagos y cobros en moneda diferente — pasos 2 y 3 de V5.)
 */
export async function getReferenceRate(currencyCode: string, date: string): Promise<ExchangeRateRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("id, currency_code, rate_to_base, effective_date, source, source_name, notes, created_at")
    .eq("currency_code", currencyCode)
    .lte("effective_date", date)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? ({ ...data, rate_to_base: Number(data.rate_to_base) } as ExchangeRateRow) : null;
}

/** true si la empresa ya tiene documentos o movimientos (la moneda funcional ya no se puede cambiar). */
export async function hasFinancialActivity(): Promise<boolean> {
  const supabase = await createClient();
  const tables = ["bank_transactions", "invoices", "expenses", "quotations"] as const;
  const counts = await Promise.all(
    tables.map((t) => supabase.from(t).select("id", { count: "exact", head: true }).limit(1)),
  );
  return counts.some((r) => (r.count ?? 0) > 0);
}

/** Mensaje de error si la moneda no está activa en el catálogo (null si está bien). */
export async function currencyError(code: string, keep?: string | null): Promise<string | null> {
  return (await isAllowedCurrency(code, keep))
    ? null
    : `La moneda ${code} no está activa. Actívala en Configuración → Monedas y tasas.`;
}

/**
 * Regla de oro del banco (V5): mientras no estén los pagos/cobros en moneda
 * diferente (pasos 2–3), la cuenta debe estar en la moneda del documento.
 * Devuelve el mensaje para el usuario o null si coinciden. La base de datos
 * también lo impide (trigger de la migración 075).
 */
export async function accountCurrencyMismatch(
  accountId: string,
  documentCurrency: string,
  kind: "pago" | "cobro",
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("bank_accounts").select("name, currency").eq("id", accountId).maybeSingle();
  if (!data || data.currency === documentCurrency) return null;
  const plural = kind === "pago" ? "Los pagos" : "Los cobros";
  return `La cuenta «${data.name}» está en ${data.currency} y el documento en ${documentCurrency}. ${plural} desde una cuenta en una moneda diferente estarán disponibles cuando se habilite el módulo multimoneda.`;
}
