import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, History, MapPin, Pencil, Receipt, User } from "lucide-react";
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

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:p-8">
      <Link href="/assets" className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Activos
      </Link>

      {nuevo && (
        <p className="rounded-[var(--radius-md)] border border-brand-success/30 bg-brand-success-bg px-3 py-2 text-sm text-brand-text">
          ✓ Activo <strong>{asset.code}</strong> registrado. Ahora súbele una <strong>foto</strong> (a la derecha) para reconocerlo
          rápido en la lista.
        </p>
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-md)] bg-brand-accent-light px-2.5 py-1 text-sm font-semibold tabular-nums text-brand-accent">
            {asset.code}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-primary">{asset.description}</h1>
          <span title={ASSET_STATUS_INFO[asset.status]} className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_TONES[asset.status]}`}>
            {ASSET_STATUS_LABELS[asset.status]}
          </span>
          {canManage && !editar && (
            <Link
              href={`/assets/${asset.id}?editar=1#datos`}
              title="Cambiar responsable, ubicación, estado, cantidad, valor o el nombre"
              className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-brand-border px-3 py-1.5 text-sm font-medium text-brand-text hover:border-brand-accent hover:text-brand-accent"
            >
              <Pencil size={14} aria-hidden /> Editar activo
            </Link>
          )}
          {asset.isConsumable && (
            <span title="Se consume o se regala en los eventos (no es activo fijo)" className="rounded-full bg-brand-info-bg px-2 py-0.5 text-xs font-medium text-brand-info">
              Se consume
            </span>
          )}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Boxes size={15} className="text-brand-muted" aria-hidden />
            <dt className="text-brand-muted">Cantidad</dt>
            <dd className="font-medium tabular-nums text-brand-text">{formatQuantity(asset.quantity)}</dd>
            {asset.typeName && <dd className="text-brand-muted">· {asset.typeName}</dd>}
          </div>
          <div className="flex items-center gap-1.5">
            <User size={15} className="text-brand-muted" aria-hidden />
            <dt className="sr-only">Responsable</dt>
            <dd className={asset.responsibleName ? "text-brand-text" : "text-brand-muted"}>{asset.responsibleName ?? "Sin responsable"}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={15} className="text-brand-muted" aria-hidden />
            <dt className="sr-only">Ubicación</dt>
            <dd className={asset.locationName ? "text-brand-text" : "text-brand-muted"}>{asset.locationName ?? "Sin ubicación"}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-brand-muted">Valor de compra</dt>
            <dd className="font-medium tabular-nums text-brand-text">{asset.value ? formatMoney(asset.value, asset.currency) : "—"}</dd>
            {asset.purchaseDate && <dd className="text-brand-muted">· {formatDate(asset.purchaseDate)}</dd>}
          </div>
        </dl>
        {asset.detail && <p className="text-sm text-brand-muted">{asset.detail}</p>}
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
          />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
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
                Fotos del activo para reconocerlo (de frente, la etiqueta o el número de serie, cómo se ve armado). La que dice{" "}
                <strong>Portada</strong> sale en la lista; para cambiarla pasa el mouse sobre otra y pulsa <em>Usar de portada</em>.
              </>
            }
          />

          <Card className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              <Receipt size={15} aria-hidden /> Cómo se compró
              <InfoHint text="Si se registró desde un gasto («Registrar como activo»), aquí sale ese gasto y cómo se pagó (tarjeta o banco). El activo solo lee el gasto: no lo cambia." />
            </p>
            {asset.expense ? (
              <div className="text-sm">
                {canSeeExpenses ? (
                  <Link href={`/expenses/${asset.expense.id}`} className="font-medium text-brand-accent hover:underline">
                    {asset.expense.description}
                  </Link>
                ) : (
                  <span className="font-medium text-brand-text">{asset.expense.description}</span>
                )}
                <p className="text-xs text-brand-muted">
                  {formatMoney(asset.expense.total, asset.expense.currency)} · {formatDate(asset.expense.date)}
                  {asset.expense.supplierName ? ` · ${asset.expense.supplierName}` : ""}
                </p>
                <p className="mt-1 text-xs text-brand-text">
                  {asset.expense.methods.length
                    ? `Pagado con: ${asset.expense.methods.map((m) => PAYMENT_METHOD_LABELS[m] ?? m).join(", ")}${asset.expense.accounts.length ? ` (${asset.expense.accounts.join(", ")})` : ""}`
                    : "Todavía sin pagos registrados."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-brand-muted">
                No está ligado a un gasto. Para ligarlo, regístralo desde el gasto con <em>Registrar como activo</em> (en los activos que ya
                estaban antes del sistema no hace falta).
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
              <History size={15} aria-hidden /> Historial
              <InfoHint text="Se anota solo cada vez que cambia el responsable, la ubicación, el estado, la cantidad o el valor: quién lo cambió y cuándo. Nadie lo puede borrar." />
            </p>
            {asset.events.length === 0 ? (
              <p className="text-xs text-brand-muted">Sin cambios todavía.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {asset.events.map((e) => (
                  <li key={e.id} className="border-l-2 border-brand-border pl-3 text-xs">
                    <p className="text-brand-text">
                      {e.field === "CREATED" ? (
                        <strong>Se registró como {e.newValue}</strong>
                      ) : (
                        <>
                          <strong>{ASSET_EVENT_LABELS[e.field] ?? e.field}:</strong> {describeAssetEventValue(e.field, e.oldValue)} →{" "}
                          <strong>{describeAssetEventValue(e.field, e.newValue)}</strong>
                        </>
                      )}
                    </p>
                    <p className="text-brand-muted">
                      {when(e.at)} · {e.by}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
