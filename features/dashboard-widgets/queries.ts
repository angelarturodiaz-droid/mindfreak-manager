import { createClient } from "@/lib/supabase/server";
import { DEFAULT_WIDGETS, NEW_WIDGETS_SHOWN_BY_DEFAULT, type WidgetInstance } from "./registry";

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
  const result = [...(data.widgets as WidgetInstance[])];
  // Widgets nuevos: visibles también para quien ya había personalizado
  // (al inicio, o después del widget indicado). Si luego los oculta, se respeta.
  const toPrepend: WidgetInstance[] = [];
  for (const n of NEW_WIDGETS_SHOWN_BY_DEFAULT) {
    if (result.some((w) => w.type === n.type)) continue;
    const item: WidgetInstance = { type: n.type, visible: true, size: n.size };
    const at = n.after ? result.findIndex((w) => w.type === n.after) : -1;
    if (at >= 0) result.splice(at + 1, 0, item);
    else toPrepend.push(item);
  }
  return [...toPrepend, ...result];
}
