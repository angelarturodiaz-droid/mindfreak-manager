"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  getMyNotificationsAction,
} from "@/features/notifications/actions";
import { toast } from "@/components/ui/toaster";

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
  payment_correction: () => `/payments?tab=correcciones`,
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

/** Cada cuánto se revisa la campanita sola (solo con la pestaña visible). */
const POLL_MS = 30_000;

export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnread,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const seen = useRef(new Set(initialNotifications.map((n) => n.id)));

  // Al cambiar de página el servidor trae los avisos nuevos: se toman esos
  // (patrón «ajustar el estado cuando cambian las props», sin efecto).
  const [prevInitial, setPrevInitial] = useState(initialNotifications);
  if (prevInitial !== initialNotifications) {
    setPrevInitial(initialNotifications);
    setNotifications(initialNotifications);
    setUnreadCount(initialUnread);
  }
  useEffect(() => {
    for (const n of initialNotifications) seen.current.add(n.id);
  }, [initialNotifications]);

  // Revisión automática: cada 30 s con la pestaña visible y al volver a ella.
  useEffect(() => {
    let alive = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await getMyNotificationsAction();
        if (!alive) return;
        const fresh = res.notifications.filter((n) => !n.is_read && !seen.current.has(n.id));
        for (const n of res.notifications) seen.current.add(n.id);
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
        const first = fresh[0];
        if (first) {
          toast(fresh.length > 1 ? `Tienes ${fresh.length} avisos nuevos` : `Tienes un aviso nuevo: ${first.title}`, {
            description: fresh.length > 1 ? "Ábrelos en la campanita." : (first.message ?? undefined),
            // Se queda hasta que la persona lo cierre (para poder leerlo con calma).
            duration: Infinity,
            closeButton: true,
            action:
              first.entity_type && first.entity_id && ENTITY_LINKS[first.entity_type]
                ? { label: "Ver", onClick: () => router.push(ENTITY_LINKS[first.entity_type!](first.entity_id!)) }
                : undefined,
          });
        }
      } catch {
        /* sin conexión: se intenta en la próxima vuelta */
      }
    }
    const timer = setInterval(refresh, POLL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router es estable
  }, []);
  const ref = useRef<HTMLDivElement>(null);
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
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
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
                onClick={() => {
                  setNotifications((list) => list.map((x) => ({ ...x, is_read: true })));
                  setUnreadCount(0);
                  startTransition(() => markAllNotificationsReadAction());
                }}
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
