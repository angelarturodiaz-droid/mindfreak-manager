import Link from "next/link";
import { Boxes, CircleDollarSign, Plus, Trash2, Wrench, X } from "lucide-react";
import { getAssetStats, listAssetLocations, listAssets, listAssetTypes, listResponsibleSuggestions, type AssetRow } from "@/features/assets/queries";
import { EditAssetButton } from "@/components/assets/asset-edit";
import { ASSET_STATUS_INFO, ASSET_STATUS_LABELS, ASSET_STATUS_TONES, ASSET_STATUSES, formatQuantity } from "@/features/assets/schema";
import { Callout, SectionHeader, StatCard, StatGrid } from "@/components/ui/page-kit";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LiveSearchInput } from "@/components/ui/live-search-input";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Pagination } from "@/components/ui/pagination";
import { hasPermission } from "@/lib/auth/permissions";
import { PAGE_SIZE, parsePage } from "@/lib/utils/pagination";
import { cleanSearch } from "@/lib/utils/search";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";

type Params = { q?: string; tipo?: string; ubicacion?: string; estado?: string; consumo?: string; page?: string };

export default async function AssetsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = cleanSearch(sp.q);
  const page = parsePage(sp.page);
  const status = [...ASSET_STATUSES, "ANULADO"].includes(sp.estado ?? "") ? sp.estado : undefined;
  const consumable = sp.consumo === "si" || sp.consumo === "no" ? sp.consumo : undefined;
  const [list, stats, types, locations, canManage, canEditLists] = await Promise.all([
    listAssets({ search: q, typeId: sp.tipo, locationId: sp.ubicacion, status, consumable, page }),
    getAssetStats(),
    listAssetTypes(),
    listAssetLocations(),
    hasPermission("assets.manage"),
    hasPermission("settings.manage"),
  ]);
  const suggestions = canManage ? await listResponsibleSuggestions() : [];
  const filtersOn = Boolean(q || sp.tipo || sp.ubicacion || status || consumable);
  const keep = { q, tipo: sp.tipo, ubicacion: sp.ubicacion, estado: status, consumo: consumable };

  const columns: Column<AssetRow>[] = [
    {
      header: "",
      accessor: (r) =>
        r.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
          <img src={r.coverUrl} alt="" className="h-9 w-12 rounded object-cover" />
        ) : (
          <span className="flex h-9 w-12 items-center justify-center rounded bg-brand-surface-hover text-brand-muted">
            <Boxes size={14} aria-hidden />
          </span>
        ),
    },
    {
      header: "Activo",
      accessor: (r) => (
        <Link href={`/assets/${r.id}`} className="group flex flex-col">
          <span className="text-xs font-semibold tabular-nums text-brand-accent">{r.code}</span>
          <span className="font-medium text-brand-text group-hover:text-brand-accent">{r.description}</span>
          {r.detail && <span className="line-clamp-1 max-w-[16rem] text-xs text-brand-muted">{r.detail}</span>}
        </Link>
      ),
    },
    {
      header: "Tipo",
      accessor: (r) => (
        <span className="flex flex-col text-xs text-brand-muted">
          {r.typeName ?? "—"}
          {r.is_consumable && (
            <span title="Se consume o se regala en los eventos (no es activo fijo)" className="mt-0.5 w-fit rounded-full bg-brand-info-bg px-1.5 text-[10px] font-medium text-brand-info">
              Se consume
            </span>
          )}
        </span>
      ),
    },
    { header: "Cant.", className: "text-right", accessor: (r) => <span className="tabular-nums">{formatQuantity(r.quantity)}</span> },
    { header: "Responsable", accessor: (r) => <span className="text-xs text-brand-text">{r.responsible_name ?? "—"}</span> },
    { header: "Ubicación", accessor: (r) => <span className="text-xs text-brand-text">{r.locationName ?? "—"}</span> },
    {
      header: "Valor",
      className: "text-right",
      accessor: (r) => (
        <span className="flex flex-col items-end">
          <span className="tabular-nums text-brand-text">{r.value ? formatMoney(r.value, r.currency) : "—"}</span>
          {r.purchase_date && <span className="text-[11px] text-brand-muted">{formatDate(r.purchase_date)}</span>}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: (r) => (
        <span title={ASSET_STATUS_INFO[r.status]} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_TONES[r.status]}`}>
          {ASSET_STATUS_LABELS[r.status]}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            header: "",
            className: "text-right",
            accessor: (r: AssetRow) =>
              r.status === "ANULADO" ? null : (
              <EditAssetButton
                assetId={r.id}
                code={r.code}
                types={types}
                locations={locations}
                responsibleSuggestions={suggestions}
                canEditLists={canEditLists}
                values={{
                  description: r.description,
                  detail: r.detail,
                  typeId: r.typeId,
                  quantity: r.quantity,
                  responsibleName: r.responsible_name,
                  locationId: r.locationId,
                  value: r.value,
                  currency: r.currency,
                  purchaseDate: r.purchase_date,
                  status: r.status,
                  isConsumable: r.is_consumable,
                }}
              />
              ),
          } as Column<AssetRow>,
        ]
      : []),
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Activos de la empresa</h1>
          <p className="text-sm text-brand-muted">
            Lo que la empresa compró para usar: mobiliario, decoración, equipos y suministros. Cada uno con su código, foto y quién lo tiene.
          </p>
        </div>
        {canManage && (
          <Link href="/assets/new">
            <Button icon={<Plus size={15} />} hint="Registra algo que la empresa tiene. Si lo compraste con un gasto, mejor hazlo desde el gasto: «Registrar como activo».">
              Nuevo activo
            </Button>
          </Link>
        )}
      </div>

      <Callout
        icon={<Boxes size={18} />}
        title="Cómo se usa"
        description="1) Registra cada cosa (si son varias iguales, una sola vez con su cantidad). 2) Ponle foto, responsable y ubicación. 3) Cuando cambie de manos, de lugar o se dañe, actualízalo: queda en su historial. Lo que se gasta en los eventos (gorras, lanyards…) márcalo «Se consume». Nada de esto cambia gastos ni bancos."
      />

      <StatGrid>
        <StatCard
          label="Activos"
          value={String(stats.count)}
          icon={<Boxes size={18} />}
          tone="blue"
          info="Cuántos registros hay (sin contar los dados de baja). Un registro puede tener varias unidades (ej. 15 jarrones)."
          hint={[stats.consumables ? `${stats.consumables} se consumen` : "", stats.retired ? `sin contar ${stats.retired} dado${stats.retired === 1 ? "" : "s"} de baja` : ""].filter(Boolean).join(" · ") || undefined}
        />
        <StatCard
          label="Valor de compra"
          value={formatMoney(stats.valueDop, "DOP")}
          icon={<CircleDollarSign size={18} />}
          tone="green"
          info="Suma de lo que costaron los activos que se usan. NO suma los dados de baja (ya no los tenemos). Los de dólares van aparte, sin convertir. Es lo que se pagó, no lo que valen hoy."
          hint={
            [
              stats.valueUsd ? `+ ${formatMoney(stats.valueUsd, "USD")}` : "",
              stats.withoutValue ? `${stats.withoutValue} sin valor anotado` : "",
              stats.retired ? `no suma los dados de baja` : "",
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
        <StatCard
          label="En reparación"
          value={String(stats.inRepair)}
          icon={<Wrench size={18} />}
          tone="amber"
          valueTone={stats.inRepair ? "warning" : undefined}
          info="Dañados o en arreglo: no contar con ellos para un evento."
        />
        <StatCard label="Dados de baja" value={String(stats.retired)} icon={<Trash2 size={18} />} tone="neutral" info="Ya no se usan. Quedan en la lista para el historial (los activos no se borran)." />
      </StatGrid>

      <form action="/assets" method="get" className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] [&>*]:min-w-0">
        <LiveSearchInput defaultValue={q ?? ""} placeholder="Buscar por nombre, código o responsable…" ariaLabel="Buscar activos" className="w-full" />
        <AutoSubmitSelect name="tipo" defaultValue={sp.tipo ?? ""} aria-label="Tipo" className="w-full truncate">
          <option value="">Todos los tipos</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="ubicacion" defaultValue={sp.ubicacion ?? ""} aria-label="Ubicación" className="w-full truncate">
          <option value="">Todas las ubicaciones</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="estado" defaultValue={status ?? ""} aria-label="Estado" className="w-full truncate">
          <option value="">Todos los estados</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ASSET_STATUS_LABELS[s]}
            </option>
          ))}
          {(stats.voided > 0 || status === "ANULADO") && <option value="ANULADO">Anulados (registrados por error) · {stats.voided}</option>}
        </AutoSubmitSelect>
        <AutoSubmitSelect name="consumo" defaultValue={consumable ?? ""} aria-label="¿Se consume?" className="w-full truncate">
          <option value="">Fijos y que se consumen</option>
          <option value="no">Solo fijos</option>
          <option value="si">Solo los que se consumen</option>
        </AutoSubmitSelect>
        {filtersOn ? (
          <Link
            href="/assets"
            title="Quita la búsqueda y todos los filtros"
            className="inline-flex h-[42px] items-center gap-1.5 rounded-[var(--radius-md)] border border-brand-accent/40 bg-brand-accent-light px-3 text-sm font-medium text-brand-accent hover:bg-brand-accent/10"
          >
            <X size={14} aria-hidden /> Limpiar filtros
          </Link>
        ) : (
          <span
            title="Cuando uses la búsqueda o un filtro, aquí podrás quitarlos todos de una vez"
            className="inline-flex h-[42px] cursor-default items-center gap-1.5 rounded-[var(--radius-md)] border border-brand-border px-3 text-sm text-brand-disabled"
          >
            <X size={14} aria-hidden /> Limpiar filtros
          </span>
        )}
      </form>

      <section>
        <SectionHeader
          title="Lista de activos"
          count={list.total}
          description={canManage ? "Lo último registrado primero, de 10 en 10. Haz clic en uno para ver su ficha, fotos e historial; el lápiz ✎ lo edita aquí mismo." : "Lo último registrado primero, de 10 en 10. Haz clic en uno para ver su ficha, fotos e historial."}
        />
        <DataTable
          columns={columns}
          rows={list.rows}
          keyFor={(r) => r.id}
          maxWidth="max-w-none"
          emptyMessage={filtersOn ? "Nada coincide con los filtros." : "Todavía no hay activos. Pulsa «Nuevo activo» o, desde un gasto, «Registrar como activo»."}
        />
        <div className="mt-4">
          <Pagination basePath="/assets" page={page} pageSize={PAGE_SIZE} total={list.total} params={keep} />
        </div>
      </section>
    </main>
  );
}
