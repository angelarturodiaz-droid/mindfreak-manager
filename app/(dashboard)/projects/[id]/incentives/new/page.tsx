import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { getProjectBasic, getProjectProfitability } from "@/features/projects/queries";
import { listActiveAccountsForSelect } from "@/features/expenses/queries";
import { getAccountFunds } from "@/features/banks/queries";
import { Card } from "@/components/ui/card";
import { NewIncentiveForm } from "./new-incentive-form";

/** V1-2: Nuevo incentivo por proyecto (solo Administrador y Finanzas). */
export default async function NewIncentivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await hasPermission("expenses.incentives"))) {
    redirect(`/projects/${id}?tab=compras&denied=incentivos`);
  }
  let project;
  try {
    project = await getProjectBasic(id);
  } catch {
    notFound();
  }
  if (!project) notFound();

  const [profitability, accounts, funds] = await Promise.all([
    getProjectProfitability(id),
    listActiveAccountsForSelect(),
    getAccountFunds(),
  ]);
  const back = `/projects/${id}?tab=finanzas`;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link href={back} className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Proyecto {project.number} · {project.name}
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo incentivo</h1>
        <p className="max-w-2xl text-sm text-brand-muted">
          Un pago a un empleado o a un tercero por este proyecto (ej. por coordinar o conseguir el evento). No lleva
          proveedor, ITBIS ni retenciones: se paga el monto completo. En la rentabilidad del proyecto se resta después
          de los gastos, en su propio renglón. A un empleado se le paga <strong>aparte de la nómina</strong>.
        </p>
      </div>
      <Card className="max-w-xl">
        <NewIncentiveForm
          projectId={project.id}
          projectNumber={project.number}
          base={Math.round(profitability.gananciaAntesIncentivos * 100) / 100}
          ventas={profitability.facturado}
          gastos={profitability.costoReal}
          accounts={accounts.filter((a) => a.currency === "DOP")}
          funds={funds}
          returnTo={back}
        />
      </Card>
    </main>
  );
}
