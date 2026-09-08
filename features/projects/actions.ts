"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { projectHeaderSchema, projectItemSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

async function generateProjectNumber(companyId: string): Promise<string> {
  const supabase = await createSupabaseClient();
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return `PROJ-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

function parseHeaderFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    client_id: String(formData.get("client_id") ?? ""),
    contact_id: String(formData.get("contact_id") ?? ""),
    manager_id: String(formData.get("manager_id") ?? ""),
    event_date: String(formData.get("event_date") ?? ""),
    event_time: String(formData.get("event_time") ?? ""),
    location_name: String(formData.get("location_name") ?? ""),
    address: String(formData.get("address") ?? ""),
    budget: String(formData.get("budget") ?? "0"),
    notes: String(formData.get("notes") ?? ""),
  };
}

/** Crear un proyecto directo, sin cotización previa (la arquitectura lo permite). */
export async function createProjectAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("projects.create");

  const parsed = projectHeaderSchema.safeParse(parseHeaderFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();
  const number = await generateProjectNumber(companyId);
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      company_id: companyId,
      client_id: parsed.data.client_id,
      contact_id: parsed.data.contact_id || null,
      manager_id: parsed.data.manager_id || null,
      number,
      name: parsed.data.name,
      event_date: parsed.data.event_date || null,
      event_time: parsed.data.event_time || null,
      location_name: parsed.data.location_name || null,
      address: parsed.data.address || null,
      budget: parsed.data.budget,
      notes: parsed.data.notes || null,
      status: "PLANNING",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "project",
    entityId: data.id,
    newValues: parsed.data,
  });

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

/**
 * Convertir una cotización APPROVED en un proyecto, copiando cliente/contacto
 * e items → project_items, sin reintroducir datos manualmente.
 * Ver F0-Arquitectura, sección O (Flujo Central) y 13 del prompt maestro.
 */
export async function convertQuotationToProjectAction(
  quotationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("projects.create");

  const parsed = projectHeaderSchema
    .pick({
      manager_id: true,
      event_date: true,
      event_time: true,
      location_name: true,
      address: true,
      budget: true,
      notes: true,
    })
    .safeParse({
      manager_id: String(formData.get("manager_id") ?? ""),
      event_date: String(formData.get("event_date") ?? ""),
      event_time: String(formData.get("event_time") ?? ""),
      location_name: String(formData.get("location_name") ?? ""),
      address: String(formData.get("address") ?? ""),
      budget: String(formData.get("budget") ?? "0"),
      notes: String(formData.get("notes") ?? ""),
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();

  const { data: quotation, error: qError } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .single();
  if (qError || !quotation) {
    return { error: qError?.message ?? "Cotización no encontrada." };
  }
  if (quotation.status !== "APPROVED") {
    return { error: "Solo se puede convertir una cotización APROBADA." };
  }
  if (quotation.project_id) {
    return { error: "Esta cotización ya fue convertida en un proyecto." };
  }

  const { data: quotationItems, error: itemsError } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId);
  if (itemsError) return { error: itemsError.message };

  const companyId = quotation.company_id as string;
  const number = await generateProjectNumber(companyId);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      company_id: companyId,
      client_id: quotation.client_id,
      contact_id: quotation.contact_id,
      quotation_id: quotation.id,
      manager_id: parsed.data.manager_id || null,
      number,
      name: `Evento — ${quotation.number}`,
      event_date: parsed.data.event_date || null,
      event_time: parsed.data.event_time || null,
      location_name: parsed.data.location_name || null,
      address: parsed.data.address || null,
      budget: parsed.data.budget,
      notes: parsed.data.notes || null,
      status: "PLANNING",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return { error: projectError?.message ?? "No se pudo crear el proyecto." };
  }

  // Copiar items de la cotización → project_items (sin reintroducir datos)
  if (quotationItems && quotationItems.length > 0) {
    const projectItemsPayload = quotationItems.map((item, index) => ({
      project_id: project.id,
      service_id: item.service_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      estimated_cost: item.quantity * item.estimated_unit_cost,
      subtotal: item.subtotal,
      sort_order: index,
    }));
    const { error: insertItemsError } = await supabase
      .from("project_items")
      .insert(projectItemsPayload);
    if (insertItemsError) return { error: insertItemsError.message };
  }

  // Vincular la cotización al proyecto recién creado
  const { error: linkError } = await supabase
    .from("quotations")
    .update({ project_id: project.id })
    .eq("id", quotationId);
  if (linkError) return { error: linkError.message };

  await logAudit({
    companyId,
    action: "CONVERT_FROM_QUOTATION",
    entityType: "project",
    entityId: project.id,
    newValues: { quotation_id: quotationId },
  });

  revalidatePath("/projects");
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${quotationId}`);
  redirect(`/projects/${project.id}`);
}

export async function updateProjectHeaderAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("projects.update");

  const parsed = projectHeaderSchema.safeParse(parseHeaderFields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createSupabaseClient();
  const { data: before } = await supabase
    .from("projects")
    .select("name, event_date, event_time, location_name, address, budget, notes, manager_id")
    .eq("id", projectId)
    .single();

  const { error } = await supabase
    .from("projects")
    .update({
      name: parsed.data.name,
      manager_id: parsed.data.manager_id || null,
      event_date: parsed.data.event_date || null,
      event_time: parsed.data.event_time || null,
      location_name: parsed.data.location_name || null,
      address: parsed.data.address || null,
      budget: parsed.data.budget,
      notes: parsed.data.notes || null,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "project",
    entityId: projectId,
    oldValues: before,
    newValues: parsed.data,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { error: null };
}

export async function updateProjectStatusAction(
  projectId: string,
  newStatus: string,
): Promise<void> {
  await requirePermission("projects.update");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("projects")
    .update({ status: newStatus })
    .eq("id", projectId);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: `STATUS_${newStatus}`,
    entityType: "project",
    entityId: projectId,
    newValues: { status: newStatus },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function addProjectItemAction(
  projectId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("projects.update");

  const parsed = projectItemSchema.safeParse({
    service_id: String(formData.get("service_id") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: String(formData.get("quantity") ?? "1"),
    unit_price: String(formData.get("unit_price") ?? "0"),
    estimated_cost: String(formData.get("estimated_cost") ?? "0"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const subtotal = parsed.data.quantity * parsed.data.unit_price;
  const estimatedCost = parsed.data.quantity * parsed.data.estimated_cost;
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("project_items").insert({
    project_id: projectId,
    service_id: parsed.data.service_id || null,
    description: parsed.data.description,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unit_price,
    estimated_cost: estimatedCost,
    subtotal,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function deleteProjectItemAction(
  itemId: string,
  projectId: string,
): Promise<void> {
  await requirePermission("projects.update");
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("project_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}
