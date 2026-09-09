import { z } from "zod";

export const bankAccountSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  bank_name: z.string().trim().optional().or(z.literal("")),
  account_number_masked: z.string().trim().optional().or(z.literal("")),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  opening_balance: z.coerce.number().default(0),
  opening_balance_date: z.string().min(1, "La fecha es requerida"),
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const manualTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  transaction_date: z.string().min(1, "La fecha es requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  description: z.string().trim().min(1, "La descripción es requerida"),
});

export const transferSchema = z.object({
  to_bank_account_id: z.string().uuid("Selecciona la cuenta destino"),
  transaction_date: z.string().min(1, "La fecha es requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  description: z.string().trim().optional().or(z.literal("")),
});
