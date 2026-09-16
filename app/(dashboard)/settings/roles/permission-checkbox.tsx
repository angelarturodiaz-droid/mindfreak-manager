"use client";

import { useState, useTransition } from "react";
import { toggleRolePermissionAction } from "@/features/users/actions";
import { toast } from "@/components/ui/toaster";

export function PermissionCheckbox({
  roleId,
  permissionId,
  granted,
  disabled,
}: {
  roleId: string;
  permissionId: string;
  granted: boolean;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(granted);
  const [isPending, startTransition] = useTransition();

  function handleChange() {
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      try {
        await toggleRolePermissionAction(roleId, permissionId, checked);
      } catch (e) {
        setChecked(checked);
        toast.error(e instanceof Error ? e.message : "No se pudo actualizar.");
      }
    });
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled || isPending}
      onChange={handleChange}
      className="h-4 w-4 accent-brand-accent disabled:opacity-40"
    />
  );
}
