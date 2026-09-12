"use client";

import { useActionState, useRef } from "react";
import { uploadDocumentAction, type ActionState } from "@/features/documents/actions";

const initialState: ActionState = { error: null };

export function UploadDocumentForm({
  entityType,
  entityId,
  revalidatePathValue,
}: {
  entityType: string;
  entityId: string;
  revalidatePathValue: string;
}) {
  const uploadWithEntity = uploadDocumentAction.bind(
    null,
    entityType,
    entityId,
    revalidatePathValue,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await uploadWithEntity(prev, fd);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="file"
        type="file"
        required
        className="text-sm text-brand-muted file:mr-3 file:border-0 file:bg-brand-primary file:px-3 file:py-1.5 file:text-sm file:text-white"
      />
      <button
        type="submit"
        disabled={pending}
        className="border border-brand-muted/30 px-3 py-1.5 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
      >
        {pending ? "Subiendo…" : "Subir"}
      </button>
      {state.error && <p className="w-full text-sm text-brand-danger">{state.error}</p>}
      <p className="w-full text-xs text-brand-muted">Máximo 15MB por archivo.</p>
    </form>
  );
}
