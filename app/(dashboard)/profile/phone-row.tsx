"use client";

import { useState, useTransition } from "react";
import { updateOwnPhoneAction } from "@/features/profile/actions";
import { toast } from "@/components/ui/toaster";

export function PhoneRow({ phone }: { phone: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateOwnPhoneAction(value);
        setEditing(false);
        toast.success("Teléfono actualizado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          placeholder="+1 809 000 0000"
          className="w-48 rounded-[var(--radius-md)] border border-brand-accent bg-brand-surface px-2.5 py-1.5 text-sm outline-none"
        />
        <button type="button" onClick={handleSave} disabled={isPending} className="text-sm text-brand-accent hover:underline">
          Guardar
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(phone ?? "");
            setEditing(false);
          }}
          className="text-sm text-brand-muted hover:text-brand-text"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span>{phone || "Sin agregar"}</span>
      <button type="button" onClick={() => setEditing(true)} className="text-sm text-brand-accent hover:underline">
        {phone ? "Cambiar" : "Agregar"}
      </button>
    </div>
  );
}
