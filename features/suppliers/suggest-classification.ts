/**
 * Sugerencia de Categoría y Tipo de servicio a partir del NOMBRE DEL
 * NEGOCIO del proveedor (ej. "Alberto Sistemas de Incendio" → Seguridad de
 * instalaciones · Sistemas contra incendios).
 *
 * Función pura (sin base de datos, sin internet): compara las palabras del
 * nombre con
 *   1. los nombres de los tipos de servicio y categorías del catálogo, y
 *   2. un diccionario de palabras del mundo de eventos y servicios
 *      ("dj" → Disc jockey, "bufete" → Asesoría legal, "flores" → Arreglos
 *      florales…).
 * Solo sugiere: el usuario siempre puede cambiarla. Si el catálogo no
 * tiene un tipo que aparece en el diccionario, esa pista se ignora.
 */

export type CatalogCategory = { id: string; name: string };
export type CatalogServiceType = { id: string; name: string; category_id: string };

export type ClassificationSuggestion = {
  categoryId: string;
  categoryName: string;
  serviceTypeId: string;
  serviceTypeName: string;
  score: number;
  /** Palabras del nombre que llevaron a la sugerencia (la de más peso primero). */
  words: string[];
};

export function normalizeWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

/** Palabras que no dicen nada del servicio. */
const STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "o", "en", "para", "por", "con", "a", "al", "un", "una", "mas", "and",
  "the", "of", "srl", "sas", "sa", "eirl", "sociedad", "anonima", "limitada", "cia", "compania", "corp", "corporacion",
  "inc", "llc", "ltd", "grupo", "group", "inversiones", "comercial", "comercializadora", "empresa", "empresas", "dominicana",
  "dominicano", "rd", "dr", "hermanos", "hnos", "asociados", "co", "sociedades", "nacional", "internacional", "global",
  "general", "generales", "multi", "pro", "plus", "express", "total", "center", "centro", "santo", "domingo", "santiago",
]);

/** Palabras muy generales: cuentan poco. */
const WEAK = new Set([
  "sistemas", "sistema", "servicios", "servicio", "soluciones", "solucion", "eventos", "evento", "producciones",
  "produccion", "equipos", "equipo", "tecnicos", "tecnico", "alquiler", "alquileres", "rental", "rentals", "renta",
  "diseno", "design", "studio", "estudio", "creativo", "creativa", "personal", "gestion", "agencia", "tienda", "casa",
  "show", "shows",
]);

const stem = (w: string) => (w.length > 5 ? w.slice(0, 5) : w.replace(/s$/, ""));

/**
 * Diccionario: raíz (o palabra exacta con "=") → tipos de servicio (por
 * nombre exacto del catálogo) y peso. Las raíces se comparan con el inicio
 * de cada palabra del nombre, sin acentos.
 */
const HINTS: { roots: string[]; types: string[]; weight: number }[] = [
  { roots: ["incend", "extint", "bomber", "fuego", "fire"], types: ["Sistemas contra incendios", "Prevención de incendios"], weight: 5 },
  { roots: ["alarm"], types: ["Monitoreo de alarmas"], weight: 4 },
  { roots: ["cctv", "=camaras"], types: ["Cámaras de seguridad"], weight: 2 },
  { roots: ["=seguridad", "vigil", "guard", "securi", "custod", "escolt"], types: ["Seguridad", "Vigilancia de instalaciones"], weight: 4 },
  { roots: ["=seguro", "=seguros", "asegur", "insuran"], types: ["Pólizas de seguro"], weight: 5 },
  { roots: ["foto", "photo", "lente", "lens"], types: ["Fotografía", "Álbumes fotográficos"], weight: 4 },
  { roots: ["video", "film", "cine", "camara"], types: ["Video y edición", "Realización multicámara"], weight: 3 },
  { roots: ["drone", "dron"], types: ["Drones"], weight: 5 },
  { roots: ["booth", "cabina"], types: ["Cabina de fotos (photobooth)"], weight: 4 },
  { roots: ["=dj", "deejay", "disco", "=djs"], types: ["Disc jockey"], weight: 5 },
  { roots: ["sonid", "audio", "sound", "acust", "bocin"], types: ["Audio y Sonido", "Técnicos de sonido"], weight: 4 },
  { roots: ["microf"], types: ["Microfonía"], weight: 4 },
  { roots: ["luz", "luces", "light", "ilumin", "lumin"], types: ["Técnico de iluminación", "Iluminación escénica", "Iluminación decorativa"], weight: 4 },
  { roots: ["=led", "pantal", "screen"], types: ["Alquiler de pantallas LED"], weight: 4 },
  { roots: ["proyect"], types: ["Alquiler de proyectores"], weight: 3 },
  { roots: ["stream", "transmi"], types: ["Transmisión en vivo"], weight: 4 },
  { roots: ["laser"], types: ["Sistemas láser"], weight: 4 },
  { roots: ["catering", "banqu", "buffet", "comida", "food", "chef", "cocin", "gourmet", "delic", "sabor", "gastro"], types: ["Buffet", "Menús servidos", "Canapés y picaderas"], weight: 4 },
  { roots: ["repost", "bizcoch", "cake", "postr", "dulce", "pastel", "bakery", "panader"], types: ["Pastelería y postres"], weight: 5 },
  { roots: ["=bar", "bares", "trago", "coctel", "cocktail", "drink", "bebid", "licor", "mixolog", "bartend"], types: ["Bebidas y bar", "Bartender"], weight: 4 },
  { roots: ["=cafe", "coffee", "cafet"], types: ["Pausa de café"], weight: 3 },
  { roots: ["meser", "camarer", "waiter"], types: ["Servicio de meseros"], weight: 4 },
  { roots: ["flor", "flower", "florist", "floral", "orquid"], types: ["Arreglos florales", "Diseño floral", "Centros de mesa"], weight: 5 },
  { roots: ["decor", "ambient"], types: ["Decoración temática", "Ambientación de espacios"], weight: 4 },
  { roots: ["globo", "balloon"], types: ["Globos"], weight: 5 },
  { roots: ["tela", "cortin"], types: ["Telas y cortinajes"], weight: 3 },
  { roots: ["vinil", "senalet", "rotul", "letrer"], types: ["Vinilos y señalética", "Rotulación de vehículos"], weight: 3 },
  { roots: ["carpa", "toldo", "=tent", "=tents"], types: ["Carpas"], weight: 5 },
  { roots: ["tarima", "escenar", "stage"], types: ["Tarimas y escenarios"], weight: 4 },
  { roots: ["truss", "estructur"], types: ["Truss y estructuras"], weight: 4 },
  { roots: ["montaj"], types: ["Montaje y desmontaje"], weight: 3 },
  { roots: ["silla", "chair"], types: ["Alquiler de sillas"], weight: 4 },
  { roots: ["mesa", "table"], types: ["Alquiler de mesas"], weight: 3 },
  { roots: ["mobili", "mueble", "furnit", "lounge"], types: ["Mobiliario lounge", "Alquiler de sillas", "Alquiler de mesas"], weight: 3 },
  { roots: ["mantel"], types: ["Mantelería"], weight: 5 },
  { roots: ["vajill", "cristal", "cubiert"], types: ["Vajilla y cristalería", "Cubertería"], weight: 4 },
  { roots: ["transp", "=bus", "=buses", "guagua", "autobus", "shuttle", "minibus", "minivan"], types: ["Transporte de invitados", "Transporte de personal"], weight: 4 },
  { roots: ["flete", "carga", "cargo", "mudanz"], types: ["Flete de equipos"], weight: 4 },
  { roots: ["camion", "truck"], types: ["Alquiler de camiones"], weight: 4 },
  { roots: ["rent", "=car", "=cars", "vehic", "auto"], types: ["Alquiler de vehículos"], weight: 2 },
  { roots: ["combust", "gasolin", "gasoil", "diesel", "=gas", "petrol"], types: ["Combustible"], weight: 5 },
  { roots: ["mensaj", "courier", "deliver", "envio", "delivery"], types: ["Mensajería"], weight: 4 },
  { roots: ["hotel", "resort", "hosped", "hostal"], types: ["Hoteles", "Gestión de alojamiento"], weight: 4 },
  { roots: ["viaje", "travel", "tour", "turism"], types: ["Agencia de viajes", "Boletos aéreos"], weight: 4 },
  { roots: ["impres", "print", "imprent", "serigraf", "tipograf", "copia"], types: ["Impresión de programas", "Banners y roll-ups", "Impresión de catálogos"], weight: 4 },
  { roots: ["banner", "rollup"], types: ["Banners y roll-ups"], weight: 5 },
  { roots: ["promo", "merch"], types: ["Artículos promocionales"], weight: 4 },
  { roots: ["regalo", "gift", "detalle"], types: ["Regalos corporativos"], weight: 3 },
  { roots: ["invitac"], types: ["Invitaciones", "Diseño de invitaciones digitales"], weight: 4 },
  { roots: ["grafic", "creativ", "brand", "marca"], types: ["Diseño gráfico"], weight: 3 },
  { roots: ["anima", "motion"], types: ["Animación digital", "Animación interactiva"], weight: 2 },
  { roots: ["music", "banda", "orquest", "mariach", "=coro", "saxo", "violin", "piano", "merengu", "salsa", "bachat", "=trio", "cantant"], types: ["Músicos y bandas"], weight: 4 },
  { roots: ["baile", "danza", "dance", "ballet"], types: ["Grupos de baile"], weight: 4 },
  { roots: ["mago", "magia", "magic"], types: ["Espectáculos de magia"], weight: 5 },
  { roots: ["payas", "infant", "kids", "nino", "ninos", "clown"], types: ["Actividades infantiles", "Personajes temáticos"], weight: 4 },
  { roots: ["comparsa", "carnaval"], types: ["Comparsas"], weight: 5 },
  { roots: ["animad", "=mc", "presentad", "locutor"], types: ["Maestro de ceremonias / animador"], weight: 4 },
  { roots: ["show", "artist", "talent", "entreten", "entertain"], types: ["Artistas y shows"], weight: 3 },
  { roots: ["maquill", "makeup", "beauty", "bellez", "cosmet"], types: ["Maquillaje", "Estilismo"], weight: 4 },
  { roots: ["peinad", "hair", "estilis", "barber", "peluq"], types: ["Peinado", "Estilismo"], weight: 4 },
  { roots: ["vestu", "costum", "sastr", "modist", "boutiq", "moda", "fashion"], types: ["Confección de vestuario", "Alquiler de vestuario"], weight: 4 },
  { roots: ["uniform", "bordad"], types: ["Confección de uniformes"], weight: 5 },
  { roots: ["medic", "salud", "clinic", "paramed", "enfermer", "doctor", "health"], types: ["Personal médico", "Atención de primeros auxilios"], weight: 4 },
  { roots: ["ambulan", "emergen", "rescat"], types: ["Servicio de ambulancia"], weight: 5 },
  { roots: ["limpi", "clean", "conserj", "lavand"], types: ["Limpieza", "Limpieza de oficina"], weight: 4 },
  { roots: ["fumig", "plaga", "=pest", "=pest"], types: ["Fumigación"], weight: 3 },
  { roots: ["generad", "planta", "energ", "power"], types: ["Plantas eléctricas", "Distribución eléctrica"], weight: 3 },
  { roots: ["electri", "electro"], types: ["Reparaciones eléctricas", "Distribución eléctrica"], weight: 3 },
  { roots: ["=aire", "=aires", "clima", "refriger", "hvac", "=frio"], types: ["Mantenimiento de aires acondicionados", "Climatización"], weight: 4 },
  { roots: ["plomer", "fontan"], types: ["Plomería"], weight: 5 },
  { roots: ["pintur", "albanil", "construc", "remodel", "ebanist", "herrer", "carpinter"], types: ["Pintura y albañilería"], weight: 3 },
  { roots: ["mecan", "taller", "garage"], types: ["Mantenimiento de vehículos"], weight: 3 },
  { roots: ["mantenim", "manten", "repara"], types: ["Reparación de equipos", "Mantenimiento de aires acondicionados"], weight: 2 },
  { roots: ["bano", "banos", "sanitar", "portatil"], types: ["Baños portátiles"], weight: 4 },
  { roots: ["internet", "wifi", "telecom", "fibra", "network", "conectiv"], types: ["Internet y WiFi", "Telefonía e internet de oficina"], weight: 4 },
  { roots: ["cablea", "=redes"], types: ["Redes y cableado"], weight: 3 },
  { roots: ["informat", "comput", "tecnolog", "=tech", "=it", "=ti", "digital", "=pc"], types: ["Soporte técnico informático"], weight: 3 },
  { roots: ["softw", "=app", "=apps", "=web", "desarroll", "program", "develop"], types: ["Desarrollo de software"], weight: 3 },
  { roots: ["hosting", "dominio"], types: ["Hosting y dominios"], weight: 4 },
  { roots: ["abogad", "legal", "jurid", "bufete", "=law", "lawyer", "litig"], types: ["Asesoría legal"], weight: 5 },
  { roots: ["notar"], types: ["Servicios notariales"], weight: 5 },
  { roots: ["contab", "contad", "audit", "account", "financ"], types: ["Contabilidad y auditoría"], weight: 5 },
  { roots: ["fiscal", "tribut", "impuest", "=tax"], types: ["Asesoría fiscal"], weight: 4 },
  { roots: ["consult", "asesor", "advisor"], types: ["Consultoría"], weight: 3 },
  { roots: ["publicid", "advert", "market", "mercade", "=ads", "media", "comunicac"], types: ["Agencia de publicidad", "Publicidad digital y redes sociales"], weight: 4 },
  { roots: ["=radio", "televis", "=tv", "periodic", "revista", "prensa"], types: ["Publicidad en medios"], weight: 4 },
  { roots: ["capacit", "academ", "curso", "training", "escuela", "institut", "formac", "coach"], types: ["Cursos y talleres"], weight: 4 },
  { roots: ["reclut", "headhunt", "rrhh", "seleccion"], types: ["Reclutamiento y selección de personal"], weight: 4 },
  { roots: ["aduan", "import", "export", "custom"], types: ["Agente aduanal", "Flete internacional"], weight: 4 },
  { roots: ["papel", "libreri", "=utiles", "oficina", "office"], types: ["Papelería y útiles de oficina"], weight: 3 },
  { roots: ["hielo", "=ice"], types: ["Hielo para eventos"], weight: 5 },
  { roots: ["desechab", "plastic"], types: ["Desechables para eventos"], weight: 4 },
  { roots: ["fiesta", "party", "celebr", "pinata", "cotillon"], types: ["Artículos de celebración"], weight: 3 },
  { roots: ["valet", "parqueo", "parking"], types: ["Valet parking", "Gestión de estacionamiento"], weight: 4 },
  { roots: ["azafat", "hostess", "protocol", "modelo", "edecan"], types: ["Azafatas y protocolo"], weight: 4 },
  { roots: ["traduc", "interpret", "idioma", "language"], types: ["Interpretación simultánea"], weight: 4 },
  { roots: ["salon", "venue", "finca", "quinta", "villa", "terraza", "jardin"], types: ["Alquiler de salón", "Alquiler de finca"], weight: 3 },
  { roots: ["teatro", "theater", "auditor"], types: ["Alquiler de teatro"], weight: 4 },
  { roots: ["boda", "wedding", "novia", "bridal"], types: ["Planificación de bodas"], weight: 4 },
  { roots: ["planner", "planif", "organiz"], types: ["Diseño de evento", "Coordinación de evento"], weight: 3 },
  { roots: ["entrada", "ticket", "boleter"], types: ["Venta de entradas"], weight: 4 },
  { roots: ["vr", "virtual", "realid", "hologr"], types: ["Experiencias de realidad virtual", "Experiencias de realidad aumentada"], weight: 3 },
  { roots: ["almacen", "deposito", "storage", "bodega"], types: ["Almacenaje de evento", "Alquiler de almacén"], weight: 3 },
];

function matchesRoot(word: string, root: string): boolean {
  return root.startsWith("=") ? word === root.slice(1) : word.startsWith(root);
}

export function suggestClassification(
  businessName: string,
  categories: CatalogCategory[],
  serviceTypes: CatalogServiceType[],
  limit = 3,
): ClassificationSuggestion[] {
  const words = normalizeWords(businessName).filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  if (words.length === 0) return [];

  const catById = new Map(categories.map((c) => [c.id, c]));
  const typeByName = new Map(serviceTypes.map((t) => [normalizeWords(t.name).join(" "), t]));
  const scores = new Map<string, { score: number; words: Map<string, number> }>();
  const add = (typeId: string, pts: number, word: string) => {
    const cur = scores.get(typeId) ?? { score: 0, words: new Map<string, number>() };
    cur.score += pts;
    cur.words.set(word, (cur.words.get(word) ?? 0) + pts);
    scores.set(typeId, cur);
  };

  for (const w of words) {
    const weak = WEAK.has(w);
    // 1. Diccionario.
    for (const h of HINTS) {
      if (!h.roots.some((r) => matchesRoot(w, r))) continue;
      h.types.forEach((name, i) => {
        const t = typeByName.get(normalizeWords(name).join(" "));
        // El primer tipo de la pista pesa un poco más que los alternativos.
        if (t) add(t.id, (weak ? 1 : h.weight) - i * 0.5, w);
      });
    }
    // 2. Nombre del tipo de servicio y de su categoría.
    if (w.length < 3) continue;
    for (const t of serviceTypes) {
      const tw = normalizeWords(t.name).filter((x) => x.length >= 3 && !STOPWORDS.has(x));
      if (tw.some((x) => stem(x) === stem(w))) add(t.id, weak ? 1 : 3, w);
      const cat = catById.get(t.category_id);
      if (cat) {
        const cw = normalizeWords(cat.name).filter((x) => x.length >= 3 && !STOPWORDS.has(x));
        if (cw.some((x) => stem(x) === stem(w))) add(t.id, weak ? 0.25 : 1, w);
      }
    }
  }

  return [...scores.entries()]
    .map(([typeId, s]) => {
      const t = serviceTypes.find((x) => x.id === typeId)!;
      const c = catById.get(t.category_id);
      return {
        categoryId: t.category_id,
        categoryName: c?.name ?? "",
        serviceTypeId: t.id,
        serviceTypeName: t.name,
        score: Math.round(s.score * 100) / 100,
        // Primero la palabra que más pesó (para explicar la sugerencia).
        words: [...s.words.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w),
      };
    })
    .filter((s) => s.score >= 2.5 && s.categoryName)
    .sort((a, b) => b.score - a.score || a.serviceTypeName.localeCompare(b.serviceTypeName, "es"))
    .slice(0, limit);
}
