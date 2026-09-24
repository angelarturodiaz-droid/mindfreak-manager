import type { BadgeTone } from "@/components/ui/badge";

/**
 * Presentación de clientes compartida por la lista (/clients) y el
 * detalle (/clients/[id]).
 *
 * Etapa (pipeline comercial: Lead → Prospecto → Cliente) y Estado
 * (activo/inactivo) son independientes: un Lead puede estar inactivo sin
 * dejar de ser Lead. Ver commit aba70ab.
 */
export const CLIENT_STAGE_FLOW = ["LEAD", "PROSPECT", "CLIENT"] as const;

export const CLIENT_STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  PROSPECT: "Prospecto",
  CLIENT: "Cliente",
};

export const CLIENT_STAGE_PLURAL: Record<string, string> = {
  LEAD: "Leads",
  PROSPECT: "Prospectos",
  CLIENT: "Clientes",
};

export const CLIENT_STAGE_TONE: Record<string, BadgeTone> = {
  LEAD: "info",
  PROSPECT: "warning",
  CLIENT: "success",
};

/** Iniciales para el avatar: "Angel Arturo Diaz" → "AD". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Color estable del avatar según el nombre (siempre el mismo para el mismo cliente). */
const AVATAR_TONES = [
  "bg-brand-accent-light text-brand-accent",
  "bg-brand-success-bg text-brand-success",
  "bg-brand-warning-bg text-brand-warning",
  "bg-chart-5-bg text-chart-5",
  "bg-chart-6-bg text-chart-6",
];
export function avatarTone(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}
