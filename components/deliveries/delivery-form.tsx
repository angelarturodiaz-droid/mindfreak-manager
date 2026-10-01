"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ActionState } from "@/features/deliveries/actions";
import {
  DEFAULT_DELIVERY_PLACE,
  DELIVERY_TYPES,
  DELIVERY_TYPE_LABELS,
  DELIVERY_TYPE_TEXT,
  defaultFooterNote,
  defaultIntroText,
  formatTotal,
} from "@/features/deliveries/schema";
import { Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { todayISO } from "@/lib/utils/dates";

type Row = { key: number; description: string; reference: string; quantity: string };

/** Clave única de cada fila del editor (para que React no mezcle filas al moverlas). */
let rowSeq = 0;
const newKey = () => ++rowSeq;

export type DeliveryFormValues = {
  client_id: string;
  project_id: string;
  delivery_type: string;
  subtitle: string;
  delivery_date: string;
  place: string;
  recipient_name: string;
  recipient_short_name: string;
  recipient_department: string;
  reference: string;
  intro_text: string;
  notes: string;
  copies: number;
  delivered_by_name: string;
  delivered_by_id_number: string;
  items: { description: string; reference: string | null; quantity: number }[];
};

const initialState: ActionState = { error: null };

function SectionTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent-light text-xs font-semibold text-brand-accent">
        {n}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-brand-text">{title}</h2>
        {hint && <p className="text-xs text-brand-muted">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Formulario de acuse (crear y editar). Las líneas se envían como JSON en el
 * campo oculto "items". Se envía con onSubmit (no con action del <form>)
 * para que, si hay un error, no se borre lo escrito.
 */
export function DeliveryForm({
  action,
  clients,
  projects,
  companyName,
  initial,
  returnTo = null,
  submitLabel,
  cancelHref,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  clients: { id: string; name: string; is_active: boolean }[];
  projects: { id: string; number: string; name: string; client_id: string | null }[];
  companyName: string;
  initial?: Partial<DeliveryFormValues>;
  returnTo?: string | null;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();

  const [clientId, setClientId] = useState(initial?.client_id ?? "");
  const [projectId, setProjectId] = useState(initial?.project_id ?? "");
  const [type, setType] = useState(initial?.delivery_type ?? "DOCUMENTS");
  const initialClientName = clients.find((c) => c.id === (initial?.client_id ?? ""))?.name ?? "";
  const [recipient, setRecipient] = useState(initial?.recipient_name ?? initialClientName);
  // El destinatario se llena con el nombre del cliente mientras no se edite a mano.
  const [recipientTouched, setRecipientTouched] = useState(Boolean(initial?.recipient_name));
  const [shortName, setShortName] = useState(initial?.recipient_short_name ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [copies, setCopies] = useState(String(initial?.copies ?? 2));
  const toRows = (list: DeliveryFormValues["items"] | undefined): Row[] =>
    (list && list.length > 0 ? list : [{ description: "", reference: "", quantity: 1 }]).map((i) => ({
      key: newKey(),
      description: i.description,
      reference: i.reference ?? "",
      quantity: String(i.quantity ?? 1),
    }));
  const [rows, setRows] = useState<Row[]>(() => toRows(initial?.items));

  const typeText = DELIVERY_TYPE_TEXT[type] ?? DELIVERY_TYPE_TEXT.OTHER;
  const clientProjects = projects.filter((p) => !clientId || p.client_id === clientId);
  const filled = rows.filter((r) => r.description.trim());
  const total = filled.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  const introPreview = useMemo(
    () =>
      defaultIntroText({
        companyName,
        recipientName: recipient || "el destinatario",
        recipientShortName: shortName,
        deliveryType: type,
        reference,
      }),
    [companyName, recipient, shortName, type, reference],
  );

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { key: newKey(), description: "", reference: "", quantity: "1" }]);
  }
  function removeRow(key: number) {
    setRows((prev) => (prev.length === 1 ? [{ key: newKey(), description: "", reference: "", quantity: "1" }] : prev.filter((r) => r.key !== key)));
  }
  function moveRow(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set(
      "items",
      JSON.stringify(
        rows.map((r) => ({ description: r.description, reference: r.reference, quantity: r.quantity || "1" })),
      ),
    );
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-4xl flex-col gap-5">
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      <Card>
        <SectionTitle n={1} title="Cliente y entrega" hint="A quién se le entrega y qué tipo de entrega es." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Cliente"
            name="client_id"
            required
            value={clientId}
            onChange={(e) => {
              const id = e.target.value;
              setClientId(id);
              if (projectId && !projects.some((p) => p.id === projectId && p.client_id === id)) setProjectId("");
              if (!recipientTouched) setRecipient(clients.find((c) => c.id === id)?.name ?? "");
            }}
          >
            <option value="" disabled>
              Selecciona el cliente…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_active ? "" : " (inactivo)"}
              </option>
            ))}
          </Select>
          <Select
            label="Proyecto / evento (opcional)"
            name="project_id"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            hint={clientId && clientProjects.length === 0 ? "Este cliente no tiene proyectos." : undefined}
          >
            <option value="">Sin proyecto</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number} — {p.name}
              </option>
            ))}
          </Select>
          <Select label="Qué se entrega" name="delivery_type" value={type} onChange={(e) => setType(e.target.value)}>
            {DELIVERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {DELIVERY_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" name="delivery_date" type="date" required defaultValue={initial?.delivery_date ?? todayISO()} />
            <Input label="Lugar" name="place" defaultValue={initial?.place ?? DEFAULT_DELIVERY_PLACE} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle n={2} title="Destinatario y referencia" hint="Así aparece arriba en el acuse." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input
              label="Destinatario"
              name="recipient_name"
              required
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                setRecipientTouched(true);
              }}
              placeholder="Ej. Empresa de Transmisión Eléctrica Dominicana"
              hint="Se llena con el nombre del cliente; puedes escribir el nombre completo de la institución."
            />
          </div>
          <Input
            label="Siglas / nombre corto"
            name="recipient_short_name"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="Ej. ETED"
            hint="Va en el recuadro «Recibido por»."
          />
          <div className="sm:col-span-3">
            <Input
              label="Departamento / área (opcional)"
              name="recipient_department"
              defaultValue={initial?.recipient_department ?? ""}
              placeholder="Ej. Departamento de Compras y Contrataciones"
            />
          </div>
          <div className="sm:col-span-3">
            <Input
              label="Referencia (opcional)"
              name="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. Orden de Compra No. 4500016121 | Gestión de evento Cisco"
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle
          n={3}
          title={`${typeText.noun.charAt(0).toUpperCase()}${typeText.noun.slice(1)} que se entregan`}
          hint="Una línea por cada cosa entregada. En el acuse se numeran 01, 02, 03…"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-brand-muted">
                <th className="w-10 pb-2 font-medium">No.</th>
                <th className="pb-2 font-medium">{typeText.itemHeader}</th>
                <th className="w-56 pb-2 font-medium">{typeText.referenceHeader}</th>
                <th className="w-20 pb-2 font-medium">Cant.</th>
                <th className="w-24 pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} className="align-top">
                  <td className="pt-2.5 pr-2 font-semibold tabular-nums text-brand-accent">{String(i + 1).padStart(2, "0")}</td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Descripción línea ${i + 1}`}
                      value={r.description}
                      onChange={(e) => updateRow(r.key, { description: e.target.value })}
                      placeholder={i === 0 ? "Ej. Factura - Gestión de evento" : ""}
                      className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-light"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Referencia línea ${i + 1}`}
                      value={r.reference}
                      onChange={(e) => updateRow(r.key, { reference: e.target.value })}
                      placeholder={i === 0 ? (type === "EQUIPMENT" ? "Ej. No. de serie" : "Ej. NCF B1500000001") : ""}
                      className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-light"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Cantidad línea ${i + 1}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={r.quantity}
                      onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                      className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-2 py-2 text-right text-sm tabular-nums outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-light"
                    />
                  </td>
                  <td className="py-1">
                    <div className="flex items-center justify-end gap-0.5 pt-1">
                      <button type="button" title="Subir" onClick={() => moveRow(i, -1)} disabled={i === 0} className="rounded p-1 text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text disabled:opacity-30">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" title="Bajar" onClick={() => moveRow(i, 1)} disabled={i === rows.length - 1} className="rounded p-1 text-brand-muted hover:bg-brand-surface-hover hover:text-brand-text disabled:opacity-30">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" title="Quitar línea" onClick={() => removeRow(r.key)} className="rounded p-1 text-brand-muted hover:bg-brand-danger-bg hover:text-brand-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-3">
          <Button type="button" variant="outline" size="sm" icon={<Plus size={14} />} onClick={addRow}>
            Agregar línea
          </Button>
          <p className="text-sm text-brand-muted">
            {typeText.totalLabel}:{" "}
            <span className="text-base font-semibold tabular-nums text-brand-text">{formatTotal(total)}</span>
          </p>
        </div>
      </Card>

      <Card>
        <details open={Boolean(initial?.intro_text || initial?.notes || initial?.subtitle || initial?.delivered_by_name)}>
          <summary className="cursor-pointer list-none">
            <SectionTitle n={4} title="Textos del acuse (opcional)" hint="Subtítulo, párrafo de entrada, nota y quién entrega. Si los dejas vacíos se usan los textos del modelo." />
          </summary>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Subtítulo" name="subtitle" defaultValue={initial?.subtitle ?? ""} placeholder={typeText.subtitle} hint="Debajo de «ACUSE DE ENTREGA»." />
            <Select label="Ejemplares" name="copies" value={copies} onChange={(e) => setCopies(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <div className="sm:col-span-2">
              <Textarea
                label="Párrafo de entrada"
                name="intro_text"
                rows={3}
                defaultValue={initial?.intro_text ?? ""}
                placeholder={introPreview}
                hint="Vacío = se usa el texto de ejemplo (se arma solo con el destinatario, el tipo y la referencia)."
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Nota adicional (opcional)"
                name="notes"
                defaultValue={initial?.notes ?? ""}
                placeholder="Se agrega después de la nota del pie"
                hint={`Nota del pie: «${defaultFooterNote(type, Number(copies))}»`}
              />
            </div>
            <Input label="Entregado por — nombre (opcional)" name="delivered_by_name" defaultValue={initial?.delivered_by_name ?? ""} hint="Vacío = línea en blanco para escribir a mano." />
            <Input label="Entregado por — cédula (opcional)" name="delivered_by_id_number" defaultValue={initial?.delivered_by_id_number ?? ""} />
          </div>
        </details>
      </Card>

      {state.error && (
        <p className="rounded-[var(--radius-md)] border border-brand-danger/30 bg-brand-danger-bg px-4 py-3 text-sm text-brand-danger">{state.error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
