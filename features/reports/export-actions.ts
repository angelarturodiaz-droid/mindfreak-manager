"use server";

import { hasPermission, getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { buildReportExport, EXPORTABLE_REPORTS, type ReportExportParams } from "./export-data";
import type { ReportExportData } from "./export-types";

const ALLOWED_PARAMS = [
  "from",
  "to",
  "project_id",
  "client_id",
  "supplier_id",
  "category_id",
  "manager_id",
  "status",
  "currency",
  "bank_account_id",
  "include_transfers",
  "view",
  "origin",
  "direction",
  "only_foreign",
  "wh_type",
  "wh_status",
  "missing_cert",
] as const;

/**
 * Datos de un reporte para exportarlo (Excel o PDF). El archivo se genera en
 * el navegador (igual que los PDF de facturas). Requiere reports.view y deja
 * constancia en Auditoría de quién exportó qué y con qué filtros.
 */
export async function getReportExportAction(
  report: string,
  rawParams: Record<string, string | undefined>,
  format: "xlsx" | "pdf",
): Promise<{ data: ReportExportData | null; error: string | null }> {
  if (!(await hasPermission("reports.view"))) {
    return { data: null, error: "No tienes permiso para ver reportes." };
  }
  if (!EXPORTABLE_REPORTS[report]) return { data: null, error: "Este reporte no se puede exportar." };

  const params: ReportExportParams = {};
  for (const k of ALLOWED_PARAMS) {
    const v = rawParams[k];
    if (typeof v === "string" && v.length > 0 && v.length <= 100) params[k] = v;
  }

  try {
    const data = await buildReportExport(report, params);
    const companyIds = await getCurrentUserCompanyIds();
    if (companyIds[0]) {
      await logAudit({
        companyId: companyIds[0],
        action: "EXPORT",
        entityType: "report",
        entityId: companyIds[0],
        newValues: { report, format, filters: data.filters },
      });
    }
    return { data, error: null };
  } catch (e) {
    console.error("Error exportando reporte", report, e);
    return { data: null, error: "No se pudo preparar el reporte. Intenta de nuevo en un momento." };
  }
}
