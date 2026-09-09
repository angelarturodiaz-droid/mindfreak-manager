import { createClient } from "@/lib/supabase/server";

export async function listExpenses(status?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select(
      "id, expense_date, description, subtotal, tax, total, status, currency, expense_categories(name), suppliers(name), projects(number, name)",
    )
    .order("expense_date", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getExpense(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "*, expense_categories(name), suppliers(name), projects(number, name), bank_accounts(name, bank_name)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listExpenseCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listActiveSuppliers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listProjectsForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, number, name")
    .neq("status", "CANCELLED")
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
