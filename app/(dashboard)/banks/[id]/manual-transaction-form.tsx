"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createManualTransactionAction, type ActionState } from "@/features/banks/actions";
import { Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/utils/dates";

const initialState: ActionState = { error: null };

export function ManualTransactionForm({
  bankAccountId,
  categories,
}: {
  bankAccountId: string;
  /** Catálogo de Configuración > Categorías (mismo para ingresos y egresos). */
  categories: { id: string; name: string }[];
}) {
  const createWithId = createManualTransactionAction.bind(null, bankAccountId);
  const [state, formAction, pending] = useActionState(createWithId, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <Select label="Tipo" name="type" defaultValue="INCOME">
        <option value="INCOME">Ingreso</option>
        <option value="EXPENSE">Gasto</option>
      </Select>
      <Input label="Fecha" name="transaction_date" type="date" required defaultValue={todayISO()} />
      <MoneyInput label="Monto" name="amount" min={0.01} required defaultValue={0} className="w-28" />
      <Select label="Categoría" name="category_id" defaultValue="" className="w-56">
        <option value="">Sin categoría (clasificar después)</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input
        label="Detalle"
        name="description"
        placeholder="Requerido sin categoría"
        className="w-56"
      />
      <Input label="Referencia" name="reference" placeholder="Cheque / No. transacción" className="w-44" />
      <Button type="submit" loading={pending} icon={<Plus size={14} />}>
        Agregar movimiento
      </Button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
      <p className="w-full text-xs text-brand-muted">
        ¿Falta una categoría?{" "}
        <Link href="/settings/expense-categories" className="text-brand-accent hover:underline">
          Administrar categorías
        </Link>
      </p>
    </form>
  );
}
