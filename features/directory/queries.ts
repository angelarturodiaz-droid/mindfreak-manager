import { createClient } from "@/lib/supabase/server";
import { accentPattern } from "@/lib/utils/search";
import { DIRECTORY_STATUSES, type DirectoryLinks, type DirectoryStatus } from "./schema";

export const DIRECTORY_PAGE_SIZE = 12;

export type DirectoryCard = {
  id: string;
  name: string;
  category: string | null;
  service_type: string | null;
  directory_status: DirectoryStatus;
  reference_price: string | null;
  rating: number | null;
  zoneName: string | null;
  tags: string[];
  coverUrl: string | null;
  phone: string | null;
};

export async function listZones() {
  const supabase = await createClient();
  const { data } = await supabase.from("directory_zones").select("id, name").order("name");
  return data ?? [];
}

export async function listTags() {
  const supabase = await createClient();
  const { data } = await supabase.from("directory_tags").select("id, name").order("name");
  return data ?? [];
}

/** Cantidad por estado (para las pestañas). */
export async function countDirectoryByStatus(): Promise<Record<DirectoryStatus, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("directory_status");
  const out = Object.fromEntries(DIRECTORY_STATUSES.map((s) => [s, 0])) as Record<DirectoryStatus, number>;
  for (const r of data ?? []) out[r.directory_status as DirectoryStatus] = (out[r.directory_status as DirectoryStatus] ?? 0) + 1;
  return out;
}

async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("documents").createSignedUrls(paths, 60 * 60);
  for (const r of data ?? []) if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  return map;
}

/** Tarjetas del Directorio (12 por página), lo último primero. */
export async function listDirectory(filters: {
  status?: DirectoryStatus | "TODOS";
  search?: string;
  zoneId?: string;
  tagId?: string;
  categoryId?: string;
  minRating?: number;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const size = filters.pageSize ?? DIRECTORY_PAGE_SIZE;
  const from = (page - 1) * size;

  let ids: string[] | null = null;
  if (filters.tagId) {
    const { data } = await supabase.from("supplier_tags").select("supplier_id").eq("tag_id", filters.tagId);
    ids = (data ?? []).map((r) => r.supplier_id as string);
    if (!ids.length) return { rows: [] as DirectoryCard[], total: 0, pageSize: size };
  }

  let q = supabase
    .from("suppliers")
    .select("id, name, category, service_type, directory_status, reference_price, rating, phone, cover_document_id, directory_zones(name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + size - 1);
  if (filters.status && filters.status !== "TODOS") q = q.eq("directory_status", filters.status);
  if (filters.search) q = q.filter("name", "imatch", accentPattern(filters.search));
  if (filters.zoneId) q = q.eq("zone_id", filters.zoneId);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  if (filters.minRating) q = q.gte("rating", filters.minRating);
  if (ids) q = q.in("id", ids);
  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const supplierIds = rows.map((r) => r.id as string);

  // Etiquetas y portada (la elegida o la primera foto subida).
  const [{ data: tagRows }, { data: photos }] = await Promise.all([
    supplierIds.length
      ? supabase.from("supplier_tags").select("supplier_id, directory_tags(name)").in("supplier_id", supplierIds)
      : Promise.resolve({ data: [] as { supplier_id: string; directory_tags: unknown }[] }),
    supplierIds.length
      ? supabase
          .from("documents")
          .select("id, entity_id, storage_path, mime_type, created_at")
          .eq("entity_type", "supplier")
          .in("entity_id", supplierIds)
          .like("mime_type", "image/%")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; entity_id: string; storage_path: string }[] }),
  ]);
  const tagsBy = new Map<string, string[]>();
  for (const t of tagRows ?? []) {
    const rel = t.directory_tags as { name: string } | { name: string }[] | null;
    const name = Array.isArray(rel) ? rel[0]?.name : rel?.name;
    if (name) tagsBy.set(t.supplier_id as string, [...(tagsBy.get(t.supplier_id as string) ?? []), name]);
  }
  const coverPath = new Map<string, string>();
  for (const r of rows) {
    const chosen = (photos ?? []).find((p) => p.id === r.cover_document_id);
    const first = (photos ?? []).find((p) => p.entity_id === r.id);
    const path = (chosen ?? first)?.storage_path;
    if (path) coverPath.set(r.id as string, path);
  }
  const urls = await signedUrls([...coverPath.values()]);

  const cards: DirectoryCard[] = rows.map((r) => {
    const zone = r.directory_zones as { name: string } | { name: string }[] | null;
    const path = coverPath.get(r.id as string);
    return {
      id: r.id as string,
      name: r.name as string,
      category: (r.category as string) ?? null,
      service_type: (r.service_type as string) ?? null,
      directory_status: r.directory_status as DirectoryStatus,
      reference_price: (r.reference_price as string) ?? null,
      rating: (r.rating as number) ?? null,
      phone: (r.phone as string) ?? null,
      zoneName: (Array.isArray(zone) ? zone[0]?.name : zone?.name) ?? null,
      tags: (tagsBy.get(r.id as string) ?? []).sort(),
      coverUrl: path ? (urls.get(path) ?? null) : null,
    };
  });
  return { rows: cards, total: count ?? 0, pageSize: size };
}

/** Datos del Directorio de un proveedor (para su ficha). */
export async function getDirectoryInfo(supplierId: string) {
  const supabase = await createClient();
  const [{ data: s }, { data: tagRows }, { data: photos }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, directory_status, zone_id, links, reference_price, directory_notes, rating, cover_document_id")
      .eq("id", supplierId)
      .maybeSingle(),
    supabase.from("supplier_tags").select("tag_id").eq("supplier_id", supplierId),
    supabase
      .from("documents")
      .select("id, file_name, storage_path, mime_type, created_at")
      .eq("entity_type", "supplier")
      .eq("entity_id", supplierId)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true }),
  ]);
  const urls = await signedUrls((photos ?? []).map((p) => p.storage_path as string));
  return {
    status: (s?.directory_status ?? "PROVEEDOR") as DirectoryStatus,
    zoneId: (s?.zone_id as string) ?? null,
    links: ((s?.links as DirectoryLinks) ?? {}) as DirectoryLinks,
    referencePrice: (s?.reference_price as string) ?? null,
    notes: (s?.directory_notes as string) ?? null,
    rating: (s?.rating as number) ?? null,
    coverId: (s?.cover_document_id as string) ?? null,
    tagIds: (tagRows ?? []).map((t) => t.tag_id as string),
    photos: (photos ?? []).map((p) => ({
      id: p.id as string,
      name: p.file_name as string,
      url: urls.get(p.storage_path as string) ?? null,
    })),
  };
}

/** ¿Tiene gastos o pagos? (entonces no vuelve a Prospecto/Evaluado/Aprobado). */
export async function supplierHasHistory(supplierId: string): Promise<boolean> {
  const supabase = await createClient();
  const [{ count: e }, { count: p }] = await Promise.all([
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("supplier_id", supplierId),
    supabase.from("supplier_payments").select("id", { count: "exact", head: true }).eq("supplier_id", supplierId),
  ]);
  return (e ?? 0) + (p ?? 0) > 0;
}
