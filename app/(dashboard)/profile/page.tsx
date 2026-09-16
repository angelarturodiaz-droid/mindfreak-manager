import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditProfileForm } from "./edit-profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { Card } from "@/components/ui/card";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Mi perfil</h1>
        <p className="text-sm text-brand-muted">{user.email}</p>
      </div>

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Información personal
        </h2>
        <Card>
          <EditProfileForm fullName={profile?.full_name ?? null} phone={profile?.phone ?? null} />
        </Card>
      </section>

      <section className="max-w-md">
        <h2 className="mb-3 text-sm font-medium text-brand-text">
          Cambiar contraseña
        </h2>
        <Card>
          <ChangePasswordForm />
        </Card>
      </section>
    </main>
  );
}
