import { createClient } from "@/lib/supabase/server";

export async function getCompany() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCompanyUsersWithRoles() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("profiles(id, full_name, email, is_active), roles(name)");
  if (error) throw new Error(error.message);

  const byUser = new Map<
    string,
    { id: string; full_name: string | null; email: string; is_active: boolean; roles: string[] }
  >();
  for (const row of data ?? []) {
    const profile = row.profiles as
      | { id: string; full_name: string | null; email: string; is_active: boolean }
      | { id: string; full_name: string | null; email: string; is_active: boolean }[]
      | null;
    const roleData = row.roles as { name: string } | { name: string }[] | null;
    const p = Array.isArray(profile) ? profile[0] : profile;
    const r = Array.isArray(roleData) ? roleData[0] : roleData;
    if (!p) continue;
    const existing = byUser.get(p.id) ?? { ...p, roles: [] as string[] };
    if (r?.name && !existing.roles.includes(r.name)) existing.roles.push(r.name);
    byUser.set(p.id, existing);
  }
  return Array.from(byUser.values());
}
