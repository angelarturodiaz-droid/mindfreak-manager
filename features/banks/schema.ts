import { z } from "zod";

export const ACCOUNT_TYPES = ["BANK", "CREDIT_CARD"] as const;

/** Tipo de cuenta bancaria (solo para type = BANK). Informativo. */
export const ACCOUNT_KINDS = ["SAVINGS", "CHECKING"] as const;
export const ACCOUNT_KIND_LABELS: Record<string, string> = {
  SAVINGS: "Ahorros",
  CHECKING: "Corriente",
};

export const bankAccountSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  bank_name: z.string().trim().optional().or(z.literal("")),
  account_number_masked: z.string().trim().optional().or(z.literal("")),
  currency: z.enum(["DOP", "USD"]).default("DOP"),
  type: z.enum(ACCOUNT_TYPES).default("BANK"),
  opening_balance: z.coerce.number().default(0),
  opening_balance_date: z.string().min(1, "La fecha es requerida"),
  credit_limit: z.coerce.number().min(0).optional(),
  account_kind: z.enum(ACCOUNT_KINDS).optional(),
});

export const bankAccountEditSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  bank_name: z.string().trim().optional().or(z.literal("")),
  account_number_masked: z.string().trim().optional().or(z.literal("")),
  credit_limit: z.coerce.number().min(0).optional(),
  // Solo se aplican si la cuenta todavía no tiene movimientos (ver acción).
  opening_balance: z.coerce.number().optional(),
  opening_balance_date: z.string().optional().or(z.literal("")),
  account_kind: z.enum(ACCOUNT_KINDS).optional(),
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
    // Solo en cuentas en otra moneda (ej. USD): unidades de moneda base por
    // 1 unidad de la moneda de la cuenta, para convertir en los reportes.
    exchange_rate: z.coerce.number().positive("La tasa debe ser mayor a 0").optional(),
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
  // Solo si las cuentas tienen monedas distintas: unidades de moneda base
  // por 1 unidad de la otra moneda (ej. 59.50 RD$ por US$).
  exchange_rate: z.coerce.number().positive("La tasa debe ser mayor a 0").optional(),
});
