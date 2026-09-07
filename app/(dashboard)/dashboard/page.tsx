import { getCurrentUser } from "@/lib/auth/permissions";
import { signOut } from "@/features/auth/actions";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold text-brand-primary">Dashboard</h1>
      <p className="text-sm text-brand-muted">
        Sesión activa: {user?.email ?? "—"}
      </p>
      <p className="text-sm text-brand-muted">
        F4 — Seguridad completada. El contenido real del Dashboard llega en F16.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="w-fit border border-brand-muted/30 px-4 py-2 text-sm text-brand-text hover:border-brand-accent"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
