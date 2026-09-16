import { createClient } from "@/lib/supabase/server";
import { DEFAULT_WIDGETS, type WidgetInstance } from "./registry";

export async function getUserDashboardWidgets(userId: string, companyId: string): Promise<WidgetInstance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboard_widget_preferences")
    .select("widgets")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.widgets) || data.widgets.length === 0) {
    return DEFAULT_WIDGETS;
  }
  return data.widgets as WidgetInstance[];
}
