import { createClient } from "@/lib/supabase/server";
import {
  BANK_DETAIL_OPTION_COLUMNS,
  suggestedAccountIds,
  toBankDetails,
  type BankDetail,
  type BankDetailOption,
} from "./bank-details";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Cuentas de banco activas marcadas "Mostrar en facturas" (nunca tarjetas). */
export async function listBankDetailOptions(supabase?: Supabase): Promise<BankDetailOption[]> {
  const client = supabase ?? (await createClient());
  const { data, error } = await client
    .from("bank_accounts")
    .select(BANK_DETAIL_OPTION_COLUMNS)
    .eq("is_active", true)
    .eq("type", "BANK")
    .eq("show_on_invoices", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as BankDetailOption[];
}

/**
 * Copia congelada para un documento.
 * - ids = lista elegida por el usuario (se validan contra las permitidas).
 * - ids = null → sugerencia: las cuentas marcadas en la moneda del documento.
 */
export async function buildBankDetails(
  supabase: Supabase,
  companyId: string,
  ids: string[] | null,
  currency: string,
  /** Duplicar: se omiten en silencio las cuentas que ya no se pueden usar. */
  lenient = false,
): Promise<{ details: BankDetail[]; error: string | null }> {
  const options = await listBankDetailOptions(supabase);
  const wanted = ids ?? suggestedAccountIds(options, currency);
  const chosen = options.filter((o) => wanted.includes(o.id));
  if (ids && !lenient && chosen.length !== new Set(ids).size) {
    return {
      details: [],
      error: "Una de las cuentas ya no se puede usar en facturas (está inactiva o se desmarcó en Bancos). Recarga la página.",
    };
  }
  if (chosen.length === 0) return { details: [], error: null };
  const { data: company } = await supabase
    .from("companies")
    .select("name, legal_name, tax_id")
    .eq("id", companyId)
    .single();
  // Mismo orden en que se marcaron en la lista (por nombre de cuenta).
  return { details: toBankDetails(chosen, company ?? null), error: null };
}
