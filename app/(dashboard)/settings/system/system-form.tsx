"use client";

import { useActionState } from "react";
import { updateSystemAction, type ActionState } from "@/features/settings/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { error: null };

export function SystemForm({
  company,
}: {
  company: { platform_name: string; brand_primary: string; brand_accent: string };
}) {
  const [state, formAction, pending] = useActionState(updateSystemAction, initialState);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Input
        label="Nombre de la plataforma"
        name="platform_name"
        required
        defaultValue={company.platform_name}
        hint="Aparece en el menú lateral y en los documentos generados."
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Color primario
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              defaultValue={company.brand_primary}
              onChange={(e) => {
                const hidden = e.currentTarget
                  .nextElementSibling as HTMLInputElement | null;
                if (hidden) hidden.value = e.currentTarget.value;
              }}
              className="h-9 w-9 rounded-[var(--radius-sm)] border border-brand-border"
            />
            <input
              name="brand_primary"
              defaultValue={company.brand_primary}
              className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-brand-text">
            Color de acento
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              defaultValue={company.brand_accent}
              onChange={(e) => {
                const hidden = e.currentTarget
                  .nextElementSibling as HTMLInputElement | null;
                if (hidden) hidden.value = e.currentTarget.value;
              }}
              className="h-9 w-9 rounded-[var(--radius-sm)] border border-brand-border"
            />
            <input
              name="brand_accent"
              defaultValue={company.brand_accent}
              className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface px-3 py-2 text-sm outline-none focus:border-brand-accent"
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-brand-muted">
        Los colores se guardan aquí; conectarlos a los Design Tokens en vivo
        (para que cambien la app entera al instante) queda pendiente —
        actualmente los tokens están fijos en <code>globals.css</code>.
      </p>

      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
