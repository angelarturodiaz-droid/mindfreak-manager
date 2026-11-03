"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds, hasPermission } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { resolveSupplierClassification } from "@/features/supplier-service-types/classification";
import {
  DIRECTORY_STATUS_LABELS,
  DIRECTORY_STATUSES,
  LINK_FIELDS,
  cleanLink,
  directoryErrorMessage,
  formatPriceText,
  invalidLinkMessage,
  type PriceCurrency,
  type DirectoryStatus,
} from "./schema";

export type DirectoryState = { error: string | null; success?: string; successId?: number; field?: string; errorId?: number };

async function companyId(): Promise<string> {
  const ids = await getCurrentUserCompanyIds();
  if (!ids.length) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  return ids[0];
}

function revalidateSupplier(id: string) {
  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/suppliers");
  revalidatePath("/directory");
}

/** Nuevo en el directorio: solo el nombre es obligatorio; entra como Prospecto (o el estado elegido). */
function priceFromForm(formData: FormData): string | null {
  const currency: PriceCurrency = formData.get("price_currency") === "USD" ? "USD" : "DOP";
  return formatPriceText(String(formData.get("reference_price") ?? ""), currency) || null;
}

export async function createDirectoryEntryAction(_prev: DirectoryState, formData: FormData): Promise<DirectoryState> {
  if (!(await hasPermission("suppliers.create"))) return { error: "No tienes permiso para agregar al directorio." };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Escribe el nombre (persona, grupo o lugar)." };
  const statusRaw = String(formData.get("directory_status") ?? "PROSPECTO");
  const status = (["PROSPECTO", "EVALUADO", "APROBADO"] as string[]).includes(statusRaw) ? statusRaw : "PROSPECTO";
  const supabase = await createClient();
  const cid = await companyId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const classification = await resolveSupplierClassification(
    supabase,
    cid,
    String(formData.get("category_id") ?? "") || null,
    String(formData.get("service_type_id") ?? "") || null,
  );
  if ("error" in classification) return { error: classification.error };
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      ...classification,
      company_id: cid,
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      zone_id: String(formData.get("zone_id") ?? "") || null,
      reference_price: priceFromForm(formData),
      directory_notes: String(formData.get("directory_notes") ?? "").trim() || null,
      directory_status: status,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: directoryErrorMessage(error?.message ?? "No se pudo guardar.") };
  await logAudit({ companyId: cid, action: "CREATE", entityType: "supplier", entityId: data.id, newValues: { name, directory_status: status } });
  revalidatePath("/directory");
  redirect(`/suppliers/${data.id}?tab=directorio&nuevo=1`);
}

/** Datos del Directorio en la ficha: zona, enlaces, precio, notas, calificación y etiquetas. */
export async function updateDirectoryInfoAction(supplierId: string, _prev: DirectoryState, formData: FormData): Promise<DirectoryState> {
  if (!(await hasPermission("suppliers.update"))) return { error: "No tienes permiso para editar." };
  const links: Record<string, string> = {};
  for (const f of LINK_FIELDS) {
    const raw = String(formData.get(`link_${f.key}`) ?? "");
    if (raw.trim()) {
      const clean = cleanLink(raw);
      if (!clean) return { error: invalidLinkMessage(f.label, f.example), field: `link_${f.key}`, errorId: Date.now() };
      links[f.key] = clean;
    }
  }
  const ratingRaw = Number(formData.get("rating") ?? 0);
  const rating = ratingRaw >= 1 && ratingRaw <= 5 ? Math.round(ratingRaw) : null;
  const tagIds = formData.getAll("tag_ids").map(String).filter(Boolean);
  const values = {
    zone_id: String(formData.get("zone_id") ?? "") || null,
    reference_price: priceFromForm(formData),
    directory_notes: String(formData.get("directory_notes") ?? "").trim() || null,
    rating,
    links,
  };
  const supabase = await createClient();
  const cid = await companyId();
  const { error } = await supabase.from("suppliers").update(values).eq("id", supplierId);
  if (error) return { error: directoryErrorMessage(error.message), errorId: Date.now() };
  // Etiquetas: se reemplazan por las marcadas.
  await supabase.from("supplier_tags").delete().eq("supplier_id", supplierId);
  if (tagIds.length) {
    const { error: tErr } = await supabase
      .from("supplier_tags")
      .insert(tagIds.map((t) => ({ supplier_id: supplierId, tag_id: t, company_id: cid })));
    if (tErr) return { error: directoryErrorMessage(tErr.message), errorId: Date.now() };
  }
  await logAudit({ companyId: cid, action: "UPDATE", entityType: "supplier", entityId: supplierId, newValues: { ...values, tags: tagIds.length } });
  revalidateSupplier(supplierId);
  return { error: null, success: "Datos del directorio guardados.", successId: Date.now() };
}

/** Mover de estado (Evaluado, Aprobado, Convertir en proveedor, Inactivo…). */
export async function setDirectoryStatusAction(supplierId: string, status: DirectoryStatus): Promise<DirectoryState> {
  if (!(await hasPermission("suppliers.update"))) return { error: "No tienes permiso para cambiar el estado." };
  if (!DIRECTORY_STATUSES.includes(status)) return { error: "Estado no válido." };
  const supabase = await createClient();
  const cid = await companyId();
  const { data: before } = await supabase.from("suppliers").select("directory_status").eq("id", supplierId).maybeSingle();
  const { error } = await supabase.from("suppliers").update({ directory_status: status }).eq("id", supplierId);
  if (error) return { error: directoryErrorMessage(error.message) };
  await logAudit({
    companyId: cid,
    action: status === "PROVEEDOR" ? "CONVERT_SUPPLIER" : "STATUS_CHANGE",
    entityType: "supplier",
    entityId: supplierId,
    oldValues: { directory_status: before?.directory_status ?? null },
    newValues: { directory_status: status },
  });
  revalidateSupplier(supplierId);
  return {
    error: null,
    success:
      status === "PROVEEDOR"
        ? "Listo: ya es proveedor y sale al registrar gastos. Si le vas a pagar, completa su RNC/cédula y su tipo fiscal."
        : `Estado cambiado a ${DIRECTORY_STATUS_LABELS[status]}.`,
    successId: Date.now(),
  };
}

/** Elegir la foto de portada de la tarjeta. */
export async function setCoverPhotoAction(supplierId: string, documentId: string): Promise<void> {
  if (!(await hasPermission("suppliers.update"))) throw new Error("No tienes permiso.");
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update({ cover_document_id: documentId }).eq("id", supplierId);
  if (error) throw new Error(error.message);
  revalidateSupplier(supplierId);
}

// ---------------------------------------------------------------------------
// Configuración → Directorio: zonas y etiquetas
// ---------------------------------------------------------------------------
type ListTable = "directory_zones" | "directory_tags";

export async function addListItemAction(table: ListTable, _prev: DirectoryState, formData: FormData): Promise<DirectoryState> {
  if (!(await hasPermission("settings.manage"))) return { error: "Solo Administración puede cambiar estas listas." };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Escribe el nombre." };
  const supabase = await createClient();
  const { error } = await supabase.from(table).insert({ company_id: await companyId(), name });
  if (error) return { error: directoryErrorMessage(error.message) };
  revalidatePath("/settings/directory");
  return { error: null, success: `«${name}» agregada.`, successId: Date.now() };
}

export async function deleteListItemAction(table: ListTable, id: string): Promise<void> {
  if (!(await hasPermission("settings.manage"))) throw new Error("Solo Administración puede cambiar estas listas.");
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(directoryErrorMessage(error.message));
  revalidatePath("/settings/directory");
}
