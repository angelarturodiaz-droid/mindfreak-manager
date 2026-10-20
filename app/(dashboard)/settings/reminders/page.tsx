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
import { ReminderSettingsForm } from "./reminder-settings-form";
import { RemindersToday } from "./reminders-today";

const STATUS: Record<ReminderLogRow["status"], { label: string; tone: "success" | "danger" | "muted" }> = {
  SENT: { label: "Enviado", tone: "success" },
  FAILED: { label: "Falló", tone: "danger" },
  PENDING: { label: "Enviando…", tone: "muted" },
};

export default async function RemindersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
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
          {r.kind === "SURVEY" ? `Encuesta · recordatorio ${r.step}` : stepLabel(r.step)}
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
          <InfoHint text="El sistema recuerda a los clientes sus facturas por vencer o vencidas y las encuestas sin responder, por correo (automático) y por WhatsApp (lista diaria en Facturas, lo envías tú). Los avisos internos de la campana al responsable de cobro siguen funcionando aparte." />
        </h2>
        <p className="text-sm text-brand-muted">Correos automáticos a clientes y lista diaria para WhatsApp.</p>
      </div>

      {!settings.ready && (
        <Card className="border-brand-warning/40 bg-brand-warning-bg text-sm text-brand-text">
          Falta aplicar la migración <strong>086</strong> en la base de datos para usar los recordatorios.
        </Card>
      )}

      <ReminderSettingsForm
        key={`${settings.updated_at ?? "nuevo"}-${survey?.updated_at ?? ""}`}
        settings={{
          auto_send_enabled: settings.auto_send_enabled,
          invoice_days: settings.invoice_days,
          invoice_subject: settings.invoice_subject,
          invoice_message: settings.invoice_message,
          whatsapp_message: settings.whatsapp_message,
          survey_reminder_enabled: Boolean(survey?.reminder_enabled),
          survey_after_days: survey?.reminder_after_days ?? 3,
          survey_max: survey?.max_reminders ?? 1,
        }}
      />

      <RemindersToday autoSendEnabled={settings.auto_send_enabled} />

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
          Historial de envíos
          <InfoHint text="Cada recordatorio enviado (o que falló) por correo o WhatsApp. Pasa el mouse por «Falló» para ver el motivo." />
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
