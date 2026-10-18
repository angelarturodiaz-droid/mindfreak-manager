"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageCircle } from "lucide-react";
import { InfoHint } from "@/components/ui/info-hint";
import { Tooltip } from "@/components/ui/tooltip";
import { ResultDialog } from "@/components/ui/result-dialog";
import { Chip } from "@/components/ui/page-kit";
import { markWhatsappReminderAction } from "@/features/reminders/actions";
import type { WhatsappTodayItem } from "@/features/reminders/queries";

/**
 * Lista diaria "Para recordar hoy por WhatsApp" (Facturas). El botón abre
 * WhatsApp con el mensaje ya escrito (la persona solo toca Enviar) y deja
 * el registro en la Gestión de cobro; la factura sale de la lista.
 */
export function WhatsappToday({ items }: { items: WhatsappTodayItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) return null;

  function open(it: WhatsappTodayItem) {
    // Se abre en el mismo clic (si no, el navegador lo bloquea como ventana emergente).
    window.open(it.url, "_blank", "noopener,noreferrer");
    setBusy(it.invoiceId);
    startTransition(async () => {
      const r = await markWhatsappReminderAction(it.invoiceId, it.step, it.phone);
      setBusy(null);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <details className="group rounded-[var(--radius-lg)] border border-brand-success/30 bg-brand-success-bg/40 [&_summary::-webkit-details-marker]:hidden">
      <summary
        className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3"
        title="Pulsa para ver u ocultar"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-brand-text">
          <ChevronDown size={16} className="shrink-0 text-brand-muted transition-transform group-open:rotate-180" aria-hidden />
          <MessageCircle size={16} className="text-brand-success" aria-hidden />
          Para recordar hoy por WhatsApp
          <span className="rounded-full bg-brand-success px-2 py-0.5 text-xs font-medium tabular-nums text-white">{items.length}</span>
          <InfoHint text="Facturas a las que hoy les toca un recordatorio (3 días antes, el día que vencen, 10 días después… según Configuración → Recordatorios). El botón abre WhatsApp con el mensaje ya escrito: solo tocas Enviar. Queda anotado en la Gestión de cobro y la factura sale de la lista." />
        </span>
        <span className="text-xs text-brand-muted">Pulsa para ver</span>
      </summary>
      <ul className="divide-y divide-brand-border border-t border-brand-success/20 bg-brand-surface">
        {items.map((it) => (
          <li key={it.invoiceId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <Link href={`/invoices/${it.invoiceId}`} className="font-medium text-brand-text hover:text-brand-accent">
              {it.number}
            </Link>
            <span className="text-brand-text">{it.client}</span>
            <span className="tabular-nums text-brand-muted">{it.balanceText}</span>
            <Chip tone={it.overdue ? "danger" : it.step === 0 ? "warning" : "accent"}>{it.cuando}</Chip>
            <span className="ml-auto flex items-center gap-2">
              {!it.phone && <span className="text-xs text-brand-warning">Sin teléfono: elige el chat en WhatsApp</span>}
              <Tooltip text={`Abre WhatsApp${it.phone ? ` con ${it.contact ?? it.client}` : ""} con el recordatorio ya escrito y lo anota en la factura.`}>
                <button
                  type="button"
                  onClick={() => open(it)}
                  disabled={pending && busy === it.invoiceId}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-brand-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  <MessageCircle size={14} aria-hidden />
                  WhatsApp
                </button>
              </Tooltip>
            </span>
          </li>
        ))}
      </ul>
      <ResultDialog open={Boolean(error)} tone="danger" title="No se pudo anotar" onClose={() => setError(null)}>
        {error}
      </ResultDialog>
    </details>
  );
}
