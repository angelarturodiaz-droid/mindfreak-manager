"use client";

import { Mail, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/field";

export type RecipientValues = {
  name: string;
  email: string;
  phone: string;
  byEmail: boolean;
  byWhatsapp: boolean;
};

/** Canales por defecto: correo si hay correo; si no, WhatsApp. */
export function defaultRecipient(r: { name: string | null; email: string | null; phone: string | null }): RecipientValues {
  const hasEmail = Boolean(r.email);
  return {
    name: r.name ?? "",
    email: r.email ?? "",
    phone: r.phone ?? "",
    byEmail: hasEmail,
    byWhatsapp: !hasEmail,
  };
}

function ChannelChip({
  checked,
  onChange,
  icon,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label
      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors ${
        checked ? "border-brand-accent bg-brand-accent-light text-brand-accent" : "border-brand-border text-brand-muted hover:border-brand-muted"
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {icon}
      {label}
    </label>
  );
}

/** Destinatario editable + elección de canal (correo, WhatsApp o ambos). */
export function RecipientFields({
  value,
  onChange,
  showChannels = true,
}: {
  value: RecipientValues;
  onChange: (v: RecipientValues) => void;
  showChannels?: boolean;
}) {
  const set = (patch: Partial<RecipientValues>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-3">
      {showChannels && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-brand-text">Enviar por</span>
          <div className="flex gap-2" role="group" aria-label="Enviar por">
            <ChannelChip checked={value.byEmail} onChange={(v) => set({ byEmail: v })} icon={<Mail size={15} />} label="Correo" />
            <ChannelChip
              checked={value.byWhatsapp}
              onChange={(v) => set({ byWhatsapp: v })}
              icon={<MessageCircle size={15} />}
              label="WhatsApp"
            />
          </div>
          {!value.byEmail && !value.byWhatsapp && (
            <span className="text-xs text-brand-danger">Elige al menos uno.</span>
          )}
        </div>
      )}
      <Input label="Nombre del destinatario" value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. María Fernández" />
      {value.byEmail && (
        <Input
          label="Correo"
          type="email"
          required
          value={value.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="cliente@empresa.com"
          icon={<Mail size={14} />}
        />
      )}
      {value.byWhatsapp && (
        <Input
          label="WhatsApp"
          type="tel"
          value={value.phone}
          onChange={(e) => set({ phone: e.target.value })}
          placeholder="809-555-0000"
          icon={<MessageCircle size={14} />}
          hint={
            value.phone.trim()
              ? "Se abrirá WhatsApp con el mensaje y el enlace ya escritos; solo tocas Enviar."
              : "Sin número: WhatsApp te deja elegir el chat."
          }
        />
      )}
    </div>
  );
}

/**
 * Abre la pestaña de WhatsApp en el mismo clic (si se abre después de
 * esperar al servidor, el navegador la bloquea) y luego le pone la URL.
 */
export function prepareWhatsappWindow(enabled: boolean): {
  go: (url: string | null | undefined) => void;
} {
  const win = enabled ? window.open("about:blank", "_blank") : null;
  return {
    go(url) {
      if (!win) {
        if (url) window.open(url, "_blank", "noopener");
        return;
      }
      if (url) win.location.href = url;
      else win.close();
    },
  };
}
