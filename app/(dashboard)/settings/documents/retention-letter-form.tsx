"use client";

import { useActionState } from "react";
import { updateRetentionLetterSettingsAction, type SettingsState } from "@/features/retention-letters/actions";
import { Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: SettingsState = { error: null };

/** Textos de la carta de retención a proveedores (4b). */
export function RetentionLetterSettingsForm({
  settings,
  canEdit,
}: {
  settings: { addressee_name: string; addressee_title: string; legal_text: string; signer_name: string | null; signer_title: string | null };
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateRetentionLetterSettingsAction, initialState);
  return (
    <form action={formAction} className="max-w-2xl space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Director(a) General de la DGII"
          name="addressee_name"
          defaultValue={settings.addressee_name}
          disabled={!canEdit}
          required
          info="A quién va dirigida la carta cuando se elige «Director(a) General de la DGII». Cámbialo cuando cambie el director."
        />
        <Input label="Cargo" name="addressee_title" defaultValue={settings.addressee_title} disabled={!canEdit} />
      </div>
      <Textarea
        label="Párrafo legal"
        name="legal_text"
        rows={4}
        defaultValue={settings.legal_text}
        disabled={!canEdit}
        info="Sale al final de la carta. Si la DGII cambia las normas (ej. Norma General 02-2026), el contador indica el texto nuevo."
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Quién firma (por defecto)"
          name="signer_name"
          defaultValue={settings.signer_name ?? ""}
          disabled={!canEdit}
          placeholder="Ej. Angel Díaz"
          info="Se puede cambiar en cada carta."
        />
        <Input label="Cargo de quien firma" name="signer_title" defaultValue={settings.signer_title ?? ""} disabled={!canEdit} placeholder="Ej. Gerente General" />
      </div>
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-success">Guardado. Las próximas cartas salen con estos textos.</p>}
      {canEdit ? (
        <Button type="submit" loading={pending}>
          Guardar
        </Button>
      ) : (
        <p className="text-xs text-brand-muted">Solo Administración puede cambiar estos textos.</p>
      )}
    </form>
  );
}
