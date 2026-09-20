"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { sendMail } from "@/lib/mail/send";
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

  const code = mfaCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Escribe el código de 6 dígitos de tu autenticador.");
  }

  // Paso extra de seguridad, a pedido explícito (no es lo que exige
  // Supabase por defecto): cambiar el correo de OTRO usuario equivale a
  // poder tomar el control de su cuenta (la próxima recuperación de
  // contraseña, por ejemplo, llegaría a la dirección nueva) — así que se
  // le exige al ADMIN que hace el cambio volver a verificar su propio
  // autenticador justo antes de aplicarlo, aunque su sesión ya esté en
  // aal2 desde el login. No basta con mirar getAuthenticatorAssuranceLevel()
  // (eso solo confirma que se verificó AL INICIAR SESIÓN, no en este
  // instante) — se hace un challenge+verify nuevo contra el factor TOTP
  // del propio admin, con el código que mandó desde el formulario.
  const supabase = await createSupabaseClient();
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();
  if (!adminUser) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");

  const { data: adminFactors, error: adminFactorsError } = await supabase.auth.mfa.listFactors();
  if (adminFactorsError) throw new Error(adminFactorsError.message);
  const adminFactor = adminFactors.totp.find((f) => f.status === "verified");
  if (!adminFactor) {
    throw new Error(
      "Tu cuenta no tiene un autenticador activo — actívalo desde tu perfil antes de cambiar correos de otros usuarios.",
    );
  }

  const { data: adminChallenge, error: adminChallengeError } = await supabase.auth.mfa.challenge({
    factorId: adminFactor.id,
  });
  if (adminChallengeError) throw new Error(adminChallengeError.message);

  const { error: adminVerifyError } = await supabase.auth.mfa.verify({
    factorId: adminFactor.id,
    challengeId: adminChallenge.id,
    code,
  });
  if (adminVerifyError) throw new Error("Código incorrecto. Intenta de nuevo.");

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
