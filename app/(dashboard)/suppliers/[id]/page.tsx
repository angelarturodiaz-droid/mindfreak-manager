import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getSupplier, listSupplierContacts } from "@/features/suppliers/queries";
import { listBankCatalog } from "@/features/bank-catalog/queries";
import {
  deactivateSupplierAction,
  deleteSupplierContactAction,
} from "@/features/suppliers/actions";
import { SupplierEditForm } from "./supplier-edit-form";
import { NewSupplierContactForm } from "./new-contact-form";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { listDocuments } from "@/features/documents/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";

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

  const [contacts, documents, canManageDocs, bankCatalog] = await Promise.all([
    listSupplierContacts(id),
    listDocuments("supplier", id),
    hasPermission("documents.upload"),
    listBankCatalog(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <div>
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Proveedores
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {supplier.name}
          </h1>
          {supplier.category && <Badge tone="info">{supplier.category}</Badge>}
          {!supplier.is_active && <Badge tone="danger">Inactivo</Badge>}
        </div>
      </div>

      {supplier.is_active && (
        <ConfirmButton
          label="Desactivar proveedor"
          confirmTitle={`¿Desactivar a "${supplier.name}"?`}
          onConfirm={deactivateSupplierAction.bind(null, supplier.id)}
        />
      )}

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Información general
        </h2>
        <Card>
          <SupplierEditForm supplier={supplier} bankCatalog={bankCatalog} />
        </Card>
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">Contactos</h2>
        <div className="space-y-2">
          {contacts.length === 0 && (
            <p className="text-sm text-brand-muted">Sin contactos todavía.</p>
          )}
          {contacts.map((contact) => (
            <Card key={contact.id} padded={false} className="flex items-center justify-between px-3 py-2">
              <div>
                <span className="text-sm font-medium text-brand-text">
                  {contact.full_name}
                </span>
                {contact.is_primary && (
                  <span className="ml-2">
                    <Badge tone="info">Principal</Badge>
                  </span>
                )}
                <p className="text-sm text-brand-muted">
                  {[contact.position, contact.email, contact.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <ConfirmButton
                label="Eliminar"
                icon={<Trash2 size={14} />}
                confirmTitle={`¿Eliminar a ${contact.full_name}?`}
                onConfirm={deleteSupplierContactAction.bind(null, contact.id, supplier.id)}
              />
            </Card>
          ))}
        </div>

        <div className="mt-4">
          <NewSupplierContactForm supplierId={supplier.id} />
        </div>
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Documentos y contratos
        </h2>
        <div className="flex flex-col gap-4">
          {canManageDocs && (
            <UploadDocumentForm
              entityType="supplier"
              entityId={supplier.id}
              revalidatePathValue={`/suppliers/${supplier.id}`}
            />
          )}
          <DocumentList
            documents={documents}
            canDelete={canManageDocs}
            revalidatePathValue={`/suppliers/${supplier.id}`}
          />
        </div>
      </section>
    </main>
  );
}
