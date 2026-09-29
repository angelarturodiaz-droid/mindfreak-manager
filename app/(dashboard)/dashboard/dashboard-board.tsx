"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  EyeOff,
  GripVertical,
  Move,
  Plus,
  Settings2,
} from "lucide-react";
import { saveDashboardWidgetsAction } from "@/features/dashboard-widgets/actions";
import {
  DASHBOARD_GRID,
  SIZE_COLS,
  WIDGET_LABELS,
  type WidgetInstance,
  type WidgetSize,
} from "@/features/dashboard-widgets/registry";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { isNavigationSignal } from "@/lib/utils/navigation-signal";

const SIZE_SHORT: { size: WidgetSize; label: string; title: string }[] = [
  { size: "sm", label: "C", title: "Chico" },
  { size: "md", label: "M", title: "Mediano" },
  { size: "lg", label: "G", title: "Grande (toda la fila)" },
];

/**
 * Cuadrícula del Dashboard. Con "Organizar" se pueden mover los cuadros con
 * el mouse (arrastrar y soltar), cambiarles el tamaño u ocultarlos ahí
 * mismo. Se guarda con la misma acción que "Personalizar Dashboard".
 */
export function DashboardBoard({
  widgets,
  nodes,
  toolbarStart,
}: {
  /** Lista completa del usuario (visibles y ocultos), en su orden. */
  widgets: WidgetInstance[];
  /** Contenido ya armado de cada widget, por tipo. */
  nodes: Record<string, ReactNode>;
  /** Va a la izquierda de Organizar / Personalizar (ej. accesos rápidos). */
  toolbarStart?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<WidgetInstance[]>(widgets);
  const [dragType, setDragType] = useState<string | null>(null);
  const [overType, setOverType] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const shown = (editing ? items : widgets).filter((w) => w.visible);
  const hidden = items.filter((w) => !w.visible);

  function startEditing() {
    setItems(widgets);
    setEditing(true);
  }

  function cancel() {
    setItems(widgets);
    setEditing(false);
    setDragType(null);
    setOverType(null);
  }

  /** Pone `type` en el lugar de `targetType` (antes si viene de más abajo, después si viene de más arriba). */
  function moveTo(type: string, targetType: string) {
    if (type === targetType) return;
    setItems((prev) => {
      const from = prev.findIndex((w) => w.type === type);
      const to = prev.findIndex((w) => w.type === targetType);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  /** Mueve un lugar entre los visibles (botones ← →, sirve también en celular). */
  function step(type: string, dir: -1 | 1) {
    const visible = items.filter((w) => w.visible);
    const i = visible.findIndex((w) => w.type === type);
    const target = visible[i + dir];
    if (target) moveTo(type, target.type);
  }

  function setSize(type: string, size: WidgetSize) {
    setItems((prev) => prev.map((w) => (w.type === type ? { ...w, size } : w)));
  }

  function setVisible(type: string, visible: boolean) {
    setItems((prev) => {
      const w = prev.find((x) => x.type === type);
      if (!w) return prev;
      const rest = prev.filter((x) => x.type !== type);
      if (!visible) return [...rest, { ...w, visible }];
      // Al mostrarlo, va después del último visible.
      const lastVisible = rest.map((x) => x.visible).lastIndexOf(true);
      const next = [...rest];
      next.splice(lastVisible + 1, 0, { ...w, visible });
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      try {
        await saveDashboardWidgetsAction(items);
        toast.success("Dashboard guardado");
        setEditing(false);
        router.refresh();
      } catch (e) {
        if (isNavigationSignal(e)) return;
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {editing ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-brand-accent bg-brand-accent-light px-4 py-3">
          <p className="text-sm text-brand-text">
            <strong>Organizando:</strong> arrastra cada cuadro con el mouse para
            moverlo (o usa ← →). C/M/G cambia el tamaño; el ojo lo oculta.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancel}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={save} loading={isPending}>
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">{toolbarStart}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Move size={14} />}
              onClick={startEditing}
            >
              Organizar
            </Button>
            <Link href="/dashboard/customize">
              <Button
                variant="outline"
                size="sm"
                icon={<Settings2 size={14} />}
              >
                Personalizar Dashboard
              </Button>
            </Link>
          </div>
        </div>
      )}

      {shown.length === 0 && !editing ? (
        <p className="text-sm text-brand-muted">
          No tienes widgets visibles. Pulsa <strong>Organizar</strong> o{" "}
          <Link
            href="/dashboard/customize"
            className="text-brand-accent hover:underline"
          >
            Personaliza tu Dashboard
          </Link>{" "}
          para agregar algunos.
        </p>
      ) : (
        <section className={DASHBOARD_GRID}>
          {shown.map((w, i) =>
            editing ? (
              <div
                key={w.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", w.type);
                  setDragType(w.type);
                }}
                onDragEnd={() => {
                  setDragType(null);
                  setOverType(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overType !== w.type) setOverType(w.type);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const type = dragType ?? e.dataTransfer.getData("text/plain");
                  if (type) moveTo(type, w.type);
                  setDragType(null);
                  setOverType(null);
                }}
                className={`${SIZE_COLS[w.size]} relative flex cursor-grab flex-col rounded-[var(--radius-lg)] border-2 border-dashed transition-colors active:cursor-grabbing ${
                  overType === w.type && dragType !== w.type
                    ? "border-brand-accent bg-brand-accent-light"
                    : "border-brand-border"
                } ${dragType === w.type ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-1 border-b border-dashed border-brand-border px-2 py-1.5">
                  <GripVertical
                    size={14}
                    className="shrink-0 text-brand-muted"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-brand-text">
                    {WIDGET_LABELS[w.type] ?? w.type}
                  </span>
                  <IconBtn
                    label="Mover antes"
                    onClick={() => step(w.type, -1)}
                    disabled={i === 0}
                  >
                    <ArrowLeft size={13} />
                  </IconBtn>
                  <IconBtn
                    label="Mover después"
                    onClick={() => step(w.type, 1)}
                    disabled={i === shown.length - 1}
                  >
                    <ArrowRight size={13} />
                  </IconBtn>
                  <span className="mx-0.5 flex overflow-hidden rounded-[var(--radius-sm)] border border-brand-border">
                    {SIZE_SHORT.map((s) => (
                      <button
                        key={s.size}
                        type="button"
                        title={s.title}
                        aria-label={`Tamaño ${s.title}`}
                        onClick={() => setSize(w.type, s.size)}
                        className={`px-1.5 py-0.5 text-[11px] font-medium ${
                          w.size === s.size
                            ? "bg-brand-primary text-white"
                            : "bg-brand-surface text-brand-muted hover:text-brand-text"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </span>
                  <IconBtn
                    label="Ocultar"
                    onClick={() => setVisible(w.type, false)}
                  >
                    <EyeOff size={13} />
                  </IconBtn>
                </div>
                {/* Mientras se organiza, el contenido no responde a clics (para arrastrar sin abrir enlaces). */}
                <div
                  className="pointer-events-none flex-1 select-none p-1"
                  aria-hidden
                >
                  {nodes[w.type]}
                </div>
              </div>
            ) : (
              <div key={`${w.type}-${i}`} className={SIZE_COLS[w.size]}>
                {nodes[w.type]}
              </div>
            ),
          )}
        </section>
      )}

      {editing && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-dashed border-brand-border p-4">
          <p className="text-sm font-medium text-brand-text">Cuadros ocultos</p>
          {hidden.length === 0 ? (
            <p className="text-xs text-brand-muted">
              Todos los cuadros están visibles.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hidden.map((w) => (
                <Button
                  key={w.type}
                  size="sm"
                  variant="outline"
                  icon={<Plus size={13} />}
                  onClick={() => setVisible(w.type, true)}
                >
                  {WIDGET_LABELS[w.type] ?? w.type}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-brand-muted hover:bg-brand-surface-hover hover:text-brand-accent disabled:opacity-30"
    >
      {children}
    </button>
  );
}
