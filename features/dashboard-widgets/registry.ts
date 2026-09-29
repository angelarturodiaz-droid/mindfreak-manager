/**
 * Catálogo de widgets del Dashboard — Fase 3 del módulo financiero
 * avanzado. Cada widget es independiente y reutilizable (ver
 * components/dashboard-widgets/render-widget.tsx); agregar uno nuevo en
 * el futuro es: 1) una entrada aquí, 2) un caso en renderWidget(). No hay
 * que rediseñar el resto del Dashboard.
 */

export type WidgetSize = "sm" | "md" | "lg";

export type WidgetDef = {
  type: string;
  label: string;
  category: string;
  defaultSize: WidgetSize;
};

export const WIDGET_REGISTRY: WidgetDef[] = [
  { type: "disponible_bancos_dop", label: "Disponible en bancos (pesos)", category: "Bancos", defaultSize: "sm" },
  { type: "disponible_bancos_usd", label: "Disponible en bancos (dólares)", category: "Bancos", defaultSize: "sm" },
  { type: "total_por_cobrar", label: "Total por cobrar", category: "Cobros", defaultSize: "sm" },
  { type: "total_vencido", label: "Total vencido", category: "Cobros", defaultSize: "sm" },
  { type: "vence_hoy", label: "Vence hoy", category: "Cobros", defaultSize: "sm" },
  { type: "total_por_pagar", label: "Total por pagar", category: "Pagos", defaultSize: "sm" },
  { type: "ingresos_mes", label: "Ingresos del mes", category: "Ventas", defaultSize: "sm" },
  { type: "gastos_mes", label: "Gastos del mes", category: "Gastos", defaultSize: "sm" },
  { type: "utilidad_mes", label: "Utilidad del mes", category: "Rentabilidad", defaultSize: "sm" },
  { type: "margen_mes", label: "Margen del mes", category: "Rentabilidad", defaultSize: "sm" },
  { type: "proyectos_activos", label: "Proyectos activos", category: "Operaciones", defaultSize: "sm" },
  { type: "flujo_financiero", label: "Gráfico: Flujo financiero", category: "Gráficos", defaultSize: "lg" },
  { type: "cobros_por_vencer", label: "Gráfico: Por cobrar según vencimiento", category: "Gráficos", defaultSize: "sm" },
  { type: "facturas_vencidas", label: "Facturas vencidas", category: "Cobros", defaultSize: "md" },
  { type: "facturas_proximas", label: "Facturas próximas a vencer", category: "Cobros", defaultSize: "md" },
  { type: "cotizaciones_pendientes", label: "Cotizaciones pendientes", category: "Ventas", defaultSize: "md" },
  { type: "ultimos_cobros", label: "Últimos cobros", category: "Cobros", defaultSize: "md" },
  { type: "ultimos_pagos", label: "Últimos pagos", category: "Pagos", defaultSize: "md" },
  { type: "tareas_pendientes", label: "Tareas pendientes", category: "Operaciones", defaultSize: "md" },
  { type: "rentabilidad_proyectos", label: "Rentabilidad por proyecto (top 5)", category: "Rentabilidad", defaultSize: "md" },
];

export const WIDGET_LABELS: Record<string, string> = Object.fromEntries(
  WIDGET_REGISTRY.map((w) => [w.type, w.label]),
);

export type WidgetInstance = { type: string; visible: boolean; size: WidgetSize };

/** Layout que ve un usuario que nunca ha personalizado su Dashboard — refleja el Dashboard "de fábrica" que ya existía. */
export const DEFAULT_WIDGETS: WidgetInstance[] = [
  { type: "disponible_bancos_dop", visible: true, size: "sm" },
  { type: "disponible_bancos_usd", visible: true, size: "sm" },
  { type: "ingresos_mes", visible: true, size: "sm" },
  { type: "ultimos_cobros", visible: true, size: "sm" },
  { type: "gastos_mes", visible: true, size: "sm" },
  { type: "ultimos_pagos", visible: true, size: "sm" },
  { type: "total_por_cobrar", visible: true, size: "sm" },
  { type: "total_por_pagar", visible: true, size: "sm" },
  { type: "utilidad_mes", visible: true, size: "sm" },
  { type: "margen_mes", visible: true, size: "sm" },
  { type: "proyectos_activos", visible: true, size: "sm" },
  { type: "cotizaciones_pendientes", visible: true, size: "sm" },
  { type: "flujo_financiero", visible: true, size: "lg" },
  { type: "cobros_por_vencer", visible: true, size: "sm" },
  { type: "total_vencido", visible: false, size: "sm" },
  { type: "vence_hoy", visible: false, size: "sm" },
  { type: "facturas_vencidas", visible: false, size: "md" },
  { type: "facturas_proximas", visible: false, size: "md" },
  { type: "tareas_pendientes", visible: false, size: "md" },
  { type: "rentabilidad_proyectos", visible: false, size: "md" },
];

/**
 * Widgets nuevos que deben aparecer (visibles, al inicio) también a quien
 * ya había personalizado su Dashboard antes de que existieran. Si luego los
 * oculta en "Personalizar", se respeta.
 */
export const NEW_WIDGETS_SHOWN_BY_DEFAULT: { type: string; size: WidgetSize; after?: string }[] = [
  { type: "disponible_bancos_dop", size: "sm" },
  { type: "disponible_bancos_usd", size: "sm" },
  // Al lado del gráfico de flujo.
  { type: "cobros_por_vencer", size: "sm", after: "flujo_financiero" },
];

/**
 * Dos zonas en el Dashboard:
 * - "kpi": indicadores compactos en una franja arriba (el tamaño no aplica).
 * - "panel": gráficos y listas en una cuadrícula de 3 columnas debajo.
 *   Chico/Mediano = 1 columna; Grande = 2 columnas.
 */
export type WidgetKind = "kpi" | "panel";

export const PANEL_TYPES = new Set([
  "flujo_financiero",
  "cobros_por_vencer",
  "facturas_vencidas",
  "facturas_proximas",
  "ultimos_cobros",
  "ultimos_pagos",
  "tareas_pendientes",
  "rentabilidad_proyectos",
]);

export function widgetKind(type: string): WidgetKind {
  return PANEL_TYPES.has(type) ? "panel" : "kpi";
}

export const PANEL_COLS: Record<WidgetSize, string> = {
  sm: "lg:col-span-1",
  md: "lg:col-span-1",
  lg: "lg:col-span-2",
};

/**
 * La lista guardada del usuario + los widgets del catálogo que todavía no
 * tiene (al final, ocultos) — así se pueden mostrar al organizar.
 */
export function withMissingWidgets(saved: WidgetInstance[]): WidgetInstance[] {
  const savedTypes = new Set(saved.map((w) => w.type));
  const missing = WIDGET_REGISTRY.filter((w) => !savedTypes.has(w.type)).map(
    (w): WidgetInstance => ({ type: w.type, visible: false, size: w.defaultSize }),
  );
  return [...saved, ...missing];
}
