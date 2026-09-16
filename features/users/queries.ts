import { createClient } from "@/lib/supabase/server";

export async function listRoles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, name, description, is_system")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listPermissions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("id, code, module, description")
    .order("module")
    .order("code");
  if (error) throw new Error(error.message);
  return data;
}

export async function listRolePermissionMatrix() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("role_permissions").select("role_id, permission_id");
  if (error) throw new Error(error.message);
  // Set de "roleId:permissionId" para lookup O(1) en la UI.
  return new Set((data ?? []).map((rp) => `${rp.role_id}:${rp.permission_id}`));
}

export async function getCompanyUsersWithRoleIds() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role_id, profiles(id, full_name, email, is_active)");
  if (error) throw new Error(error.message);

  const byUser = new Map<
    string,
    { id: string; full_name: string | null; email: string; is_active: boolean; roleIds: string[] }
  >();
  for (const row of data ?? []) {
    const profile = row.profiles as
      | { id: string; full_name: string | null; email: string; is_active: boolean }
      | { id: string; full_name: string | null; email: string; is_active: boolean }[]
      | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    if (!p) continue;
    const existing = byUser.get(p.id) ?? { ...p, roleIds: [] as string[] };
    if (!existing.roleIds.includes(row.role_id)) existing.roleIds.push(row.role_id);
    byUser.set(p.id, existing);
  }
  return Array.from(byUser.values());
}
