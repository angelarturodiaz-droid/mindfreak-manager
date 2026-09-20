import { randomBytes, createHash } from "node:crypto";

/** Nombre de la cookie httpOnly que identifica un "equipo de confianza". */
export const TRUSTED_DEVICE_COOKIE = "mf_trusted_device";

/** Cuántos días dura un equipo marcado como "de confianza" sin pedir MFA en el login. */
export const TRUSTED_DEVICE_DAYS = 90;

/** Token aleatorio de alta entropía — el valor real vive solo en la cookie del navegador. */
export function generateTrustedDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

/** Hash del token — es lo único que se guarda en la base de datos. */
export function hashTrustedDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
