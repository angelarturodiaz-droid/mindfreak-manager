import { describe, expect, it } from "vitest";
import {
  daysBetween,
  fillReminder,
  invoiceStepForToday,
  normalizeDays,
  pickEmailRecipient,
  pickPhone,
  projectAllowsReminder,
  stepLabel,
  surveyStepForToday,
  whenText,
} from "@/features/reminders/schedule";
import { planReminders } from "@/features/reminders/engine";

const DAYS = [-3, 0, 10];
const fmt = (iso: string) => iso; // formato neutro para las pruebas

describe("invoiceStepForToday (3 antes, el día, 10 después)", () => {
  it("3 días antes del vencimiento → paso −3", () => {
    expect(invoiceStepForToday({ dueDate: "2026-10-21", today: "2026-10-18", days: DAYS, done: [] })).toBe(-3);
  });
  it("el día del vencimiento → paso 0", () => {
    expect(invoiceStepForToday({ dueDate: "2026-10-18", today: "2026-10-18", days: DAYS, done: [-3] })).toBe(0);
  });
  it("10 días después → paso 10", () => {
    expect(invoiceStepForToday({ dueDate: "2026-10-08", today: "2026-10-18", days: DAYS, done: [-3, 0] })).toBe(10);
  });
  it("entre pasos no hay nada que mandar", () => {
    expect(invoiceStepForToday({ dueDate: "2026-10-13", today: "2026-10-18", days: DAYS, done: [-3, 0] })).toBeNull();
  });
  it("no repite un paso ya enviado", () => {
    expect(invoiceStepForToday({ dueDate: "2026-10-18", today: "2026-10-18", days: DAYS, done: [0] })).toBeNull();
  });
  it("si la tarea no corrió, recupera hasta 2 días tarde", () => {
    expect(invoiceStepForToday({ dueDate: "2026-10-16", today: "2026-10-18", days: DAYS, done: [] })).toBe(0);
    expect(invoiceStepForToday({ dueDate: "2026-10-15", today: "2026-10-18", days: DAYS, done: [] })).toBeNull();
  });
  it("factura emitida con vencimiento hoy: no manda el de 3 días antes atrasado", () => {
    expect(invoiceStepForToday({ dueDate: "2026-10-18", today: "2026-10-18", days: DAYS, done: [] })).toBe(0);
  });
  it("acepta más pasos configurados (ej. 20 y 30 después)", () => {
    expect(invoiceStepForToday({ dueDate: "2026-09-18", today: "2026-10-18", days: [-3, 0, 10, 20, 30], done: [] })).toBe(30);
  });
});

describe("normalizeDays", () => {
  it("ordena, quita repetidos y fuera de rango", () => {
    expect(normalizeDays([10, -3, 0, 10, 500, -90])).toEqual([-3, 0, 10]);
  });
  it("vacío → los de siempre", () => {
    expect(normalizeDays([])).toEqual([-3, 0, 10]);
  });
});

describe("surveyStepForToday", () => {
  const base = { today: "2026-10-18", afterDays: 3, max: 2, enabled: true };
  it("a los 3 días sin responder → recordatorio 1", () => {
    expect(surveyStepForToday({ ...base, lastContactAt: "2026-10-15T10:00:00Z", count: 0 })).toBe(1);
  });
  it("antes de tiempo no", () => {
    expect(surveyStepForToday({ ...base, lastContactAt: "2026-10-16T10:00:00Z", count: 0 })).toBeNull();
  });
  it("respeta el máximo", () => {
    expect(surveyStepForToday({ ...base, lastContactAt: "2026-10-01T10:00:00Z", count: 2 })).toBeNull();
  });
  it("apagado en Configuración → no", () => {
    expect(surveyStepForToday({ ...base, enabled: false, lastContactAt: "2026-10-01", count: 0 })).toBeNull();
  });
});

describe("textos", () => {
  it("cuándo vence", () => {
    expect(whenText("2026-10-21", "2026-10-18", fmt)).toBe("vence el 2026-10-21 (en 3 días)");
    expect(whenText("2026-10-18", "2026-10-18", fmt)).toBe("vence hoy");
    expect(whenText("2026-10-08", "2026-10-18", fmt)).toBe("venció hace 10 días (2026-10-08)");
  });
  it("nombre del paso", () => {
    expect(stepLabel(-3)).toBe("3 días antes");
    expect(stepLabel(0)).toBe("el día del vencimiento");
    expect(stepLabel(10)).toBe("10 días después");
  });
  it("plantilla con variables; las desconocidas quedan como están", () => {
    expect(
      fillReminder("Hola {contacto}, la factura {factura} {cuando}. {otra}", {
        contacto: "Ana",
        factura: "INV-0033",
        cuando: "vence hoy",
      }),
    ).toBe("Hola Ana, la factura INV-0033 vence hoy. {otra}");
    expect(fillReminder("Hola {contacto}, gracias", { contacto: "" })).toBe("Hola, gracias");
  });
  it("días entre fechas", () => {
    expect(daysBetween("2026-10-08", "2026-10-18")).toBe(10);
  });
});

describe("destinatario (decisión 18-oct)", () => {
  const base = {
    client_name: "Cliente SRL",
    client_email: "pagos@cliente.com",
    client_phone: "8095550000",
    contact_name: "Ana Pérez",
    contact_email: "ana@cliente.com",
    contact_phone: "8295551111",
  };
  it("siempre el correo registrado del cliente (saludo con el contacto)", () => {
    expect(pickEmailRecipient(base)).toEqual({ email: "pagos@cliente.com", name: "Ana Pérez" });
  });
  it("cliente sin correo → nada (aunque el contacto tenga)", () => {
    expect(pickEmailRecipient({ ...base, client_email: "" })).toBeNull();
  });
  it("teléfono: el del cliente y, si no tiene, el del contacto", () => {
    expect(pickPhone(base)).toBe("8095550000");
    expect(pickPhone({ ...base, client_phone: null })).toBe("8295551111");
  });
  it("factura de proyecto: solo con el proyecto Completado", () => {
    expect(projectAllowsReminder(null, null)).toBe(true);
    expect(projectAllowsReminder("p1", "IN_PROGRESS")).toBe(false);
    expect(projectAllowsReminder("p1", "COMPLETED")).toBe(true);
  });
});


describe("planReminders (qué sale hoy)", () => {
  const company = {
    company_id: "c1",
    name: "Mindfreak",
    logo_url: null,
    brand_primary: null,
    brand_accent: null,
    auto_send_enabled: true,
    invoice_days: [-3, 0, 10],
    invoice_subject: "Recordatorio: factura {factura} de {empresa}",
    invoice_message: "La factura {factura} por {monto} {cuando}.",
    whatsapp_message: "x",
    survey_reminder_enabled: true,
    survey_after_days: 3,
    survey_max: 2,
    survey_subject: "¿Cómo te fue?",
    survey_message: "Cuéntanos.",
  };
  const invoice = {
    id: "i1",
    company_id: "c1",
    number: "INV-0040",
    due_date: "2026-10-18",
    total: 1000,
    balance: 600,
    currency: "DOP",
    bank_details: [],
    client_name: "Cliente SRL",
    client_email: "pagos@cliente.com",
    client_phone: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    sent_steps: [],
  };
  it("factura que vence hoy → correo con asunto y mensaje llenos", () => {
    const [p] = planReminders({ companies: [company], invoices: [invoice], surveys: [] }, "2026-10-18", "https://app");
    expect(p.kind).toBe("INVOICE");
    expect(p.step).toBe(0);
    expect(p.recipient).toBe("pagos@cliente.com");
    expect(p.subject).toBe("Recordatorio: factura INV-0040 de Mindfreak");
    expect(p.html).toContain("vence hoy");
    expect(p.blocked).toBeNull();
  });
  it("sin correo → queda bloqueado con el motivo", () => {
    const [p] = planReminders(
      { companies: [company], invoices: [{ ...invoice, client_email: null }], surveys: [] },
      "2026-10-18",
      "https://app",
    );
    expect(p.blocked).toMatch(/no tiene correo registrado/);
  });
  it("encuesta sin responder hace 3 días → recordatorio 1 con el enlace", () => {
    const [p] = planReminders(
      {
        companies: [company],
        invoices: [],
        surveys: [
          {
            id: "s1",
            company_id: "c1",
            token: "tok",
            recipient_name: "Ana",
            recipient_email: "ana@cliente.com",
            reminder_count: 0,
            last_contact_at: "2026-10-15T12:00:00Z",
            project_name: "Boda",
            event_date: null,
            client_name: "Cliente SRL",
          },
        ],
      },
      "2026-10-18",
      "https://app",
    );
    expect(p.kind).toBe("SURVEY");
    expect(p.stepText).toBe("Recordatorio 1 de 2");
    expect(p.html).toContain("https://app/encuesta/tok");
  });
});
