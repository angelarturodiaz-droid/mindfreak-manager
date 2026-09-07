import Link from "next/link";
import { listImportBatches } from "@/features/clients/queries";
import { ImportForm } from "./import-form";

export default async function ImportClientsPage() {
  const batches = await listImportBatches();

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/clients" className="text-sm text-brand-muted hover:text-brand-text">
          ← Clientes
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-brand-primary">
          Importar clientes (CSV)
        </h1>
        <p className="text-sm text-brand-muted">
          Columnas esperadas: <code>name, tax_id, email, phone, address, status</code>{" "}
          (status: <code>LEAD</code> o <code>ACTIVE</code>, opcional — por defecto LEAD).
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
          <table className="w-full max-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
                <th className="py-2 font-medium">Archivo</th>
                <th className="py-2 font-medium">Filas</th>
                <th className="py-2 font-medium">Éxito</th>
                <th className="py-2 font-medium">Errores</th>
                <th className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-brand-muted/10">
                  <td className="py-2">{b.file_name}</td>
                  <td className="py-2">{b.total_rows}</td>
                  <td className="py-2 text-brand-success">{b.success_count}</td>
                  <td className="py-2 text-brand-danger">{b.error_count}</td>
                  <td className="py-2 text-brand-muted">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
