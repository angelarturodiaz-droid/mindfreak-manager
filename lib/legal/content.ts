import { COMPANY_NAME, COMPANY_PHONE, COMPANY_RNC, SUPPORT_EMAIL } from "@/lib/app-info";

/**
 * Textos de la Política de Privacidad y los Términos de Uso.
 * Cada bloque es un párrafo (string) o una lista de puntos (string[]).
 * Al cambiar un texto: subir LEGAL_VERSION y LEGAL_DATE.
 * Borrador a revisar por el abogado / contador (Ley 172-13 de RD).
 */
export const LEGAL_VERSION = "1.0";
export const LEGAL_DATE = "2026-10-19";

export type LegalBlock = string | string[];
export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };
export type LegalDoc = { slug: "privacidad" | "terminos"; title: string; sections: LegalSection[] };

const contact = `${SUPPORT_EMAIL} · Tel. ${COMPANY_PHONE}`;

const privacy: LegalDoc = {
  slug: "privacidad",
  title: "Política de Privacidad",
  sections: [
    {
      id: "introduccion",
      title: "Introducción",
      blocks: [
        `En ${COMPANY_NAME} (RNC ${COMPANY_RNC}) valoramos tu privacidad y nos comprometemos a proteger la información personal de nuestros usuarios, clientes, proveedores y demás personas relacionadas con el uso de Mindfreak Manager, el sistema interno de gestión de la empresa.`,
        "Esta política explica qué información recopilamos, para qué la usamos, cómo la protegemos y qué derechos tienes, de acuerdo con la Ley 172-13 de la República Dominicana sobre protección de datos de carácter personal.",
      ],
    },
    {
      id: "datos",
      title: "Datos que recopilamos",
      blocks: [
        [
          "Usuarios del sistema (empleados y colaboradores): nombre, correo, rol y permisos, registro de accesos (fecha, hora y dispositivo) y configuración de la verificación en dos pasos.",
          "Clientes y sus contactos: nombre o razón social, RNC o cédula, correo, teléfono, dirección y cargo de los contactos; cotizaciones, facturas, cobros, gestiones de cobro y respuestas a encuestas de satisfacción.",
          "Proveedores: nombre o razón social, RNC o cédula, datos de contacto y bancarios para pagos, gastos, retenciones y comprobantes fiscales.",
          "Documentos adjuntos: contratos, comprobantes y otros archivos que los usuarios suben al sistema.",
        ],
        "No recopilamos datos sensibles (salud, religión, opinión política u otros) ni datos de tarjetas de crédito.",
      ],
    },
    {
      id: "uso",
      title: "Uso de la información",
      blocks: [
        "Usamos los datos solo para:",
        [
          "Operar la empresa: cotizar, facturar, cobrar, pagar y gestionar proyectos y eventos.",
          "Cumplir obligaciones fiscales y legales (DGII: comprobantes fiscales, retenciones y reportes).",
          "Enviar comunicaciones relacionadas con el servicio: facturas, recordatorios de cobro y encuestas de satisfacción.",
          "Mantener la seguridad del sistema: control de acceso, registro de cambios y prevención de fraudes.",
        ],
        "No vendemos ni alquilamos datos personales y no los usamos para publicidad de terceros.",
      ],
    },
    {
      id: "compartir",
      title: "Compartir información",
      blocks: [
        "Solo compartimos datos cuando es necesario:",
        [
          "Con proveedores tecnológicos reconocidos que alojan y operan el sistema (base de datos, hospedaje, protección del sitio y envío de correos), bajo acuerdos de confidencialidad y seguridad. Algunos pueden guardar la información fuera de la República Dominicana, con medidas de protección equivalentes.",
          "Con autoridades (DGII, tribunales u otras) cuando la ley lo exija.",
          "Con asesores de la empresa (contador, auditor o abogado), que tienen deber de confidencialidad.",
        ],
      ],
    },
    {
      id: "seguridad",
      title: "Seguridad",
      blocks: [
        [
          "Acceso solo con usuario, contraseña segura y verificación en dos pasos.",
          "Permisos por rol: cada persona ve solo lo que necesita para su trabajo.",
          "Comunicación cifrada (HTTPS) y bloqueo temporal tras varios intentos fallidos.",
          "Registro de los cambios importantes (quién, qué y cuándo).",
          "Copias de respaldo periódicas, que no incluyen contraseñas ni claves.",
        ],
        "Ningún sistema es totalmente invulnerable. Si ocurre un incidente que afecte tus datos, te informaremos según lo exige la ley.",
      ],
    },
    {
      id: "conservacion",
      title: "Conservación de los datos",
      blocks: [
        "Conservamos los datos mientras exista la relación comercial o laboral y, después, durante los plazos que exigen las normas fiscales y comerciales (en general, 10 años para los documentos contables y fiscales). Pasado ese plazo, se eliminan o se anonimizan.",
      ],
    },
    {
      id: "derechos",
      title: "Tus derechos",
      blocks: [
        "De acuerdo con la Ley 172-13 puedes pedir acceder a tus datos, corregirlos si son incorrectos, o cancelarlos u oponerte a su uso, salvo cuando debamos conservarlos por una obligación legal.",
        `Escríbenos a ${SUPPORT_EMAIL} con tu nombre y lo que solicitas. Te responderemos en un plazo máximo de 10 días hábiles.`,
      ],
    },
    {
      id: "cambios",
      title: "Cambios en la política",
      blocks: [
        "Podemos actualizar esta política. La versión vigente y su fecha están siempre disponibles en el sistema; los cambios importantes se avisarán a los usuarios.",
      ],
    },
    {
      id: "contacto",
      title: "Contacto",
      blocks: [`${COMPANY_NAME} · RNC ${COMPANY_RNC} · ${contact}`],
    },
  ],
};

const terms: LegalDoc = {
  slug: "terminos",
  title: "Términos de Uso",
  sections: [
    {
      id: "aceptacion",
      title: "Aceptación",
      blocks: [
        `Mindfreak Manager es un sistema de uso interno de ${COMPANY_NAME}. Al iniciar sesión, el usuario acepta estos Términos de Uso y la Política de Privacidad.`,
      ],
    },
    {
      id: "cuentas",
      title: "Acceso y cuentas",
      blocks: [
        [
          "Solo pueden usar el sistema las personas autorizadas por la administración.",
          "La cuenta es personal e intransferible: no se comparten la contraseña ni el código de verificación.",
          "El usuario es responsable de lo que se haga con su cuenta y debe avisar de inmediato si sospecha un acceso indebido.",
          "La empresa puede desactivar una cuenta en cualquier momento (por ejemplo, al terminar la relación laboral o ante un uso indebido).",
        ],
      ],
    },
    {
      id: "uso-permitido",
      title: "Uso permitido",
      blocks: [
        [
          "Usar el sistema solo para tareas de la empresa y según el rol asignado.",
          "Registrar información veraz y completa: montos, comprobantes fiscales y datos de clientes y proveedores.",
          "No intentar entrar a módulos o datos sin permiso, ni alterar o borrar registros para ocultar operaciones.",
          "No descargar, copiar ni compartir información fuera de la empresa sin autorización.",
        ],
      ],
    },
    {
      id: "confidencialidad",
      title: "Confidencialidad",
      blocks: [
        "Toda la información del sistema (clientes, precios, márgenes, finanzas y proveedores) es confidencial. Esta obligación continúa aun después de terminar la relación con la empresa.",
      ],
    },
    {
      id: "registro",
      title: "Registro de actividad",
      blocks: [
        "El sistema registra los accesos y los cambios (quién, qué y cuándo) por seguridad y auditoría. El usuario acepta este registro.",
      ],
    },
    {
      id: "propiedad",
      title: "Propiedad",
      blocks: [`El sistema, su diseño, su código y su contenido son propiedad de ${COMPANY_NAME}. Todos los derechos reservados.`],
    },
    {
      id: "disponibilidad",
      title: "Disponibilidad",
      blocks: [
        "Procuramos que el sistema esté siempre disponible, pero puede haber interrupciones por mantenimiento o por fallas de proveedores externos. La información se respalda periódicamente.",
      ],
    },
    {
      id: "incumplimiento",
      title: "Incumplimiento",
      blocks: ["El uso indebido puede llevar a la suspensión de la cuenta y a las medidas laborales o legales que correspondan."],
    },
    {
      id: "cambios",
      title: "Cambios",
      blocks: ["Estos términos pueden actualizarse. La versión vigente y su fecha están siempre disponibles en el sistema."],
    },
    {
      id: "ley",
      title: "Ley aplicable y contacto",
      blocks: [
        "Estos términos se rigen por las leyes de la República Dominicana.",
        `Dudas o soporte: ${contact}.`,
      ],
    },
  ],
};

export const LEGAL_DOCS = { privacidad: privacy, terminos: terms } as const;
export type LegalSlug = keyof typeof LEGAL_DOCS;
