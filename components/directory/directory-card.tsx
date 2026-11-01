import Link from "next/link";
import { ImageOff, MapPin, Phone, Tag } from "lucide-react";
import type { DirectoryCard as Card } from "@/features/directory/queries";
import { DIRECTORY_STATUS_INFO, DIRECTORY_STATUS_LABELS, DIRECTORY_STATUS_TONES } from "@/features/directory/schema";
import { Stars } from "./stars";

/** Tarjeta del Directorio: foto, nombre, categoría, estado, zona, etiquetas, precio y estrellas. */
export function DirectoryCard({ card }: { card: Card }) {
  return (
    <Link
      href={`/suppliers/${card.id}?tab=directorio&return_to=${encodeURIComponent("/directory")}`}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface transition-shadow hover:shadow-[var(--shadow-lg)]"
    >
      <div className="relative aspect-[4/3] w-full bg-brand-surface-hover">
        {card.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage (cambia cada hora)
          <img src={card.coverUrl} alt={card.name} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-brand-muted">
            <ImageOff size={22} aria-hidden /> Sin foto todavía
          </span>
        )}
        <span
          title={DIRECTORY_STATUS_INFO[card.directory_status]}
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm ${DIRECTORY_STATUS_TONES[card.directory_status]}`}
        >
          {DIRECTORY_STATUS_LABELS[card.directory_status]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-1 font-semibold text-brand-text group-hover:text-brand-accent">{card.name}</p>
        <p className="line-clamp-1 text-xs text-brand-muted">
          {[card.category, card.service_type].filter(Boolean).join(" · ") || "Sin categoría"}
        </p>
        <Stars value={card.rating} />
        {card.reference_price && <p className="line-clamp-1 text-sm font-medium text-brand-text">{card.reference_price}</p>}
        <div className="mt-auto flex flex-col gap-1 pt-1 text-xs text-brand-muted">
          {card.zoneName && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} aria-hidden /> {card.zoneName}
            </span>
          )}
          {card.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone size={12} aria-hidden /> {card.phone}
            </span>
          )}
          {card.tags.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              <Tag size={12} aria-hidden />
              {card.tags.slice(0, 4).map((t) => (
                <span key={t} className="rounded-full bg-brand-surface-hover px-1.5 py-0.5 text-[11px] text-brand-text">
                  {t}
                </span>
              ))}
              {card.tags.length > 4 && <span>+{card.tags.length - 4}</span>}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
