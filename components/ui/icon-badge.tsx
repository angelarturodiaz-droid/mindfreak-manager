import type { ReactNode } from "react";

export type IconBadgeTone = "blue" | "green" | "amber" | "red" | "violet" | "teal" | "neutral";

const TONE_CLASSES: Record<IconBadgeTone, string> = {
  blue: "bg-brand-accent-light text-brand-accent",
  green: "bg-brand-success-bg text-brand-success",
  amber: "bg-brand-warning-bg text-brand-warning",
  red: "bg-brand-danger-bg text-brand-danger",
  violet: "bg-chart-5-bg text-chart-5",
  teal: "bg-chart-6-bg text-chart-6",
  neutral: "bg-brand-surface-hover text-brand-muted",
};

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
};

/**
 * Ícono circular con fondo de color suave — usado para diferenciar
 * categorías/módulos de un vistazo (navegación, manual de ayuda) en vez
 * del ícono monocromático plano. Los tonos reutilizan los tokens de marca
 * y de la paleta de gráficos, nunca colores sueltos.
 */
export function IconBadge({
  icon,
  tone = "blue",
  size = "md",
  className = "",
}: {
  icon: ReactNode;
  tone?: IconBadgeTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]} ${className}`}
    >
      {icon}
    </span>
  );
}
