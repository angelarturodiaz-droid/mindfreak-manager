import { createClient } from "@/lib/supabase/server";
import { accentPattern } from "@/lib/utils/search";
import { PAGE_SIZE } from "@/lib/utils/pagination";
import type { AssetCurrency, AssetStatus } from "./schema";

export type AssetRow = {
  id: string;
  code: string;
  description: string;
  detail: string | null;
  typeId: string | null;
  typeName: string | null;
  quantity: number;
  responsible_name: string | null;
  locationId: string | null;
  locationName: string | null;
  value: number | null;
  currency: AssetCurrency;
  purchase_date: string | null;
  status: AssetStatus;
  is_consumable: boolean;
  coverUrl: string | null;
};

export async function listAssetTypes() {
  const supabase = await createClient();
  const { data } = await supabase.from("asset_types").select("id, name").order("name");
  return data ?? [];
}

export async function listAssetLocations() {
  const supabase = await createClient();
  const { data } = await supabase.from("asset_locations").select("id, name").order("name");
  return data ?? [];
}

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("documents").createSignedUrls(paths, 60 * 60);
  for (const r of data ?? []) if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  return map;
}

function relName(rel: unknown): string | null {
  const r = rel as { name: string } | { name: string }[] | null;
  return (Array.isArray(r) ? r[0]?.name : r?.name) ?? null;
}

/** Tarjetas de arriba: cuántos hay, valor total (sin los dados de baja), en reparación y dados de baja. */
export async function getAssetStats() {
  const supabase = await createClient();
  const { data } = await supabase.from("assets").select("status, quantity, value, currency, is_consumable");
  const rows = data ?? [];
  const active = rows.filter((r) => r.status !== "DADO_DE_BAJA" && r.status !== "ANULADO");
  const sum = (cur: string) =>
    active.filter((r) => r.currency === cur).reduce((a, r) => a + Number(r.value ?? 0), 0);
  return {
    count: active.length,
    consumables: active.filter((r) => r.is_consumable).length,
    valueDop: sum("DOP"),
    valueUsd: sum("USD"),
    withoutValue: active.filter((r) => r.value === null || Number(r.value) === 0).length,
    inRepair: rows.filter((r) => r.status === "EN_REPARACION").length,
    retired: rows.filter((r) => r.status === "DADO_DE_BAJA").length,
    voided: rows.filter((r) => r.status === "ANULADO").length,
  };
}

/** Lista paginada (lo último registrado primero). */
export async function listAssets(filters: {
  search?: string;
  typeId?: string;
  locationId?: string;
  status?: string;
  consumable?: "si" | "no";
  page?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  let q = supabase
    .from("assets")
    .select(
      "id, code, description, detail, type_id, location_id, quantity, responsible_name, value, currency, purchase_date, status, is_consumable, cover_document_id, asset_types(name), asset_locations(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("code", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (filters.search) {
    const p = accentPattern(filters.search);
    q = q.or(`description.imatch.${p},code.imatch.${p},responsible_name.imatch.${p},detail.imatch.${p}`);
  }
  if (filters.typeId) q = q.eq("type_id", filters.typeId);
  if (filters.locationId) q = q.eq("location_id", filters.locationId);
  // Los anulados (registrados por error) solo salen con el filtro «Anulados».
  if (filters.status) q = q.eq("status", filters.status);
  else q = q.neq("status", "ANULADO");
  if (filters.consumable === "si") q = q.eq("is_consumable", true);
  if (filters.consumable === "no") q = q.eq("is_consumable", false);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = rows.map((r) => r.id as string);

  const { data: photos } = ids.length
    ? await supabase
        .from("documents")
        .select("id, entity_id, storage_path")
        .eq("entity_type", "asset")
        .in("entity_id", ids)
        .like("mime_type", "image/%")
        .order("created_at", { ascending: true })
    : { data: [] as { id: string; entity_id: string; storage_path: string }[] };
  const coverPath = new Map<string, string>();
  for (const r of rows) {
    const chosen = (photos ?? []).find((p) => p.id === r.cover_document_id);
    const first = (photos ?? []).find((p) => p.entity_id === r.id);
    const path = (chosen ?? first)?.storage_path;
    if (path) coverPath.set(r.id as string, path);
  }
  const urls = await signedUrls([...coverPath.values()]);

  const out: AssetRow[] = rows.map((r) => {
    const path = coverPath.get(r.id as string);
    return {
      id: r.id as string,
      code: r.code as string,
      description: r.description as string,
      detail: (r.detail as string) ?? null,
      typeId: (r.type_id as string) ?? null,
      typeName: relName(r.asset_types),
      quantity: Number(r.quantity),
      responsible_name: (r.responsible_name as string) ?? null,
      locationId: (r.location_id as string) ?? null,
      locationName: relName(r.asset_locations),
      value: r.value === null ? null : Number(r.value),
      currency: (r.currency as AssetCurrency) ?? "DOP",
      purchase_date: (r.purchase_date as string) ?? null,
      status: r.status as AssetStatus,
      is_consumable: Boolean(r.is_consumable),
      coverUrl: path ? (urls.get(path) ?? null) : null,
    };
  });
  return { rows: out, total: count ?? 0 };
}

/** Ficha del activo: datos, fotos, gasto con que se compró e historial. */
export async function getAsset(id: string) {
  const supabase = await createClient();
  const { data: a, error } = await supabase
    .from("assets")
    .select("*, asset_types(name), asset_locations(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!a) return null;

  const [{ data: photos }, { data: events }, expense] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, storage_path, mime_type, created_at")
      .eq("entity_type", "asset")
      .eq("entity_id", id)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true }),
    supabase.from("asset_events").select("id, field, old_value, new_value, changed_by, changed_at").eq("asset_id", id).order("changed_at", { ascending: false }).limit(50),
    a.expense_id ? getExpenseSummary(a.expense_id as string) : Promise.resolve(null),
  ]);
  const urls = await signedUrls((photos ?? []).map((p) => p.storage_path as string));

  const userIds = [...new Set((events ?? []).map((e) => e.changed_by).filter(Boolean))] as string[];
  const { data: people } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; email: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));

  return {
    id: a.id as string,
    code: a.code as string,
    description: a.description as string,
    detail: (a.detail as string) ?? null,
    typeId: (a.type_id as string) ?? null,
    typeName: relName(a.asset_types),
    quantity: Number(a.quantity),
    responsibleName: (a.responsible_name as string) ?? null,
    locationId: (a.location_id as string) ?? null,
    locationName: relName(a.asset_locations),
    value: a.value === null ? null : Number(a.value),
    currency: (a.currency as AssetCurrency) ?? "DOP",
    purchaseDate: (a.purchase_date as string) ?? null,
    status: a.status as AssetStatus,
    isConsumable: Boolean(a.is_consumable),
    expenseId: (a.expense_id as string) ?? null,
    expense,
    coverId: (a.cover_document_id as string) ?? null,
    createdAt: a.created_at as string,
    voidReason: (a.void_reason as string) ?? null,
    voidedAt: (a.voided_at as string) ?? null,
    voidedBy: a.voided_by ? (nameOf.get(a.voided_by as string) ?? (await voiderName(a.voided_by as string))) : null,
    photos: (photos ?? []).map((p) => ({ id: p.id as string, name: p.file_name as string, url: urls.get(p.storage_path as string) ?? null })),
    events: (events ?? []).map((e) => ({
      id: e.id as string,
      field: e.field as string,
      oldValue: (e.old_value as string) ?? null,
      newValue: (e.new_value as string) ?? null,
      by: e.changed_by ? (nameOf.get(e.changed_by as string) ?? "Usuario") : "Sistema",
      at: e.changed_at as string,
    })),
  };
}

async function voiderName(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  return (data?.full_name as string) || (data?.email as string) || "Usuario";
}

/** Lo que se muestra del gasto en la ficha del activo (y para llenar «Registrar como activo»). */
export async function getExpenseSummary(expenseId: string) {
  const supabase = await createClient();
  const { data: e } = await supabase
    .from("expenses")
    .select("id, description, total, subtotal, currency, expense_date, status, payment_method, suppliers(name), bank_accounts(name)")
    .eq("id", expenseId)
    .maybeSingle();
  if (!e) return null;
  const { data: pays } = await supabase
    .from("supplier_payments")
    .select("method, bank_accounts!supplier_payments_bank_account_id_fkey(name)")
    .eq("expense_id", expenseId)
    .eq("status", "ACTIVE");
  const methods = [...new Set((pays ?? []).map((p) => p.method as string).filter(Boolean))];
  const accounts = [...new Set((pays ?? []).map((p) => relName(p.bank_accounts)).filter(Boolean))] as string[];
  return {
    id: e.id as string,
    description: e.description as string,
    total: Number(e.total),
    subtotal: Number(e.subtotal),
    currency: (e.currency as string) ?? "DOP",
    date: e.expense_date as string,
    status: e.status as string,
    supplierName: relName(e.suppliers),
    methods: methods.length ? methods : e.payment_method ? [e.payment_method as string] : [],
    accounts: accounts.length ? accounts : relName(e.bank_accounts) ? [relName(e.bank_accounts) as string] : [],
  };
}

/** Activos registrados con un gasto (para mostrarlos en el gasto). */
export async function listAssetsForExpense(expenseId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("assets").select("id, code, description, status").eq("expense_id", expenseId).order("code");
  return (data ?? []) as { id: string; code: string; description: string; status: AssetStatus }[];
}

/** Nombres de los usuarios (sugerencias para «Responsable»). */
export async function listResponsibleSuggestions(): Promise<string[]> {
  const supabase = await createClient();
  const [{ data: users }, { data: used }] = await Promise.all([
    supabase.from("user_roles").select("profiles(full_name, is_active)"),
    supabase.from("assets").select("responsible_name").not("responsible_name", "is", null),
  ]);
  const names = new Set<string>();
  for (const u of users ?? []) {
    const p = u.profiles as { full_name: string | null; is_active: boolean } | { full_name: string | null; is_active: boolean }[] | null;
    const row = Array.isArray(p) ? p[0] : p;
    if (row?.full_name && row.is_active) names.add(row.full_name);
  }
  for (const r of used ?? []) if (r.responsible_name) names.add(r.responsible_name as string);
  return [...names].sort((a, b) => a.localeCompare(b));
}
