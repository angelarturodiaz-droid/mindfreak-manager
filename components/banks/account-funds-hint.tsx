import { Wallet, CreditCard } from "lucide-react";
import { cardPosition } from "@/features/banks/display";
import type { AccountFunds } from "@/features/banks/queries";
import { formatMoney } from "@/lib/utils/money";

/**
 * Recuadro chico debajo de la cuenta elegida en un pago: cuánto hay
 * disponible y, si se sabe el monto (misma moneda), si alcanza. Es solo
 * informativo — la validación real la hace la base de datos al guardar.
 */
export function AccountFundsHint({
  funds,
  amount,
  amountCurrency,
}: {
  funds: AccountFunds | undefined;
  amount?: number;
  amountCurrency?: string;
}) {
  if (!funds) return null;
  const cur = funds.currency;
  const comparable = amount !== undefined && amount > 0 && (!amountCurrency || amountCurrency === cur);

  if (funds.type === "CREDIT_CARD") {
    const pos = cardPosition(funds.balance, funds.credit_limit, funds.favor_increases_limit);
    const short = comparable && pos.available !== null && amount! > pos.available;
    return (
      <Box tone={short ? "danger" : "info"} icon={<CreditCard size={14} />}>
        <span>
          Crédito disponible:{" "}
          <strong>{pos.available === null ? "sin límite registrado" : formatMoney(pos.available, cur)}</strong>
          {pos.debt > 0 && <> · Deuda {formatMoney(pos.debt, cur)}</>}
          {pos.favor > 0 && <> · A favor {formatMoney(pos.favor, cur)}</>}
        </span>
        {short && <span>No alcanza para {formatMoney(amount!, cur)}: la tarjeta no tiene crédito suficiente.</span>}
      </Box>
    );
  }

  const canOverdraw = funds.account_kind === "CHECKING" && funds.allow_overdraft;
  const missing = comparable ? Math.round((amount! - funds.balance) * 100) / 100 : 0;
  const tone = missing > 0 ? (canOverdraw ? "warning" : "danger") : funds.balance < 0 ? "warning" : "info";
  return (
    <Box tone={tone} icon={<Wallet size={14} />}>
      <span>
        Disponible en la cuenta: <strong>{formatMoney(funds.balance, cur)}</strong>
        {canOverdraw && " · permite sobregiro"}
      </span>
      {missing > 0 &&
        (canOverdraw ? (
          <span>
            Con este pago quedaría en sobregiro por {formatMoney(missing, cur)}; al guardar se te pedirá confirmar.
          </span>
        ) : (
          <span>No alcanza: faltan {formatMoney(missing, cur)}. Elige otra cuenta o cambia el monto.</span>
        ))}
    </Box>
  );
}

function Box({
  tone,
  icon,
  children,
}: {
  tone: "info" | "warning" | "danger";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "danger"
      ? "border-brand-danger/30 bg-brand-danger-bg text-brand-danger"
      : tone === "warning"
        ? "border-brand-warning/40 bg-brand-warning-bg text-brand-text"
        : "border-brand-border bg-brand-surface-hover text-brand-text";
  return (
    <div className={`flex w-full items-start gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-xs ${cls}`}>
      <span className="mt-px shrink-0">{icon}</span>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
