import Link from "next/link";
import { ExternalLink, FileText, LifeBuoy, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import {
  APP_NAME,
  APP_VERSION,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_RNC,
  RELEASE_DATE,
  SUPPORT_EMAIL,
  copyrightText,
  environmentLabel,
} from "@/lib/app-info";
import { LEGAL_DATE, LEGAL_VERSION } from "@/lib/legal/content";
import { formatDate } from "@/lib/utils/dates";

/** Configuración → Sistema → Información del sistema. */
export function SystemInfo() {
  const rows: [string, string, string?][] = [
    ["Nombre del sistema", APP_NAME],
    ["Empresa", `${COMPANY_NAME} · RNC ${COMPANY_RNC}`],
    ["Versión", `v${APP_VERSION}`, "Sube con cada cambio importante y queda anotada en el historial de cambios (CHANGELOG). 1.0.1 = corrección pequeña, 1.1.0 = función nueva, 2.0.0 = cambio grande."],
    ["Ambiente", environmentLabel(), "Producción = el sistema real que usa el equipo. Desarrollo = la copia de pruebas en la computadora."],
    ["Última actualización", formatDate(RELEASE_DATE)],
    ["Política y términos", `Versión ${LEGAL_VERSION} · vigente desde el ${formatDate(LEGAL_DATE)}`],
  ];
  const link = "inline-flex items-center gap-1.5 text-sm font-medium text-brand-accent hover:underline";

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h3 className="flex items-center gap-1.5 font-semibold text-brand-text">
          Información del sistema
          <InfoHint text="Versión del sistema y enlaces a la Política de Privacidad, los Términos de Uso y Soporte. Lo mismo aparece abajo en todas las pantallas y en el menú de tu usuario (arriba a la derecha)." />
        </h3>
        <p className="text-xs text-brand-muted">Detalles de la versión y enlaces importantes.</p>
      </div>
      <dl className="divide-y divide-brand-border rounded-[var(--radius-md)] border border-brand-border text-sm">
        {rows.map(([k, v, hint]) => (
          <div key={k} className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[200px_1fr]">
            <dt className="flex items-center gap-1 text-brand-muted">
              {k}
              {hint && <InfoHint text={hint} />}
            </dt>
            <dd className="font-medium text-brand-text">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/legal/privacidad" target="_blank" className={link}>
          <ShieldCheck size={15} /> Política de Privacidad <ExternalLink size={12} />
        </Link>
        <Link href="/legal/terminos" target="_blank" className={link}>
          <FileText size={15} /> Términos de Uso <ExternalLink size={12} />
        </Link>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Soporte%20Mindfreak%20Manager`} className={link}>
          <LifeBuoy size={15} /> Soporte: {SUPPORT_EMAIL} · {COMPANY_PHONE}
        </a>
      </div>
      <p className="text-xs text-brand-muted">{copyrightText()}</p>
    </Card>
  );
}
