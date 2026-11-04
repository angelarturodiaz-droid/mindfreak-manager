import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  History,
  MapPin,
  Pencil,
  Receipt,
  User,
} from "lucide-react";
import { getAsset, listAssetLocations, listAssetTypes, listResponsibleSuggestions } from "@/features/assets/queries";
import { setAssetCoverAction } from "@/features/assets/actions";
import {
  ASSET_EVENT_LABELS,
  ASSET_STATUS_INFO,
  ASSET_STATUS_LABELS,
  ASSET_STATUS_TONES,
  describeAssetEventValue,
  formatQuantity,
} from "@/features/assets/schema";
import { AssetDetailsPanel } from "@/components/assets/asset-edit";
import { PhotoGallery } from "@/components/directory/directory-panel";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { hasPermission } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";
import { PAYMENT_METHOD_LABELS } from "@/features/payments/schema";

function when(iso: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Valor o un texto gris cuando falta («Sin asignar»). */
function Val({ children, empty = "Sin asignar" }: { children: React.ReactNode; empty?: string }) {
  const missing = children === null || children === undefined || children === "" || children === false;
  return missing ? <span className="italic text-brand-muted">{empty}</span> : <>{children}</>;
}

/** Dato clave del encabezado: ícono, título y valor. */
function KeyFact({ icon, label, children, sub }: { icon: React.ReactNode; label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-brand-background px-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-surface text-brand-accent shadow-[var(--shadow-sm)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-brand-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-brand-text">{children}</p>
        {sub && <p className="text-xs text-brand-muted">{sub}</p>}
      </div>
    </div>
  );
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  CREATED: <Boxes size={12} aria-hidden />,
  responsible: <User size={12} aria-hidden />,
  location: <MapPin size={12} aria-hidden />,
  status: <Archive size={12} aria-hidden />,
  quantity: <Boxes size={12} aria-hidden />,
  value: <CircleDollarSign size={12} aria-hidden />,
};

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; editar?: string }>;
}) {
  const { id } = await params;
  const { nuevo, editar } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [asset, canManage, canUpload, canSeeExpenses, types, locations, suggestions, canEditLists] = await Promise.all([
    getAsset(id),
    hasPermission("assets.manage"),
    hasPermission("documents.upload"),
    hasPermission("expenses.view"),
    listAssetTypes(),
    listAssetLocations(),
    listResponsibleSuggestions(),
    hasPermission("settings.manage"),
  ]);
  if (!asset) notFound();

  const cover = asset.photos.find((p) => p.id === asset.coverId) ?? asset.photos[0] ?? null;
  const retired = asset.status === "DADO_DE_BAJA";
  const returnHere = encodeURIComponent(`/assets/${asset.id}`);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-8">
      <Link href="/assets" className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Activos
      </Link>

      {nuevo && (
        <p className="rounded-[var(--radius-md)] border border-brand-success/30 bg-brand-success-bg px-3 py-2 text-sm text-brand-text">
          ✓ Activo <strong>{asset.code}</strong> registrado. Ahora súbele una <strong>foto</strong> (a la derecha) para reconocerlo rápido en la lista.
        </p>
      )}
      {retired && (
        <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface-hover px-3 py-2 text-sm text-brand-text">
          <Archive size={16} className="mt-0.5 shrink-0 text-brand-muted" aria-hidden />
          <span>
            <strong>Dado de baja:</strong> ya no se usa. Se queda en la lista para el historial, pero no cuenta en las tarjetas de arriba de
            Activos (cantidad ni valor). Si vuelve a usarse, edítalo y ponle «En uso».
          </span>
        </p>
      )}

      {/* Encabezado: foto, código, nombre, estado y datos clave */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-brand-border bg-brand-surface-hover">
            {cover?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage
              <img src={cover.url} alt={asset.description} className={`h-full w-full object-cover ${retired ? "grayscale" : ""}`} />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] text-brand-muted">
                <Boxes size={22} aria-hidden /> Sin foto
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[var(--radius-md)] bg-brand-accent-light px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-accent">{asset.code}</span>
              <span title={ASSET_STATUS_INFO[asset.status]} className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_TONES[asset.status]}`}>
                {ASSET_STATUS_LABELS[asset.status]}
              </span>
              {asset.isConsumable && (
                <span title="Se consume o se regala en los eventos (no es activo fijo)" className="rounded-full bg-brand-info-bg px-2 py-0.5 text-xs font-medium text-brand-info">
                  Se consume
                </span>
              )}
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-brand-primary">{asset.description}</h1>
            <p className="mt-0.5 text-sm text-brand-muted">
              {asset.typeName ?? "Sin tipo"} · registrado el {formatDate(asset.createdAt.slice(0, 10))}
            </p>
          </div>
          {canManage && !editar && (
            <Link
              href={`/assets/${asset.id}?editar=1#datos`}
              title="Cambiar responsable, ubicación, estado, cantidad, valor o el nombre"
              className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-brand-primary px-3.5 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-brand-primary-hover"
            >
              <Pencil size={14} aria-hidden /> Editar activo
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <KeyFact icon={<User size={15} />} label="Responsable">
            <Val>{asset.responsibleName}</Val>
          </KeyFact>
          <KeyFact icon={<MapPin size={15} />} label="Ubicación">
            <Val>{asset.locationName}</Val>
          </KeyFact>
          <KeyFact icon={<Boxes size={15} />} label="Cantidad">
            {formatQuantity(asset.quantity)} {asset.quantity === 1 ? "unidad" : "unidades"}
          </KeyFact>
          <KeyFact
            icon={<CircleDollarSign size={15} />}
            label="Valor de compra"
            sub={asset.purchaseDate ? `Comprado el ${formatDate(asset.purchaseDate)}` : undefined}
          >
            <Val empty="Sin valor anotado">{asset.value ? formatMoney(asset.value, asset.currency) : null}</Val>
          </KeyFact>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* Columna principal: información (o el formulario al editar) e historial */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <AssetDetailsPanel
            key={editar ? "editar" : "ver"}
            assetId={asset.id}
            canEdit={canManage}
            startEditing={Boolean(editar)}
            types={types}
            locations={locations}
            responsibleSuggestions={suggestions}
            canEditLists={canEditLists}
            values={{
              description: asset.description,
              detail: asset.detail,
              typeId: asset.typeId,
              quantity: asset.quantity,
              responsibleName: asset.responsibleName,
              locationId: asset.locationId,
              value: asset.value,
              currency: asset.currency,
              purchaseDate: asset.purchaseDate,
              status: asset.status,
              isConsumable: asset.isConsumable,
            }}
          >
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-brand-muted">Tipo</dt>
                <dd className="mt-0.5 text-brand-text">
                  <Val>{asset.typeName}</Val>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-muted">Estado</dt>
                <dd className="mt-0.5 flex flex-col gap-0.5">
                  <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_TONES[asset.status]}`}>{ASSET_STATUS_LABELS[asset.status]}</span>
                  <span className="text-xs text-brand-muted">{ASSET_STATUS_INFO[asset.status]}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-brand-muted">¿Se consume o se regala?</dt>
                <dd className="mt-0.5 text-brand-text">{asset.isConsumable ? "Sí: se gasta o se entrega en los eventos" : "No: es un activo fijo"}</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-muted">Fecha de compra</dt>
                <dd className="mt-0.5 text-brand-text">
                  <Val empty="No anotada">{asset.purchaseDate ? formatDate(asset.purchaseDate) : null}</Val>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-brand-muted">Detalle</dt>
                <dd className="mt-0.5 whitespace-pre-line text-brand-text">
                  <Val empty="Sin detalle (color, tamaño, marca, número de serie…)">{asset.detail}</Val>
                </dd>
              </div>
            </dl>
          </AssetDetailsPanel>

          <Card className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              <History size={15} aria-hidden /> Historial
              <InfoHint text="Se anota solo cada vez que cambia el responsable, la ubicación, el estado, la cantidad o el valor: quién lo cambió y cuándo. Nadie lo puede borrar." />
            </h2>
            {asset.events.length === 0 ? (
              <p className="text-sm text-brand-muted">Sin cambios todavía.</p>
            ) : (
              <ol className="relative flex flex-col gap-4 border-l border-brand-border pl-5">
                {asset.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[29px] top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-brand-border bg-brand-surface text-brand-muted">
                      {EVENT_ICONS[e.field] ?? <History size={12} aria-hidden />}
                    </span>
                    {e.field === "CREATED" ? (
                      <p className="text-sm font-medium text-brand-text">Se registró como {e.newValue}</p>
                    ) : (
                      <p className="flex flex-wrap items-center gap-1.5 text-sm text-brand-text">
                        <span className="font-medium">{ASSET_EVENT_LABELS[e.field] ?? e.field}:</span>
                        <span className="text-brand-muted line-through decoration-brand-muted/40">{describeAssetEventValue(e.field, e.oldValue)}</span>
                        <ArrowRight size={13} className="text-brand-muted" aria-hidden />
                        <span className="font-medium">{describeAssetEventValue(e.field, e.newValue)}</span>
                      </p>
                    )}
                    <p className="text-xs text-brand-muted">
                      {when(e.at)} · {e.by}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Columna lateral: fotos y compra */}
        <div className="flex flex-col gap-4">
          <PhotoGallery
            entityType="asset"
            entityId={asset.id}
            photos={asset.photos}
            coverId={asset.coverId}
            canEdit={canManage}
            canUpload={canManage && canUpload}
            setCover={setAssetCoverAction.bind(null, asset.id)}
            help={
              <>
                De frente, la etiqueta o el número de serie, y cómo se ve armado. La <strong>Portada</strong> sale en la lista y arriba; para cambiarla pasa el
                mouse sobre otra y pulsa <em>Usar de portada</em>.
              </>
            }
          />

          <Card className="flex flex-col gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              <Receipt size={15} aria-hidden /> Cómo se compró
              <InfoHint text="Si se registró desde un gasto («Registrar como activo»), aquí sale ese gasto y cómo se pagó (tarjeta o banco). El activo solo lee el gasto: no lo cambia." />
            </h2>
            {asset.expense ? (
              <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-brand-border p-3">
                {canSeeExpenses ? (
                  <Link
                    href={`/expenses/${asset.expense.id}?return_to=${returnHere}`}
                    className="flex items-center justify-between gap-2 text-sm font-medium text-brand-accent hover:underline"
                    title="Abrir el gasto (con «Volver al activo» para regresar aquí)"
                  >
                    {asset.expense.description}
                    <ArrowRight size={14} aria-hidden />
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-brand-text">{asset.expense.description}</span>
                )}
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-brand-muted">Total del gasto</dt>
                    <dd className="font-medium tabular-nums text-brand-text">{formatMoney(asset.expense.total, asset.expense.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-brand-muted">Fecha</dt>
                    <dd className="flex items-center gap-1 text-brand-text">
                      <CalendarDays size={11} aria-hidden /> {formatDate(asset.expense.date)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-brand-muted">Proveedor</dt>
                    <dd className="text-brand-text">
                      <Val empty="Sin proveedor">{asset.expense.supplierName}</Val>
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-brand-muted">Cómo se pagó</dt>
                    <dd className="flex flex-wrap gap-1 pt-0.5">
                      {asset.expense.methods.length ? (
                        asset.expense.methods.map((m) => (
                          <span key={m} className="inline-flex items-center gap-1 rounded-full bg-brand-surface-hover px-2 py-0.5 text-brand-text">
                            <CreditCard size={11} aria-hidden /> {PAYMENT_METHOD_LABELS[m] ?? m}
                          </span>
                        ))
                      ) : (
                        <span className="italic text-brand-muted">Todavía sin pagos registrados</span>
                      )}
                      {asset.expense.accounts.map((a) => (
                        <span key={a} className="rounded-full bg-brand-surface-hover px-2 py-0.5 text-brand-text">
                          {a}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-xs text-brand-muted">
                No está ligado a un gasto. Para ligarlo, regístralo desde el gasto con <em>Registrar como activo</em> (en los activos que ya estaban antes
                del sistema no hace falta).
              </p>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
