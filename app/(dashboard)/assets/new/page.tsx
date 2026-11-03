import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { hasPermission, requirePageAccess } from "@/lib/auth/permissions";
import { getExpenseSummary, listAssetLocations, listAssetTypes, listResponsibleSuggestions } from "@/features/assets/queries";
import { AssetForm } from "@/components/assets/asset-form";
import { formatMoney } from "@/lib/utils/money";
import { formatDate } from "@/lib/utils/dates";

export default async function NewAssetPage({ searchParams }: { searchParams: Promise<{ gasto?: string }> }) {
  await requirePageAccess("assets.manage", "registrar activos");
  const { gasto } = await searchParams;
  const [types, locations, suggestions, expense, canEditLists] = await Promise.all([
    listAssetTypes(),
    listAssetLocations(),
    listResponsibleSuggestions(),
    gasto && /^[0-9a-f-]{36}$/i.test(gasto) ? getExpenseSummary(gasto) : Promise.resolve(null),
    hasPermission("settings.manage"),
  ]);
  const back = expense ? `/expenses/${expense.id}` : "/assets";

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link href={back} className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> {expense ? "Volver al gasto" : "Activos"}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">{expense ? "Registrar como activo" : "Nuevo activo"}</h1>
        <p className="text-sm text-brand-muted">
          Algo que la empresa compró para usar. Al guardar recibe su código (ACT-0001, ACT-0002…) y después le puedes subir fotos en su ficha.
        </p>
      </div>
      {expense && (
        <div className="flex max-w-3xl items-start gap-2 rounded-[var(--radius-md)] border border-brand-accent/30 bg-brand-accent-light px-3 py-2 text-sm text-brand-text">
          <Receipt size={16} className="mt-0.5 shrink-0 text-brand-accent" aria-hidden />
          <span>
            Se registra con el gasto <strong>{expense.description}</strong> ({formatMoney(expense.total, expense.currency)} · {formatDate(expense.date)}
            {expense.supplierName ? ` · ${expense.supplierName}` : ""}). Ya llenamos qué es, el valor y la fecha con los datos del gasto:
            revísalos. Si el gasto incluía otras cosas, cambia el valor a lo que costó solo este activo. <strong>El gasto no cambia.</strong>
          </span>
        </div>
      )}
      <div className="max-w-3xl">
        <AssetForm
          types={types}
          locations={locations}
          responsibleSuggestions={suggestions}
          expenseId={expense?.id ?? null}
          canEditLists={canEditLists}
          initial={
            expense
              ? {
                  description: expense.description,
                  value: expense.total,
                  currency: expense.currency === "USD" ? "USD" : "DOP",
                  purchaseDate: expense.date,
                }
              : undefined
          }
        />
      </div>
    </main>
  );
}
