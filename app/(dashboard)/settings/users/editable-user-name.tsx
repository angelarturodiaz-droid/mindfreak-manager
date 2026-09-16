"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateUserNameAction } from "@/features/users/actions";
import { toast } from "@/components/ui/toaster";

export function EditableUserName({ userId, fullName }: { userId: string; fullName: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fullName ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUserNameAction(userId, value);
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          className="w-36 rounded-[var(--radius-sm)] border border-brand-accent bg-brand-surface px-1.5 py-0.5 text-sm outline-none"
        />
        <button type="button" onClick={handleSave} disabled={isPending} className="text-brand-success">
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(fullName ?? "");
            setEditing(false);
          }}
          className="text-brand-muted"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-left"
    >
      {fullName ?? "—"}
      <Pencil size={11} className="text-brand-muted opacity-0 group-hover:opacity-100" />
    </button>
  );
}
