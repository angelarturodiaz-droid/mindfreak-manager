import Link from "next/link";
import { listTaxRates } from "@/features/tax-rates/queries";
import {
  setDefaultTaxRateAction,
  toggleTaxRateActiveAction,
} from "@/features/tax-rates/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { NewTaxRateForm } from "./new-tax-rate-form";

export default async function TaxRatesPage() {
  const [rates, canManage] = await Promise.all([
    listTaxRates(false),
    hasPermission("settings.manage"),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard" className="text-sm text-brand-muted hover:text-brand-text">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-brand-primary">
          Tasas de impuesto
        </h1>
        <p className="text-sm text-brand-muted">
          Se usan al agregar líneas en cotizaciones y facturas. Esto no activa la
          facturación fiscal completa (NCF/DGII) — eso sigue pendiente para V2.
        </p>
      </div>

      <table className="w-full max-w-2xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-brand-muted/30 text-left text-brand-muted">
            <th className="py-2 font-medium">Nombre</th>
            <th className="py-2 font-medium">Tasa</th>
            <th className="py-2 font-medium">Predeterminada</th>
            <th className="py-2 font-medium">Estado</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id} className="border-b border-brand-muted/10">
              <td className="py-2">{r.name}</td>
              <td className="py-2">{r.rate}%</td>
              <td className="py-2">
                {r.is_default ? (
                  "Sí"
                ) : canManage && r.is_active ? (
                  <form action={setDefaultTaxRateAction.bind(null, r.id)}>
                    <button type="submit" className="text-brand-accent hover:underline">
                      Hacer predeterminada
                    </button>
                  </form>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2">{r.is_active ? "Activa" : "Inactiva"}</td>
              <td className="py-2 text-right">
                {canManage && (
                  <form
                    action={toggleTaxRateActiveAction.bind(null, r.id, r.is_active)}
                  >
                    <button
                      type="submit"
                      className="text-brand-muted hover:text-brand-danger"
                    >
                      {r.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {rates.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-brand-muted">
                Sin tasas configuradas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canManage && (
        <section className="max-w-2xl">
          <h2 className="mb-3 text-sm font-medium text-brand-text">Nueva tasa</h2>
          <NewTaxRateForm />
        </section>
      )}
    </main>
  );
}
