"use client";

import { useRef, useState, useTransition } from "react";
import { Palette, Upload, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ResultDialog } from "@/components/ui/result-dialog";
import { toast } from "@/components/ui/toaster";
import { BankMark } from "@/components/banks/bank-mark";
import { updateBankBrandAction } from "@/features/bank-catalog/actions";
import {
  BRAND_SWATCHES,
  HEX_COLOR,
  bankInitials,
  defaultBankLogo,
  readableTextOn,
} from "@/features/bank-catalog/branding";

/** Reduce la imagen a 128×128 (centrada, fondo transparente) en el navegador. */
async function toLogoDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
    const w = img.naturalWidth || size;
    const h = img.naturalHeight || size;
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    const webp = canvas.toDataURL("image/webp", 0.9);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Botón "Color y logo" de una fila del catálogo de bancos: elige el color de
 * las tarjetas de ese banco y sube su logo. Vista previa en vivo.
 */
export function BankBrandEditor({
  entryId,
  name,
  color,
  uploadedLogo,
}: {
  entryId: string;
  name: string;
  color: string | null;
  /** Logo subido por el usuario (no el del sistema). */
  uploadedLogo: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pickColor, setPickColor] = useState<string | null>(color);
  const [logo, setLogo] = useState<string | null | undefined>(undefined); // undefined = sin cambio
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const systemLogo = defaultBankLogo(name);
  const shownLogo = logo === undefined ? (uploadedLogo ?? systemLogo) : (logo ?? systemLogo);
  const preview = { name, color: pickColor, logo: shownLogo, initials: bankInitials(name) };

  function reset() {
    setPickColor(color);
    setLogo(undefined);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setError("El logo debe ser una imagen PNG, JPG, WEBP o SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen pesa más de 5 MB. Usa una más liviana.");
      return;
    }
    try {
      setLogo(await toLogoDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la imagen.");
    }
  }

  function save() {
    start(async () => {
      const res = await updateBankBrandAction(entryId, pickColor, logo);
      if (res.error) setError(res.error);
      else {
        toast.success(`Listo: ${name} se verá así en tus cuentas y tarjetas.`);
        setOpen(false);
      }
    });
  }

  const fg = pickColor ? readableTextOn(pickColor) : undefined;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        icon={<Palette size={14} />}
        onClick={() => {
          reset();
          setOpen(true);
        }}
        hint="Color de las tarjetas y logo de este banco"
      >
        Color y logo
      </Button>

      {open && (
        <Modal open onClose={() => !pending && setOpen(false)} title={`Color y logo — ${name}`}>
          <div className="flex flex-col gap-4 text-sm">
            {/* Vista previa como en Bancos */}
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-brand-border">
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={pickColor ? { background: `linear-gradient(120deg, ${pickColor}, ${pickColor}d9)`, color: fg } : undefined}
              >
                <BankMark brand={preview} size={40} className={pickColor ? "ring-2 ring-white/70" : ""} />
                <div>
                  <p className="font-semibold">Cuenta de ejemplo</p>
                  <p className="text-xs opacity-80">{name}</p>
                </div>
              </div>
              <p className="px-4 py-2 text-xs text-brand-muted">Así se verán todas las cuentas y tarjetas de {name}.</p>
            </div>

            <div>
              <p className="mb-2 font-medium text-brand-text">Color de las tarjetas</p>
              <div className="flex flex-wrap items-center gap-2">
                {BRAND_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPickColor(c)}
                    title={c}
                    aria-label={`Color ${c}`}
                    className={`h-8 w-8 rounded-full ${pickColor?.toLowerCase() === c ? "ring-2 ring-brand-accent ring-offset-2" : ""}`}
                    style={{ background: c }}
                  />
                ))}
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-brand-accent" title="Elegir cualquier color">
                  <input
                    type="color"
                    value={pickColor && HEX_COLOR.test(pickColor) ? pickColor : "#334155"}
                    onChange={(e) => setPickColor(e.target.value)}
                    className="h-8 w-8 cursor-pointer rounded border border-brand-border bg-transparent p-0"
                  />
                  Otro color…
                </label>
                <button
                  type="button"
                  onClick={() => setPickColor(null)}
                  className="text-xs text-brand-muted hover:underline"
                  title="Sin color: la tarjeta se ve blanca, como antes"
                >
                  Sin color
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 font-medium text-brand-text">Logo del banco</p>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onFile} />
                <Button type="button" variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>
                  Subir logo
                </Button>
                {(logo ?? (logo === undefined ? uploadedLogo : null)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => setLogo(null)}
                    hint={systemLogo ? "Vuelve al logo que trae el sistema" : "Sin logo se usan las iniciales"}
                  >
                    Quitar logo subido
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-brand-muted">
                PNG, JPG, WEBP o SVG (mejor cuadrado). Se reduce solo a 128 px.{" "}
                {systemLogo ? "Sin subir nada se usa el logo que trae el sistema." : "Sin logo se usan las iniciales en el color del banco."}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="button" onClick={save} loading={pending}>
                Guardar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ResultDialog open={!!error} tone="danger" title="Revisa el logo o el color" onClose={() => setError(null)}>
        <p className="text-sm text-brand-muted">{error}</p>
      </ResultDialog>
    </>
  );
}
