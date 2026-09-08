import { listActiveClients, listCompanyMembers } from "@/features/projects/queries";
import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  const [clients, members] = await Promise.all([
    listActiveClients(),
    listCompanyMembers(),
  ]);

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">
          Nuevo proyecto (directo)
        </h1>
        <p className="text-sm text-brand-muted">
          Sin cotización previa. Si el cliente ya tiene una cotización
          aprobada, mejor conviértela desde el listado de proyectos.
        </p>
      </div>
      <NewProjectForm clients={clients} members={members} />
    </main>
  );
}
