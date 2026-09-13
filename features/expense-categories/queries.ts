import { createClient } from "@/lib/supabase/server";

export async function listExpenseCategoriesWithUsage() {
  const supabase = await createClient();
  const { data: categories, error } = await supabase
    .from("expense_categories")
    .select("id, name, description")
    .order("name");
  if (error) throw new Error(error.message);

  const { data: counts, error: countError } = await supabase
    .from("expenses")
    .select("category_id");
  if (countError) throw new Error(countError.message);

  const usage = new Map<string, number>();
  for (const row of counts ?? []) {
    if (!row.category_id) continue;
    usage.set(row.category_id, (usage.get(row.category_id) ?? 0) + 1);
  }

  return (categories ?? []).map((c) => ({ ...c, expenseCount: usage.get(c.id) ?? 0 }));
}
