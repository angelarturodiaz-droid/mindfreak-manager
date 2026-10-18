import { createClient } from "@/lib/supabase/server";
import { pageRange } from "@/lib/utils/pagination";
import { formatMoney } from "@/lib/utils/money";
import { formatDate, todayISO } from "@/lib/utils/dates";
import { whatsappUrl } from "@/features/surveys/schema";
import { DEFAULT_MESSAGE, DEFAULT_SUBJECT } from "./engine";
import {
  DEFAULT_INVOICE_DAYS,
  fillReminder,
  invoiceStepForToday,
  pickPhone,
  stepLabel,
  whenText,
} from "./schedule";

export const DEFAULT_WHATSAPP =
  "Hola {contacto}, te saluda {empresa}. Te recordamos que la factura {factura} por {monto} {cuando}. Si ya pagaste, por favor ignora este mensaje. ¡Gracias!";

export type ReminderSettings = {
  ready: boolean;
  auto_send_enabled: boolean;
  invoice_days: number[];
  invoice_subject: string;
  invoice_message: string;
  whatsapp_message: string;
  updated_at: string | null;
};

/** Ajustes de recordatorios (o los de siempre si todavía no hay fila / migración). */
export async function getReminderSettings(): Promise<ReminderSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reminder_settings")
    .select("auto_send_enabled, invoice_days, invoice_subject, invoice_message, whatsapp_message, updated_at")
    .maybeSingle();
  return {
    ready: !error,
    auto_send_enabled: data?.auto_send_enabled ?? false,
    invoice_days: data?.invoice_days ?? DEFAULT_INVOICE_DAYS,
    invoice_subject: data?.invoice_subject ?? DEFAULT_SUBJECT,
    invoice_message: data?.invoice_message ?? DEFAULT_MESSAGE,
    whatsapp_message: data?.whatsapp_message ?? DEFAULT_WHATSAPP,
    updated_at: data?.updated_at ?? null,
  };
}

export type ReminderLogRow = {
  id: string;
  kind: "INVOICE" | "INVOICE_WA" | "SURVEY";
  entity_id: string;
  step: number;
  channel: "EMAIL" | "WHATSAPP";
  recipient: string | null;
  status: "PENDING" | "SENT" | "FAILED";
  error: string | null;
  source: "CRON" | "MANUAL" | "USER";
  created_at: string;
  sent_at: string | null;
  /** INV-0033 / nombre del proyecto de la encuesta. */
  document: string | null;
  href: string | null;
  who: string | null;
};

/** Historial de envíos (paginado). */
export async function listReminderLog(page = 1): Promise<{ rows: ReminderLogRow[]; total: number }> {
  const supabase = await createClient();
  const [from, to] = pageRange(page);
  const { data, count, error } = await supabase
    .from("reminder_log")
    .select("id, kind, entity_id, step, channel, recipient, status, error, source, created_at, sent_at, profiles(full_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error || !data) return { rows: [], total: 0 };

  const invoiceIds = data.filter((r) => r.kind !== "SURVEY").map((r) => r.entity_id);
  const surveyIds = data.filter((r) => r.kind === "SURVEY").map((r) => r.entity_id);
  const [{ data: invs }, { data: surveys }] = await Promise.all([
    invoiceIds.length
      ? supabase.from("invoices").select("id, number").in("id", invoiceIds)
      : Promise.resolve({ data: [] as { id: string; number: string }[] }),
    surveyIds.length
      ? supabase.from("project_surveys").select("id, project_id, projects(name)").in("id", surveyIds)
      : Promise.resolve({ data: [] as { id: string; project_id: string; projects: unknown }[] }),
  ]);
  const invMap = new Map((invs ?? []).map((i) => [i.id, i.number]));
  const surveyMap = new Map(
    (surveys ?? []).map((s) => {
      const p = (Array.isArray(s.projects) ? s.projects[0] : s.projects) as { name: string } | null;
      return [s.id, { name: p?.name ?? "Encuesta", projectId: s.project_id }];
    }),
  );

  return {
    total: count ?? 0,
    rows: data.map((r) => {
      const prof = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { full_name: string | null } | null;
      const survey = r.kind === "SURVEY" ? surveyMap.get(r.entity_id) : undefined;
      return {
        ...(r as Omit<ReminderLogRow, "document" | "href" | "who">),
        document: r.kind === "SURVEY" ? survey?.name ?? null : invMap.get(r.entity_id) ?? null,
        href:
          r.kind === "SURVEY"
            ? survey
              ? `/projects/${survey.projectId}?tab=satisfaccion`
              : null
            : `/invoices/${r.entity_id}`,
        who: r.source === "USER" ? prof?.full_name ?? "Usuario" : r.source === "MANUAL" ? "Revisar ahora" : "Tarea diaria",
      };
    }),
  };
}

export type WhatsappTodayItem = {
  invoiceId: string;
  number: string;
  client: string;
  contact: string | null;
  balanceText: string;
  cuando: string;
  step: number;
  stepText: string;
  phone: string | null;
  url: string;
  overdue: boolean;
};

/**
 * Lista "Para recordar hoy por WhatsApp": facturas abiertas a las que les
 * toca un recordatorio hoy (mismos días de Configuración) y que todavía no
 * se marcaron por WhatsApp. Funciona aunque los correos automáticos estén
 * apagados. Visible para quien ve facturas.
 */
export async function listWhatsappToday(): Promise<WhatsappTodayItem[]> {
  const supabase = await createClient();
  const today = todayISO();
  const settings = await getReminderSettings();
  if (!settings.ready) return [];

  const min = new Date(Date.now() - 130 * 86_400_000).toISOString().slice(0, 10);
  const max = new Date(Date.now() + 70 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: invs }, { data: company }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, due_date, balance, currency, clients(name, phone, client_contacts(full_name, phone, email, is_primary))")
      .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])
      .gt("balance", 0)
      .not("due_date", "is", null)
      .gte("due_date", min)
      .lte("due_date", max),
    supabase.from("companies").select("name").limit(1).maybeSingle(),
  ]);
  if (!invs?.length) return [];

  const { data: logs } = await supabase
    .from("reminder_log")
    .select("entity_id, step")
    .eq("kind", "INVOICE_WA")
    .in("status", ["PENDING", "SENT"])
    .in(
      "entity_id",
      invs.map((i) => i.id),
    );
  const done = new Map<string, number[]>();
  for (const l of logs ?? []) done.set(l.entity_id, [...(done.get(l.entity_id) ?? []), l.step]);

  const items: WhatsappTodayItem[] = [];
  for (const inv of invs) {
    if (!inv.due_date) continue;
    const step = invoiceStepForToday({
      dueDate: inv.due_date,
      today,
      days: settings.invoice_days,
      done: done.get(inv.id) ?? [],
    });
    if (step === null) continue;
    const client = (Array.isArray(inv.clients) ? inv.clients[0] : inv.clients) as {
      name: string;
      phone: string | null;
      client_contacts: { full_name: string; phone: string | null; email: string | null; is_primary: boolean }[] | null;
    } | null;
    const contacts = client?.client_contacts ?? [];
    const contact = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
    const phone = pickPhone({
      client_name: client?.name ?? null,
      client_email: null,
      client_phone: client?.phone ?? null,
      contact_name: contact?.full_name ?? null,
      contact_email: contact?.email ?? null,
      contact_phone: contact?.phone ?? null,
    });
    const balanceText = formatMoney(Number(inv.balance), inv.currency);
    const cuando = whenText(inv.due_date, today, formatDate);
    const text = fillReminder(settings.whatsapp_message, {
      contacto: (contact?.full_name ?? "").split(" ")[0],
      cliente: client?.name ?? "",
      empresa: company?.name ?? "",
      factura: inv.number,
      monto: balanceText,
      vence: formatDate(inv.due_date),
      cuando,
    });
    items.push({
      invoiceId: inv.id,
      number: inv.number,
      client: client?.name ?? "—",
      contact: contact?.full_name ?? null,
      balanceText,
      cuando,
      step,
      stepText: stepLabel(step),
      phone,
      url: whatsappUrl(phone, text),
      overdue: step > 0,
    });
  }
  return items.sort((a, b) => b.step - a.step);
}
