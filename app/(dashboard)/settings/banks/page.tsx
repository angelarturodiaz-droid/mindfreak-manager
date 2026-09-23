import { listBankCatalog } from "@/features/bank-catalog/queries";
import {
  toggleBankCatalogActiveAction,
  deleteBankCatalogEntryAction,
} from "@/features/bank-catalog/actions";
import { NewBankCatalogEntryForm } from "./new-bank-catalog-entry-form";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable, type Column } from "@/components/ui/data-table";

type BankEntry = Awaited<ReturnType<typeof listBankCatalog>>[number];

export default async function BankCatalogSettingsPage() {
  const banks = await listBankCatalog(false);

  const columns: Column<BankEntry>[] = [
    { header: "Nombre", accessor: (b) => b.name },
    {
      header: "Estado",
      accessor: (b) => <Badge tone={b.is_active ? "success" : "danger"}>{b.is_active ? "Activo" : "Inactivo"}</Badge>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (b) => (
        <div className="flex justify-end gap-3">
          <ActionButton
            label={b.is_active ? "Desactivar" : "Activar"}
            variant="ghost"
            onAction={() => toggleBankCatalogActiveAction(b.id, b.is_active)}
          />
          <ConfirmButton
            label="Eliminar"
            confirmTitle={`¿Eliminar "${b.name}" del catálogo?`}
            confirmMessage="Las cuentas/proveedores que ya lo tengan guardado no se ven afectados."
            onConfirm={deleteBankCatalogEntryAction.bind(null, b.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-primary">
          Catálogo de bancos
        </h2>
        <p className="text-sm text-brand-muted">
          Se usa como lista desplegable al crear un Proveedor o una Cuenta
          bancaria/Tarjeta, para que el nombre del banco quede siempre
          igual. Viene precargado con los bancos más comunes de RD.
        </p>
      </div>

      <DataTable columns={columns} rows={banks} keyFor={(b) => b.id} maxWidth="max-w-md" emptyMessage="Sin bancos en el catálogo todavía." />

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Agregar banco
        </h2>
        <NewBankCatalogEntryForm />
      </section>
    </div>
  );
}
