import { z } from "zod";

export const PAYMENT_METHODS = [
  "TRANSFER",
  "DEPOSIT",
  "CHECK",
  "CARD",
  "CASH",
  "OTHER",
] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CHECK: "Cheque",
  CARD: "Tarjeta",
  CASH: "Efectivo",
  OTHER: "Otro",
};

export const registerPaymentSchema = z.object({
  bank_account_id: z.string().uuid().optional().or(z.literal("")),
  payment_date: z.string().min(1, "La fecha es requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;
