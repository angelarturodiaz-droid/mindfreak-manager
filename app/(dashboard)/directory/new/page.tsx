import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listZones } from "@/features/directory/queries";
import { listCategoryOptions } from "@/features/expense-categories/queries";
import { listServiceTypeOptions } from "@/features/supplier-service-types/queries";
import { NewDirectoryEntryForm } from "./new-directory-form";

export default async function NewDirectoryEntryPage() {
  const [zones, categories, serviceTypes] = await Promise.all([listZones(), listCategoryOptions(), listServiceTypeOptions()]);
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <Link href="/directory" className="inline-flex w-fit items-center gap-1 text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft size={14} /> Volver al directorio
      </Link>
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Nuevo en el directorio</h1>
        <p className="text-sm text-brand-muted">
          Un talento, un lugar o un aliado con el que podríamos trabajar. Solo el <strong>nombre</strong> es obligatorio:
          las fotos, etiquetas, enlaces y la calificación se agregan después en su ficha.
        </p>
      </div>
      <NewDirectoryEntryForm
        zones={zones}
        categories={categories}
        serviceTypes={serviceTypes.map((s) => ({ id: s.id, name: s.name, category_id: s.category_id }))}
      />
    </main>
  );
}
