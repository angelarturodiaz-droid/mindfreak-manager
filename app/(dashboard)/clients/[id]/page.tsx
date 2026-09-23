import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserCheck, Trash2 } from "lucide-react";
import { getClient, listClientContacts } from "@/features/clients/queries";
import {
  convertClientToActiveAction,
  deactivateClientAction,
  deleteContactAction,
} from "@/features/clients/actions";
import { ActionButton } from "@/components/ui/action-button";
import { ClientEditForm } from "./client-edit-form";
import { NewContactForm } from "./new-contact-form";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { listDocuments } from "@/features/documents/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let client;
  try {
    client = await getClient(id);
  } catch {
    notFound();
  }
  if (!client) notFound();

  const [contacts, documents, canManageDocs] = await Promise.all([
    listClientContacts(id),
    listDocuments("client", id),
    hasPermission("documents.upload"),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-8 p-4 md:p-8">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-text"
        >
          <ArrowLeft size={14} /> Clientes
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">{client.name}</h1>
          <Badge tone={client.status === "ACTIVE" ? "success" : "info"}>
            {client.status === "ACTIVE" ? "Cliente activo" : "Lead"}
          </Badge>
          {!client.is_active && <Badge tone="danger">Inactivo</Badge>}
        </div>
      </div>

      <div className="flex gap-3">
        {client.status === "LEAD" && (
          <ActionButton
            label="Convertir a cliente activo"
            variant="secondary"
            icon={<UserCheck size={14} />}
            onAction={convertClientToActiveAction.bind(null, client.id)}
          />
        )}
        {client.is_active && (
          <ConfirmButton
            label="Desactivar cliente"
            confirmTitle={`¿Desactivar a "${client.name}"?`}
            confirmMessage="Podrás reactivarlo más adelante si hace falta."
            onConfirm={deactivateClientAction.bind(null, client.id)}
          />
        )}
      </div>

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Información general
        </h2>
        <Card>
          <ClientEditForm client={client} />
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
                onConfirm={deleteContactAction.bind(null, contact.id, client.id)}
              />
            </Card>
          ))}
        </div>

        <div className="mt-4">
          <NewContactForm clientId={client.id} />
        </div>
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Documentos y contratos
        </h2>
        <div className="flex flex-col gap-4">
          {canManageDocs && (
            <UploadDocumentForm
              entityType="client"
              entityId={client.id}
              revalidatePathValue={`/clients/${client.id}`}
            />
          )}
          <DocumentList
            documents={documents}
            canDelete={canManageDocs}
            revalidatePathValue={`/clients/${client.id}`}
          />
        </div>
      </section>
    </main>
  );
}
