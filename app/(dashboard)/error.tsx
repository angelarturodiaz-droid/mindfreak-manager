"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Pantalla amable cuando una página no se pudo cargar (por ejemplo, un corte de internet). */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const connection = /conectar|fetch failed|network|internet/i.test(error.message);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-8 text-center shadow-[var(--shadow-sm)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-warning-bg text-brand-warning">
          <WifiOff size={22} aria-hidden />
        </span>
        <h1 className="text-lg font-semibold text-brand-text">{connection ? "Se cortó la conexión" : "No se pudo cargar esta pantalla"}</h1>
        <p className="text-sm text-brand-muted">
          {connection
            ? "No pudimos hablar con la base de datos. Suele ser un corte de internet de unos segundos. Tus datos están bien: no se guardó ni se borró nada."
            : "Algo falló al abrir esta pantalla. Tus datos están bien. Prueba otra vez; si se repite, toma una captura y avísale a Administración."}
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button
            icon={<RefreshCw size={15} />}
            loading={pending}
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            Reintentar
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Ir al inicio</Button>
          </Link>
        </div>
        {error.digest && <p className="pt-1 text-[11px] text-brand-disabled">Código: {error.digest}</p>}
      </div>
    </main>
  );
}
