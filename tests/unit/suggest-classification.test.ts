import { describe, expect, it } from "vitest";
import { suggestClassification } from "@/features/suppliers/suggest-classification";
import { CATALOG } from "./fixtures-catalog";

const categories = Object.keys(CATALOG).map((name, i) => ({ id: `c${i}`, name }));
const serviceTypes = categories.flatMap((c) => CATALOG[c.name].map((name, j) => ({ id: `${c.id}-t${j}`, name, category_id: c.id })));

const top = (name: string) => {
  const s = suggestClassification(name, categories, serviceTypes)[0];
  return s ? `${s.categoryName} · ${s.serviceTypeName}` : null;
};

describe("suggestClassification", () => {
  it.each([
    ["Alberto Sistemas de Incendio", "Seguridad de instalaciones · Sistemas contra incendios"],
    ["Extintores del Caribe SRL", "Seguridad de instalaciones · Sistemas contra incendios"],
    ["Foto Estudio Pérez", "Fotografía y video · Fotografía"],
    ["DJ Carlos", "Entretenimiento · Disc jockey"],
    ["Sonido Profesional RD", "Audiovisuales · Audio y Sonido"],
    ["Seguros Universal", "Seguros · Pólizas de seguro"],
    ["Seguridad Total SRL", "Personal de eventos · Seguridad"],
    ["Bufete Gómez & Asociados", "Honorarios profesionales · Asesoría legal"],
    ["Catering Delicias Gourmet", "Catering y alimentos · Buffet"],
    ["Flores y Más", "Decoración · Arreglos florales"],
    ["Carpas Hermanos Díaz", "Escenografía y montaje · Carpas"],
    ["Transporte Turístico Bávaro", "Transporte y combustible · Transporte de invitados"],
    ["Imprenta La Unión", "Impresos y promocionales · Impresión de programas"],
    ["Contadores Asociados", "Honorarios profesionales · Contabilidad y auditoría"],
    ["Refrigeración Polar", "Mantenimiento y reparaciones · Mantenimiento de aires acondicionados"],
    ["Repostería Dulce Hogar", "Catering y alimentos · Pastelería y postres"],
    ["Luces y Efectos Show", "Iluminación · Técnico de iluminación"],
    ["Fumigadora Antiplagas", "Limpieza de instalaciones · Fumigación"],
  ])("%s → %s", (name, expected) => {
    expect(top(name)).toBe(expected);
  });

  it("sin palabras útiles no sugiere nada", () => {
    expect(suggestClassification("Juan Pérez", categories, serviceTypes)).toEqual([]);
    expect(suggestClassification("Inversiones Grupo SRL", categories, serviceTypes)).toEqual([]);
    expect(suggestClassification("", categories, serviceTypes)).toEqual([]);
  });

  it("da alternativas y dice por qué palabra", () => {
    const s = suggestClassification("Alberto Sistemas de Incendio", categories, serviceTypes);
    expect(s[1]?.serviceTypeName).toBe("Prevención de incendios");
    expect(s[0].words[0]).toBe("incendio");
  });

  it("ignora pistas cuyo tipo no existe en el catálogo", () => {
    const small = serviceTypes.filter((t) => t.name !== "Disc jockey");
    expect(suggestClassification("DJ Carlos", categories, small)).toEqual([]);
  });
});
