"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { taxRateSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

export async function createTaxRateAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const parsed = taxRateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    rate: String(formData.get("rate") ?? "0"),
    is_default: formData.get("is_default") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  if (parsed.data.is_default) {
    await supabase
      .from("tax_rates")
      .update({ is_default: false })
      .eq("company_id", companyId)
      .eq("is_default", true);
  }

  const { error } = await supabase.from("tax_rates").insert({
    company_id: companyId,
    name: parsed.data.name,
    rate: parsed.data.rate,
    is_default: parsed.data.is_default,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings/tax-rates");
  return { error: null };
}

export async function setDefaultTaxRateAction(taxRateId: string): Promise<void> {
  await requirePermission("settings.manage");
  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  await supabase
    .from("tax_rates")
    .update({ is_default: false })
    .eq("company_id", companyId)
    .eq("is_default", true);

  const { error } = await supabase
    .from("tax_rates")
    .update({ is_default: true })
    .eq("id", taxRateId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/tax-rates");
}

export async function toggleTaxRateActiveAction(
  taxRateId: string,
  currentlyActive: boolean,
): Promise<void> {
  await requirePermission("settings.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("tax_rates")
    .update({ is_active: !currentlyActive })
    .eq("id", taxRateId);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/tax-rates");
}
