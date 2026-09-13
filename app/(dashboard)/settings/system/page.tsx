import { getCompany } from "@/features/settings/queries";
import { SystemForm } from "./system-form";
import { LogoUploadForm } from "./logo-upload-form";

export default async function SystemSettingsPage() {
  const company = await getCompany();

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-brand-primary">Logo</h2>
        <LogoUploadForm logoUrl={company.logo_url} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-brand-primary">
          Nombre y colores
        </h2>
        <SystemForm company={company} />
      </section>
    </div>
  );
}
