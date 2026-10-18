import Link from "next/link";
import { SearchX } from "lucide-react";

/** Pantalla "no existe" en español (dirección mal escrita o registro borrado). */
export function NotFoundView() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent-light text-brand-accent">
          <SearchX size={26} aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-brand-primary">No encontramos esta página</h1>
        <p className="text-sm text-brand-muted">
          La dirección puede estar mal escrita, o lo que buscas ya no existe (por ejemplo, un registro que se borró).
          Usa el menú o vuelve al inicio.
        </p>
        <Link
          href="/dashboard"
          className="mt-1 inline-flex items-center rounded-[var(--radius-md)] bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
