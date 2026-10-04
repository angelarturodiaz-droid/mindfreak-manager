import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";

export type FiscalRuleSummary = {
  id?: string;
  name: string;
  version: number;
  treatment: string | null;
  legal_source: string | null;
  legal_article: string | null;
  reference_url: string | null;
  needs_review: boolean;
};

/**
 * Mensaje principal, lo que falta (con enlace para completarlo) y el
 * desplegable "¿Por qué se aplicó esto?" con la regla y su fuente.
 */
export function FiscalExplanation({
  status,
  message,
  explanation,
  missing,
  rule,
  supplierId,
  canSeeRules = false,
}: {
  status: string;
  message: string;
  explanation: string;
  missing: string[];
  rule: FiscalRuleSummary | null;
  supplierId?: string | null;
  canSeeRules?: boolean;
}) {
  const warn = ["MISSING_DATA", "NO_RULE", "REVIEW", "BLOCKED"].includes(status);
  const supplierMissing = missing.some((m) => m.includes("proveedor"));
  const typeUnclassified = missing.some((m) => m.includes("clasificación fiscal"));
  return (
    <div className="flex flex-col gap-2">
      <p className={`flex items-start gap-2 text-sm ${warn ? "text-brand-warning" : "text-brand-text"}`}>
        {warn && <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />}
        <span>{message}</span>
      </p>
      {missing.length > 1 && (
        <ul className="ml-6 list-disc text-xs text-brand-muted">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {(supplierMissing && supplierId) || typeUnclassified ? (
        <p className="text-xs text-brand-muted">
          {supplierMissing && supplierId && (
            <Link href={`/suppliers/${supplierId}`} className="text-brand-accent underline" target="_blank">
              Completar la ficha fiscal del proveedor
            </Link>
          )}
          {supplierMissing && supplierId && typeUnclassified && " · "}
          {typeUnclassified && (
            <Link href="/settings/service-types?fiscal=none" className="text-brand-accent underline" target="_blank">
              Clasificar el tipo de servicio
            </Link>
          )}
          <span> (se abre en otra pestaña; luego vuelve y el cálculo se actualiza).</span>
        </p>
      ) : null}
      <details className="rounded-[var(--radius-md)] border border-brand-border px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-brand-text">¿Por qué se aplicó esto?</summary>
        <div className="mt-2 flex flex-col gap-1.5 text-xs text-brand-muted">
          <p>{explanation}</p>
          {rule && (
            <>
              <p>
                <span className="font-medium text-brand-text">Regla:</span> {rule.name}
                {rule.version > 1 ? ` (versión ${rule.version})` : ""}
                {rule.treatment ? ` · ${rule.treatment}` : ""}
              </p>
              {(rule.legal_source || rule.legal_article) && (
                <p>
                  <span className="font-medium text-brand-text">Base legal:</span>{" "}
                  {[rule.legal_source, rule.legal_article].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="flex flex-wrap gap-3">
                {rule.reference_url && (
                  <a href={rule.reference_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-accent underline">
                    Ver fuente <ExternalLink size={12} aria-hidden />
                  </a>
                )}
                {canSeeRules && rule.id && (
                  <Link href={`/settings/fiscal-rules/${rule.id}`} className="text-brand-accent underline" target="_blank">
                    Ver la regla
                  </Link>
                )}
              </p>
              {rule.needs_review && (
                <p className="text-brand-warning">
                  Esta regla es una propuesta inicial pendiente de revisar con tu contador.
                </p>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  );
}
