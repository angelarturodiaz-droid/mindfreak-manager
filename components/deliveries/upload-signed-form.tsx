"use client";

import { useActionState, useRef, useTransition } from "react";
import { Upload } from "lucide-react";
import { uploadSignedDeliveryAction, type ActionState } from "@/features/deliveries/actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useSuccessToast } from "@/components/ui/use-success-toast";

const initialState: ActionState = { error: null };

/** Adjuntar el acuse firmado (PDF o foto) y, opcional, quién lo recibió. */
export function UploadSignedForm({ receiptId, alreadySigned }: { receiptId: string; alreadySigned: boolean }) {
  const [state, formAction, pending] = useActionState(uploadSignedDeliveryAction.bind(null, receiptId), initialState);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  useSuccessToast(state);

  return (
    <form
      ref={formRef}
      key={state.successId ?? 0}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="flex flex-col gap-3"
    >
      <div>
        <label htmlFor="signed-file" className="block text-sm font-medium text-brand-text">
          Acuse firmado <span className="text-brand-danger">*</span>
        </label>
        <input
          id="signed-file"
          name="file"
          type="file"
          required
          accept="application/pdf,image/*"
          className="mt-1 w-full text-sm text-brand-muted file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-brand-primary file:px-3 file:py-1.5 file:text-sm file:text-white"
        />
        <p className="mt-1 text-xs text-brand-muted">PDF escaneado o foto (JPG, PNG). Máximo 15MB.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Recibido por (opcional)" name="received_by_name" placeholder="Nombre de quien firmó" />
        <Input label="Cargo (opcional)" name="received_by_position" />
      </div>
      <Input label="Fecha y hora de recibido (opcional)" name="received_at" type="datetime-local" />
      {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
      <div>
        <Button type="submit" loading={pending} icon={<Upload size={14} />} className="!bg-brand-success">
          {alreadySigned ? "Subir otra copia firmada" : "Adjuntar acuse firmado"}
        </Button>
      </div>
    </form>
  );
}
