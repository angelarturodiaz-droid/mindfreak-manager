import Link from "next/link";
import { MessageCircle, Mail, Smile } from "lucide-react";
import { getReminderSettings, listReminderLog, type ReminderLogRow } from "@/features/reminders/queries";
import { getSurveySettings } from "@/features/surveys/queries";
import { stepLabel } from "@/features/reminders/schedule";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Chip } from "@/components/ui/page-kit";
import { PAGE_SIZE, parsePage } from "@/lib/utils/pagination";
import { formatDateTime } from "@/lib/utils/dates";
import { GeneralSwitch, InvoiceReminderForm, SurveyReminderForm } from "./reminder-settings-form";
import { TypePicker } from "@/components/settings/type-picker";

/** Tipos de recordatorio (los "próximamente" quedan listos para agregarse). */
const TYPES = [
  { value: "facturas", label: "Facturas por cobrar" },
  { value: "encuesta", label: "Encuesta de satisfacción" },
  { value: "cotizaciones", label: "Cotizaciones por vencer", soon: true },
];
import { RemindersToday } from "./reminders-today";

const STATUS: Record<ReminderLogRow["status"], { label: string; tone: "success" | "danger" | "muted" }> = {
  SENT: { label: "Enviado", tone: "success" },
  FAILED: { label: "Falló", tone: "danger" },
  PENDING: { label: "Enviando…", tone: "muted" },
};

export default async function RemindersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const tipo = TYPES.some((t) => t.value === sp.tipo) ? sp.tipo! : "facturas";
  const [settings, log, survey] = await Promise.all([
    getReminderSettings(),
    listReminderLog(page),
    getSurveySettings().catch(() => null),
  ]);

  const columns: Column<ReminderLogRow>[] = [
    { header: "Fecha", accessor: (r) => <span className="whitespace-nowrap text-brand-muted">{formatDateTime(r.sent_at ?? r.created_at)}</span> },
    {
      header: "Documento",
      accessor: (r) =>
        r.href ? (
          <Link href={r.href} className="font-medium text-brand-text hover:text-brand-accent">
            {r.document ?? "—"}
          </Link>
        ) : (
          <span>{r.document ?? "—"}</span>
        ),
    },
    {
      header: "Recordatorio",
      info: "Qué recordatorio fue: días respecto al vencimiento (facturas) o número de recordatorio (encuestas).",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          {r.channel === "WHATSAPP" ? (
            <MessageCircle size={14} className="text-brand-success" aria-label="WhatsApp" />
          ) : r.kind === "SURVEY" ? (
            <Smile size={14} className="text-brand-accent" aria-label="Encuesta" />
          ) : (
            <Mail size={14} className="text-brand-muted" aria-label="Correo" />
          )}
          <Chip tone={r.kind === "SURVEY" ? "success" : "muted"}>{r.kind === "SURVEY" ? "Encuesta" : "Factura"}</Chip>
          {r.kind === "SURVEY" ? `recordatorio ${r.step}` : stepLabel(r.step)}
        </span>
      ),
    },
    {
      header: "Para",
      accessor: (r) => (
        <span className="text-brand-muted">
          {r.recipient || (r.channel === "WHATSAPP" ? "sin teléfono (se eligió el chat)" : "—")}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: (r) => (
        <span title={r.error ?? undefined}>
          <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>
        </span>
      ),
    },
    { header: "Quién", info: "Tarea diaria (8:15 a. m.), botón «Enviar ahora» o la persona que abrió el WhatsApp.", accessor: (r) => <span className="text-brand-muted">{r.who}</span> },
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-primary">
          Recordatorios
          <InfoHint text="Aquí se decide QUÉ recordatorios están encendidos y CUÁNDO salen. Lo que dice cada mensaje se edita en Configuración → Mensajes al cliente. Los avisos internos de la campana al responsable de cobro siguen funcionando aparte." />
        </h2>
        <p className="text-sm text-brand-muted">
          Qué se le recuerda al cliente y cuándo. Los textos están en{" "}
          <Link href="/settings/messages" className="text-brand-accent hover:underline">
            Mensajes al cliente
          </Link>
          .
        </p>
      </div>

      {!settings.ready && (
        <Card className="border-brand-warning/40 bg-brand-warning-bg text-sm text-brand-text">
          Falta aplicar la migración <strong>086</strong> en la base de datos para usar los recordatorios.
        </Card>
      )}

      <GeneralSwitch key={`g-${settings.updated_at ?? ""}`} enabled={settings.auto_send_enabled} />

      <TypePicker
        label="¿Qué recordatorio quieres configurar?"
        hint="Cada tipo tiene su propio encendido y su calendario. Los textos que recibe el cliente se editan en Configuración → Mensajes al cliente."
        options={TYPES}
        value={tipo}
      />

      {tipo === "facturas" && (
        <InvoiceReminderForm
          key={`f-${settings.updated_at ?? ""}`}
          settings={{ invoice_enabled: settings.invoice_enabled, invoice_days: settings.invoice_days }}
        />
      )}
      {tipo === "encuesta" && (
        <SurveyReminderForm
          key={`e-${survey?.updated_at ?? ""}`}
          generalOn={settings.auto_send_enabled}
          settings={{
            send_by_default: survey?.send_by_default ?? true,
            reminder_enabled: Boolean(survey?.reminder_enabled),
            reminder_after_days: survey?.reminder_after_days ?? 3,
            max_reminders: survey?.max_reminders ?? 1,
          }}
        />
      )}
      {tipo === "cotizaciones" && (
        <Card className="text-sm text-brand-muted">
          <strong className="text-brand-text">Próximamente.</strong> Avisar al cliente antes de que venza su cotización.
          Cuando se agregue, tendrá aquí su encendido y su calendario, y su texto en Mensajes al cliente.
        </Card>
      )}

      <RemindersToday autoSendEnabled={settings.auto_send_enabled} />

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
          Historial de envíos — todos los tipos
          <InfoHint text="Cada recordatorio enviado (o que falló) por correo o WhatsApp, de facturas y de la encuesta. Pasa el mouse por «Falló» para ver el motivo." />
        </h3>
        <DataTable
          columns={columns}
          rows={log.rows}
          keyFor={(r) => r.id}
          emptyMessage="Todavía no se ha enviado ningún recordatorio."
          maxWidth="max-w-none"
        />
        <Pagination basePath="/settings/reminders" page={page} pageSize={PAGE_SIZE} total={log.total} />
      </section>
    </div>
  );
}
