import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupplier, listSupplierContacts } from "@/features/suppliers/queries";
import {
  deactivateSupplierAction,
  deleteSupplierContactAction,
} from "@/features/suppliers/actions";
import { SupplierEditForm } from "./supplier-edit-form";
import { NewSupplierContactForm } from "./new-contact-form";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let supplier;
  try {
    supplier = await getSupplier(id);
  } catch {
    notFound();
  }
  if (!supplier) notFound();

  const contacts = await listSupplierContacts(id);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/suppliers" className="text-sm text-brand-muted hover:text-brand-text">
          ← Proveedores
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {supplier.name}
          </h1>
          {supplier.category && (
            <span className="text-sm text-brand-accent">{supplier.category}</span>
          )}
          {!supplier.is_active && (
            <span className="text-sm text-brand-danger">(inactivo)</span>
          )}
        </div>
      </div>

      {supplier.is_active && (
        <form action={deactivateSupplierAction.bind(null, supplier.id)}>
          <button
            type="submit"
            className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger"
          >
            Desactivar proveedor
          </button>
        </form>
      )}

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Información general
        </h2>
        <SupplierEditForm supplier={supplier} />
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">Contactos</h2>
        <div className="space-y-2">
          {contacts.length === 0 && (
            <p className="text-sm text-brand-muted">Sin contactos todavía.</p>
          )}
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between border border-brand-muted/20 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-brand-text">
                  {contact.full_name}
                </span>
                {contact.is_primary && (
                  <span className="ml-2 text-xs text-brand-accent">Principal</span>
                )}
                <p className="text-brand-muted">
                  {[contact.position, contact.email, contact.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <form
                action={deleteSupplierContactAction.bind(null, contact.id, supplier.id)}
              >
                <button
                  type="submit"
                  className="text-brand-muted hover:text-brand-danger"
                >
                  Eliminar
                </button>
              </form>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <NewSupplierContactForm supplierId={supplier.id} />
        </div>
      </section>
    </main>
  );
}
