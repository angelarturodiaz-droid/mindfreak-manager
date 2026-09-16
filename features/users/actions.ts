"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { createUserSchema } from "./schema";

export type ActionState = { error: string | null };

async function getPrimaryCompanyId(): Promise<string> {
  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) {
    throw new Error("Tu usuario no está asignado a ninguna compañía.");
  }
  return companyIds[0];
}

/**
 * Crea un usuario directamente (sin correo de invitación) con la
 * contraseña que se le indique, y le asigna uno o más roles. Usa la
 * Secret Key de Supabase (API de administración de Auth) — ver
 * lib/supabase/admin.ts. El usuario queda activo de inmediato, sin pasar
 * por confirmación de correo (email_confirm: true).
 */
export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("users.manage");

  const parsed = createUserSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role_ids: formData.getAll("role_ids").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const companyId = await getPrimaryCompanyId();

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo inicializar el cliente admin." };
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (createError || !created.user) {
    return { error: createError?.message ?? "No se pudo crear el usuario." };
  }

  const newUserId = created.user.id;
  const supabase = await createSupabaseClient();

  // El trigger de F1 crea la fila en profiles automáticamente al crearse el
  // auth.users — solo hace falta completar el nombre (el trigger solo
  // conoce el email en ese momento).
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name })
    .eq("id", newUserId);
  if (profileError) return { error: profileError.message };

  const { error: rolesError } = await supabase.from("user_roles").insert(
    parsed.data.role_ids.map((roleId) => ({
      user_id: newUserId,
      role_id: roleId,
      company_id: companyId,
    })),
  );
  if (rolesError) return { error: rolesError.message };

  await logAudit({
    companyId,
    action: "CREATE",
    entityType: "user",
    entityId: newUserId,
    newValues: { email: parsed.data.email, full_name: parsed.data.full_name, role_ids: parsed.data.role_ids },
  });

  revalidatePath("/settings/users");
  return { error: null };
}

export async function updateUserNameAction(userId: string, fullName: string): Promise<void> {
  await requirePermission("users.manage");
  if (!fullName.trim()) throw new Error("El nombre no puede quedar vacío.");

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "user",
    entityId: userId,
    newValues: { full_name: fullName.trim() },
  });

  revalidatePath("/settings/users");
}

export async function toggleUserActiveAction(userId: string, currentlyActive: boolean): Promise<void> {
  await requirePermission("users.manage");
  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: !currentlyActive })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: currentlyActive ? "DEACTIVATE" : "ACTIVATE",
    entityType: "user",
    entityId: userId,
    newValues: { is_active: !currentlyActive },
  });

  revalidatePath("/settings/users");
}

/**
 * Reemplaza por completo los roles de un usuario (dentro de esta
 * compañía) por la lista dada.
 */
export async function updateUserRolesAction(userId: string, roleIds: string[]): Promise<void> {
  await requirePermission("users.manage");
  if (roleIds.length === 0) {
    throw new Error("Un usuario debe tener al menos un rol.");
  }

  const companyId = await getPrimaryCompanyId();
  const supabase = await createSupabaseClient();

  const { error: deleteError } = await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (deleteError) throw new Error(deleteError.message);

  const { error: insertError } = await supabase.from("user_roles").insert(
    roleIds.map((roleId) => ({ user_id: userId, role_id: roleId, company_id: companyId })),
  );
  if (insertError) throw new Error(insertError.message);

  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "user",
    entityId: userId,
    newValues: { role_ids: roleIds },
  });

  revalidatePath("/settings/users");
}

/**
 * Prende/apaga un permiso de un rol. NOTA: los 5 roles base (ADMIN,
 * MANAGER, SALES, FINANCE, OPERATIONS) tienen company_id = null (son
 * plantillas globales, pensadas para reutilizarse entre compañías en el
 * futuro) — hoy con una sola compañía activa esto no es un problema
 * práctico, pero si en el futuro hay más de una compañía usando esta
 * misma instancia, editar aquí afectaría a todas. Documentado también en
 * MANUAL_NOTES.md.
 */
export async function toggleRolePermissionAction(
  roleId: string,
  permissionId: string,
  currentlyGranted: boolean,
): Promise<void> {
  await requirePermission("users.manage");
  const supabase = await createSupabaseClient();

  if (currentlyGranted) {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .insert({ role_id: roleId, permission_id: permissionId });
    if (error) throw new Error(error.message);
  }

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "role_permission",
    entityId: roleId,
    newValues: { permission_id: permissionId, granted: !currentlyGranted },
  });

  revalidatePath("/settings/roles");
}
