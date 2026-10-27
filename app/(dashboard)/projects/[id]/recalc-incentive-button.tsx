"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { recalculateIncentiveAction } from "@/features/incentives/actions";

/** «Recalcular» un incentivo por % con la ganancia de hoy (solo pendiente y sin pagos). */
export function RecalcIncentiveButton({ expenseId }: { expenseId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      icon={<RefreshCw size={13} />}
      loading={pending}
      hint="Vuelve a calcular el monto con la ganancia antes de incentivos de hoy. Solo mientras no se haya pagado."
      onClick={() =>
        start(async () => {
          const res = await recalculateIncentiveAction(expenseId);
          if (res.error) toast.error(res.error);
          else toast.success(res.message ?? "Incentivo recalculado.");
        })
      }
    >
      Recalcular
    </Button>
  );
}
