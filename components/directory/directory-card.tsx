import Link from "next/link";
import { ImageOff, MapPin } from "lucide-react";
import type { DirectoryCard as Card } from "@/features/directory/queries";
import { DIRECTORY_STATUS_INFO, DIRECTORY_STATUS_LABELS, DIRECTORY_STATUS_TONES } from "@/features/directory/schema";
import { Stars } from "./stars";

export function directoryHref(id: string) {
  return `/suppliers/${id}?tab=directorio&return_to=${encodeURIComponent("/directory")}`;
}

/** Tarjeta compacta: foto, nombre, estado, estrellas y zona. El resto, al pasar el mouse o en la ficha. */
export function DirectoryCard({ card }: { card: Card }) {
  const more = [
    [card.category, card.service_type].filter(Boolean).join(" · "),
    card.reference_price,
    card.tags.length ? `Etiquetas: ${card.tags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <Link
      href={directoryHref(card.id)}
      title={more || card.name}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-brand-border bg-brand-surface transition-shadow hover:shadow-[var(--shadow-lg)]"
    >
      <div className="relative aspect-[3/2] w-full bg-brand-surface-hover">
        {card.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Storage (cambia cada hora)
          <img src={card.coverUrl} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-brand-muted">
            <ImageOff size={18} aria-label="Sin foto" />
          </span>
        )}
        <span
          title={DIRECTORY_STATUS_INFO[card.directory_status]}
          className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium shadow-sm ${DIRECTORY_STATUS_TONES[card.directory_status]}`}
        >
          {DIRECTORY_STATUS_LABELS[card.directory_status]}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2 py-1.5">
        <p className="line-clamp-1 text-sm font-semibold text-brand-text group-hover:text-brand-accent">{card.name}</p>
        <Stars value={card.rating} size={11} />
        {card.zoneName && (
          <span className="inline-flex items-center gap-1 truncate text-[11px] text-brand-muted">
            <MapPin size={10} aria-hidden /> {card.zoneName}
          </span>
        )}
      </div>
    </Link>
  );
}
