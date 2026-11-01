import Link from "next/link";
import { FileSignature } from "lucide-react";
import { getRetentionLetterSettings } from "@/features/retention-letters/actions";
import { hasPermission } from "@/lib/auth/permissions";
import { RetentionLetterSettingsForm } from "./retention-letter-form";

export default async function DocumentsSettingsPage() {
  const [settings, canEdit] = await Promise.all([getRetentionLetterSettings(), hasPermission("settings.manage")]);
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-brand-primary">
          <FileSignature size={18} aria-hidden /> Carta de retención a proveedores
        </h2>
        <p className="mb-4 text-sm text-brand-muted">
          Cuando le retenemos ISR o ITBIS a un proveedor, en el gasto sale el botón <strong>Carta de retención (PDF)</strong>.
          Aquí se configuran los textos fijos de esa carta. Los montos, el NCF y los porcentajes salen solos del gasto.
        </p>
        <RetentionLetterSettingsForm settings={settings} canEdit={canEdit} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-brand-primary">Archivos adjuntos</h2>
        <p className="text-sm text-brand-muted">
          Los archivos (recibos, contratos, fotos, comprobantes) se suben directamente en cada registro: no hay tipos de
          documento ni plantillas que configurar. Está dentro de{" "}
          <Link href="/projects" className="text-brand-accent hover:underline">
            Proyectos
          </Link>
          ,{" "}
          <Link href="/expenses" className="text-brand-accent hover:underline">
            Gastos
          </Link>
          ,{" "}
          <Link href="/clients" className="text-brand-accent hover:underline">
            Clientes
          </Link>{" "}
          y{" "}
          <Link href="/suppliers" className="text-brand-accent hover:underline">
            Proveedores
          </Link>
          , cada uno en su sección «Documentos».
        </p>
      </section>
    </div>
  );
}
