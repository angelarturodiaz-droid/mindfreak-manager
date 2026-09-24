-- Tipo de cuenta bancaria: Ahorros o Corriente.
--
-- Solo aplica a cuentas bancarias (type = 'BANK'); las tarjetas de crédito
-- no lo usan (queda null). Opcional para las cuentas ya existentes, que se
-- pueden completar desde "Editar cuenta". Es solo informativo: no cambia
-- cómo se calculan balances ni movimientos.
--
-- Idempotente.

alter table public.bank_accounts
  add column if not exists account_kind text;

alter table public.bank_accounts drop constraint if exists bank_accounts_account_kind_check;
alter table public.bank_accounts
  add constraint bank_accounts_account_kind_check
  check (account_kind is null or account_kind in ('SAVINGS', 'CHECKING'));

comment on column public.bank_accounts.account_kind is
  'Tipo de cuenta bancaria: SAVINGS (ahorros) o CHECKING (corriente). Null en tarjetas o si no se ha indicado.';
