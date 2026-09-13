"use client";

import { useActionState, useRef } from "react";
import { uploadLogoAction, type ActionState } from "@/features/settings/actions";

const initialState: ActionState = { error: null };

export function LogoUploadForm({ logoUrl }: { logoUrl: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    const result = await uploadLogoAction(prev, fd);
    if (!result.error) formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <div className="flex items-center gap-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo actual" className="h-16 w-16 object-contain" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center border border-dashed border-brand-muted/30 text-xs text-brand-muted">
          Sin logo
        </div>
      )}
      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input
          name="file"
          type="file"
          accept="image/*"
          required
          className="text-sm text-brand-muted file:mr-3 file:border-0 file:bg-brand-primary file:px-3 file:py-1.5 file:text-sm file:text-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-fit border border-brand-muted/30 px-3 py-1.5 text-sm text-brand-text hover:border-brand-accent disabled:opacity-50"
        >
          {pending ? "Subiendo…" : "Subir logo"}
        </button>
        {state.error && <p className="text-xs text-brand-danger">{state.error}</p>}
      </form>
    </div>
  );
}
