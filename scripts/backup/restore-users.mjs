#!/usr/bin/env node
// Recrea los usuarios de una copia en un proyecto NUEVO, con el mismo id (así sus roles y datos vuelven a funcionar).
// No trae contraseñas: cada persona pone una nueva con «¿Olvidaste tu contraseña?» y vuelve a activar la verificación en dos pasos.
// Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup/restore-users.mjs <carpeta>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!dir || !url || !key) {
  console.error("Uso: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup/restore-users.mjs <carpeta>");
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const users = JSON.parse(readFileSync(join(dir, "database", "auth-users.json"), "utf8"));
for (const u of users) {
  const { error } = await supabase.auth.admin.createUser({
    id: u.id,
    email: u.email,
    phone: u.phone ?? undefined,
    email_confirm: Boolean(u.email_confirmed),
    user_metadata: { full_name: u.full_name ?? undefined },
  });
  console.log(error ? `✗ ${u.email}: ${error.message}` : `✓ ${u.email}`);
}
console.log("Listo. Cada usuario debe usar «¿Olvidaste tu contraseña?» y activar de nuevo la verificación en dos pasos.");
