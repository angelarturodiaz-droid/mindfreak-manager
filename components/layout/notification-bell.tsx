"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/features/notifications/actions";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  invoice: (id) => `/invoices/${id}`,
  quotation: (id) => `/quotations/${id}`,
  expense: (id) => `/expenses/${id}`,
  project: (id) => `/projects/${id}`,
  task: () => `/tasks`,
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleClickNotification(n: Notification) {
    if (!n.is_read) {
      startTransition(() => markNotificationReadAction(n.id));
    }
    setOpen(false);
    if (n.entity_type && n.entity_id && ENTITY_LINKS[n.entity_type]) {
      router.push(ENTITY_LINKS[n.entity_type](n.entity_id));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificaciones"
        className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-brand-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-accent"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 flex max-h-96 w-80 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between border-b border-brand-border px-4 py-2.5">
            <p className="text-sm font-medium text-brand-text">Notificaciones</p>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => markAllNotificationsReadAction())}
                className="text-xs text-brand-accent hover:underline disabled:opacity-50"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-brand-muted">Sin notificaciones.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClickNotification(n)}
                  className={`flex w-full flex-col gap-0.5 border-b border-brand-border px-4 py-2.5 text-left last:border-0 hover:bg-brand-surface-hover ${
                    n.is_read ? "" : "bg-brand-accent-light"
                  }`}
                >
                  <p className="text-sm font-medium text-brand-text">{n.title}</p>
                  {n.message && <p className="text-xs text-brand-muted">{n.message}</p>}
                  <p className="text-[11px] text-brand-muted">{timeAgo(n.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
