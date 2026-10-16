import { CreditCard, Landmark } from "lucide-react";
import type { BankBrand } from "@/features/bank-catalog/branding";
import { readableTextOn } from "@/features/bank-catalog/branding";

/**
 * Cuadrito del banco: su logo (sobre blanco) o sus iniciales en el color del
 * banco. Sin banco: ícono genérico de banco o tarjeta.
 */
export function BankMark({
  brand,
  isCard = false,
  size = 40,
  className = "",
}: {
  brand: BankBrand | null;
  isCard?: boolean;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  const radius = size >= 32 ? "rounded-[10px]" : "rounded-[6px]";
  if (brand?.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo pequeño, puede ser data URL
      <img
        src={brand.logo}
        alt={`Logo de ${brand.name}`}
        style={style}
        className={`shrink-0 bg-white object-contain ${radius} ${className}`}
      />
    );
  }
  if (brand?.color) {
    const fs = Math.max(9, Math.round(size * (brand.initials.length > 2 ? 0.3 : 0.36)));
    return (
      <span
        aria-label={brand.name}
        style={{ ...style, background: brand.color, color: readableTextOn(brand.color), fontSize: fs }}
        className={`flex shrink-0 items-center justify-center font-bold ${radius} ${className}`}
      >
        {brand.initials}
      </span>
    );
  }
  const Icon = isCard ? CreditCard : Landmark;
  return (
    <span
      style={style}
      className={`flex shrink-0 items-center justify-center bg-brand-accent-light text-brand-accent ${radius} ${className}`}
      aria-label={brand?.name ?? "Banco"}
    >
      {brand?.initials && size >= 24 ? (
        <span className="text-xs font-bold">{brand.initials}</span>
      ) : (
        <Icon size={Math.round(size * 0.45)} aria-hidden />
      )}
    </span>
  );
}
