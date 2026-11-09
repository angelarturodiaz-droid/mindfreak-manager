#!/usr/bin/env node
// Compara una base restaurada con manifest.json: filas por tabla y totales de control (facturas, cobros, gastos, pagos, bancos).
// Uso: node scripts/backup/compare-restore.mjs <carpeta> <db-url>   (usa psql)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [dir, db] = process.argv.slice(2);
const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const q = (sql) => execFileSync("psql", [db, "-At", "-c", sql], { encoding: "utf8" }).trim();
let bad = 0;
for (const t of m.database.tables) {
  const n = Number(q(`select count(*) from public."${t.name}"`));
  if (n !== t.rows) {
    console.error(`✗ ${t.name}: ${n} filas (en la copia: ${t.rows})`);
    bad++;
  }
}
const totals = JSON.parse(
  q(`select jsonb_build_object(
    'invoices', (select jsonb_build_object('count', count(*), 'total', coalesce(sum(total),0), 'balance', coalesce(sum(balance),0)) from invoices),
    'customer_payments', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount),0)) from customer_payments),
    'expenses', (select jsonb_build_object('count', count(*), 'total', coalesce(sum(total),0), 'balance', coalesce(sum(balance),0)) from expenses),
    'supplier_payments', (select jsonb_build_object('count', count(*), 'amount', coalesce(sum(amount),0)) from supplier_payments),
    'bank_balances', (select coalesce(jsonb_object_agg(a.name || ' (' || a.currency || ')', b.current_balance), '{}'::jsonb)
                      from bank_accounts a join bank_account_balances b on b.bank_account_id = a.id))`),
);
const norm = (o) => JSON.stringify(o, Object.keys(o).sort(), 0);
for (const k of Object.keys(m.controlTotals)) {
  const a = m.controlTotals[k];
  const b = totals[k];
  const same = k === "bank_balances"
    ? Object.keys(a).every((acc) => Number(a[acc]) === Number(b[acc])) && Object.keys(a).length === Object.keys(b).length
    : Object.keys(a).every((f) => Number(a[f]) === Number(b[f]));
  console.log(`${same ? "✓" : "✗"} ${k}: ${same ? "igual" : `copia ${norm(a)} · restaurada ${norm(b)}`}`);
  if (!same) bad++;
}
console.log(bad ? `✗ ${bad} diferencia(s).` : `✓ Restauración igual a la copia (${m.database.tables.length} tablas, ${m.database.totalRows} filas).`);
process.exit(bad ? 1 : 0);
