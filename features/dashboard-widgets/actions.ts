"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserCompanyIds } from "@/lib/auth/permissions";
import type { WidgetInstance } from "./registry";

export async function saveDashboardWidgetsAction(widgets: WidgetInstance[]): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no encontrada.");

  const companyIds = await getCurrentUserCompanyIds();
  if (companyIds.length === 0) throw new Error("Tu usuario no está asignado a ninguna compañía.");
  const companyId = companyIds[0];

  const { error } = await supabase.from("dashboard_widget_preferences").upsert(
    {
      user_id: user.id,
      company_id: companyId,
      widgets,
    },
    { onConflict: "user_id,company_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customize");
}
