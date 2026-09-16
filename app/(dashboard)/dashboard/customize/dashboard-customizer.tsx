"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { saveDashboardWidgetsAction } from "@/features/dashboard-widgets/actions";
import { WIDGET_LABELS, type WidgetInstance, type WidgetSize } from "@/features/dashboard-widgets/registry";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

const SIZE_LABELS: Record<WidgetSize, string> = { sm: "Chico", md: "Mediano", lg: "Grande" };

export function DashboardCustomizer({ initialWidgets }: { initialWidgets: WidgetInstance[] }) {
  const [items, setItems] = useState<WidgetInstance[]>(initialWidgets);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleVisible(index: number) {
    setItems((prev) => prev.map((w, i) => (i === index ? { ...w, visible: !w.visible } : w)));
  }

  function changeSize(index: number, size: WidgetSize) {
    setItems((prev) => prev.map((w, i) => (i === index ? { ...w, size } : w)));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveDashboardWidgetsAction(items);
        toast.success("Dashboard actualizado");
        router.push("/dashboard");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-brand-muted">
        Arrastra para reordenar. Marca cuáles quieres ver, y de qué tamaño.
        Se guarda por tu usuario — nadie más lo ve así, y sigue igual la
        próxima vez que entres.
      </p>

      <ul className="flex max-w-2xl flex-col gap-2">
        {items.map((w, i) => (
          <li
            key={w.type}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            className={`flex items-center gap-3 rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2.5 ${
              dragIndex === i ? "opacity-50" : ""
            } ${w.visible ? "" : "opacity-60"}`}
          >
            <GripVertical size={16} className="shrink-0 cursor-grab text-brand-muted" />
            <span className="flex-1 text-sm text-brand-text">{WIDGET_LABELS[w.type] ?? w.type}</span>
            <select
              value={w.size}
              onChange={(e) => changeSize(i, e.target.value as WidgetSize)}
              disabled={!w.visible}
              className="rounded-[var(--radius-sm)] border border-brand-border bg-brand-surface px-2 py-1 text-xs disabled:opacity-50"
            >
              {(Object.keys(SIZE_LABELS) as WidgetSize[]).map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => toggleVisible(i)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-brand-muted hover:bg-brand-surface-hover hover:text-brand-accent"
              aria-label={w.visible ? "Ocultar" : "Mostrar"}
            >
              {w.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-3">
        <Button onClick={handleSave} loading={isPending}>
          Guardar
        </Button>
        <Button variant="ghost" onClick={() => router.push("/dashboard")}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
