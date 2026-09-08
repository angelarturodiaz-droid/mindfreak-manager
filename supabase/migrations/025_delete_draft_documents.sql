-- Fix: faltaba política RLS de DELETE en quotations/invoices, por lo que
-- discardQuotationAction/discardInvoiceAction ejecutaban el DELETE sin error
-- pero sin borrar ninguna fila (RLS deniega por defecto sin policy). Se
-- restringe explícitamente a documentos en BORRADOR — igual que ya valida la
-- capa de aplicación — para que RLS sea una segunda línea de defensa real
-- (F0-Arquitectura, sección L) y no se pueda borrar por esta vía una
-- cotización/factura con actividad real (enviada, emitida, aprobada, etc.).

create policy quotations_delete on public.quotations for delete
  using (
    company_id in (select public.user_company_ids())
    and public.has_permission('quotations.update')
    and status = 'DRAFT'
  );

create policy invoices_delete on public.invoices for delete
  using (
    company_id in (select public.user_company_ids())
    and public.has_permission('invoices.create')
    and status = 'DRAFT'
  );
