"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { sendMail } from "@/lib/mail/send";
import { reverifyAdminMfa } from "@/lib/mfa/admin-reverify";
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
 * Crea un usuario por INVITACIÓN — el admin solo pone nombre, correo y
 * rol(es); nunca le pone contraseña a otra cuenta. Supabase manda el
 * correo real de invitación (plantilla "Invite user" en el dashboard,
 * configurada para apuntar a /auth/confirm?type=invite → /update-password,
 * igual que se hizo con "Reset password" — ver F0-Arquitectura y
 * CHANGELOG.md) y la persona elige su propia contraseña al aceptar.
 *
 * Se cambió del modelo anterior (el admin creaba la cuenta con una
 * contraseña temporal que él mismo inventaba) por dos razones: el admin
 * nunca debería conocer la contraseña real de otra cuenta, y este camino
 * SÍ confirma que el correo existe de verdad (si hay un typo, la
 * invitación nunca se acepta y la cuenta queda visiblemente pendiente,
 * en vez de creada con una contraseña que nadie puede usar).
 */
export async function createUserAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("users.manage");

  const parsed = createUserSchema.safeParse({
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
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

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host")}`;

  const { data: created, error: createError } = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name },
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });
  if (createError || !created.user) {
    return { error: createError?.message ?? "No se pudo invitar al usuario." };
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

export async function resetUserPasswordAction(userId: string, newPassword: string): Promise<void> {
  await requirePermission("users.manage");
  if (newPassword.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) throw new Error(error.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "user",
    entityId: userId,
    newValues: { passwordReset: true },
  });
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
 * Elimina una cuenta por completo (auth.users + profiles, vía ON DELETE
 * CASCADE de profiles.id → auth.users.id) — a diferencia de
 * toggleUserActiveAction, esto no se puede deshacer. Pide re-verificar
 * el MFA del admin, igual que updateUserEmailAction (ver
 * lib/mfa/admin-reverify.ts), y nunca deja que un admin se elimine a sí
 * mismo por aquí.
 *
 * OJO: muchas tablas de negocio (facturas, gastos, cotizaciones,
 * clientes, proveedores, documentos, aprobaciones, etc.) referencian
 * profiles vía created_by/approved_by/uploaded_by con NO ACTION en el
 * DELETE — a propósito, para nunca perder ese rastro en silencio ni
 * arrastrar esos registros al borrar un usuario. Si la cuenta alguna vez
 * creó algo en el sistema, este borrado falla con un error de la base de
 * datos en vez de completarse a medias — en ese caso hay que usar
 * "Desactivar" en vez de eliminar.
 *
 * Además, ninguna cuenta con rol ADMIN se puede eliminar nunca, tenga o
 * no actividad registrada — es la única forma de no quedarse sin nadie
 * que administre el sistema por un borrado accidental (o de un admin
 * eliminando a otro). Para un admin que ya no debe tener acceso, la
 * única vía es "Desactivar" (o quitarle el rol ADMIN primero).
 */
export async function deleteUserAction(userId: string, mfaCode: string): Promise<void> {
  await requirePermission("users.manage");

  const supabase = await createSupabaseClient();
  const adminUser = await reverifyAdminMfa(supabase, mfaCode);

  if (adminUser.id === userId) {
    throw new Error("No puedes eliminar tu propia cuenta desde aquí.");
  }

  const { data: targetRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", userId);
  if (rolesError) throw new Error(rolesError.message);
  const isAdmin = (targetRoles ?? []).some((row) => {
    const roleData = row.roles as { name: string } | { name: string }[] | null;
    const r = Array.isArray(roleData) ? roleData[0] : roleData;
    return r?.name === "ADMIN";
  });
  if (isAdmin) {
    throw new Error(
      "No se puede eliminar una cuenta con rol Administrador. Usa \"Desactivar\", o quítale el rol de Administrador primero.",
    );
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    // El mensaje que llega aquí NO siempre trae el texto real de Postgres
    // ("violates foreign key constraint") — confirmado revisando los logs
    // de Auth en vivo: la API de administración de Supabase a veces lo
    // envuelve en uno genérico ("Database error deleting user", código
    // unexpected_failure) y esconde el motivo real. Como la única causa
    // conocida de que deleteUser falle a esta altura (ya se descartó ser
    // Administrador) es que la cuenta tiene actividad registrada, se trata
    // cualquier error de este paso como ese caso — nunca se le muestra al
    // admin un mensaje crudo de base de datos.
    console.error("deleteUserAction: fallo al eliminar", userId, error);
    throw new Error(
      "No se puede eliminar: este usuario ya tiene actividad registrada en el sistema (facturas, gastos, clientes, etc.). Usa \"Desactivar\" en vez de eliminar.",
    );
  }

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "DELETE",
    entityType: "user",
    entityId: userId,
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

export async function updateUserEmailAction(
  userId: string,
  newEmail: string,
  mfaCode: string,
): Promise<{ notified: boolean }> {
  await requirePermission("users.manage");

  const trimmed = newEmail.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("Correo inválido.");
  }

  // Paso extra de seguridad, a pedido explícito (no es lo que exige
  // Supabase por defecto): cambiar el correo de OTRO usuario equivale a
  // poder tomar el control de su cuenta (la próxima recuperación de
  // contraseña, por ejemplo, llegaría a la dirección nueva) — así que se
  // le exige al ADMIN que hace el cambio volver a verificar su propio
  // autenticador justo antes de aplicarlo. Ver lib/mfa/admin-reverify.ts.
  const supabase = await createSupabaseClient();
  const adminUser = await reverifyAdminMfa(supabase, mfaCode);

  const adminClient = createAdminClient();

  // IMPORTANTE — por qué antes "no llegaba el correo": el endpoint de
  // administración de Supabase (updateUserById) NO es el mismo flujo que
  // usa un usuario para cambiar su propio correo, y tampoco dispara la
  // notificación de seguridad "Email address changed" aunque esté
  // activada en el dashboard — se confirmó revisando los logs de Auth en
  // vivo: al cambiar un correo por esta vía no hay NINGÚN intento de
  // envío, exista o no esa notificación. Esa notificación solo corre
  // cuando el propio usuario cambia su correo con su sesión
  // (supabase.auth.updateUser). Por eso el aviso al correo anterior lo
  // manda esta misma app directo, por su cuenta — ver lib/mail/send.ts y
  // CHANGELOG.md para el detalle completo.
  const { data: previousUser } = await adminClient.auth.admin.getUserById(userId);
  const previousEmail = previousUser?.user?.email ?? null;

  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    email: trimmed,
    email_confirm: true,
  });
  if (authError) throw new Error(authError.message);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email: trimmed })
    .eq("id", userId);
  if (profileError) throw new Error(profileError.message);

  const companyId = await getPrimaryCompanyId();
  await logAudit({
    companyId,
    action: "UPDATE",
    entityType: "user",
    entityId: userId,
    newValues: { email: trimmed },
  });

  revalidatePath("/settings/users");

  // El cambio ya se aplicó — si este aviso falla (SMTP no configurado,
  // correo anterior inválido, etc.), no se revierte nada; solo se le
  // informa al admin en la UI para que avise manualmente si hace falta.
  let notified = false;
  if (previousEmail && previousEmail !== trimmed) {
    notified = await sendMail({
      to: previousEmail,
      subject: "Tu correo de acceso a Mindfreak Manager cambió",
      html: `
        <p>El correo de acceso de tu cuenta en Mindfreak Manager cambió de <strong>${previousEmail}</strong> a <strong>${trimmed}</strong>.</p>
        <p>Lo hizo un administrador (${adminUser.email}) desde el panel de Usuarios.</p>
        <p>Si no reconoces este cambio, contacta a un administrador de inmediato.</p>
      `,
    });
  }

  return { notified };
}

/**
 * Reenvía la invitación a un usuario que todavía no la ha aceptado.
 * `supabase.auth.resend()` NO soporta type "invite" (solo "signup" y
 * "email_change" — ver tipos de @supabase/auth-js), así que el reenvío
 * real es volver a llamar inviteUserByEmail(): para un usuario que ya
 * existe pero sigue sin confirmar, Supabase actualiza la invitación y
 * reenvía el correo en vez de dar error de "ya existe".
 */
export async function resendEmailVerificationAction(email: string): Promise<void> {
  await requirePermission("users.manage");

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "No se pudo inicializar el cliente admin.");
  }

  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("host")}`;

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/update-password`,
  });
  if (error) throw new Error(error.message);
}
