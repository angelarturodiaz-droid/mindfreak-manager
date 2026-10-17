/**
 * Qué reportes ve cada rol: además de "Ver reportes" (reports.view), cada
 * reporte pide el permiso de los datos que muestra. Así Ventas u Operaciones
 * no ven números de facturas, cobros, gastos o bancos que su rol no maneja.
 */
export const REPORT_PERMISSIONS: Record<string, string[]> = {
  rentabilidad: ["invoices.view", "expenses.view"],
  vencimientos: ["invoices.view"],
  cxc: ["invoices.view"],
  "retenciones-clientes": ["payments.view"],
  cxp: ["expenses.view"],
  "flujo-categoria": ["banks.view"],
  "por-moneda": ["payments.view"],
  "ventas-cliente": ["invoices.view"],
  "gastos-categoria": ["expenses.view"],
};

/** Comparaciones (rentabilidad de proyectos y clientes). */
export const COMPARISONS_PERMISSIONS = ["invoices.view", "expenses.view"];

export function canSeeReport(report: string, perms: Set<string> | string[]): boolean {
  const has = (p: string) => (Array.isArray(perms) ? perms.includes(p) : perms.has(p));
  const need = REPORT_PERMISSIONS[report];
  return !!need && has("reports.view") && need.every(has);
}

export function allowedReports(perms: Set<string> | string[]): string[] {
  return Object.keys(REPORT_PERMISSIONS).filter((r) => canSeeReport(r, perms));
}

export function canSeeComparisons(perms: Set<string> | string[]): boolean {
  const has = (p: string) => (Array.isArray(perms) ? perms.includes(p) : perms.has(p));
  return has("reports.view") && COMPARISONS_PERMISSIONS.every(has);
}
