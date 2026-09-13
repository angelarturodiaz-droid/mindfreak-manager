import Link from "next/link";

export default function DocumentsSettingsPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">
        Documentos
      </h2>
      <p className="text-sm text-brand-muted">
        En este sistema los documentos son archivos subidos directamente
        (recibos, contratos, fotos, comprobantes) — no hay &ldquo;tipos de
        documento&rdquo; ni &ldquo;plantillas&rdquo; ni una numeración propia que
        configurar, es un concepto que no aplica a cómo está diseñado
        Mindfreak Manager.
      </p>
      <p className="mt-3 text-sm text-brand-muted">
        La gestión de documentos ya está disponible dentro de{" "}
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
        </Link>{" "}
        — cada uno tiene su propia sección de &ldquo;Documentos&rdquo; o &ldquo;Recibos y
        comprobantes&rdquo;.
      </p>
    </div>
  );
}
