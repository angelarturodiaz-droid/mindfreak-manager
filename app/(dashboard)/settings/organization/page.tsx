import { getCompany } from "@/features/settings/queries";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationSettingsPage() {
  const company = await getCompany();

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">
        Datos de la empresa
      </h2>
      <OrganizationForm company={company} />
    </div>
  );
}
