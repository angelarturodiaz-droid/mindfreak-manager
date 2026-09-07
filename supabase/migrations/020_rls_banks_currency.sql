-- F4: Políticas RLS — Bancos y Monedas

create policy bank_accounts_select on public.bank_accounts for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('banks.view'));
create policy bank_accounts_insert on public.bank_accounts for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('banks.create'));
create policy bank_accounts_update on public.bank_accounts for update
  using (company_id in (select public.user_company_ids()) and public.has_permission('banks.create'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('banks.create'));

create policy bank_transactions_select on public.bank_transactions for select
  using (company_id in (select public.user_company_ids()) and public.has_permission('banks.view'));
create policy bank_transactions_insert on public.bank_transactions for insert
  with check (company_id in (select public.user_company_ids()) and public.has_permission('banks.create'));
create policy bank_transactions_update on public.bank_transactions for update
  using (company_id in (select public.user_company_ids()) and (public.has_permission('banks.create') or public.has_permission('banks.reconcile')))
  with check (company_id in (select public.user_company_ids()) and (public.has_permission('banks.create') or public.has_permission('banks.reconcile')));

-- Tasas de cambio: lectura amplia (dato de referencia), escritura vía settings.manage
create policy exchange_rates_select on public.exchange_rates for select
  using (company_id in (select public.user_company_ids()));
create policy exchange_rates_write on public.exchange_rates for all
  using (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'))
  with check (company_id in (select public.user_company_ids()) and public.has_permission('settings.manage'));
