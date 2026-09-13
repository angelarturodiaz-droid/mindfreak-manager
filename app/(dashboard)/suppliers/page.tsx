import Link from "next/link";
import { Truck, Plus } from "lucide-react";
import { listSuppliers } from "@/features/suppliers/queries";
import { deactivateSupplierAction } from "@/features/suppliers/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmButton } from "@/components/ui/confirm-button";

type SupplierRow = Awaited<ReturnType<typeof listSuppliers>>[number];

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const suppliers = await listSuppliers(params.q);

  const columns: Column<SupplierRow>[] = [
    {
      header: "Nombre",
      accessor: (s) => (
        <div className="flex items-center gap-2">
          <Link href={`/suppliers/${s.id}`} className="font-medium text-brand-text hover:text-brand-accent">
            {s.name}
          </Link>
          {!s.is_active && <Badge tone="danger">Inactivo</Badge>}
        </div>
      ),
    },
    { header: "Categoría", accessor: (s) => <span className="text-brand-muted">{s.category || "—"}</span> },
    { header: "Contacto", accessor: (s) => <span className="text-brand-muted">{s.email || s.phone || "—"}</span> },
    {
      header: "",
      className: "text-right",
      accessor: (s) =>
        s.is_active ? (
          <ConfirmButton
            label="Desactivar"
            confirmTitle={`¿Desactivar a "${s.name}"?`}
            onConfirm={deactivateSupplierAction.bind(null, s.id)}
          />
        ) : null,
    },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Proveedores</h1>
          <p className="text-sm text-brand-muted">
            Empresas y personas que le proveen servicios a Mindfreak Events.
          </p>
        </div>
        <Link href="/suppliers/new">
          <Button size="sm" icon={<Plus size={14} />}>
            Nuevo proveedor
          </Button>
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/suppliers" method="get">
        <Input type="text" name="q" defaultValue={params.q} placeholder="Buscar por nombre…" className="w-64" />
        <Button type="submit" variant="outline" size="md">
          Buscar
        </Button>
      </form>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={<Truck size={28} />}
          title="Aún no tienes proveedores que coincidan con este filtro."
          action={
            <Link href="/suppliers/new">
              <Button size="sm" icon={<Plus size={14} />}>
                Crear el primero
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable columns={columns} rows={suppliers} keyFor={(s) => s.id} />
      )}
    </main>
  );
}
