import { Font } from "@react-pdf/renderer";
import { ROBOTO_REGULAR_WOFF_BASE64, ROBOTO_BOLD_WOFF_BASE64 } from "./fonts-data";

/**
 * @react-pdf/renderer usa pdfkit por debajo, y pdfkit carga sus fuentes "estándar"
 * (Helvetica, Helvetica-Bold, etc.) leyendo archivos del disco con el sistema de
 * archivos de Node. Cloudflare Workers no tiene disco, así que cualquier documento
 * que use la fuente por defecto (o cualquier variante de Helvetica) falla ahí con
 * "No such module '#standard-fonts/Helvetica'".
 *
 * La solución es registrar nuestra propia fuente en vez de dejar que pdfkit
 * resuelva Helvetica. OJO: pasarle a Font.register un Buffer/Uint8Array crudo
 * como `src` NO alcanza — @react-pdf/font solo evita el disco cuando `src` es
 * una data: URL o una URL http(s); un buffer crudo cae en su rama por defecto,
 * que llama a `fontkit.open(src)` esperando una RUTA DE ARCHIVO, es decir el
 * mismo problema de disco otra vez. Por eso aquí convertimos el base64 en un
 * data: URL, que sí se decodifica en memoria (fontkit.create) sin tocar el
 * sistema de archivos. Las fuentes van embebidas en base64 en fonts-data.ts
 * para no depender de fetch en tiempo de ejecución ni de archivos sueltos.
 */

const FONT_FAMILY = "Roboto";
let registered = false;

function woffBase64ToDataUrl(base64: string): string {
  return `data:font/woff;base64,${base64}`;
}

/**
 * Registra la fuente Roboto (normal y bold) para @react-pdf/renderer.
 * Idempotente: seguro llamarla en cada render.
 *
 * IMPORTANTE: todos los documentos PDF deben usar fontFamily: "Roboto" (nunca
 * "Helvetica" ni dejar el default) para no disparar la carga de fuentes
 * estándar de pdfkit basada en disco.
 */
export function registerPdfFonts(): string {
  if (!registered) {
    const regularDataUrl = woffBase64ToDataUrl(ROBOTO_REGULAR_WOFF_BASE64);
    const boldDataUrl = woffBase64ToDataUrl(ROBOTO_BOLD_WOFF_BASE64);
    Font.register({
      family: FONT_FAMILY,
      fonts: [
        // Los estilos existentes usan tanto "normal"/"bold" como los valores
        // numéricos 400/700; registramos ambos alias para que cualquiera de
        // los dos resuelva a la variante correcta.
        { src: regularDataUrl, fontWeight: "normal" },
        { src: boldDataUrl, fontWeight: "bold" },
        { src: regularDataUrl, fontWeight: 400 },
        { src: boldDataUrl, fontWeight: 700 },
      ],
    });
    // Evita que pdfkit intente aplicar guiones con datos de hifenación por
    // idioma que tampoco están disponibles en este runtime.
    Font.registerHyphenationCallback((word) => [word]);
    registered = true;
  }
  return FONT_FAMILY;
}
