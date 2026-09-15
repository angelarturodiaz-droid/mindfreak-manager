"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { organizationSchema, systemSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

export async function updateOrganizationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const parsed = organizationSchema.safeParse({
    legal_name: String(formData.get("legal_name") ?? ""),
    tax_id: String(formData.get("tax_id") ?? ""),
    address: String(formData.get("address") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    base_currency: String(formData.get("base_currency") ?? "DOP"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("companies")
    .update({
      legal_name: parsed.data.legal_name || null,
      tax_id: parsed.data.tax_id || null,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      base_currency: parsed.data.base_currency,
    })
    .eq("id", companyId);
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "company",
    entityId: companyId,
    newValues: parsed.data,
  });

  revalidatePath("/settings/organization");
  return { error: null };
}

export async function updateSystemAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const parsed = systemSchema.safeParse({
    platform_name: String(formData.get("platform_name") ?? ""),
    brand_primary: String(formData.get("brand_primary") ?? ""),
    brand_accent: String(formData.get("brand_accent") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("companies")
    .update({
      platform_name: parsed.data.platform_name,
      brand_primary: parsed.data.brand_primary,
      brand_accent: parsed.data.brand_accent,
    })
    .eq("id", companyId);
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "company",
    entityId: companyId,
    newValues: parsed.data,
  });

  revalidatePath("/settings/system");
  revalidatePath("/", "layout"); // el nombre de plataforma se usa en el layout
  return { error: null };
}

const MAX_LOGO_BYTES = 3 * 1024 * 1024; // 3MB
const LOGO_SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 10; // ~10 años

export async function uploadLogoAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("settings.manage");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "El logo no puede superar 3MB." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "El archivo debe ser una imagen." };
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  // NOTA: el logo se guarda en el bucket 'documents' (privado, ya probado y
  // estable) dentro de una subcarpeta "branding/", en vez de en un bucket
  // público dedicado — hubo un problema real de RLS con buckets nuevos que
  // no se pudo resolver a nivel de política tras una investigación extensa;
  // esta es la solución estable mientras tanto. Como el bucket es privado,
  // se usa un link firmado de larga duración (~10 años) en vez de una URL
  // pública directa.
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${companyId}/branding/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) return { error: uploadError.message };

  const { data: signedData, error: signError } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, LOGO_SIGNED_URL_SECONDS);
  if (signError || !signedData) {
    return { error: signError?.message ?? "No se pudo generar el link del logo." };
  }
  const logoUrl = signedData.signedUrl;

  const { error } = await supabase
    .from("companies")
    .update({ logo_url: logoUrl })
    .eq("id", companyId);
  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "company",
    entityId: companyId,
    newValues: { logo_url: logoUrl },
  });

  revalidatePath("/settings/system");
  revalidatePath("/", "layout");
  return { error: null };
}
