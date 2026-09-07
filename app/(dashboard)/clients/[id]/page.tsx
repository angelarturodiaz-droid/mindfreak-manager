import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient, listClientContacts } from "@/features/clients/queries";
import {
  convertClientToActiveAction,
  deactivateClientAction,
  deleteContactAction,
} from "@/features/clients/actions";
import { ClientEditForm } from "./client-edit-form";
import { NewContactForm } from "./new-contact-form";

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

  const contacts = await listClientContacts(id);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/clients" className="text-sm text-brand-muted hover:text-brand-text">
          ← Clientes
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-brand-primary">
            {client.name}
          </h1>
          <span
            className={
              client.status === "ACTIVE" ? "text-brand-success" : "text-brand-accent"
            }
          >
            {client.status === "ACTIVE" ? "Cliente activo" : "Lead"}
          </span>
          {!client.is_active && (
            <span className="text-sm text-brand-danger">(inactivo)</span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        {client.status === "LEAD" && (
          <form action={convertClientToActiveAction.bind(null, client.id)}>
            <button
              type="submit"
              className="border border-brand-accent px-4 py-2 text-sm text-brand-accent hover:bg-brand-accent hover:text-white"
            >
              Convertir a cliente activo
            </button>
          </form>
        )}
        {client.is_active && (
          <form action={deactivateClientAction.bind(null, client.id)}>
            <button
              type="submit"
              className="border border-brand-muted/30 px-4 py-2 text-sm text-brand-muted hover:border-brand-danger hover:text-brand-danger"
            >
              Desactivar cliente
            </button>
          </form>
        )}
      </div>

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Información general
        </h2>
        <ClientEditForm client={client} />
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
              <form action={deleteContactAction.bind(null, contact.id, client.id)}>
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
          <NewContactForm clientId={client.id} />
        </div>
      </section>
    </main>
  );
}
