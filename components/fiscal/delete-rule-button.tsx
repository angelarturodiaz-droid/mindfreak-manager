"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { deleteFiscalRuleAction } from "@/features/fiscal/rule-actions";

export function DeleteRuleButton({ ruleId, name }: { ruleId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Eliminar regla"
      icon={<Trash2 size={14} />}
      hint="Solo se puede si ningún gasto la ha usado. Si ya se usó, desactívala."
      confirmTitle={`¿Eliminar "${name}"?`}
      confirmMessage="Se borra por completo. Si ya la usó algún gasto no se podrá: en ese caso desactívala."
      confirmLabel="Sí, eliminar"
      successMessage="Regla eliminada."
      onConfirm={async () => {
        const res = await deleteFiscalRuleAction(ruleId);
        if (res.error) throw new Error(res.error);
        router.push("/settings/fiscal-rules");
      }}
    />
  );
}
