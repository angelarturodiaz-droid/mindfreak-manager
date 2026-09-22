// Configuración de OpenNext para desplegar en Cloudflare Pages/Workers.
// Sin caché incremental en R2 por ahora (se puede activar más adelante
// si se necesita ISR/revalidación — ver https://opennext.js.org/cloudflare/caching).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
