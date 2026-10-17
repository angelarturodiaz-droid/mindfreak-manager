/**
 * Regla de contraseña segura del sistema (corrección 16-oct: aceptaba
 * "12345678"). Se usa en el navegador (lista en vivo) y en el servidor
 * (crear contraseña por invitación o recuperación, cambiarla en Mi perfil y
 * cuando un administrador la restablece).
 */

export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_RULES: { id: string; label: string; test: (pw: string) => boolean }[] = [
  { id: "length", label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", label: "Una letra mayúscula (A-Z)", test: (pw) => /[A-ZÁÉÍÓÚÑ]/.test(pw) },
  { id: "lower", label: "Una letra minúscula (a-z)", test: (pw) => /[a-záéíóúñ]/.test(pw) },
  { id: "digit", label: "Un número (0-9)", test: (pw) => /\d/.test(pw) },
  { id: "symbol", label: "Un símbolo (! @ # $ % & * …)", test: (pw) => /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(pw) },
];

/** Contraseñas demasiado comunes (en minúsculas, sin símbolos al final). */
const COMMON = [
  "password", "contraseña", "contrasena", "qwerty", "asdfgh", "zxcvbn", "123456", "abc123", "admin", "administrador",
  "welcome", "bienvenido", "letmein", "iloveyou", "teamo", "mindfreak", "dominicana", "santodomingo", "passw0rd",
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** ¿Es una serie fácil? (1234…, abcd…, 4 o más caracteres iguales seguidos) */
function hasEasyPattern(pw: string): boolean {
  if (/(.)\1{3,}/.test(pw)) return true;
  const s = normalize(pw);
  let run = 1;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    run = d === 1 || d === -1 ? run + 1 : 1;
    if (run >= 5) return true;
  }
  return false;
}

/**
 * Problema de la contraseña en una frase, o null si cumple. `email` y `name`
 * evitan que la contraseña contenga el correo o el nombre de la persona.
 */
export function passwordProblem(pw: string, ctx: { email?: string | null; name?: string | null } = {}): string | null {
  const missing = PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label.toLowerCase());
  if (missing.length > 0) {
    return `La contraseña no es segura. Le falta: ${missing.join(", ")}.`;
  }
  const n = normalize(pw).replace(/[^a-z0-9]/g, "");
  if (COMMON.some((c) => n.includes(normalize(c).replace(/[^a-z0-9]/g, "")))) {
    return "La contraseña es muy común o fácil de adivinar (por ejemplo «password», «123456» o el nombre de la empresa). Elige otra.";
  }
  if (hasEasyPattern(pw)) {
    return "La contraseña tiene una serie fácil de adivinar (como 12345, abcde o la misma letra repetida). Elige otra.";
  }
  const local = normalize(ctx.email?.split("@")[0] ?? "").replace(/[^a-z0-9]/g, "");
  if (local.length >= 4 && n.includes(local)) {
    return "La contraseña no puede contener tu correo. Elige otra.";
  }
  const nameParts = normalize(ctx.name ?? "")
    .split(/\s+/)
    .filter((p) => p.length >= 4);
  if (nameParts.some((p) => n.includes(p))) {
    return "La contraseña no puede contener tu nombre. Elige otra.";
  }
  return null;
}

/** Contraseña segura al azar (para "Generar" del administrador). */
export function generateStrongPassword(length = 14): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const rand = (max: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  };
  for (let attempt = 0; attempt < 20; attempt++) {
    const chars = sets.map((s) => s[rand(s.length)]);
    while (chars.length < length) chars.push(all[rand(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const pw = chars.join("");
    if (!passwordProblem(pw)) return pw;
  }
  return "Mf#" + Date.now().toString(36) + "Xy9!";
}
