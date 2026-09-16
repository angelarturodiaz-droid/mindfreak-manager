"use client";

import { useState } from "react";
import { ChangePasswordForm } from "./change-password-form";

export function PasswordRow() {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="max-w-sm">
        <ChangePasswordForm onDone={() => setEditing(false)} />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-2 text-sm text-brand-muted hover:text-brand-text"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="tracking-widest text-brand-muted">••••••••••</span>
      <button type="button" onClick={() => setEditing(true)} className="text-sm text-brand-accent hover:underline">
        Cambiar
      </button>
    </div>
  );
}
