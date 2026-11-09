import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildDataSql, dollarTag, quoteIdent, tableInsertSql } from "@/features/backups/sql";
import { EXCLUDED_TABLES, FORBIDDEN_KEYS, backupFileName } from "@/features/backups/manifest";
import { LAST_MIGRATION } from "@/features/backups/version";

describe("respaldo · data.sql", () => {
  it("usa json_populate_recordset con la lista de columnas y una etiqueta que no choca con los datos", () => {
    const sql = tableInsertSql({ name: "clients", columns: ["id", "name"], rows: [{ id: "a", name: "Dato con $mfbk$ dentro" }] });
    expect(sql).toContain('insert into public."clients" ("id", "name") select "id", "name" from json_populate_recordset(null::public."clients", $mfbk1$');
    expect(sql).toContain("$mfbk1$);");
  });
  it("tabla vacía = solo un comentario; muchas filas = varias instrucciones", () => {
    expect(tableInsertSql({ name: "x", columns: ["id"], rows: [] })).toBe("-- x: sin filas\n");
    const rows = Array.from({ length: 1201 }, (_, i) => ({ id: i }));
    expect(tableInsertSql({ name: "x", columns: ["id"], rows }).match(/insert into/g)).toHaveLength(3);
  });
  it("desactiva triggers durante la carga y va en una transacción", () => {
    const sql = buildDataSql([], { createdAt: "2026-11-08T00:00:00Z", lastMigration: "103", appVersion: "1.0.0" });
    expect(sql).toMatch(/begin;\nset session_replication_role = replica;/);
    expect(sql).toMatch(/set session_replication_role = origin;\ncommit;/);
  });
  it("escapa nombres y etiquetas", () => {
    expect(quoteIdent('a"b')).toBe('"a""b"');
    expect(dollarTag("nada")).toBe("$mfbk$");
  });
});

describe("respaldo · seguridad y versión", () => {
  it("excluye las tablas de credenciales", () => {
    for (const t of ["mfa_recovery_codes", "mfa_trusted_devices", "auth_login_attempts"]) expect(EXCLUDED_TABLES).toContain(t);
  });
  it("la función de usuarios solo exporta campos funcionales (sin contraseñas ni MFA)", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/103_backups.sql"), "utf8");
    const fn = sql.slice(sql.indexOf("backup_export_auth_users()"), sql.indexOf("backup_list_files()"));
    for (const key of FORBIDDEN_KEYS) expect(fn.toLowerCase()).not.toContain(key);
    expect(fn).not.toMatch(/mfa_factors|refresh_tokens|sessions/);
  });
  it("LAST_MIGRATION coincide con la última migración del código", () => {
    const nums = readdirSync(join(process.cwd(), "supabase/migrations"))
      .map((f) => f.match(/^(\d{3})_/)?.[1])
      .filter(Boolean)
      .sort();
    expect(nums[nums.length - 1]).toBe(LAST_MIGRATION);
  });
  it("nombre del archivo en hora de RD", () => {
    expect(backupFileName(new Date("2026-11-09T00:15:00Z"))).toBe("mindfreak-respaldo-2026-11-08-2015.zip");
  });
});
