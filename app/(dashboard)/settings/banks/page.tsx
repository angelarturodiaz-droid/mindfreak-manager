import { listBankCatalogWithBrand } from "@/features/bank-catalog/queries";
import { BankMark } from "@/components/banks/bank-mark";
import { BankBrandEditor } from "./bank-brand-editor";
import {
  toggleBankCatalogActiveAction,
  deleteBankCatalogEntryAction,
} from "@/features/bank-catalog/actions";
import { NewBankCatalogEntryForm } from "./new-bank-catalog-entry-form";
import { Badge } from "@/components/ui/badge";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { ActionButton } from "@/components/ui/action-button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, paginate, parsePage } from "@/lib/utils/pagination";


type BankEntry = Awaited<ReturnType<typeof listBankCatalogWithBrand>>[number];

export default async function BankCatalogSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const banks = await listBankCatalogWithBrand();

  const columns: Column<BankEntry>[] = [
    {
      header: "Banco",
      info: "El color y el logo se usan en las tarjetas de Bancos y en las listas, para reconocer cada cuenta rápido.",
      accessor: (b) => (
        <span className="flex items-center gap-2.5">
          <BankMark brand={b.brand} size={30} />
          <span className="text-brand-text">{b.name}</span>
          {b.brand?.color && (
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.brand.color }} title={`Color ${b.brand.color}`} />
          )}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: (b) => <Badge tone={b.is_active ? "success" : "danger"}>{b.is_active ? "Activo" : "Inactivo"}</Badge>,
    },
    {
      header: "",
      className: "text-right",
      accessor: (b) => (
        <div className="flex justify-end gap-3">
          {b.name !== "Otro" && (
            <BankBrandEditor entryId={b.id} name={b.name} color={b.brand_color} uploadedLogo={b.logo_data} />
          )}
          <ActionButton
            label={b.is_active ? "Desactivar" : "Activar"}
            variant="ghost"
            onAction={toggleBankCatalogActiveAction.bind(null, b.id, b.is_active)}
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
          igual. Viene precargado con los bancos más comunes de RD. Con
          <strong> Color y logo</strong> eliges cómo se ven las cuentas y
          tarjetas de cada banco en Bancos.
        </p>
      </div>

      <DataTable columns={columns} rows={paginate(banks, page)} keyFor={(b) => b.id} maxWidth="max-w-3xl" emptyMessage="Sin bancos en el catálogo todavía." />
      <div className="max-w-3xl">
        <Pagination basePath="/settings/banks" page={page} pageSize={PAGE_SIZE} total={banks.length} />
      </div>

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Agregar banco
        </h2>
        <NewBankCatalogEntryForm />
      </section>
    </div>
  );
}
