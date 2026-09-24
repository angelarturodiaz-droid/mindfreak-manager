import { z } from "zod";

export const ACCOUNT_TYPES = ["BANK", "CREDIT_CARD"] as const;

export const bankAccountSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  bank_name: z.string().trim().optional().or(z.literal("")),
  account_number_masked: z.string().trim().optional().or(z.literal("")),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  type: z.enum(ACCOUNT_TYPES).default("BANK"),
  opening_balance: z.coerce.number().default(0),
  opening_balance_date: z.string().min(1, "La fecha es requerida"),
  credit_limit: z.coerce.number().min(0).optional(),
});

export const bankAccountEditSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  bank_name: z.string().trim().optional().or(z.literal("")),
  account_number_masked: z.string().trim().optional().or(z.literal("")),
  credit_limit: z.coerce.number().min(0).optional(),
  // Solo se aplican si la cuenta todavía no tiene movimientos (ver acción).
  opening_balance: z.coerce.number().optional(),
  opening_balance_date: z.string().optional().or(z.literal("")),
});

export type BankAccountEditInput = z.infer<typeof bankAccountEditSchema>;

export const manualTransactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    transaction_date: z.string().min(1, "La fecha es requerida"),
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    // Categoría del catálogo (Configuración > Categorías). Si se elige, la
    // descripción es opcional y se usa el nombre de la categoría.
    category_id: z.string().uuid().optional().or(z.literal("")),
    description: z.string().trim().optional().or(z.literal("")),
    // Número de cheque, de transacción o de depósito (opcional).
    reference: z.string().trim().max(100).optional().or(z.literal("")),
  })
  // Se permite guardar "Sin categoría" (queda en la alerta para clasificar
  // después), pero entonces la descripción es obligatoria.
  .refine((d) => Boolean(d.category_id) || Boolean(d.description), {
    message: "Si lo dejas sin categoría, escribe una descripción.",
    path: ["category_id"],
  });

export const transferSchema = z.object({
  to_bank_account_id: z.string().uuid("Selecciona la cuenta destino"),
  transaction_date: z.string().min(1, "La fecha es requerida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  description: z.string().trim().optional().or(z.literal("")),
});
