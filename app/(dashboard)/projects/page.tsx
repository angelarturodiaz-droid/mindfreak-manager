import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  FileCheck2,
  FolderKanban,
  MapPin,
  Plus,
  Wallet,
} from "lucide-react";
import {
  listProjects,
  listConvertibleQuotations,
  getProjectStats,
} from "@/features/projects/queries";
import { PROJECT_STATUSES } from "@/features/projects/schema";
import {
  COUNTDOWN_CLASSES,
  PROJECT_STATUS_LABELS,
  eventCountdown,
  formatEventDate,
  formatMoney,
} from "@/features/projects/display";
import { listClientOptions } from "@/features/clients/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconBadge, type IconBadgeTone } from "@/components/ui/icon-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { relationName } from "@/lib/utils/relation";
import { parsePage } from "@/lib/utils/pagination";

type ProjectRow = Awaited<ReturnType<typeof listProjects>>["rows"][number];

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: IconBadgeTone;
}) {
  return (
    <Card className="flex items-start gap-4">
      <IconBadge icon={icon} tone={tone} size="lg" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-muted">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-brand-text">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-brand-muted">{hint}</p>
      </div>
    </Card>
  );
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [{ rows: projects, total, pageSize }, convertibleQuotations, clientOptions, stats] =
    await Promise.all([
      listProjects({ status: params.status, clientId: params.client, page }),
      listConvertibleQuotations(),
      listClientOptions(),
      getProjectStats(params.client),
    ]);

  const statusHref = (status?: string) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (params.client) qs.set("client", params.client);
    const s = qs.toString();
    return s ? `/projects?${s}` : "/projects";
  };
  const selectedClientName = params.client
    ? clientOptions.find((c) => c.id === params.client)?.name
    : undefined;

  const columns: Column<ProjectRow>[] = [
    {
      header: "Proyecto",
      accessor: (p) => (
        <Link href={`/projects/${p.id}`} className="group block min-w-[12rem]">
          <span className="block font-medium text-brand-text group-hover:text-brand-accent">
            {p.name}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-brand-muted">
            <span>{p.number}</span>
            {p.location_name && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin size={11} /> {p.location_name}
              </span>
            )}
          </span>
        </Link>
      ),
    },
    {
      header: "Cliente",
      accessor: (p) => (
        <span className="text-brand-text">{relationName(p.clients) ?? "—"}</span>
      ),
    },
    {
      header: "Evento",
      accessor: (p) => {
        if (!p.event_date) return <span className="text-brand-muted">Sin fecha</span>;
        const cd = eventCountdown(p.event_date, p.status);
        return (
          <div className="flex flex-col items-start gap-1">
            <span className="whitespace-nowrap text-brand-text">{formatEventDate(p.event_date)}</span>
            {cd && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COUNTDOWN_CLASSES[cd.tone]}`}
              >
                {cd.label}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Presupuesto",
      className: "text-right",
      accessor: (p) => (
        <span className="whitespace-nowrap font-medium tabular-nums">{formatMoney(p.budget)}</span>
      ),
    },
    {
      header: "Estado",
      accessor: (p) => (
        <Badge status={p.status}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</Badge>
      ),
    },
    {
      header: "",
      className: "w-8 text-right",
      accessor: (p) => (
        <Link
          href={`/projects/${p.id}`}
          aria-label={`Abrir ${p.name}`}
          className="inline-flex text-brand-muted hover:text-brand-accent"
        >
          <ChevronRight size={16} />
        </Link>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Proyectos / Eventos</h1>
          <p className="text-sm text-brand-muted">
            Planifica y da seguimiento a cada evento: fechas, presupuesto, gastos y cobros.
          </p>
        </div>
        <Link href="/projects/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nuevo proyecto
          </Button>
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Proyectos activos"
          value={String(stats.active)}
          hint="Planificación, confirmados y en curso"
          icon={<FolderKanban size={20} />}
          tone="blue"
        />
        <StatCard
          label="Próximos 30 días"
          value={String(stats.upcoming)}
          hint="Eventos activos por realizarse"
          icon={<CalendarClock size={20} />}
          tone="amber"
        />
        <StatCard
          label="En curso"
          value={String(stats.byStatus.IN_PROGRESS ?? 0)}
          hint="Eventos en ejecución ahora"
          icon={<CalendarDays size={20} />}
          tone="violet"
        />
        <StatCard
          label="Presupuesto activo"
          value={formatMoney(stats.activeBudget)}
          hint="Suma de proyectos activos"
          icon={<Wallet size={20} />}
          tone="green"
        />
      </section>

      {convertibleQuotations.length > 0 && (
        <section className="rounded-[var(--radius-lg)] border border-brand-accent/25 bg-brand-accent-light p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconBadge icon={<FileCheck2 size={18} />} tone="blue" />
              <div>
                <p className="text-sm font-semibold text-brand-text">
                  {convertibleQuotations.length === 1
                    ? "1 cotización aprobada sin proyecto"
                    : `${convertibleQuotations.length} cotizaciones aprobadas sin proyecto`}
                </p>
                <p className="text-xs text-brand-muted">
                  Conviértelas en proyecto para empezar a planificar el evento.
                </p>
              </div>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {convertibleQuotations.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-4 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <Link
                    href={`/quotations/${q.id}`}
                    className="font-medium text-brand-text hover:text-brand-accent"
                  >
                    {q.number}
                  </Link>
                  <span className="text-brand-muted">{relationName(q.clients) ?? "Sin cliente"}</span>
                  <span className="font-medium tabular-nums">{formatMoney(q.total, q.currency)}</span>
                  {q.total === 0 && (
                    <span className="rounded-full bg-brand-warning-bg px-2 py-0.5 text-[11px] font-medium text-brand-warning">
                      Sin líneas
                    </span>
                  )}
                </div>
                <Link href={`/projects/from-quotation/${q.id}`}>
                  <Button size="sm" variant="outline" icon={<ArrowRight size={14} />}>
                    Convertir en proyecto
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
            {[undefined, ...PROJECT_STATUSES].map((s) => {
              const active = (params.status ?? undefined) === s;
              const count = s ? stats.byStatus[s] ?? 0 : stats.total;
              return (
                <Link
                  key={s ?? "all"}
                  href={statusHref(s)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-border bg-brand-surface text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
                  }`}
                >
                  {s ? PROJECT_STATUS_LABELS[s] : "Todos"}
                  <span
                    className={`rounded-full px-1.5 text-xs tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-brand-surface-hover text-brand-muted"
                    }`}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>

          <form action="/projects" method="get" className="flex items-center gap-2">
            {params.status && <input type="hidden" name="status" value={params.status} />}
            <AutoSubmitSelect
              name="client"
              defaultValue={params.client ?? ""}
              className="w-60"
              aria-label="Filtrar por cliente"
            >
              <option value="">Todos los clientes</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.is_active ? "" : " (inactivo)"}
                </option>
              ))}
            </AutoSubmitSelect>
            <noscript>
              <Button type="submit" variant="outline" size="md">
                Filtrar
              </Button>
            </noscript>
          </form>
        </div>

        {(params.status || params.client) && (
          <p className="text-sm text-brand-muted">
            Mostrando
            {params.status && (
              <>
                {" "}
                proyectos en <span className="font-medium text-brand-text">
                  {PROJECT_STATUS_LABELS[params.status] ?? params.status}
                </span>
              </>
            )}
            {selectedClientName && (
              <>
                {params.status ? " de " : " proyectos de "}
                <span className="font-medium text-brand-text">{selectedClientName}</span>
              </>
            )}
            {" · "}
            <Link href="/projects" className="text-brand-accent hover:underline">
              Limpiar filtros
            </Link>
          </p>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={28} />}
            title={
              params.status || params.client
                ? "No hay proyectos que coincidan con este filtro."
                : "Aún no tienes proyectos."
            }
            action={
              <Link href="/projects/new">
                <Button size="sm" icon={<Plus size={14} />}>
                  Nuevo proyecto
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable
              columns={columns}
              rows={projects}
              keyFor={(p) => p.id}
              maxWidth="max-w-none"
            />
            <Pagination
              basePath="/projects"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ status: params.status, client: params.client }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
