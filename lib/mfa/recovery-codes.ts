import { randomBytes, createHash } from "node:crypto";

/** Cuántos códigos se generan cada vez (regenerar invalida los anteriores). */
export const RECOVERY_CODE_COUNT = 10;

// Sin 0/O/1/I/L — se pueden confundir al copiarlos o escribirlos a mano.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateOneCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

/** Genera N códigos de un solo uso, en texto plano (solo se muestran una vez). */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, generateOneCode);
}

function normalize(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Hash determinístico (sha256) — se guarda en la base de datos en vez del
 * código en texto plano. No es para contraseñas (no necesita ser lento):
 * los códigos ya tienen suficiente entropía propia (8 caracteres de un
 * alfabeto de 32, de un solo uso) como para que un hash rápido baste.
 */
export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalize(code)).digest("hex");
}
