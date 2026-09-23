import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listImportBatches } from "@/features/clients/queries";
import { ImportForm } from "./import-form";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

type Batch = Awaited<ReturnType<typeof listImportBatches>>[number];

const BATCH_STATUS_LABELS: Record<string, string> = {
  PROCESSING: "Procesando",
  COMPLETED: "Completado",
  COMPLETED_WITH_ERRORS: "Completado con errores",
  FAILED: "Falló",
};

export default async function ImportClientsPage() {
  const batches = await listImportBatches();

  const columns: Column<Batch>[] = [
    { header: "Archivo", accessor: (b) => b.file_name },
    { header: "Filas", accessor: (b) => b.total_rows },
    { header: "Éxito", accessor: (b) => <span className="text-brand-success">{b.success_count}</span> },
    { header: "Errores", accessor: (b) => <span className="text-brand-danger">{b.error_count}</span> },
    { header: "Estado", accessor: (b) => <Badge status={b.status}>{BATCH_STATUS_LABELS[b.status] ?? b.status}</Badge> },
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Clientes
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-brand-primary">
          Importar clientes (CSV)
        </h1>
        <p className="text-sm text-brand-muted">
          Columnas esperadas: <code>name, tax_id, email, phone, address, stage</code>{" "}
          (stage: <code>LEAD</code>, <code>PROSPECT</code> o <code>CLIENT</code>, opcional — por defecto LEAD).
        </p>
      </div>

      <ImportForm />

      <section>
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Importaciones recientes
        </h2>
        {batches.length === 0 ? (
          <p className="text-sm text-brand-muted">Aún no has importado nada.</p>
        ) : (
          <DataTable columns={columns} rows={batches} keyFor={(b) => b.id} maxWidth="max-w-2xl" />
        )}
      </section>
    </main>
  );
}
