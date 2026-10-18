import { requirePageAccess } from "@/lib/auth/permissions";

/** Convertir una cotización en proyecto: solo quien puede crear proyectos. */
export default async function FromQuotationLayout({ children }: { children: React.ReactNode }) {
  await requirePageAccess("projects.create", "convertir cotizaciones en proyecto");
  return children;
}
