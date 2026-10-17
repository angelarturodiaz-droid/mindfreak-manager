import { describe, expect, it } from "vitest";
import { generateStrongPassword, passwordProblem } from "@/lib/auth/password-policy";

describe("passwordProblem", () => {
  it("rechaza contraseñas débiles", () => {
    expect(passwordProblem("12345678")).toMatch(/no es segura/);
    expect(passwordProblem("Password123!")).toMatch(/común/);
    expect(passwordProblem("Abcdef12345!")).toMatch(/serie|común/);
    expect(passwordProblem("Aaaaaa1!xyz")).toMatch(/serie/);
    expect(passwordProblem("Mindfreak2026!")).toMatch(/común/);
    expect(passwordProblem("Adiaz#Rojo27", { email: "adiaz@unitedcapitaldr.com" })).toMatch(/correo/);
    expect(passwordProblem("Julissa#Rojo27", { name: "Julissa Diaz" })).toMatch(/nombre/);
  });
  it("acepta una contraseña segura", () => {
    expect(passwordProblem("Verde#Lago27x")).toBeNull();
  });
  it("genera contraseñas que cumplen", () => {
    for (let i = 0; i < 20; i++) expect(passwordProblem(generateStrongPassword())).toBeNull();
  });
});
