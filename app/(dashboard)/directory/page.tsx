import Link from "next/link";
import { BookUser, Plus } from "lucide-react";
import { countDirectoryByStatus, listDirectory, listTags, listZones } from "@/features/directory/queries";
import { DIRECTORY_STATUS_INFO, DIRECTORY_STATUS_LABELS, DIRECTORY_STATUSES, type DirectoryStatus } from "@/features/directory/schema";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { DirectoryCard } from "@/components/directory/directory-card";
import { Callout, SectionHeader } from "@/components/ui/page-kit";
import { Button } from "@/components/ui/button";
import { LiveSearchInput } from "@/components/ui/live-search-input";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Pagination } from "@/components/ui/pagination";
import { hasPermission } from "@/lib/auth/permissions";
import { parsePage } from "@/lib/utils/pagination";
import { cleanSearch } from "@/lib/utils/search";

type Params = { estado?: string; q?: string; zona?: string; etiqueta?: string; categoria?: string; estrellas?: string; page?: string };

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const status = (DIRECTORY_STATUSES as readonly string[]).includes(sp.estado ?? "") ? (sp.estado as DirectoryStatus) : "TODOS";
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const minRating = Number(sp.estrellas) || undefined;
  const [list, counts, zones, tags, categories, canCreate] = await Promise.all([
    listDirectory({ status, search: q, zoneId: sp.zona, tagId: sp.etiqueta, categoryId: sp.categoria, minRating, page }),
    countDirectoryByStatus(),
    listZones(),
    listTags(),
    listCategoryOptions(),
    hasPermission("suppliers.create"),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const filtersOn = Boolean(q || sp.zona || sp.etiqueta || sp.categoria || sp.estrellas);
  const keep = { estado: status === "TODOS" ? undefined : status, q, zona: sp.zona, etiqueta: sp.etiqueta, categoria: sp.categoria, estrellas: sp.estrellas };
  const tabHref = (s: string) => {
    const p = new URLSearchParams();
    if (s !== "TODOS") p.set("estado", s);
    return `/directory${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Directorio de Recursos y Aliados</h1>
          <p className="text-sm text-brand-muted">
            Talentos, lugares y aliados con los que podemos trabajar. Cuando les pagas por primera vez se convierten en Proveedor.
          </p>
        </div>
        {canCreate && (
          <Link href="/directory/new">
            <Button icon={<Plus size={15} />} hint="Solo pide el nombre; lo demás lo completas cuando lo evalúes.">
              Nuevo en el directorio
            </Button>
          </Link>
        )}
      </div>

      <Callout
        icon={<BookUser size={18} />}
        title="Cómo se usa"
        description="1) Agrega a alguien que conociste o te recomendaron (Prospecto). 2) Evalúalo: fotos, precio de referencia, calificación y notas (Evaluado). 3) Si nos sirve, márcalo Aprobado. 4) Cuando lo contrates, conviértelo en Proveedor (o regístrale un gasto: se convierte solo)."
      />

      <nav aria-label="Estados del directorio" className="flex gap-1 overflow-x-auto border-b border-brand-border">
        {(["TODOS", ...DIRECTORY_STATUSES] as const).map((s) => {
          const active = status === s;
          const count = s === "TODOS" ? total : counts[s];
          return (
            <Link
              key={s}
              href={tabHref(s)}
              title={s === "TODOS" ? "Todos los registros" : DIRECTORY_STATUS_INFO[s]}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active ? "border-brand-accent font-medium text-brand-accent" : "border-transparent text-brand-muted hover:text-brand-text"
              }`}
            >
              {s === "TODOS" ? "Todos" : DIRECTORY_STATUS_LABELS[s]}
              <span className="rounded-full bg-brand-surface-hover px-1.5 text-xs tabular-nums text-brand-muted">{count}</span>
            </Link>
          );
        })}
      </nav>

      <form action="/directory" method="get" className="flex flex-wrap items-end gap-2">
        {status !== "TODOS" && <input type="hidden" name="estado" value={status} />}
        <LiveSearchInput defaultValue={q ?? ""} placeholder="Buscar por nombre…" ariaLabel="Buscar en el directorio" className="w-64" />
        <AutoSubmitSelect name="categoria" defaultValue={sp.categoria ?? ""} aria-label="Categoría" className="w-48">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="zona" defaultValue={sp.zona ?? ""} aria-label="Zona" className="w-44">
          <option value="">Todas las zonas</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="etiqueta" defaultValue={sp.etiqueta ?? ""} aria-label="Etiqueta" className="w-40">
          <option value="">Todas las etiquetas</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="estrellas" defaultValue={sp.estrellas ?? ""} aria-label="Calificación" className="w-40">
          <option value="">Cualquier calificación</option>
          <option value="3">3 ★ o más</option>
          <option value="4">4 ★ o más</option>
          <option value="5">5 ★</option>
        </AutoSubmitSelect>
        {filtersOn && (
          <Link href={tabHref(status)} className="pb-2 text-sm text-brand-accent hover:underline">
            Limpiar filtros
          </Link>
        )}
      </form>

      <section>
        <SectionHeader
          title={status === "TODOS" ? "Todos" : DIRECTORY_STATUS_LABELS[status]}
          count={list.total}
          description="Lo último registrado primero. Haz clic en una tarjeta para ver su ficha, fotos y notas."
        />
        {list.rows.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-brand-border p-8 text-center text-sm text-brand-muted">
            {filtersOn ? "Nada coincide con los filtros." : "Todavía no hay nadie aquí. Pulsa «Nuevo en el directorio»."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.rows.map((c) => (
              <DirectoryCard key={c.id} card={c} />
            ))}
          </div>
        )}
        <div className="mt-4">
          <Pagination basePath="/directory" page={page} pageSize={list.pageSize} total={list.total} params={keep} />
        </div>
      </section>
    </main>
  );
}
