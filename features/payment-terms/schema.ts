import { z } from "zod";

export const PAYMENT_TERM_METHODS = ["TRANSFER", "DEPOSIT", "CHECK", "CARD", "CASH", "OTHER"] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CHECK: "Cheque",
  CARD: "Tarjeta",
  CASH: "Efectivo",
  OTHER: "Otro",
};

export const paymentTermSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es requerido"),
    credit_days: z.coerce.number().int().min(0, "No puede ser negativo"),
    payment_method: z.enum(PAYMENT_TERM_METHODS),
    advance_percent: z.coerce.number().min(0).max(100),
    balance_percent: z.coerce.number().min(0).max(100),
  })
  .refine((data) => Math.round((data.advance_percent + data.balance_percent) * 100) === 10000, {
    message: "El anticipo y el saldo deben sumar 100%",
    path: ["balance_percent"],
  });
