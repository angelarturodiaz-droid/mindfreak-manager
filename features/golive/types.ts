/** A1 — Tipos y lectura de lo que devuelven golive_preview y golive_validate (sin "use server": se prueban solos). */

export type GoLiveCount = { key: string; label: string; count: number };

export type GoLivePreview = {
  previewId: string;
  counts: GoLiveCount[];
  total: number;
  kept: Record<string, number>;
  lists: { clients: string[]; suppliers: string[]; bankAccounts: string[]; assets: string[] };
  fileCount: number;
  backupOk: boolean;
  backupAt: string | null;
  companyName: string;
};

export type GoLiveCheck = { key: string; ok: boolean; detail: unknown };
export type GoLiveChecks = { ran: boolean; runAt: string | null; checks: GoLiveCheck[] };

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function golivePreviewFrom(data: unknown): GoLivePreview {
  const d = (data ?? {}) as Record<string, unknown>;
  const counts = (Array.isArray(d.counts) ? d.counts : []).map((c) => {
    const x = c as Record<string, unknown>;
    return { key: String(x.key), label: String(x.label), count: Number(x.count ?? 0) };
  });
  const lists = (d.lists ?? {}) as Record<string, unknown>;
  const kept: Record<string, number> = {};
  for (const [k, v] of Object.entries((d.kept ?? {}) as Record<string, unknown>)) kept[k] = Number(v);
  return {
    previewId: String(d.preview_id ?? ""),
    counts,
    total: counts.reduce((s, c) => s + c.count, 0),
    kept,
    lists: {
      clients: arr(lists.clients),
      suppliers: arr(lists.suppliers),
      bankAccounts: arr(lists.bank_accounts),
      assets: arr(lists.assets),
    },
    fileCount: Number(d.file_count ?? 0),
    backupOk: d.backup_ok === true,
    backupAt: (d.backup_at as string | null) ?? null,
    companyName: String(d.company_name ?? ""),
  };
}

export function checksFrom(data: unknown): GoLiveChecks {
  const d = (data ?? {}) as Record<string, unknown>;
  const checks = (Array.isArray(d.checks) ? d.checks : []).map((c) => {
    const x = c as Record<string, unknown>;
    return { key: String(x.key), ok: x.ok === true, detail: x.detail };
  });
  return { ran: d.ran === true, runAt: (d.run_at as string | null) ?? null, checks };
}

/** Lo que significa cada comprobación, en palabras sencillas. */
export const CHECK_LABELS: Record<string, { title: string; ok: string; bad: string }> = {
  empty: {
    title: "Todo lo de prueba quedó en cero",
    ok: "Facturas, cotizaciones, gastos, cobros, pagos, clientes, proveedores y cuentas en 0.",
    bad: "Hay registros nuevos. Es normal si ya empezaste a cargar los datos reales.",
  },
  orphans: {
    title: "No quedó nada suelto",
    ok: "Ningún registro apunta a algo que ya no existe y cada documento tiene su archivo.",
    bad: "Hay referencias rotas. Avísale a soporte antes de seguir.",
  },
  kept: {
    title: "La configuración quedó igual",
    ok: "Usuarios, roles, impuestos, reglas fiscales, monedas, categorías, productos y activos sin cambios.",
    bad: "Cambió algo de la configuración desde la limpieza (puede ser normal si lo editaste después).",
  },
  files: {
    title: "Se borraron los archivos de prueba",
    ok: "No queda ningún PDF, foto o adjunto de prueba.",
    bad: "Quedan archivos por borrar: pulsa «Reintentar archivos».",
  },
  audit: {
    title: "La auditoría empieza limpia",
    ok: "Solo queda el registro de la limpieza (la auditoría de pruebas está en el respaldo).",
    bad: "Quedan registros de auditoría anteriores a la limpieza.",
  },
};

/** Nombres que se muestran de lo que se conserva (para la vista previa). */
export const KEPT_LABELS: Record<string, string> = {
  profiles: "Usuarios",
  roles: "Roles",
  tax_rates: "Impuestos",
  fiscal_rules: "Reglas fiscales",
  payment_terms: "Condiciones de pago",
  currencies: "Monedas",
  bank_catalog: "Catálogo de bancos",
  expense_categories: "Categorías de gastos",
  supplier_service_types: "Tipos de servicio",
  services: "Productos y servicios",
  service_categories: "Categorías de productos",
  directory_zones: "Zonas del Directorio",
  directory_tags: "Etiquetas del Directorio",
  suppliers: "Registros del Directorio que no son proveedores",
  assets: "Activos",
  survey_questions: "Preguntas de la encuesta",
};
