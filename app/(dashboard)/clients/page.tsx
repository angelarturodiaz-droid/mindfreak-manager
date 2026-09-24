import Link from "next/link";
import {
  ChevronRight,
  Mail,
  Phone,
  Search,
  Sparkles,
  Target,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  listClients,
  getClientStats,
  getClientListAggregates,
} from "@/features/clients/queries";
import {
  convertClientToProspectAction,
  convertClientToClientAction,
  deactivateClientAction,
  reactivateClientAction,
} from "@/features/clients/actions";
import {
  CLIENT_STAGE_FLOW,
  CLIENT_STAGE_LABELS,
  CLIENT_STAGE_PLURAL,
  CLIENT_STAGE_TONE,
  avatarTone,
  initials,
} from "@/features/clients/display";
import { formatMoney } from "@/features/projects/display";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { IconBadge, type IconBadgeTone } from "@/components/ui/icon-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { parsePage } from "@/lib/utils/pagination";

type ClientRow = Awaited<ReturnType<typeof listClients>>["rows"][number];

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

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const stage =
    params.stage === "LEAD" || params.stage === "PROSPECT" || params.stage === "CLIENT"
      ? params.stage
      : undefined;
  const status =
    params.status === "active" || params.status === "inactive" ? params.status : undefined;
  const search = params.q?.trim() || undefined;
  const page = parsePage(params.page);

  const [{ rows: clients, total, pageSize }, stats] = await Promise.all([
    listClients({ stage, search, status, page }),
    getClientStats(),
  ]);
  const aggregates = await getClientListAggregates(clients.map((c) => c.id));

  const hrefWith = (next: { stage?: string }) => {
    const qs = new URLSearchParams();
    if (next.stage) qs.set("stage", next.stage);
    if (search) qs.set("q", search);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/clients?${s}` : "/clients";
  };
  const hasFilters = Boolean(stage || search || status);

  const columns: Column<ClientRow>[] = [
    {
      header: "Cliente",
      accessor: (c) => (
        <Link href={`/clients/${c.id}`} className="group flex min-w-[14rem] items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              c.is_active ? avatarTone(c.name) : "bg-brand-surface-hover text-brand-muted"
            }`}
            aria-hidden
          >
            {initials(c.name)}
          </span>
          <span className="min-w-0">
            <span
              className={`block truncate font-medium group-hover:text-brand-accent ${
                c.is_active ? "text-brand-text" : "text-brand-muted"
              }`}
            >
              {c.name}
            </span>
            <span className="block text-xs text-brand-muted">
              {c.tax_id ? `RNC/Céd. ${c.tax_id}` : "Sin RNC/Cédula"}
            </span>
          </span>
        </Link>
      ),
    },
    {
      header: "Contacto",
      accessor: (c) =>
        c.email || c.phone ? (
          <div className="flex flex-col gap-0.5 text-sm">
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-brand-text hover:text-brand-accent">
                <Mail size={13} className="text-brand-muted" /> {c.email}
              </a>
            )}
            {c.phone && (
              <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 text-brand-muted hover:text-brand-accent">
                <Phone size={13} /> {c.phone}
              </a>
            )}
          </div>
        ) : (
          <span className="text-brand-muted">Sin datos de contacto</span>
        ),
    },
    {
      header: "Etapa",
      accessor: (c) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={CLIENT_STAGE_TONE[c.stage] ?? "neutral"}>
            {CLIENT_STAGE_LABELS[c.stage] ?? c.stage}
          </Badge>
          {!c.is_active && <Badge tone="neutral">Inactivo</Badge>}
        </div>
      ),
    },
    {
      header: "Proyectos activos",
      className: "text-center",
      accessor: (c) => {
        const n = aggregates[c.id]?.activeProjects ?? 0;
        return <span className={`tabular-nums ${n > 0 ? "font-medium text-brand-text" : "text-brand-muted"}`}>{n}</span>;
      },
    },
    {
      header: "Por cobrar",
      className: "text-right",
      accessor: (c) => {
        const v = aggregates[c.id]?.porCobrar ?? 0;
        return (
          <span className={`whitespace-nowrap tabular-nums ${v > 0 ? "font-medium text-brand-warning" : "text-brand-muted"}`}>
            {v > 0 ? formatMoney(v) : "—"}
          </span>
        );
      },
    },
    {
      header: "",
      className: "text-right",
      accessor: (c) => (
        <div className="flex items-center justify-end gap-3 whitespace-nowrap">
          {c.is_active && c.stage === "LEAD" && (
            <ActionLink
              label="Marcar prospecto"
              pendingLabel="Guardando…"
              onAction={convertClientToProspectAction.bind(null, c.id)}
            />
          )}
          {c.is_active && c.stage === "PROSPECT" && (
            <ActionLink
              label="Convertir en cliente"
              pendingLabel="Guardando…"
              onAction={convertClientToClientAction.bind(null, c.id)}
            />
          )}
          {c.is_active ? (
            <ActionLink
              label="Desactivar"
              pendingLabel="Guardando…"
              className="text-sm text-brand-muted hover:text-brand-danger"
              onAction={deactivateClientAction.bind(null, c.id)}
            />
          ) : (
            <ActionLink
              label="Reactivar"
              pendingLabel="Guardando…"
              onAction={reactivateClientAction.bind(null, c.id)}
            />
          )}
          <Link href={`/clients/${c.id}`} aria-label={`Abrir ${c.name}`} className="text-brand-muted hover:text-brand-accent">
            <ChevronRight size={16} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Clientes</h1>
          <p className="text-sm text-brand-muted">
            Tu cartera comercial: de lead a prospecto a cliente, con lo que cada uno te debe.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/clients/import">
            <Button variant="outline" size="sm" icon={<Upload size={14} />}>
              Importar CSV
            </Button>
          </Link>
          <Link href="/clients/new">
            <Button size="sm" icon={<UserPlus size={14} />}>
              Nuevo cliente
            </Button>
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Clientes"
          value={String(stats.byStage.CLIENT ?? 0)}
          hint="Activos que ya compraron"
          icon={<UserCheck size={20} />}
          tone="green"
        />
        <StatCard
          label="Prospectos"
          value={String(stats.byStage.PROSPECT ?? 0)}
          hint="En negociación"
          icon={<Target size={20} />}
          tone="amber"
        />
        <StatCard
          label="Leads"
          value={String(stats.byStage.LEAD ?? 0)}
          hint="Contactos nuevos por calificar"
          icon={<Sparkles size={20} />}
          tone="blue"
        />
        <StatCard
          label="Por cobrar"
          value={formatMoney(stats.porCobrar)}
          hint="Facturas abiertas de todos los clientes"
          icon={<Wallet size={20} />}
          tone="violet"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filtrar por etapa" className="flex flex-wrap gap-1.5">
            {[undefined, ...CLIENT_STAGE_FLOW].map((s) => {
              const active = stage === s;
              // Los conteos solo coinciden con la tabla cuando no hay filtro de
              // estado/búsqueda; con filtro, el total real está en el texto de abajo.
              const count = s ? stats.byStageAll[s] ?? 0 : stats.total;
              return (
                <Link
                  key={s ?? "all"}
                  href={hrefWith({ stage: s })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-border bg-brand-surface text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text"
                  }`}
                >
                  {s ? CLIENT_STAGE_PLURAL[s] : "Todos"}
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

          <form action="/clients" method="get" className="flex flex-wrap items-center gap-2">
            {stage && <input type="hidden" name="stage" value={stage} />}
            <Input
              type="search"
              name="q"
              icon={<Search size={15} />}
              defaultValue={search}
              placeholder="Buscar por nombre…"
              aria-label="Buscar cliente por nombre"
              className="w-60"
            />
            <AutoSubmitSelect
              name="status"
              defaultValue={status ?? ""}
              className="w-44"
              aria-label="Filtrar por estado"
            >
              <option value="">Activos e inactivos</option>
              <option value="active">Solo activos</option>
              <option value="inactive">Solo inactivos ({stats.inactive})</option>
            </AutoSubmitSelect>
          </form>
        </div>

        {hasFilters && (
          <p className="text-sm text-brand-muted">
            {total} {total === 1 ? "resultado" : "resultados"}
            {search && (
              <>
                {" "}para <span className="font-medium text-brand-text">“{search}”</span>
              </>
            )}
            {" · "}
            <Link href="/clients" className="text-brand-accent hover:underline">
              Limpiar filtros
            </Link>
          </p>
        )}

        {clients.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title={hasFilters ? "No hay clientes que coincidan con este filtro." : "Aún no tienes clientes."}
            action={
              <Link href="/clients/new">
                <Button size="sm" icon={<UserPlus size={14} />}>
                  Nuevo cliente
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            <DataTable columns={columns} rows={clients} keyFor={(c) => c.id} maxWidth="max-w-none" />
            <Pagination
              basePath="/clients"
              page={page}
              pageSize={pageSize}
              total={total}
              params={{ stage, q: search, status }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
