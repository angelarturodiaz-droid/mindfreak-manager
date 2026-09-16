"use client";

import { useTransition } from "react";
import { setInvoiceResponsibleAction } from "@/features/invoices/actions";
import { Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";

type User = { id: string; full_name: string | null; email: string };

export function ResponsibleSelector({
  invoiceId,
  currentUserId,
  users,
}: {
  invoiceId: string;
  currentUserId: string | null;
  users: User[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      try {
        await setInvoiceResponsibleAction(invoiceId, value || null);
        toast.success("Responsable actualizado");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <Select
      label="Responsable de cobro"
      defaultValue={currentUserId ?? ""}
      disabled={isPending}
      onChange={(e) => handleChange(e.target.value)}
      className="w-56"
    >
      <option value="">Sin asignar</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.full_name ?? u.email}
        </option>
      ))}
    </Select>
  );
}
