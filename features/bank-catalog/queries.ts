import { createClient } from "@/lib/supabase/server";
import { resolveBankBrand, type BankBrand } from "./branding";

export async function listBankCatalog(onlyActive = true) {
  const supabase = await createClient();
  let query = supabase.from("bank_catalog").select("id, name, is_active").order("name");
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

/** Catálogo con color y logo (Configuración → Catálogo de bancos). */
export async function listBankCatalogWithBrand() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_catalog")
    .select("id, name, is_active, brand_color, logo_data")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((b) => ({ ...b, brand: resolveBankBrand(b.name, b) }));
}

/**
 * Nombre del banco → su marca (color/logo), para pintar cuentas y tarjetas.
 * Bancos que no estén en el catálogo igual reciben iniciales.
 */
export async function getBankBrands(): Promise<(bankName: string | null | undefined) => BankBrand | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("bank_catalog").select("name, brand_color, logo_data");
  const byName = new Map((data ?? []).map((b) => [b.name, b]));
  return (bankName) => resolveBankBrand(bankName, bankName ? byName.get(bankName) : null);
}
