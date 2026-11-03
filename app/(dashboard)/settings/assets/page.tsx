import { MapPin, Shapes } from "lucide-react";
import { listAssetLocations, listAssetTypes } from "@/features/assets/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { ListEditor } from "../directory/list-editor";

export default async function AssetSettingsPage() {
  const [types, locations, isAdmin, canManage] = await Promise.all([
    listAssetTypes(),
    listAssetLocations(),
    hasPermission("settings.manage"),
    hasPermission("assets.manage"),
  ]);
  const canEdit = isAdmin || canManage;
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <p className="text-sm text-brand-muted">
        Listas de <strong>Activos</strong>. Se eligen de aquí al registrar un activo, para que no haya dos con el mismo nombre
        (ej. «Almacén» y «almacen»). Si quitas una, los activos que la tenían quedan «sin tipo» o «sin ubicación».
      </p>
      <ListEditor
        table="asset_types"
        title="Tipos"
        icon={<Shapes size={17} aria-hidden />}
        description="Para agrupar y filtrar los activos (mobiliario, decoraciones, equipo de evento…)."
        placeholder="Ej. Iluminación"
        items={types}
        canEdit={canEdit}
      />
      <ListEditor
        table="asset_locations"
        title="Ubicaciones"
        icon={<MapPin size={17} aria-hidden />}
        description="Dónde se guardan las cosas (una casa, el almacén, la oficina, un depósito alquilado)."
        placeholder="Ej. Depósito Los Prados"
        items={locations}
        canEdit={canEdit}
      />
    </div>
  );
}
