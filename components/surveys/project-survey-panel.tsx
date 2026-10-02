import { getAppUrl } from "@/lib/utils/app-url";
import {
  Ban,
  CalendarCheck,
  Eye,
  Mail,
  MessageSquareQuote,
  RefreshCw,
  RotateCcw,
  Send,
  Smile,
  Star,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listProjectSurveys, listSurveyAnswers, resolveSurveyRecipient } from "@/features/surveys/queries";
import { SURVEY_STATUS_LABELS, SURVEY_STATUS_TONE, npsCategory } from "@/features/surveys/schema";
import {
  cancelSurveyAction,
  reopenSurveyAction,
  resendSurveyAction,
  sendNewSurveyAction,
  shareSurveyWhatsappAction,
} from "@/features/surveys/actions";
import { CopySurveyLinkButton, SurveyActionButton, SurveySendButton, SurveyWhatsappButton } from "./survey-action-button";
import { relationRow } from "@/lib/utils/relation";

function fmt(date: string | null | undefined, withTime = true): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "America/Santo_Domingo",
  }).format(new Date(date));
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={s <= Math.round(value) ? "fill-brand-warning text-brand-warning" : "text-brand-disabled"}
          aria-hidden
        />
      ))}
    </span>
  );
}

function Metric({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface p-4">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-muted">
        {icon}
        {label}
      </span>
      <div className="text-brand-text">{children}</div>
    </div>
  );
}

export async function ProjectSurveyPanel({
  projectId,
  projectStatus,
  canSend,
}: {
  projectId: string;
  projectStatus: string;
  canSend: boolean;
}) {
  const [surveys, recipient] = await Promise.all([listProjectSurveys(projectId), resolveSurveyRecipient(projectId)]);
  const latest = surveys[0] ?? null;
  const history = surveys.slice(1);
  const answers = latest && latest.responded_at ? await listSurveyAnswers(latest.id) : [];

  const origin = await getAppUrl();
  const linkOf = (token: string) => `${origin}/encuesta/${token}`;

  const recipientLine = recipient.email
    ? `${recipient.name ? `${recipient.name} · ` : ""}${recipient.email}`
    : recipient.phone
      ? `${recipient.name ? `${recipient.name} · ` : ""}WhatsApp ${recipient.phone}`
      : "El cliente no tiene correo ni teléfono registrado (podrás copiar el enlace).";

  if (!latest) {
    return (
      <section className="flex max-w-3xl flex-col gap-4">
        <header>
          <h2 className="text-base font-semibold text-brand-text">Satisfacción del cliente</h2>
          <p className="text-sm text-brand-muted">Encuesta que responde el cliente al cerrar el evento.</p>
        </header>
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
            <Smile size={24} aria-hidden />
          </span>
          <p className="font-medium text-brand-text">Todavía no se ha enviado la encuesta</p>
          <p className="max-w-md text-sm text-brand-muted">
            {projectStatus === "COMPLETED"
              ? "El proyecto está completado. Puedes enviarle la encuesta al cliente ahora."
              : "Se ofrece automáticamente al finalizar el proyecto. También puedes enviarla ahora."}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-brand-muted">
            <Mail size={13} aria-hidden /> {recipientLine}
          </p>
          {canSend && (
            <SurveySendButton
              action={sendNewSurveyAction.bind(null, projectId)}
              label="Enviar encuesta"
              title="Enviar encuesta de satisfacción"
              submitLabel="Enviar encuesta"
              icon={<Send size={14} />}
              variant="secondary"
              defaultName={recipient.name ?? ""}
              defaultEmail={recipient.email ?? ""}
              defaultPhone={recipient.phone ?? ""}
              chooseChannel
            />
          )}
        </Card>
      </section>
    );
  }

  const nps = npsCategory(latest.nps_score);
  const isOpen = latest.status === "PENDING" || latest.status === "SENT";
  const createdBy = relationRow<{ full_name: string | null }>(latest.created_by_profile)?.full_name;
  const sentBy = relationRow<{ full_name: string | null }>(latest.sent_by_profile)?.full_name;

  const timeline: { label: string; value: string | null; who?: string | null }[] = [
    { label: "Creada", value: fmt(latest.created_at), who: createdBy },
    {
      label: latest.send_count > 1 ? `Enviada (${latest.send_count} correos)` : "Enviada",
      value: fmt(latest.sent_at),
      who: sentBy,
    },
    ...(latest.send_count > 1 ? [{ label: "Último correo", value: fmt(latest.last_sent_at) }] : []),
    ...(latest.whatsapp_count > 0
      ? [
          {
            label: latest.whatsapp_count > 1 ? `Por WhatsApp (${latest.whatsapp_count} veces)` : "Por WhatsApp",
            value: fmt(latest.whatsapp_last_sent_at),
          },
        ]
      : []),
    { label: "Abierta por el cliente", value: fmt(latest.first_opened_at) },
    { label: "Respondida", value: fmt(latest.responded_at) },
    ...(latest.reopened_at ? [{ label: "Reabierta", value: fmt(latest.reopened_at) }] : []),
    ...(latest.cancelled_at ? [{ label: "Cancelada", value: fmt(latest.cancelled_at) }] : []),
  ];

  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-brand-text">Satisfacción del cliente</h2>
          <p className="text-sm text-brand-muted">Encuesta que responde el cliente al cerrar el evento.</p>
        </div>
        {canSend && !isOpen && (
          <SurveySendButton
            action={sendNewSurveyAction.bind(null, projectId)}
            label="Enviar otra encuesta"
            title="¿Enviar otra encuesta?"
            submitLabel="Sí, enviar otra"
            icon={<Send size={14} />}
            defaultName={latest.recipient_name ?? recipient.name ?? ""}
            defaultEmail={latest.recipient_email ?? recipient.email ?? ""}
            defaultPhone={latest.recipient_phone ?? recipient.phone ?? ""}
            chooseChannel
            warning={`Este proyecto ya tiene una encuesta ${SURVEY_STATUS_LABELS[latest.status].toLowerCase()}. Se creará una nueva con un enlace distinto.`}
          />
        )}
      </header>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge tone={SURVEY_STATUS_TONE[latest.status]}>{SURVEY_STATUS_LABELS[latest.status]}</Badge>
              {latest.reopened_at && latest.status === "SENT" && <Badge tone="neutral">Reabierta</Badge>}
            </div>
            <p className="inline-flex items-center gap-1.5 text-sm text-brand-muted">
              <Mail size={14} aria-hidden />
              {[latest.recipient_name, latest.recipient_email, latest.recipient_phone ? `WhatsApp ${latest.recipient_phone}` : null]
                .filter(Boolean)
                .join(" · ") || "Sin correo ni teléfono — comparte el enlace"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOpen && <CopySurveyLinkButton link={linkOf(latest.token)} />}
            {canSend && isOpen && (
              <SurveySendButton
                action={resendSurveyAction.bind(null, latest.id, projectId)}
                label={latest.send_count > 0 ? "Reenviar correo" : "Enviar por correo"}
                title={latest.send_count > 0 ? "Reenviar la encuesta por correo" : "Enviar la encuesta por correo"}
                submitLabel={latest.status === "PENDING" ? "Enviar" : "Reenviar"}
                icon={<RefreshCw size={14} />}
                defaultName={latest.recipient_name ?? ""}
                defaultEmail={latest.recipient_email ?? ""}
              />
            )}
            {canSend && isOpen && (
              <SurveyWhatsappButton
                action={shareSurveyWhatsappAction.bind(null, latest.id, projectId)}
                defaultPhone={latest.recipient_phone ?? recipient.phone ?? ""}
                label={latest.whatsapp_count > 0 ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
              />
            )}
            {canSend && isOpen && (
              <SurveyActionButton
                action={cancelSurveyAction.bind(null, latest.id, projectId)}
                label="Cancelar"
                hint="Cancela la encuesta: el enlace deja de aceptar respuestas."
                icon={<Ban size={14} />}
                confirm={{
                  title: "¿Cancelar la encuesta?",
                  message: "El enlace dejará de aceptar respuestas. Puedes reabrirla después si hace falta.",
                  label: "Sí, cancelar",
                  danger: true,
                }}
              />
            )}
            {canSend && !isOpen && (
              <SurveyActionButton
                action={reopenSurveyAction.bind(null, latest.id, projectId)}
                label="Reabrir"
                icon={<RotateCcw size={14} />}
                confirm={{
                  title: "¿Reabrir la encuesta?",
                  message:
                    latest.status === "ANSWERED"
                      ? "El cliente podrá responder otra vez con el mismo enlace. Si responde de nuevo, sus respuestas nuevas reemplazan las actuales."
                      : "El enlace volverá a aceptar respuestas.",
                  label: "Sí, reabrir",
                }}
              />
            )}
          </div>
        </div>

        {latest.last_send_error && isOpen && (
          <div className="flex gap-2 rounded-[var(--radius-md)] bg-brand-warning-bg px-3 py-2 text-sm text-brand-text">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-brand-warning" aria-hidden />
            <span>
              {latest.last_send_error} Copia el enlace y envíalo por WhatsApp u otra vía, o vuelve a intentar el envío.
            </span>
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-brand-border pt-4 text-sm sm:grid-cols-2">
          {timeline.map((t) => (
            <div key={t.label} className="flex justify-between gap-3 sm:block">
              <dt className="text-xs text-brand-muted">{t.label}</dt>
              <dd className={t.value ? "text-brand-text" : "text-brand-disabled"}>
                {t.value ?? "—"}
                {t.value && t.who ? <span className="text-brand-muted"> · {t.who}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {latest.responded_at && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={<Star size={13} aria-hidden />} label="Calificación">
              {latest.overall_rating !== null ? (
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-semibold tabular-nums">
                    {Number(latest.overall_rating).toFixed(1)}
                    <span className="text-sm font-normal text-brand-muted"> / 5</span>
                  </span>
                  <Stars value={Number(latest.overall_rating)} />
                </div>
              ) : (
                <span className="text-brand-muted">—</span>
              )}
            </Metric>
            <Metric icon={<CalendarCheck size={13} aria-hidden />} label="NPS">
              {latest.nps_score !== null ? (
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-semibold tabular-nums">
                    {latest.nps_score}
                    <span className="text-sm font-normal text-brand-muted"> / 10</span>
                  </span>
                  {nps && <Badge tone={nps.tone}>{nps.label}</Badge>}
                </div>
              ) : (
                <span className="text-sm text-brand-muted">No incluido</span>
              )}
            </Metric>
            <Metric icon={<ThumbsUp size={13} aria-hidden />} label="¿Nos recomendaría?">
              <span className="font-semibold">{latest.recommendation ?? "—"}</span>
            </Metric>
            <Metric icon={<MessageSquareQuote size={13} aria-hidden />} label="Testimonio">
              <span className="font-semibold">
                {latest.testimonial_consent === null ? "—" : latest.testimonial_consent ? "Autoriza" : "No autoriza"}
              </span>
            </Metric>
          </div>

          {latest.comments && (
            <Card>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-muted">Comentarios</p>
              <blockquote className="whitespace-pre-line border-l-2 border-brand-accent pl-3 text-sm text-brand-text">
                {latest.comments}
              </blockquote>
              {latest.respondent_name && <p className="mt-2 text-xs text-brand-muted">— {latest.respondent_name}</p>}
            </Card>
          )}

          <Card padded={false} id="respuestas">
            <p className="flex items-center gap-1.5 border-b border-brand-border px-5 py-3 text-sm font-semibold text-brand-text">
              <Eye size={15} aria-hidden /> Respuestas
            </p>
            <ol className="divide-y divide-brand-border">
              {answers.map((a, i) => (
                <li key={a.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:gap-6">
                  <p className="text-sm text-brand-muted sm:w-1/2">
                    {i + 1}. {a.question_text}
                  </p>
                  <div className="text-sm font-medium text-brand-text sm:w-1/2">
                    {a.question_type === "RATING_5" && a.value_number !== null ? (
                      <span className="inline-flex items-center gap-2">
                        <Stars value={Number(a.value_number)} /> {a.value_number} / 5
                      </span>
                    ) : a.question_type === "NPS_10" && a.value_number !== null ? (
                      `${a.value_number} / 10`
                    ) : (
                      <span className="whitespace-pre-line">{a.value_text ?? "—"}</span>
                    )}
                  </div>
                </li>
              ))}
              {answers.length === 0 && <li className="px-5 py-4 text-sm text-brand-muted">Sin respuestas registradas.</li>}
            </ol>
          </Card>
        </>
      )}

      {history.length > 0 && (
        <Card padded={false}>
          <p className="border-b border-brand-border px-5 py-3 text-sm font-semibold text-brand-text">Encuestas anteriores</p>
          <ul className="divide-y divide-brand-border">
            {history.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone={SURVEY_STATUS_TONE[s.status]}>{SURVEY_STATUS_LABELS[s.status]}</Badge>
                  <span className="text-brand-muted">Creada {fmt(s.created_at, false)}</span>
                </span>
                <span className="text-brand-muted">
                  {s.responded_at
                    ? `Respondida ${fmt(s.responded_at, false)}${s.overall_rating !== null ? ` · ${Number(s.overall_rating).toFixed(1)}/5` : ""}`
                    : (s.recipient_email ?? "")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
