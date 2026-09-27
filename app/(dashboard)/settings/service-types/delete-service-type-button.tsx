"use client";

import { deleteServiceTypeAction } from "@/features/supplier-service-types/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";

export function DeleteServiceTypeButton({
  serviceTypeId,
  name,
  supplierCount,
}: {
  serviceTypeId: string;
  name: string;
  supplierCount: number;
}) {
  return (
    <ConfirmButton
      label="Eliminar"
      confirmTitle={`¿Eliminar el tipo de servicio "${name}"?`}
      confirmMessage={
        supplierCount > 0
          ? `Lo usan ${supplierCount} proveedor(es). Si lo eliminas, quedarán sin tipo de servicio (los proveedores no se borran).`
          : undefined
      }
      onConfirm={() => deleteServiceTypeAction(serviceTypeId)}
    />
  );
}
