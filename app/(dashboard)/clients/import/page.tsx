import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listImportBatches } from "@/features/clients/queries";
import { ClientImportPanel } from "./import-panel";
import { requirePageAccess } from "@/lib/auth/permissions";
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
  await requirePageAccess("clients.import", "Importar clientes");
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
        <h1 className="mt-2 text-xl font-semibold text-brand-primary">Importar clientes desde Excel</h1>
        <p className="max-w-3xl text-sm text-brand-muted">
          Carga muchos clientes y leads de una vez, con su contacto principal y su contacto de cobros. Nada se guarda hasta que
          revises el archivo y pulses <strong>Importar</strong>. Los RNC o cédulas que ya existen se saltan.
        </p>
      </div>

      <ClientImportPanel />

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
