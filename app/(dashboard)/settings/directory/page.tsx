import { MapPin, Tag } from "lucide-react";
import { listTags, listZones } from "@/features/directory/queries";
import { hasPermission } from "@/lib/auth/permissions";
import { ListEditor } from "./list-editor";

export default async function DirectorySettingsPage() {
  const [zones, tags, canEdit] = await Promise.all([listZones(), listTags(), hasPermission("settings.manage")]);
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <p className="text-sm text-brand-muted">
        Listas del <strong>Directorio de Recursos y Aliados</strong>. Se eligen de aquí para que no haya dos con el mismo
        nombre (ej. «Bodas» y «bodas»). Si borras una, solo se quita de los registros que la tenían.
      </p>
      <ListEditor
        table="directory_zones"
        title="Zonas"
        icon={<MapPin size={17} aria-hidden />}
        description="Dónde trabaja o dónde está cada talento o lugar."
        placeholder="Ej. Higüey"
        items={zones}
        canEdit={canEdit}
      />
      <ListEditor
        table="directory_tags"
        title="Etiquetas"
        icon={<Tag size={17} aria-hidden />}
        description="Para filtrar rápido en el directorio (tipo de evento, estilo, presupuesto)."
        placeholder="Ej. Quinceañeros"
        items={tags}
        canEdit={canEdit}
      />
    </div>
  );
}
