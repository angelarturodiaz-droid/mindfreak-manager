import { requirePageAccess } from "@/lib/auth/permissions";

/** Anticipos de clientes: mismo permiso que Cobros y pagos (payments.view). */
export default async function AdvancesAccessLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("payments.view", "entrar a los anticipos");
  return children;
}
