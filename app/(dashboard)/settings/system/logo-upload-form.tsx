"use client";

import { useActionState, useRef } from "react";
import { Upload } from "lucide-react";
import { uploadLogoAction, type ActionState } from "@/features/settings/actions";
import { Button } from "@/components/ui/button";

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
        <img src={logoUrl} alt="Logo actual" className="h-16 w-16 rounded-[var(--radius-md)] object-contain" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-brand-border text-xs text-brand-muted">
          Sin logo
        </div>
      )}
      <form ref={formRef} action={formAction} className="flex flex-col gap-2">
        <input
          name="file"
          type="file"
          accept="image/*"
          required
          className="text-sm text-brand-muted file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-brand-primary file:px-3 file:py-1.5 file:text-sm file:text-white"
        />
        <Button type="submit" variant="outline" size="sm" loading={pending} icon={<Upload size={14} />}>
          Subir logo
        </Button>
        {state.error && <p className="text-xs text-brand-danger">{state.error}</p>}
      </form>
    </div>
  );
}
