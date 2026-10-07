"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds, getCurrentUser } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { currencySchema, currencySettingsSchema, describeRate, exchangeRateSchema } from "./schema";

export type CurrencyActionState = {
  error: string | null;
  /** Campo con el problema, para mostrar el mensaje debajo de él. */
  field?: string;
  success?: string;
  successId?: number;
};

const PATH = "/settings/currencies";

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

async function getFunctionalCurrency(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, companyId: string) {
  const { data } = await supabase.from("companies").select("base_currency").eq("id", companyId).single();
  return data?.base_currency ?? "DOP";
}

/** Agregar una moneda al catálogo (ej. EUR). */
export async function createCurrencyAction(
  _prev: CurrencyActionState,
  formData: FormData,
): Promise<CurrencyActionState> {
  await requirePermission("settings.manage");
  const parsed = currencySchema.safeParse({
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    symbol: String(formData.get("symbol") ?? ""),
    decimals: String(formData.get("decimals") ?? "2"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("currencies")
    .insert({ company_id: companyId, ...parsed.data })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: `La moneda ${parsed.data.code} ya está en el catálogo. Si está inactiva, actívala.` };
    return { error: error.message };
  }
  await logAudit({ companyId, action: "CREATE", entityType: "currency", entityId: data.id, newValues: parsed.data });
  revalidatePath(PATH);
  return { error: null, success: `Moneda ${parsed.data.code} agregada.`, successId: Date.now() };
}

/**
 * Activar / desactivar una moneda. No se puede desactivar la moneda
 * funcional ni una moneda con cuentas activas. Desactivarla solo la quita
 * de las listas para documentos nuevos: lo ya registrado no cambia.
 */
export async function toggleCurrencyActiveAction(currencyId: string): Promise<void> {
  await requirePermission("settings.manage");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data: cur, error } = await supabase
    .from("currencies")
    .select("code, is_active")
    .eq("id", currencyId)
    .single();
  if (error || !cur) throw new Error("Moneda no encontrada.");

  if (cur.is_active) {
    const functional = await getFunctionalCurrency(supabase, companyId);
    if (cur.code === functional) {
      throw new Error(`${cur.code} es la moneda funcional de la empresa: no se puede desactivar.`);
    }
    const { count } = await supabase
      .from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("currency", cur.code)
      .eq("is_active", true);
    if ((count ?? 0) > 0) {
      throw new Error(`Hay ${count} cuenta(s) activa(s) en ${cur.code}. Desactívalas primero en Bancos.`);
    }
  }

  const { error: upError } = await supabase.from("currencies").update({ is_active: !cur.is_active }).eq("id", currencyId);
  if (upError) throw new Error(upError.message);
  await logAudit({
    companyId,
    action: cur.is_active ? "DEACTIVATE" : "ACTIVATE",
    entityType: "currency",
    entityId: currencyId,
    oldValues: { code: cur.code, is_active: cur.is_active },
    newValues: { code: cur.code, is_active: !cur.is_active },
  });
  revalidatePath(PATH);
}

/**
 * Borrar una moneda del catálogo. Solo si nunca se usó (función
 * `delete_currency`, migración 079): si ya tiene cuentas, documentos o
 * movimientos se explica y se sugiere desactivarla. Sus tasas de
 * referencia se borran con ella.
 */
export async function deleteCurrencyAction(currencyId: string): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.rpc("delete_currency", { p_currency_id: currencyId });
  if (error) {
    const m = error.message;
    if (m.includes("currency_in_use")) {
      const detail = m.slice(m.indexOf("currency_in_use:") + 16).trim();
      throw new Error(
        detail.includes("funcional")
          ? `No se puede borrar: ${detail}.`
          : `No se puede borrar porque ${detail}. Si ya no la vas a usar, desactívala: deja de salir en las listas y lo registrado no cambia.`,
      );
    }
    if (m.includes("currency_not_found")) throw new Error("La moneda ya no existe. Recarga la página.");
    if (m.includes("Could not find the function") || m.includes("does not exist")) {
      throw new Error("Falta activar el borrado de monedas en la base de datos (migración 079). Avísale al administrador.");
    }
    throw new Error(m);
  }
  revalidatePath(PATH);
}

/** Fuente de la tasa de referencia y tolerancia de redondeo. */
export async function updateCurrencySettingsAction(
  _prev: CurrencyActionState,
  formData: FormData,
): Promise<CurrencyActionState> {
  await requirePermission("settings.manage");
  const parsed = currencySettingsSchema.safeParse({
    reference_rate_source: String(formData.get("reference_rate_source") ?? "MANUAL"),
    reference_source_name: String(formData.get("reference_source_name") ?? ""),
    rounding_tolerance: String(formData.get("rounding_tolerance") ?? "1"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Datos inválidos.", field: issue?.path?.[0] ? String(issue.path[0]) : undefined };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const user = await getCurrentUser();
  const { data: before } = await supabase
    .from("currency_settings")
    .select("reference_rate_source, reference_source_name, rounding_tolerance")
    .eq("company_id", companyId)
    .maybeSingle();
  const values = {
    reference_rate_source: parsed.data.reference_rate_source,
    reference_source_name: parsed.data.reference_source_name || null,
    rounding_tolerance: parsed.data.rounding_tolerance,
    updated_by: user?.id ?? null,
  };
  const { error } = await supabase
    .from("currency_settings")
    .upsert({ company_id: companyId, ...values }, { onConflict: "company_id" });
  if (error) return { error: error.message };
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "currency_settings",
    entityId: companyId,
    oldValues: before ?? undefined,
    newValues: values,
  });
  revalidatePath(PATH);
  return { error: null, success: "Configuración guardada.", successId: Date.now() };
}

/**
 * Registrar la tasa de referencia de una moneda para una fecha. Si ya hay
 * una para esa moneda y fecha, se reemplaza (queda en Auditoría con la
 * anterior). Las operaciones ya registradas guardan su propia tasa y no
 * cambian.
 */
export async function saveExchangeRateAction(
  _prev: CurrencyActionState,
  formData: FormData,
): Promise<CurrencyActionState> {
  await requirePermission("settings.manage");
  const parsed = exchangeRateSchema.safeParse({
    currency_code: String(formData.get("currency_code") ?? ""),
    effective_date: String(formData.get("effective_date") ?? ""),
    rate_to_base: String(formData.get("rate_to_base") ?? ""),
    source: String(formData.get("source") ?? "MANUAL"),
    source_name: String(formData.get("source_name") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const functional = await getFunctionalCurrency(supabase, companyId);
  if (d.currency_code === functional) {
    return { error: `${functional} es la moneda funcional: su tasa siempre es 1.` };
  }
  const { data: cur } = await supabase
    .from("currencies")
    .select("is_active")
    .eq("code", d.currency_code)
    .maybeSingle();
  if (!cur?.is_active) return { error: `La moneda ${d.currency_code} no está activa en el catálogo.` };

  const { data: existing } = await supabase
    .from("exchange_rates")
    .select("id, rate_to_base, source")
    .eq("currency_code", d.currency_code)
    .eq("effective_date", d.effective_date)
    .maybeSingle();
  const user = await getCurrentUser();
  const values = {
    rate_to_base: d.rate_to_base,
    source: d.source,
    source_name: d.source_name || null,
    notes: d.notes || null,
  };

  let id: string;
  if (existing) {
    const { error } = await supabase.from("exchange_rates").update(values).eq("id", existing.id);
    if (error) return { error: error.message };
    id = existing.id;
  } else {
    const { data, error } = await supabase
      .from("exchange_rates")
      .insert({
        company_id: companyId,
        currency_code: d.currency_code,
        effective_date: d.effective_date,
        created_by: user?.id ?? null,
        ...values,
      })
      .select("id")
      .single();
    if (error) {
      if (error.message.includes("exchange_rates_source_check")) {
        return { error: "Falta aplicar la segunda parte de la migración 075 en la base de datos (fuentes de tasa)." };
      }
      return { error: error.message };
    }
    id = data.id;
  }

  await logAudit({
    companyId,
    action: existing ? "UPDATE" : "CREATE",
    entityType: "exchange_rate",
    entityId: id,
    oldValues: existing ? { rate_to_base: existing.rate_to_base, source: existing.source } : undefined,
    newValues: { currency_code: d.currency_code, effective_date: d.effective_date, ...values },
  });
  revalidatePath(PATH);
  return {
    error: null,
    success: `${existing ? "Tasa actualizada" : "Tasa guardada"}: ${describeRate(d.currency_code, d.rate_to_base, functional)} (${d.effective_date}).`,
    successId: Date.now(),
  };
}

/** Borrar una tasa de referencia (no afecta operaciones ya registradas: cada una guarda su tasa). */
export async function deleteExchangeRateAction(rateId: string): Promise<void> {
  await requirePermission("settings.manage");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("exchange_rates")
    .select("currency_code, effective_date, rate_to_base, source")
    .eq("id", rateId)
    .maybeSingle();
  const { error } = await supabase.from("exchange_rates").delete().eq("id", rateId);
  if (error) throw new Error(error.message);
  await logAudit({ companyId, action: "DELETE", entityType: "exchange_rate", entityId: rateId, oldValues: before ?? undefined });
  revalidatePath(PATH);
}
