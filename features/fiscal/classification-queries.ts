import { createClient } from "@/lib/supabase/server";

export type FiscalClassification = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  position: number;
};

/** Clasificaciones fiscales del servicio (migración 071), en orden. */
export async function listFiscalClassifications(): Promise<FiscalClassification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiscal_classifications")
    .select("id, code, name, description, is_active, position")
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
