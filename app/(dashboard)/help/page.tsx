"use client";

import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  LayoutDashboard,
  Users,
  Truck,
  FileText,
  CalendarDays,
  Package,
  Receipt,
  Wallet,
  CreditCard,
  Landmark,
  BarChart3,
  CheckSquare,
  History,
  Settings,
  ShieldCheck,
  ListFilter,
  PackageCheck,
  Smile,
  Scale,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { IconBadge, type IconBadgeTone } from "@/components/ui/icon-badge";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Section = {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  tone: IconBadgeTone;
  summary: string;
  content: ReactNode;
};

function StatusRow({ items }: { items: { label: string; status?: string; tone?: "success" | "warning" | "danger" | "info" | "neutral" }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Badge key={it.label} status={it.status} tone={it.tone}>
          {it.label}
        </Badge>
      ))}
    </div>
  );
}

/** Texto plano de un pedazo de JSX (para buscar en el manual). */
function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode; items?: unknown[] };
    let text = Children.toArray(props.children).map(nodeText).join(" ");
    if (Array.isArray(props.items)) {
      text +=
        " " +
        props.items
          .map((it) =>
            typeof it === "object" && it !== null && !isValidElement(it) && "label" in it
              ? String((it as { label: string }).label)
              : nodeText(it as ReactNode),
          )
          .join(" ");
    }
    return text;
  }
  return "";
}

/** Minúsculas y sin acentos: "Tasa" = "tasa", "retención" = "retencion". */
function norm(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Todas las palabras buscadas aparecen en el texto. */
function matches(text: string, words: string[]) {
  const t = norm(text);
  return words.every((w) => wordAt(t, w, 0) >= 0);
}

/** Posición de la palabra buscada al inicio de una palabra del texto ("tasa" no encuentra "retasa"). */
function wordAt(text: string, w: string, from: number) {
  let at = text.indexOf(w, from);
  while (at > 0 && /[a-z0-9]/.test(text[at - 1])) at = text.indexOf(w, at + 1);
  return at;
}

/** Resalta en amarillo las palabras buscadas (sin importar acentos ni mayúsculas). */
function highlightText(text: string, words: string[]): ReactNode {
  if (!words.length) return text;
  let flat = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const n = norm(text[i]);
    for (let k = 0; k < n.length; k++) {
      flat += n[k];
      map.push(i);
    }
  }
  const hit = new Array<boolean>(text.length).fill(false);
  for (const w of words) {
    let from = 0;
    for (;;) {
      const at = wordAt(flat, w, from);
      if (at < 0) break;
      for (let j = at; j < at + w.length; j++) hit[map[j]] = true;
      from = at + w.length;
    }
  }
  if (!hit.includes(true)) return text;
  const out: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const on = hit[i];
    let j = i;
    while (j < text.length && hit[j] === on) j++;
    const piece = text.slice(i, j);
    out.push(on ? <mark key={i} className="rounded bg-yellow-200 px-0.5 text-inherit">{piece}</mark> : piece);
    i = j;
  }
  return out;
}

function highlight(node: ReactNode, words: string[]): ReactNode {
  if (!words.length) return node;
  if (typeof node === "string") return highlightText(node, words);
  if (Array.isArray(node)) return node.map((n, i) => <Fragment key={i}>{highlight(n, words)}</Fragment>);
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    if (props.children === undefined || node.type === Bullets) return node;
    return cloneElement(node as ReactElement<{ children?: ReactNode }>, undefined, highlight(props.children, words));
  }
  return node;
}

/**
 * En una búsqueda, de cada módulo se dejan solo los bloques que mencionan lo
 * buscado (las listas se filtran punto por punto).
 */
function filterContent(content: ReactNode, words: string[]): ReactNode {
  if (!words.length) return content;
  const top =
    isValidElement(content) && content.type === Fragment
      ? Children.toArray((content.props as { children?: ReactNode }).children)
      : Children.toArray(content);
  return top
    .filter((child) => matches(nodeText(child), words))
    .map((child, i) => <Fragment key={i}>{highlight(child, words)}</Fragment>);
}

/** Bloques de un módulo para buscar: párrafos sueltos y cada punto de las listas. */
function contentUnits(content: ReactNode): ReactNode[] {
  const top =
    isValidElement(content) && content.type === Fragment
      ? Children.toArray((content.props as { children?: ReactNode }).children)
      : Children.toArray(content);
  return top.flatMap((child) =>
    isValidElement(child) && child.type === Bullets ? (child.props as { items: ReactNode[] }).items : [child],
  );
}

/** Palabras que no ayudan a buscar ("tasa del día" busca "tasa" y "día"). */
const STOP = new Set(["de", "del", "la", "las", "el", "los", "en", "y", "o", "un", "una", "con", "para", "por", "que", "al", "se", "es", "como"]);

/** Palabras que se están buscando (vacío = sin búsqueda). */
const SearchCtx = createContext<string[]>([]);

const LONG = 260;

function BulletItem({ item, words }: { item: ReactNode; words: string[] }) {
  const searching = words.length > 0;
  const [open, setOpen] = useState(false);
  const long = nodeText(item).length > LONG;
  const clamp = long && !open && !searching;
  return (
    <li className="flex gap-2">
      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-muted" />
      <span className="min-w-0">
        <span className={clamp ? "line-clamp-2" : undefined}>{searching ? highlight(item, words) : item}</span>
        {long && !searching && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-0.5 text-xs font-medium text-brand-accent hover:underline"
          >
            {open ? "Ver menos" : "Ver más"}
          </button>
        )}
      </span>
    </li>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  const words = useContext(SearchCtx);
  const shown = words.length ? items.filter((it) => matches(nodeText(it), words)) : items;
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-brand-text">
      {shown.map((it, i) => (
        <BulletItem key={i} item={it} words={words} />
      ))}
    </ul>
  );
}

const SECTIONS: Section[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    tone: "blue",
    summary: "Resumen financiero en vivo de toda la operación.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Es la pantalla de inicio. Muestra tarjetas con los números clave del
          negocio (total por cobrar, total vencido, lo que vence hoy, cuentas
          por pagar, ventas del mes, gastos del mes, utilidad y margen del
          mes, proyectos activos, cotizaciones pendientes), un gráfico de
          cobros vs. pagos de los últimos 6 meses, y listas rápidas: facturas
          vencidas, facturas próximas a vencer, últimos cobros, últimos
          pagos, tareas pendientes y rentabilidad por proyecto (top 5).
        </p>
        <Bullets
          items={[
            <><strong>Disponible en bancos (pesos)</strong> y <strong>(dólares)</strong>: el dinero que hay hoy en las cuentas de ahorro y corrientes, cada moneda por separado (no incluye tarjetas de crédito). Al hacer clic abre Bancos.</>,
            "Todos los números son en vivo — no es un corte histórico, se recalculan en cada visita.",
            <>
              <strong>Diseño en dos zonas</strong>: arriba una franja de{" "}
              <strong>indicadores</strong> compactos (hasta 5 por fila) y debajo
              los <strong>gráficos y listas</strong> en 3 columnas. Cada indicador
              trae una línea de detalle y, cuando aplica, un anillo con un %:
              Ventas = cuánto se cobró este mes frente a lo facturado; Gastos = %
              de las ventas; Margen = utilidad sobre ventas; Por cobrar / Total
              vencido = qué parte de lo pendiente ya está vencida.
            </>,
            <>
              <strong>Flujo financiero</strong>: cobros (verde) y pagos (rojo) de
              los últimos 6 meses, con los totales, el neto y cuánto subieron o
              bajaron los cobros de este mes frente al anterior.{" "}
              <strong>Por cobrar según vencimiento</strong>: barras con lo
              vencido, lo que vence hoy, próximos 7 días, 8 a 15 y 16 a 30 días.
            </>,
            <>
              <strong>Personalizar</strong> (arriba a la derecha): elige qué ver y
              en qué orden (arrastrando en la lista). Los indicadores siguen ese
              orden en la franja de arriba; los gráficos y listas, debajo. Para
              gráficos y listas el tamaño decide el ancho: Chico o Mediano = 1
              columna, Grande = 2 columnas.
            </>,
            "Cada panel tiene \"Ver ›\" para abrir el módulo correspondiente, y los indicadores llevan al listado relacionado.",
            "Las tarjetas de proyectos activos y cotizaciones pendientes son atajos: llevan directo al listado filtrado.",
          ]}
        />
      </>
    ),
  },
  {
    id: "uso-general",
    label: "Cómo se usan las pantallas",
    icon: ListFilter,
    tone: "blue",
    summary: "Resúmenes, filtros, páginas y fechas: igual en todos los módulos.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Todos los listados (Clientes, Proveedores, Cotizaciones, Proyectos,
          Facturas, Gastos, Bancos, Tareas, Productos y servicios) funcionan
          igual, para que aprendas una vez y lo uses en todas partes.
        </p>
        <Bullets
          items={[
            <><strong>Tarjetas de resumen</strong> arriba de cada listado: los números clave del módulo (por ejemplo, por cobrar, vencido, en seguimiento).</>,
            <><strong>Filtros por estado</strong> como botones con su cantidad (ej. <em>Borrador 3</em>). Haz clic en uno para ver solo esos; <em>Todos</em> quita el filtro.</>,
            <><strong>Filtro por cliente</strong> (Cotizaciones, Facturas y Proyectos): se aplica al elegirlo, sin botón adicional. <em>Limpiar filtros</em> vuelve a la vista completa.</>,
            <><strong>Buscador en vivo</strong> (Clientes, Proveedores, Productos y servicios, Configuración → Categorías y Tipos de servicio): la lista se filtra <strong>mientras escribes</strong>, sin pulsar Enter. Con escribir &ldquo;an&rdquo; ya aparece todo lo que lo contiene; mientras carga se ve un circulito girando. Se combina con los demás filtros y vuelve a la página 1. <em>Limpiar</em> o borrar el texto muestra todo de nuevo.</>,
            <><strong>Páginas</strong>: se muestran 25 registros por página. Abajo aparece <em>Mostrando 1–25 de N</em> con <em>Anterior</em> y <em>Siguiente</em>; los filtros se mantienen al cambiar de página.</>,
            <><strong>Explicación de los botones</strong>: pasa el mouse por encima de un botón de acción (sin hacer clic) y aparece un globo que explica en pocas palabras qué hace, por ejemplo <em>Emitir factura</em>, <em>Registrar cobro</em> o, en Monedas y tasas, <em>Guardar tasa</em>, <em>Agregar moneda</em>, <em>Desactivar</em> y <em>Borrar</em>.</>,
            <><strong>Etiquetas de tiempo</strong>: fechas legibles (24 sept 2026) con avisos como <em>Vence en 3 días</em> (ámbar) o <em>Vencida hace 2 días</em> (rojo).</>,
            <><strong>Fecha del día por defecto</strong>: al crear una factura, cotización, gasto, cobro, pago o movimiento de banco, la fecha ya viene con el día de hoy (hora de República Dominicana). Puedes cambiarla si hace falta.</>,
            <>Dentro de cada registro (proyecto, cliente, proveedor, factura…) el encabezado resume lo importante y las <strong>pestañas</strong> agrupan el resto de la información.</>,
            <><strong>Filtros sin resultados</strong>: si un filtro no encuentra nada, aparece un aviso amarillo <em>&ldquo;No se encontraron … con los filtros aplicados&rdquo;</em> con el botón <strong>Limpiar filtros</strong>. Así sabes que la lista está vacía por el filtro y no porque no existan registros. Desde ese aviso <strong>no tienes que limpiar</strong>: si eliges otra opción en los filtros de arriba (otro estado, otro cliente, otra categoría…), se busca <strong>solo por esa opción</strong> y se muestran sus registros. Mientras la lista sí tiene resultados, los filtros se combinan (ej. estado + cliente). En Bancos, los números de cada botón de filtro ya cuentan los otros filtros activos, así un 0 te avisa antes de hacer clic. Aplica a todos los listados, al detalle de cada cuenta de banco y a los reportes.</>,
            <><strong>Volver al proyecto</strong>: todo lo que abras desde un proyecto (una factura, cotización, gasto, proveedor o el cliente) o crees desde él (<em>Nueva factura</em>, <em>Nuevo gasto</em>) muestra arriba <em>&ldquo;← Volver al proyecto&rdquo;</em> y te regresa a la pestaña del proyecto donde estabas. Una factura nueva creada desde el proyecto ya viene con el proyecto elegido.</>,
            <><strong>Pasos de avance</strong> (Facturas, Cotizaciones, Proyectos y Clientes): cada paso <strong>completado se pinta en verde</strong> con ✓, el paso en curso en azul y los que faltan en gris. Al llegar al último paso (Pagada, Proyecto, Completado o Cliente) también queda en verde, porque ya se completó. Si una factura está vencida, su paso en curso se ve en rojo.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    tone: "violet",
    summary: "Leads, prospectos y clientes, con sus contactos.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Cada cliente tiene dos datos independientes. La <strong>Etapa</strong>{" "}
          indica dónde está en el proceso comercial: <strong>Lead</strong> →{" "}
          <strong>Prospecto</strong> → <strong>Cliente</strong>. El{" "}
          <strong>Estado</strong> indica si está operativo:{" "}
          <strong>Activo</strong> o <strong>Inactivo</strong> — un Lead puede
          estar Activo o Inactivo sin dejar de ser Lead. Cada cliente puede
          tener varios contactos (nombre, cargo, teléfono, correo) para saber
          a quién llamar según el caso.
        </p>
        <StatusRow
          items={[
            { label: "Lead", tone: "info" },
            { label: "Prospecto", tone: "warning" },
            { label: "Cliente", tone: "success" },
          ]}
        />
        <Bullets
          items={[
            <>
              La Etapa avanza con los botones <strong>Marcar prospecto</strong>{" "}
              y <strong>Convertir en cliente</strong> — no hace falta editarla a
              mano, y nunca retrocede sola.
            </>,
            "Desactivar un cliente no borra su historial de cotizaciones, proyectos o facturas, ni cambia su Etapa — solo lo marca como Inactivo y lo puedes Reactivar cuando quieras.",
            "El listado se puede filtrar por etapa, por estado (activos / inactivos) y buscar por nombre. Muestra, por cliente, sus proyectos activos y lo que tiene por cobrar.",
            <>En el detalle del cliente, la <strong>Etapa comercial</strong> se ve como pasos: haz clic en la siguiente etapa para avanzar. Debajo están sus números (cotizado aprobado, facturado, por cobrar, vencido y proyectos activos) y pestañas con sus <strong>Cotizaciones</strong>, <strong>Facturas</strong>, <strong>Proyectos</strong>, <strong>Entregas</strong> (acuses de recibo) y <strong>Documentos</strong>.</>,
            <>Desde el cliente, <strong>Nueva cotización</strong> y <strong>Nueva factura</strong> abren el formulario con ese cliente ya elegido.</>,
            "Se pueden importar clientes en lote desde un archivo CSV (botón Importar CSV).",
          ]}
        />
      </>
    ),
  },
  {
    id: "entregas",
    label: "Entregas y acuses",
    icon: PackageCheck,
    tone: "violet",
    summary: "Registrar lo que se entrega a un cliente, imprimir el acuse y adjuntarlo firmado.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Para dejar constancia de lo que se le entrega a un cliente: <strong>documentos</strong> (facturas,
          certificaciones, RPE…), <strong>equipos</strong>, <strong>materiales</strong> u <strong>otros artículos</strong>.
          Cada entrega genera un <strong>acuse de recibo</strong> con el formato de Mindfreak (número ACU-0001, destinatario,
          fecha, referencia, tabla numerada y recuadros de firma <em>Entregado por</em> / <em>Recibido por</em> con espacio
          para el sello), que se imprime, se firma a mano y luego se adjunta firmado. Menú: <strong>Comercial → Entregas y
          acuses</strong>, o desde el cliente en la pestaña <strong>Entregas</strong>.
        </p>
        <StatusRow
          items={[
            { label: "Borrador", tone: "warning" },
            { label: "Pendiente de firma", tone: "info" },
            { label: "Firmado", tone: "success" },
            { label: "Anulado", tone: "danger" },
          ]}
        />
        <Bullets
          items={[
            <><strong>Nuevo acuse</strong>: eliges el cliente (y si quieres el proyecto), qué se entrega, la fecha y el lugar. El <strong>destinatario</strong> se llena con el nombre del cliente; puedes poner el nombre completo de la institución, sus <strong>siglas</strong> (van en el recuadro «Recibido por»), el <strong>departamento</strong> y una <strong>referencia</strong> (ej. número de orden de compra).</>,
            <><strong>Líneas</strong>: una por cada cosa entregada, con descripción, referencia (en equipos, el número de serie) y cantidad. Se numeran 01, 02, 03… y abajo sale el <strong>total entregado</strong>. Las flechas cambian el orden y la papelera quita la línea. En acuses de documentos la columna de cantidad no sale en el PDF si todo es 1.</>,
            <><strong>Textos del acuse</strong> (opcional): subtítulo, párrafo de entrada, nota, ejemplares y quién entrega (nombre y cédula). Si los dejas vacíos se usan los textos del modelo, que se arman solos con el destinatario, el tipo y la referencia.</>,
            <><strong>Imprimir / descargar PDF</strong>: abre el acuse en otra pestaña para imprimirlo o guardarlo. Un borrador sale con la marca de agua «BORRADOR» y uno anulado con «ANULADO».</>,
            <><strong>Pasos</strong>: Borrador → <strong>Marcar como pendiente de firma</strong> (cuando ya lo imprimiste y lo entregaste) → <strong>Adjuntar acuse firmado</strong> (PDF escaneado o foto; opcional: quién lo recibió, cargo y fecha/hora). Al adjuntarlo el acuse queda <strong>Firmado</strong> y el archivo se guarda en el acuse (no se puede borrar; se puede subir otra copia). Los pasos completados se ven en verde.</>,
            <>Mientras no esté firmado se puede <strong>Editar</strong> (si ya lo imprimiste, vuelve a imprimirlo) o <strong>Volver a borrador</strong>. Un borrador se puede <strong>Descartar</strong>. <strong>Duplicar</strong> crea uno nuevo en borrador con la fecha de hoy y las mismas líneas. <strong>Anular</strong> (solo Admin y Gerente) lo deja en el historial como anulado.</>,
            <>En el <strong>cliente → pestaña Entregas</strong> está el historial de todo lo entregado a ese cliente, con su estado y quién lo recibió; <strong>Nuevo acuse</strong> abre el formulario con el cliente ya elegido y al guardar vuelves al cliente.</>,
            "El listado se filtra por estado, cliente y tipo, y el buscador (número, referencia o destinatario) filtra mientras escribes. Arriba: total de acuses, pendientes de firma, firmados (y cuántos este mes) y borradores.",
            "Permisos: ver (todos los roles); crear, editar, imprimir y adjuntar el firmado (Admin, Gerente, Ventas y Operaciones); anular (Admin y Gerente).",
          ]}
        />
      </>
    ),
  },
  {
    id: "encuesta",
    label: "Encuesta de satisfacción",
    icon: Smile,
    tone: "teal",
    summary: "Encuesta al cliente al cerrar el evento: se envía sola, el cliente responde sin cuenta y las respuestas quedan en el proyecto.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Al finalizar un proyecto el sistema pregunta <strong>«¿Deseas enviar la encuesta de satisfacción al cliente?»</strong>.
          Si dices que sí, se le manda al cliente un correo con el logo y los colores de la empresa y un botón
          <strong> Responder encuesta</strong>. El cliente la contesta desde el celular o la computadora, <strong>sin iniciar
          sesión</strong>, en una página propia del ERP (no es Google Forms). Las respuestas quedan en el proyecto, en la
          pestaña <strong>Satisfacción del cliente</strong>.
        </p>
        <StatusRow
          items={[
            { label: "Pendiente", tone: "warning" },
            { label: "Enviada", tone: "info" },
            { label: "Respondida", tone: "success" },
            { label: "Cancelada", tone: "danger" },
          ]}
        />
        <Bullets
          items={[
            <><strong>Al finalizar</strong>: en el proyecto, en «Avance del proyecto», haz clic en <strong>Completado</strong>. Sale la ventana <strong>Finalizar proyecto</strong> con la encuesta <strong>activada por defecto</strong> y a quién se le enviará; puedes desactivarla antes de confirmar. El proyecto se finaliza aunque el correo falle.</>,
            <><strong>A quién</strong>: al contacto del proyecto; si no tiene correo, al contacto principal del cliente con correo; si no, al correo del cliente. El <strong>nombre y el correo se pueden cambiar</strong> antes de enviar (en la ventana de finalizar, en <strong>Enviar encuesta</strong> y en <strong>Reenviar</strong>, que corrige el destinatario y manda el mismo enlace). Si no hay ningún correo, la encuesta se crea igual como <strong>Pendiente</strong> y puedes <strong>Copiar enlace</strong> para mandarlo por WhatsApp.</>,
            <><strong>Enviar por</strong>: <strong>Correo</strong>, <strong>WhatsApp</strong> o ambos (se eligen en la ventana de finalizar y en Enviar encuesta). <strong>No es obligatorio el correo</strong>: con solo WhatsApp se abre tu WhatsApp (web o del celular) con el número del cliente y el mensaje con el enlace ya escritos; solo tocas Enviar y la encuesta queda como <strong>Enviada</strong>. Sin número, WhatsApp te deja elegir el chat. Después puedes usar <strong>Enviar/Reenviar por WhatsApp</strong> y <strong>Enviar/Reenviar correo</strong> en cualquier orden, siempre con el mismo enlace. El mensaje se cambia en Configuración (debe llevar {"{enlace}"}).</>,
            <><strong>El enlace</strong> es único y secreto (ej. /encuesta/x7Fk…); no muestra datos internos. Se puede responder <strong>una sola vez</strong>: si se abre de nuevo, dice que ya fue respondida.</>,
            <><strong>Pestaña Satisfacción del cliente</strong>: estado, a quién se envió, fechas (creada, enviada, abierta por el cliente, respondida) y quién la envió. Cuando el cliente responde: <strong>calificación general</strong> (promedio de las preguntas de 1 a 5), <strong>NPS</strong> (si está activa la pregunta de 0 a 10: Promotor, Pasivo o Detractor), si nos <strong>recomendaría</strong>, si <strong>autoriza testimonio</strong>, los <strong>comentarios</strong> y todas las respuestas.</>,
            <><strong>Acciones</strong>: <strong>Reenviar</strong> (mismo enlace, sirve de recordatorio), <strong>Copiar enlace</strong>, <strong>Cancelar</strong> (el enlace deja de aceptar respuestas), <strong>Reabrir</strong> (para que el cliente responda de nuevo; las respuestas nuevas reemplazan las anteriores) y <strong>Enviar otra encuesta</strong> (con aviso, para no duplicar). Si el proyecto ya tiene una encuesta enviada o respondida, la ventana de finalizar lo advierte y deja la opción desmarcada.</>,
            <>Cuando el cliente responde, llega una <strong>notificación</strong> (campana) al encargado del proyecto y a quien la envió.</>,
            <><strong>Configuración → Encuesta de satisfacción</strong>: las <strong>preguntas</strong> (agregar, editar, subir/bajar, obligatoria u opcional, desactivar, eliminar; si una ya tiene respuestas se desactiva en vez de borrarse) con su tipo (1 a 5, 0 a 10, texto corto, párrafo, opción única, varias opciones, Sí/No) y el <strong>indicador</strong> al que cuenta; si se ofrece <strong>por defecto</strong>; y los <strong>textos</strong> del correo y de la página, con {"{cliente}"}, {"{proyecto}"}, {"{empresa}"} y {"{contacto}"}. Los cambios aplican a las encuestas nuevas; las ya enviadas conservan sus preguntas.</>,
            "Todo queda en la auditoría del proyecto: creada, enviada, reenviada, cancelada, reabierta y respondida.",
            "Permisos: ver (todos los roles); enviar, reenviar, cancelar y reabrir (Admin, Gerente, Ventas y Operaciones); configurar preguntas y textos (Admin y Gerente).",
          ]}
        />
      </>
    ),
  },
  {
    id: "proveedores",
    label: "Proveedores",
    icon: Truck,
    tone: "teal",
    summary: "Empresas o personas que le prestan servicios a Mindfreak Events.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Aquí se registran los proveedores: quién les provee transporte,
          renta de equipos, catering, etc. Cada proveedor guarda su banco,
          número de cuenta y tipo de servicio — útil a la hora de hacerles un
          pago o de ver en Reportes cuánto se le ha pagado a cada uno.
        </p>
        <Bullets
          items={[
            "Igual que Clientes, cada proveedor puede tener varios contactos.",
            <><strong>Categoría y Tipo de servicio</strong>: al crear o editar un proveedor eliges su <strong>Categoría</strong> de la lista de Configuración → Categorías y luego su <strong>Tipo de servicio</strong>, que solo muestra los tipos de esa categoría. Ejemplo: <em>Sonus Eventos</em> → Categoría <em>Audiovisuales</em> → Tipo de servicio <em>Alquiler de sonido</em>. Las dos listas tienen <strong>buscador</strong>: haz clic y escribe (sin importar acentos). La categoría también se encuentra escribiendo uno de sus servicios: al escribir &ldquo;drones&rdquo; aparece <em>Fotografía y video · Incluye: Drones</em>, y al elegirla queda elegido también el tipo de servicio <em>Drones</em>.</>,
            <><strong>Sugerencia por el nombre del negocio</strong>: al escribir el <strong>Nombre del negocio</strong> el sistema propone la categoría y el tipo de servicio. Ejemplo: <em>Alberto Sistemas de Incendio</em> → <em>Seguridad de instalaciones → Sistemas contra incendios</em> (por la palabra &ldquo;incendio&rdquo;), y debajo ofrece otras opciones como botones (<em>Salud y emergencias → Prevención de incendios</em>). Se basa en las palabras del nombre (DJ, flores, catering, bufete, sonido, fumigadora…) y en los nombres del catálogo. Es solo una sugerencia: si eliges la categoría a mano ya no la cambia. En un proveedor que ya tenía categoría no se cambia nada. <strong>Persona de contacto</strong> (opcional, al crear): se guarda como contacto principal.</>,
            <><strong>Información fiscal</strong> (al crear o editar el proveedor): al escribir el <strong>RNC/Cédula</strong> (con o sin guiones) el sistema reconoce si es un RNC (9 dígitos → sugiere <em>Persona Jurídica</em>) o una Cédula (11 dígitos → sugiere <em>Persona Física</em>) y avisa si el último dígito no cuadra (posible error al escribir). Son <strong>sugerencias</strong>: puedes cambiarlas. La <strong>condición fiscal</strong> (Registrado DGII, Informal, RST) la confirmas tú: tener Cédula no significa ser informal. Indica también si <strong>emite factura electrónica (e-CF)</strong> y si es del <strong>extranjero</strong> (entonces pide país e identificación extranjera y oculta lo que no aplica). Cada campo tiene un <strong>ⓘ</strong> que explica qué significa. Con estos datos el sistema sabrá qué retenciones aplicar al pagarle. En el detalle se ve, por ejemplo, <em>Persona Física · Registrado DGII · Emite e-CF</em>, o el aviso <em>Información fiscal pendiente</em>.</>,
            <>Si el tipo de servicio no está en la lista, agrégalo en <strong>Configuración → Tipos de servicio</strong> (uno por uno o en lote con un CSV) y recarga la página del proveedor.</>,
            <>Al pulsar <strong>Guardar cambios</strong> aparece el aviso verde &ldquo;Cambios del proveedor guardados&rdquo; y al lado del botón <strong>Guardado</strong>; la categoría y el tipo quedan mostrando lo guardado (también si la categoría no tiene tipos de servicio), sin tener que refrescar.</>,
            <>No hay una lista aparte de &ldquo;categorías de eventos&rdquo;: la categoría del proveedor es la <strong>misma lista</strong> de Configuración → Categorías que usan los gastos y Bancos (ahí están Audiovisuales, Iluminación, Catering y alimentos, etc.). Así el gasto de un proveedor y su pago salen solos con la categoría correcta.</>,
            <>Al registrar un <strong>gasto nuevo</strong> y elegir el proveedor, la categoría del gasto se llena sola con la del proveedor (puedes cambiarla antes de guardar). Así el pago en Bancos también sale con esa categoría.</>,
            "El listado muestra, por proveedor, cuánto se le ha gastado y cuánto se le debe (por pagar), con búsqueda y filtro de activos/inactivos.",
            <>El detalle del proveedor tiene sus números (total gastado, pagado, por pagar y proyectos) y pestañas con sus <strong>Gastos</strong>, <strong>Pagos</strong> y <strong>Documentos</strong>.</>,
            "Importación en lote por CSV disponible, igual que en Clientes. Las columnas category y service_type se enlazan con los catálogos de Configuración y, si no existen, se crean.",
          ]}
        />
      </>
    ),
  },
  {
    id: "cotizaciones",
    label: "Cotizaciones",
    icon: FileText,
    tone: "violet",
    summary: "Propuestas de precio a un cliente, con flujo de aprobación.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Una cotización se arma con ítems (servicios/productos), y puede
          llevar impuesto, comisión y descuento. Sigue un flujo de estados
          desde que se crea hasta que el cliente decide:
        </p>
        <StatusRow
          items={[
            { label: "Borrador", status: "DRAFT" },
            { label: "Enviada", status: "SENT" },
            { label: "Negociando", status: "NEGOTIATING" },
            { label: "Aprobada", status: "APPROVED" },
            { label: "Rechazada", status: "REJECTED" },
            { label: "Expirada", status: "EXPIRED" },
            { label: "Cancelada", status: "CANCELLED" },
          ]}
        />
        <Bullets
          items={[
            "Mientras está en Borrador se puede editar libremente; una vez enviada, los cambios importantes quedan registrados.",
            <><strong>Negociando</strong>: si el cliente pide cambios después de enviada, pulsa <strong>Pasar a negociación</strong>; así puedes editar líneas y precios. Luego <strong>Marcar como enviada de nuevo</strong>, o directamente Aprobar o Rechazar.</>,
            <><strong>Expirada</strong> se calcula sola: una cotización Enviada o Negociando cuya fecha de validez ya pasó se ve como Expirada en la lista, el filtro y el detalle. <strong>Se puede aprobar igual</strong> si el cliente acepta tarde (o duplicarla con fecha nueva).</>,
            <>
              Aprobar una cotización requiere el permiso{" "}
              <code className="rounded bg-brand-surface-hover px-1 py-0.5 text-xs">
                quotations.approve
              </code>{" "}
              — normalmente un rol de supervisor o admin.
            </>,
            <>
              Una cotización aprobada se puede convertir directamente en un{" "}
              <strong>Proyecto</strong> con el botón de conversión, sin volver
              a capturar los datos del cliente ni los ítems.
            </>,
            "El listado resume lo que está en seguimiento (enviadas, vistas o negociando), lo aprobado, los borradores y la tasa de aprobación, y avisa cuántos días de validez le quedan a cada cotización abierta.",
            <>En el detalle, los pasos <em>Borrador → Enviada → Aprobada → Proyecto</em> muestran en qué punto está. Los botones principales (enviar, aprobar, rechazar, convertir) están a la izquierda y los secundarios (compartir, duplicar, cancelar) a la derecha. El resumen de totales, la condición de pago y las condiciones quedan en la columna derecha.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: "proyectos",
    label: "Proyectos / Eventos",
    icon: CalendarDays,
    tone: "violet",
    summary: "El evento en sí — se crea directo o desde una cotización aprobada.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Un proyecto es el evento que se va a ejecutar. Tiene un responsable
          asignado, fechas, y acumula lo cotizado, lo facturado, lo cobrado y
          el costo real (gastos asociados), de donde sale la utilidad real y
          el margen — visibles también en el reporte de Rentabilidad.
        </p>
        <StatusRow
          items={[
            { label: "Planificación", status: "PLANNING" },
            { label: "Confirmado", status: "CONFIRMED" },
            { label: "En curso", status: "IN_PROGRESS" },
            { label: "Completado", status: "COMPLETED" },
            { label: "Cancelado", status: "CANCELLED" },
          ]}
        />
        <Bullets
          items={[
            "Se puede crear un proyecto directo (sin pasar por cotización) o convertir una cotización ya aprobada. Arriba del listado aparecen las cotizaciones aprobadas que todavía no tienen proyecto, con su botón Convertir en proyecto.",
            "Los gastos que se le cargan a un proyecto son los que determinan su costo real y utilidad.",
            "El listado se puede filtrar por estado y por cliente, y muestra cuánto falta para cada evento (Mañana, En 5 días, Hace 3 días en rojo si el proyecto sigue abierto).",
            <>En el detalle, el estado se cambia haciendo clic en los pasos <em>Planificación → Confirmado → En curso → Completado</em>. <strong>Cancelar proyecto</strong> es un botón aparte que pide confirmación; un proyecto cancelado se puede reactivar.</>,
            <>Siempre visibles: presupuesto (con barra de lo gastado), facturado, cobrado (y lo que falta por cobrar) y utilidad real. Pestañas: Resumen, Finanzas, Ventas y cobros, Gastos y proveedores, Bancos, Tareas, Documentos y Actividades.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: "servicios",
    label: "Productos y Servicios",
    icon: Package,
    tone: "teal",
    summary: "El catálogo que se usa para armar cotizaciones y facturas.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Es el catálogo reutilizable de lo que Mindfreak Events vende:
          servicios y productos con su precio, para no tener que escribirlos
          desde cero cada vez que se arma una cotización o una factura.
        </p>
        <Bullets
          items={[
            "Se pueden organizar por categoría y filtrar por tipo (servicio o producto), categoría o nombre.",
            "Cada uno muestra su margen (precio vs. costo por defecto) en verde, ámbar o rojo.",
            "Un cambio de precio aquí no altera cotizaciones o facturas ya emitidas — esas quedan congeladas al valor con el que se crearon.",
          ]}
        />
      </>
    ),
  },
  {
    id: "facturas",
    label: "Facturas",
    icon: Receipt,
    tone: "green",
    summary: "Ligadas a un cliente y, opcionalmente, a un proyecto/evento.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Una factura se emite a un cliente, casi siempre asociada a un
          proyecto. Puede ser factura regular o electrónica (e-CF, DGII), y
          lleva su propio impuesto, comisión y descuento igual que una
          cotización.
        </p>
        <StatusRow
          items={[
            { label: "Borrador", status: "DRAFT" },
            { label: "Emitida", status: "ISSUED" },
            { label: "Parcial", status: "PARTIALLY_PAID" },
            { label: "Pagada", status: "PAID" },
            { label: "Vencida", status: "OVERDUE" },
            { label: "Cancelada", status: "CANCELLED" },
          ]}
        />
        <Bullets
          items={[
            <><strong>Borrador → Emitir</strong>: mientras está en Borrador puedes agregar o quitar líneas y editar NCF y vencimiento. El botón <strong>Emitir factura</strong> la hace oficial: ya no se edita, empieza a contar el vencimiento, aparece en Por cobrar y se le pueden registrar cobros.</>,
            <><strong>¿Y &ldquo;enviada&rdquo;?</strong> Las facturas no tienen estado &ldquo;Enviada&rdquo; (las cotizaciones sí, porque el cliente todavía tiene que aceptarlas). Para mandársela al cliente usa <strong>Compartir</strong> (enlace sin acceso al sistema) o el PDF, siempre <strong>después de emitirla</strong>, para que reciba la versión definitiva.</>,
            <><strong>Marcar como enviada al cliente</strong>: después de mandarla, pulsa este botón en el detalle de la factura. Queda anotado <em>&ldquo;Enviada al cliente el 27 sept 2026, 12:49 p. m. por (tu nombre)&rdquo;</em> y en la lista aparece un sobre verde junto al número. Es solo una marca de control para la gestión de cobro (saber si el cliente ya la recibió): <strong>no cambia el estado</strong> de la factura, que sigue Emitida, Pago parcial, Pagada o Vencida según sus cobros. Solo aparece en facturas ya emitidas (no en borradores ni canceladas). Si la marcaste por error, usa <strong>Quitar marca de enviada</strong>.</>,
            "El balance pendiente baja automáticamente a medida que se registran cobros contra esa factura.",
            "Una factura vencida es la que pasó su fecha de vencimiento sin liquidarse — aparece en el Dashboard y en el reporte de Vencimientos.",
            "Se puede compartir un enlace de la factura sin dar acceso al sistema completo (botón de compartir en el detalle).",
            "El listado resume lo que hay por cobrar, lo vencido, lo que vence en 7 días y los borradores, y marca cada factura con su situación (Vence en 3 días / Vencida hace 2 días).",
            <><strong>Vencida</strong> se calcula sola por la fecha: una factura Emitida o con Pago parcial, con balance pendiente y fecha de vencimiento ya pasada, aparece como <strong>Vencida</strong> (etiqueta roja) en la lista, el filtro, el detalle, la ficha del cliente y el reporte de Cuentas por cobrar. Sigue aceptando pagos; al pagarla completa pasa a Pagada. Los borradores no cuentan como vencidos.</>,
            <>En el detalle, los pasos <em>Borrador → Emitida → Pago parcial → Pagada</em> muestran el avance (cada paso completado queda en verde con ✓, el paso en curso en azul y en rojo si está vencida; al terminar de pagar, <em>Pagada</em> también queda en verde). En la columna derecha están el resumen con la barra de lo pagado, NCF/vencimiento (en borrador) y la <strong>Gestión de cobro</strong> con su historial.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: "cobros-pagos",
    label: "Cobros y pagos",
    icon: Wallet,
    tone: "green",
    summary: "El dinero que entra de clientes y el que sale a proveedores.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Un <strong>cobro</strong> es el dinero que un cliente paga contra
          una o varias facturas. Un <strong>pago a proveedor</strong> es lo
          contrario: lo que Mindfreak Events le paga a un proveedor por un
          gasto ya registrado. Ambos actualizan automáticamente el balance de
          la factura o el gasto correspondiente y quedan reflejados en
          Bancos.
        </p>
        <Bullets
          items={[
            "Cada cobro o pago se registra en la moneda en la que ocurrió, con su tasa de cambio congelada si es distinta a la moneda base de la empresa.",
            <><strong>Regla del banco: cada cuenta se mueve solo en su moneda.</strong> Una cuenta en dólares solo baja o sube en dólares; la factura o el gasto se quedan en su moneda. Se puede <strong>pagar un gasto</strong> y <strong>cobrar una factura</strong> con una cuenta en otra moneda (ver abajo): el sistema pide cuánto se movió realmente en el banco.</>,
            <><strong>Pago en moneda diferente</strong> (ej. un gasto de RD$97,000 pagado desde Promerica USD): al elegir la cuenta aparece el recuadro <em>Pago en moneda diferente</em>. Muestra el monto a pagar en la moneda del gasto, la <strong>tasa de referencia</strong> del día (la de Configuración → Monedas y tasas; se puede cambiar y queda marcada como manual) y el <strong>débito estimado</strong> (US$1,649.66). Tú escribes <strong>cuánto debitó realmente el banco</strong> (US$1,650) y, si hubo, la <strong>comisión</strong> (US$5). El sistema calcula la <strong>tasa efectiva</strong> (1 USD = 58.787879) y la <strong>diferencia informativa</strong> contra la referencia (RD$20; positiva = salió más de lo esperado). Resultado: el gasto baja RD$97,000; la cuenta baja US$1,650 y, aparte, US$5 de comisión en la categoría <em>Comisiones bancarias</em>. Diferencias de hasta la tolerancia (RD$1.00) se guardan como <strong>redondeo</strong>. La diferencia informativa <strong>no</strong> es una ganancia o pérdida contable. En el detalle del gasto, la columna <em>Salió del banco</em> muestra el monto en la moneda de la cuenta, la tasa efectiva y la diferencia. Lo mismo aplica al crear un gasto <strong>ya pagado</strong> con una cuenta o tarjeta en otra moneda (el cálculo usa el neto a pagar).</>,
            <><strong>Cobro en moneda diferente</strong> (ej. una factura de US$1,000 que el cliente pagó en tu cuenta en pesos): al elegir la cuenta aparece el recuadro <em>Cobro en moneda diferente</em> con la tasa de referencia del día y el <strong>crédito estimado</strong> (RD$58,800 a 58.80). Tú escribes <strong>cuánto entró realmente al banco</strong> (RD$58,500) y, si el banco cobró algo por recibirlo, la <strong>comisión del banco</strong>. Resultado: la factura baja US$1,000 (queda Pagada); la cuenta sube RD$58,500 y, aparte, baja la comisión en <em>Comisiones bancarias</em>. Tasa efectiva 1 USD = 58.50; diferencia informativa RD$300 (positiva = entró menos de lo esperado; negativa = entró más). Igual que en los pagos, no es ganancia ni pérdida contable y lo que esté dentro de la tolerancia se guarda como redondeo. En el detalle de la factura, la columna <em>Entró al banco</em> muestra el monto en la moneda de la cuenta, la comisión, la tasa efectiva y la diferencia. El cobro debe ser del mismo cliente de la factura y no puede ir a una tarjeta de crédito.</>,
            <><strong>Si falta la tasa o el monto del banco</strong>: al guardar sale una ventana roja <em>Falta un dato</em> y el campo vacío queda marcado en rojo (tasa de referencia, monto que debitó o entró en el banco, tasa del documento o monto recibido en una transferencia entre monedas). Si la tasa estaba vacía, al cerrar la ventana vuelve a aparecer sola: la de la fecha del pago o, si esa fecha no tiene, la <strong>tasa del día</strong> (con el aviso <em>revísala</em>). Pasa con cada error, aunque la hayas borrado antes. También puedes pulsar <strong>↻ Usar tasa del día</strong> al lado de la tasa cuando está vacía o cambiada a mano.</>,
            <><strong>Cómo está ordenado Registrar pago</strong>: <strong>1 Datos del pago</strong> (fecha, monto y método) · <strong>2 Cuenta de donde sale el dinero</strong> (o <em>Tarjeta con que se paga</em>; aquí aparecen la referencia, el recuadro de moneda diferente y lo disponible) · <strong>3 Proveedor (opcional)</strong>, con <em>Cancelar</em> y <em>Registrar pago</em> abajo a la derecha. <em>Registrar cobro</em> en una factura sigue el mismo orden: Datos del cobro · Cuenta donde entra el dinero · Clasificación.</>,
            <><strong>Cancelar</strong>: en <em>Registrar pago</em> (gasto) y <em>Registrar cobro</em> (factura), el botón <strong>Cancelar</strong> borra lo que escribiste y quita el error, sin guardar nada. Ya no hace falta salir de la página.</>,
            <><strong>Pagar después con tarjeta</strong>: un gasto pendiente también se puede pagar más tarde con una <strong>tarjeta de crédito</strong>. En <em>Registrar pago</em> elige el método <em>Tarjeta</em>: la lista muestra <strong>solo tus tarjetas</strong> (con cualquier otro método, solo las cuentas de banco). Debajo de la lista, el filtro <strong>Ver moneda</strong> (DOP · USD · Todas) arranca en la moneda del gasto para no elegir por error una cuenta en otra moneda. El pago sube la deuda de la tarjeta (si no alcanza el crédito disponible, sale <em>Crédito insuficiente</em> y no se registra). Si la tarjeta está en otra moneda, aparece el recuadro de moneda diferente. La tarjeta <em>Cómo se pagó</em> muestra el método y la cuenta de los pagos reales.</>,
            <><strong>Configuración → Monedas y tasas</strong>: monedas que usa la empresa (DOP y USD activas; se pueden agregar otras como EUR), la <strong>tasa de referencia</strong> de cada día (siempre &ldquo;1 USD = 58.80 DOP&rdquo;), de dónde sale (Banco Central/DGII, banco, manual u otra) y la <strong>tolerancia de redondeo</strong>. Cada operación guarda su propia tasa: cambiar o borrar una tasa no modifica lo ya registrado. La moneda funcional (la de los reportes) se elige en Organización y ya no se puede cambiar cuando hay documentos. Si eliges <em>Otra fuente</em>, escribe su nombre (ej. Infodolar). <strong>Borrar</strong> una moneda solo se puede si nunca se usó (sin cuentas, documentos ni movimientos); si ya se usó, el sistema te lo explica y la puedes <strong>desactivar</strong>. Al crear una <strong>cotización, factura o gasto</strong>, la moneda viene en pesos (la de la empresa); si eliges otra, la <strong>tasa se llena sola</strong> con la tasa del día y la puedes cambiar.</>,
            "No se puede cobrar o pagar más del balance pendiente.",
            "La pantalla Cobros y pagos resume lo cobrado y pagado en el mes, el neto del mes y lo cobrado en el año, con dos pestañas: Cobros de clientes y Pagos a proveedores.",
            "Cada cobro o pago genera su movimiento en Bancos con la categoría asignada automáticamente (ver Bancos).",
            <><strong>Categoría del cobro</strong>: al registrar un cobro en una factura, el campo <strong>Categoría</strong> viene con &ldquo;Cobro de factura&rdquo;. Déjalo así para un cobro normal, o elige otra si ese dinero se debe clasificar distinto (ej. Anticipo de cliente, Servicios, Reembolso). La categoría solo afecta cómo se ve el ingreso en Bancos y en el reporte de Ingresos y egresos por categoría; el monto, el balance y el estado de la factura se calculan igual. Si después quieres cambiarla, hazlo desde Bancos con el selector de la fila.</>,
            <><strong>Pagos a proveedores</strong>: no tienen campo de categoría porque toman la <strong>categoría del gasto</strong>. Elígela en el gasto antes de pagar (o cámbiala luego en Bancos).</>,
            <><strong>Pago a proveedor con retenciones</strong>: se paga el <strong>neto</strong> (factura − ISR − ITBIS retenidos), no el total. El formulario lo explica paso a paso; ver <strong>Retenciones al pagar a un proveedor</strong>.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: "gastos",
    label: "Gastos",
    icon: CreditCard,
    tone: "green",
    summary: "De un proyecto/evento específico o de la empresa en general.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Un gasto puede estar ligado a un proveedor y a un proyecto (lo cual
          alimenta el costo real de ese proyecto), o ser un gasto general de
          la empresa sin proyecto asociado.
        </p>
        <StatusRow
          items={[
            { label: "Pendiente", status: "PENDING" },
            { label: "Parcial", status: "PARTIALLY_PAID" },
            { label: "Pagado", status: "PAID" },
            { label: "Cancelado", status: "CANCELLED" },
          ]}
        />
        <Bullets
          items={[
            "Se organizan por categoría (Configuración → Categorías). Es la misma lista que usan los movimientos de Bancos, así que al pagar un gasto su movimiento bancario hereda esa misma categoría.",
            "Al elegir el proveedor en un gasto nuevo, la categoría se sugiere sola con la categoría del proveedor.",
            <><strong>Gasto desde un proyecto</strong>: en el proyecto, pestaña <em>Gastos y proveedores</em>, el botón <strong>Nuevo gasto</strong> abre el formulario con ese proyecto ya elegido. Al guardar (o cancelar) vuelves al proyecto y el gasto aparece en su lista. Lo mismo desde un proveedor: el proveedor viene elegido, con su categoría sugerida, y al guardar vuelves al proveedor.</>,
            "Un gasto con proveedor se liquida registrando un pago a proveedor contra él.",
            <>Si pagas desde una cuenta sin fondos suficientes, el sistema no deja registrar el pago (ver <strong>Bancos → Reglas de cada tipo de cuenta</strong>). Si la cuenta es corriente con sobregiro autorizado, te pide confirmar.</>,
            "El listado resume lo que hay por pagar y lo gastado en el mes y el año; el detalle muestra la barra de lo pagado y sus recibos y comprobantes.",
            <><strong>Recibos en otra moneda</strong>: el recibo PDF que se envía al cliente o al proveedor muestra solo el monto en la moneda de la factura o del gasto. La cuenta usada, la tasa efectiva, la tasa del día, la comisión y la diferencia son información interna: se ven en el detalle de la factura o del gasto (columnas <em>Entró al banco</em> / <em>Salió del banco</em>) y en el reporte <em>Pagos y cobros por moneda</em>, no en el recibo.</>,
            <><strong>Tipo de servicio, comprobante y NCF</strong>: al elegir el proveedor se sugiere su tipo de servicio (puedes cambiarlo si este gasto es de otra cosa). Indica también el tipo de comprobante que te dio (B01, B02, E31…) y su NCF; el NCF debe empezar igual que el tipo elegido (ej. B01…). Con esto el sistema calcula las <strong>retenciones</strong> (ver <strong>Retenciones al pagar a un proveedor</strong>).</>,
            <>Las listas de <strong>Categoría</strong>, <strong>Proveedor</strong> y <strong>Tipo de servicio</strong> del gasto tienen <strong>buscador</strong>: haz clic y escribe parte del nombre. Con el teclado: flechas para moverte, Enter para elegir, Esc para cerrar.</>,
            <>El listado tiene el filtro <strong>Revisión fiscal</strong> (gastos a los que les falta información o regla) y <strong>Con retenciones</strong>; en la columna Total se ve lo retenido debajo del monto.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: "retenciones",
    label: "Retenciones al pagar a un proveedor",
    icon: Scale,
    tone: "amber",
    summary: "Por qué a veces le pagas al proveedor menos que su factura, y cómo lo calcula el sistema.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          En República Dominicana, cuando la empresa le paga a ciertos proveedores la ley la obliga a{" "}
          <strong>quedarse con una parte del pago</strong> y entregársela a la DGII a nombre del proveedor. Eso es una{" "}
          <strong>retención</strong>. No es un descuento ni dinero que se ahorra: es un impuesto del proveedor que la
          empresa paga por él. Por eso al proveedor se le paga el <strong>neto</strong>.
        </p>
        <Card className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-brand-text">Ejemplo: técnico de iluminación, persona física registrada</p>
          <p className="text-brand-muted">Factura: RD$100,000 + ITBIS 18 % (RD$18,000) = <strong className="text-brand-text">RD$118,000</strong></p>
          <p className="text-brand-muted">− ISR retenido: 15 % sobre el 20 % del subtotal = RD$3,000</p>
          <p className="text-brand-muted">− ITBIS retenido: 100 % del ITBIS = RD$18,000</p>
          <p className="text-brand-text">= Le pagas al proveedor <strong>RD$97,000</strong>. Los RD$21,000 retenidos se pagan a la DGII (tu contador los declara el mes siguiente).</p>
        </Card>
        <Bullets
          items={[
            <><strong>Cómo lo decide el sistema</strong>: mira la <em>ficha fiscal del proveedor</em> (persona física o jurídica, registrado, informal, RST, del extranjero, si emite e-CF), el <em>tipo de servicio</em> del gasto (y su clasificación fiscal: técnico, profesional, alquiler, bienes…), el <em>comprobante</em> y la <em>fecha</em>, y busca la regla vigente en Configuración → Reglas fiscales. Nadie escribe porcentajes en el gasto.</>,
            <><strong>Al registrar el gasto</strong> aparece la tarjeta <strong>Tratamiento fiscal</strong>, que se actualiza sola mientras llenas el formulario: total de la factura, ISR retenido, ITBIS retenido y <strong>neto a pagar</strong>. Cada término tiene un <strong>ⓘ</strong>: pasa el mouse por encima para ver qué significa. En <em>¿Por qué se aplicó esto?</em> ves la regla, su base legal y el enlace a la fuente.</>,
            <><strong>Si falta información</strong> (el proveedor no tiene ficha fiscal o el tipo de servicio no está clasificado), la tarjeta lo dice y trae el enlace para completarlo. El gasto se puede guardar igual: queda con retención 0 y marcado <strong>Faltan datos</strong> o <strong>Sin regla</strong> (filtro <em>Revisión fiscal</em>). Nunca se inventa una retención.</>,
            <><strong>Recalcular</strong>: si completaste los datos después, en el detalle del gasto pulsa <strong>Recalcular</strong> (solo mientras el gasto no tenga pagos). Hazlo <strong>antes del primer pago</strong>: una vez pagado, lo retenido queda como se pagó.</>,
            <><strong>Al pagar</strong>: el formulario de pago explica &ldquo;¿Cuánto le pago al proveedor?&rdquo; con el mismo desglose y propone el <strong>neto pendiente</strong>. Puedes pagar en abonos, pero no más que el neto. Del banco sale solo el neto. El comprobante de pago (PDF) muestra las retenciones.</>,
            <><strong>Pagado al crearlo</strong>: si al registrar el gasto eliges el banco o la tarjeta, se paga en ese momento <strong>el neto</strong>. Si dejas <em>Aún no — queda pendiente de pago</em> (también con método Tarjeta), el gasto queda <strong>Pendiente</strong> y lo pagas después, completo o en partes, con la cuenta o tarjeta que quieras. El método de pago va antes de la tarjeta <em>Tratamiento fiscal</em>, que queda al final.</>,
            <><strong>Las reglas cambian, los gastos no</strong>: cada gasto guarda la regla, la versión y los montos con los que se calculó. Si la DGII cambia una tasa, se crea una versión nueva de la regla y solo afecta a los gastos nuevos.</>,
            <><strong>Ajustar</strong> (solo quien puede aprobar gastos): si tu contador indica un tratamiento distinto, en el detalle del gasto pulsa <strong>Ajustar</strong>, corrige el ISR o ITBIS retenido y escribe el motivo. Queda marcado <em>Ajuste manual</em> y registrado en Auditoría con los montos de antes y después.</>,
            <><strong>Gastos anteriores</strong> a esta función quedan <em>Sin evaluar</em>: se pagan por el total, como siempre.</>,
            <>Las reglas iniciales son una <strong>propuesta</strong> basada en fuentes públicas de la DGII; revísalas con tu contador (Configuración → Reglas fiscales).</>,
          ]}
        />
        <StatusRow
          items={[
            { label: "Con retenciones", tone: "info" },
            { label: "Sin retención", tone: "success" },
            { label: "Faltan datos / Sin regla / Por revisar", tone: "warning" },
            { label: "Bloqueado (no se deja guardar)", tone: "danger" },
            { label: "Sin evaluar / Sin proveedor", tone: "neutral" },
          ]}
        />
      </>
    ),
  },
  {
    id: "bancos",
    label: "Bancos",
    icon: Landmark,
    tone: "green",
    summary: "Cuentas, tarjetas y cada movimiento con su Tipo y su Categoría.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Bancos reúne automáticamente los movimientos que genera el resto del
          sistema (cobros de facturas, pagos a proveedores, gastos pagados,
          transferencias) por cuenta o tarjeta, y permite registrar
          movimientos manuales para lo demás (intereses, comisiones,
          ajustes).
        </p>
        <p className="text-sm text-brand-text">
          Cada movimiento tiene dos datos <strong>independientes</strong>:
        </p>
        <Bullets
          items={[
            <><strong>Tipo</strong>: Ingreso (entra dinero, se ve en verde con +), Egreso (sale dinero, en rojo con −) o Transferencia (entre tus propias cuentas).</>,
            <><strong>Categoría</strong>: de qué proviene o en qué se usó el dinero (Nómina, Alquiler, Cobro de factura, Catering…). Las categorías no tienen tipo: la misma categoría puede aparecer en ingresos y en egresos (ej. Comisión cobrada o pagada). Salen de Configuración → Categorías.</>,
          ]}
        />
        <p className="text-sm font-medium text-brand-text">La categoría se asigna sola según el origen:</p>
        <Bullets
          items={[
            <>Cobro de una factura → <strong>Cobro de factura</strong>, o la categoría que elijas en el formulario de cobro (ej. Anticipo de cliente).</>,
            <>Pago a proveedor o gasto pagado → <strong>la categoría del gasto</strong> (Catering, Sonido, Alquiler…). Si el gasto no tiene categoría: Pago a suplidor u Otros gastos.</>,
            <>Transferencia hacia o desde una tarjeta → <strong>Pago de tarjeta de crédito</strong>; cualquier otra transferencia → <strong>Transferencia entre cuentas</strong>.</>,
            "Siempre puedes cambiar la categoría de cualquier movimiento con el selector de su fila: solo cambia la categoría, nunca el monto, la fecha ni la cuenta.",
          ]}
        />
        <p className="text-sm font-medium text-brand-text">Movimientos manuales:</p>
        <Bullets
          items={[
            "Elige el tipo (Ingreso o Egreso), la fecha, el monto y la categoría del desplegable. El detalle es opcional si eliges categoría.",
            <>Si todavía no sabes la categoría, elige <strong>Sin categoría (clasificar después)</strong> y escribe una descripción: el movimiento se guarda igual y queda en la alerta <strong>⚠️ N movimientos sin categoría</strong> para corregirlo luego.</>,
            <>El campo <strong>Referencia</strong> (opcional) guarda el número de cheque, depósito o transacción.</>,
          ]}
        />
        <p className="text-sm font-medium text-brand-text">En el detalle de una cuenta:</p>
        <Bullets
          items={[
            "Balance actual (o deuda y crédito disponible si es tarjeta), entradas, salidas y neto del mes, y cuántos movimientos faltan por conciliar.",
            <>Columna <strong>Origen</strong>: la factura, el gasto, el pago o la otra cuenta que generó el movimiento, con enlace. Las dos partes de una transferencia quedan enlazadas entre sí.</>,
            <>Columna <strong>Saldo</strong>: cómo quedó la cuenta después de cada movimiento, como un estado de cuenta (se oculta al filtrar).</>,
            "Filtros por tipo, por conciliación y por categoría (incluida Sin categoría).",
            "Movimiento manual, Transferir y Editar cuenta están en paneles plegables arriba de la tabla: haz clic en el título para abrirlos.",
            "Cada cuenta tiene su propia moneda.",
          ]}
        />

        <p className="text-sm font-medium text-brand-text">Reglas de cada tipo de cuenta (fondos, sobregiro y tarjetas):</p>
        <p className="text-sm text-brand-text">
          El sistema maneja tres tipos: <strong>Cuenta de ahorro</strong>, <strong>Cuenta corriente</strong> y{" "}
          <strong>Tarjeta de crédito</strong>. Antes de registrar cualquier salida de dinero (egreso, pago a
          proveedor, gasto pagado, transferencia) revisa el saldo de la cuenta de origen. La revisión la hace
          la base de datos, así que aplica desde cualquier pantalla.
        </p>
        <Bullets
          items={[
            <><strong>Ahorro</strong>: nunca puede quedar en negativo. Si la operación supera el saldo, se bloquea y no se registra nada. Ejemplo: saldo RD$10,000 y transferencia de RD$15,000 → <em>&ldquo;Fondos insuficientes. La cuenta de ahorro tiene un saldo disponible de RD$10,000.00 y la operación requiere RD$15,000.00. Las cuentas de ahorro no permiten sobregiros.&rdquo;</em> El saldo sigue en RD$10,000.</>,
            <><strong>Corriente sin sobregiro</strong> (así viene por defecto): igual que ahorro, se bloquea si no hay fondos.</>,
            <><strong>Corriente con sobregiro autorizado</strong>: si la operación deja la cuenta en negativo, aparece el aviso <em>&ldquo;Fondos insuficientes. Esta operación generará un sobregiro de RD$5,000.00. ¿Desea continuar?&rdquo;</em> con <strong>Cancelar</strong> y <strong>Continuar</strong>. Solo si pulsas Continuar se registra, la cuenta queda en negativo (se ve <em>En sobregiro</em>) y la confirmación queda guardada en el movimiento.</>,
            <>Para activar el sobregiro: <strong>Editar cuenta → Tipo de cuenta: Corriente → marcar Permitir sobregiro</strong>. En cuentas de ahorro esa casilla aparece bloqueada.</>,
            <>Las cuentas creadas antes que no tienen tipo se tratan como <strong>corriente sin sobregiro</strong> hasta que les pongas el tipo en Editar cuenta.</>,
            "Las entradas de dinero (cobros, ingresos, transferencias recibidas) nunca se bloquean.",
            <><strong>Cómo se ve</strong>: si no hay fondos o crédito, aparece una <strong>ventana roja</strong> (&ldquo;Fondos insuficientes&rdquo; o &ldquo;Crédito insuficiente&rdquo;) con el detalle y el botón <strong>Cerrar</strong>; no se registró nada y puedes cambiar el monto o la cuenta. Si es un sobregiro autorizado, la ventana es <strong>amarilla</strong> con <strong>Cancelar</strong> / <strong>Continuar</strong>.</>,
            <><strong>Saber antes de pagar</strong>: al elegir la cuenta en <strong>Registrar pago</strong> de un gasto o en <strong>Nuevo gasto</strong>, debajo aparece un recuadro con lo <strong>disponible en la cuenta</strong> (en tarjetas, el crédito disponible y la deuda). En Registrar pago además avisa si el monto no alcanza (rojo) o si dejaría la cuenta en sobregiro (amarillo). Es solo un aviso: la validación real se hace al guardar.</>,
            <><strong>Al terminar</strong>: una transferencia o un pago a proveedor muestran una <strong>ventana verde</strong> (&ldquo;Transferencia realizada&rdquo; / &ldquo;Pago registrado&rdquo;) con el monto y las cuentas; un movimiento manual muestra un aviso corto arriba a la derecha. En todos los casos el formulario <strong>queda en blanco</strong> para la siguiente operación.</>,
          ]}
        />
        <p className="text-sm font-medium text-brand-text">Tarjetas de crédito: deuda, saldo a favor y crédito disponible:</p>
        <Bullets
          items={[
            <>La tarjeta muestra <strong>Deuda actual</strong> (lo que le debes al banco), <strong>Saldo a favor</strong> (dinero tuyo que el banco tiene en la tarjeta) y <strong>Disponible</strong> (lo que aún puedes comprar). Un saldo a favor <strong>nunca se muestra como deuda negativa</strong>.</>,
            <><strong>Pagar la tarjeta</strong> primero baja la deuda; si pagas más de lo que debes, el excedente queda como saldo a favor. Ejemplo: deuda RD$600 y pago de RD$1,000 → deuda RD$0 y saldo a favor RD$400. Antes de transferir, el formulario te avisa: <em>&ldquo;La tarjeta no tiene suficiente deuda para aplicar el pago completo. El excedente de RD$400.00 se registrará como saldo a favor.&rdquo;</em></>,
            <>También puedes pasar dinero a una tarjeta <strong>sin deuda</strong> (pago anticipado): todo queda como saldo a favor. Ejemplo: transferir US$1,000 a una tarjeta en dólares sin deuda → Saldo a favor US$1,000.</>,
            <><strong>Compras con la tarjeta</strong>: primero consumen el saldo a favor y lo que exceda se vuelve deuda. Ejemplo: saldo a favor RD$400 y compra de RD$600 → saldo a favor RD$0 y deuda RD$200.</>,
            <><strong>Crédito disponible</strong> = límite − deuda. Si tu banco deja que el saldo a favor aumente el poder de compra por encima del límite, marca en la tarjeta <em>&ldquo;El saldo a favor aumenta el crédito disponible por encima del límite&rdquo;</em>: entonces disponible = límite − deuda + saldo a favor (ej. límite 2,000 + 1,000 a favor = 3,000).</>,
            <>Una compra que supere el crédito disponible se bloquea: <em>&ldquo;Crédito insuficiente. La operación supera el crédito disponible de RD$X.&rdquo;</em> Si la tarjeta no tiene límite configurado, no se valida.</>,
          ]}
        />

        <p className="text-sm font-medium text-brand-text">Crear una cuenta (incluida una cuenta en dólares):</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-brand-text">
          <li>Ve a <strong>Bancos → Nueva cuenta o tarjeta</strong>.</li>
          <li>En <strong>Tipo</strong> elige <em>Cuenta bancaria</em> (o <em>Tarjeta de crédito</em>).</li>
          <li>En <strong>Tipo de cuenta</strong> elige <em>Ahorros</em> o <em>Corriente</em> (solo para cuentas bancarias). Si es corriente y el banco te autorizó sobregiro, marca <strong>Permitir sobregiro</strong>.</li>
          <li>Ponle un <strong>Nombre</strong> que la identifique, ej. <em>Popular Ahorros USD</em>, y elige el banco.</li>
          <li>En <strong>Moneda</strong> elige <em>DOP (pesos)</em> o <em>USD (dólares)</em>. <strong>No se puede cambiar después</strong>, para no alterar los movimientos ya registrados.</li>
          <li>En <strong>Balance inicial</strong> escribe el saldo que tiene hoy, en la moneda de la cuenta, con su fecha.</li>
        </ol>
        <Bullets
          items={[
            <>En la lista de Bancos puedes filtrar por <strong>tipo</strong> (Ahorros / Corriente / <strong>Tarjetas de crédito</strong>) y por <strong>moneda</strong> (DOP / USD). Con muchas cuentas, cambia a la vista <strong>Lista</strong> (arriba a la derecha): una fila por cuenta con tipo, moneda, saldo o deuda y avisos; la vista <strong>Tarjetas</strong> muestra hasta 4 por fila en pantallas grandes. Las cuentas creadas antes quedan como <em>sin indicar</em>: complétalas desde <strong>Editar cuenta</strong>.</>,
            <><strong>Cuánto dinero tiene la empresa</strong>: arriba en Bancos, <strong>Disponible en pesos</strong> suma todas las cuentas de ahorro y corrientes activas en RD$, y <strong>Disponible en dólares</strong> hace lo mismo con las cuentas en US$. Son dos totales separados: los dólares <strong>no</strong> se convierten ni se suman a los pesos. Debajo de cada total ves el desglose (Ahorros · Corriente · cantidad de cuentas). Las <strong>tarjetas de crédito no cuentan</strong> como dinero disponible (tienen sus propias tarjetas: Deuda y Crédito disponible). Una cuenta corriente en sobregiro resta del total.</>,
            <><strong>Movimientos manuales en cuentas en dólares</strong>: el formulario pide la <strong>Tasa</strong> (pesos por 1 dólar). El movimiento se guarda en dólares en la cuenta, y la tasa sirve para que los reportes lo conviertan a pesos. Ejemplo: intereses de US$10 a tasa 59.50 cuentan como RD$595 en el reporte de Ingresos y egresos.</>,
            "Cobros, pagos y transferencias en dólares ya guardan su propia tasa, así que también se convierten bien en los reportes.",
          ]}
        />

        <p className="text-sm font-medium text-brand-text">Transferir entre cuentas y pagar tarjetas:</p>
        <p className="text-sm text-brand-text">
          El panel <strong>Transferir o pagar tarjeta</strong> mueve dinero desde la cuenta que
          estás viendo hacia otra cuenta o tarjeta tuya. En <em>Cuenta destino</em> aparecen todas
          tus demás cuentas y tarjetas <strong>activas</strong> (nunca la cuenta en la que estás).
          Si no aparece la que buscas, créala primero en <strong>Bancos → Nueva cuenta o
          tarjeta</strong> o revisa que no esté inactiva.
        </p>
        <Bullets
          items={[
            <><strong>Entre bancos</strong> (ej. de Banreservas a Popular): la cuenta de origen baja y la de destino sube por el mismo monto. Queda con la categoría <em>Transferencia entre cuentas</em>.</>,
            <><strong>Pagar una tarjeta de crédito</strong>: desde tu cuenta de banco elige la tarjeta como destino. El banco baja y la <strong>deuda de la tarjeta baja</strong> por lo pagado (si pagas de más, el excedente queda como saldo a favor). Queda con la categoría <em>Pago de tarjeta de crédito</em>.</>,
            <>La cuenta de origen tiene que tener fondos (o sobregiro autorizado y confirmado); si no, la transferencia no se registra en ninguna de las dos cuentas.</>,
            <>Una transferencia <strong>no es ingreso ni gasto</strong>: solo mueve tu propio dinero. Por eso el reporte de Ingresos y egresos la excluye por defecto.</>,
            <>Las dos partes quedan <strong>enlazadas</strong>: en la columna Origen de cada una verás <em>A Popular</em> o <em>Desde Banreservas</em>, con enlace a la otra cuenta.</>,
            <><strong>Comisión del banco</strong> (opcional): lo que cobró el banco de origen por enviar. Se registra <strong>aparte</strong> en la cuenta de origen, en la categoría <em>Comisiones bancarias</em>, ligada a la transferencia (en Origen dice <em>Comisión de: Transferencia a …</em>). Lo transferido no cambia: sale RD$5,000 + RD$50 de comisión y entran RD$5,000.</>,
          ]}
        />
        <p className="text-sm font-medium text-brand-text">Transferencias entre monedas distintas (ej. pagar una tarjeta en dólares desde una cuenta en pesos):</p>
        <Bullets
          items={[
            <>Al elegir una cuenta destino con otra moneda aparece el recuadro <strong>Transferencia entre monedas</strong> con la <strong>tasa del día</strong> (la de Configuración → Monedas y tasas; opcional, solo para comparar) y el campo <strong>¿Cuánto entró en …?</strong>.</>,
            <>Escribe en <strong>Monto que sale</strong> lo que se descontó de la cuenta de origen y en <strong>¿Cuánto entró?</strong> lo que realmente recibió la otra cuenta (su estado de cuenta). El sistema calcula la <strong>tasa efectiva</strong> con los dos montos. Ejemplo: sale <strong>US$1,000</strong> de Promerica y entran <strong>RD$60,000</strong> en Popular → tasa efectiva 1 USD = 60.00; con la tasa del día 59.80 la <strong>diferencia informativa</strong> es −RD$200 (verde: se recibió más valor). No es ganancia ni pérdida contable.</>,
            "También funciona al revés (de pesos a dólares, por ejemplo para pagar una tarjeta en dólares): sale el monto en pesos y escribes los dólares que entraron.",
            "Cada movimiento guarda su tasa (la efectiva), así los reportes convierten correctamente a pesos. Una de las dos cuentas debe estar en la moneda base de la empresa (pesos).",
            <><strong>Tarjetas con dos monedas</strong> (balance en pesos y en dólares): regístrala como <strong>dos tarjetas</strong>, una en DOP y otra en USD (ej. <em>Visa Popular DOP</em> y <em>Visa Popular USD</em>). Así cada balance lleva su propia deuda y límite, y pagas cada uno desde la cuenta que corresponda.</>,
          ]}
        />

        <p className="text-sm font-medium text-brand-text">Conciliación: ¿qué es y para qué sirve?</p>
        <p className="text-sm text-brand-text">
          Conciliar es <strong>comparar cada movimiento del sistema con el estado de cuenta real
          del banco</strong> y marcar los que confirmaste que sí aparecen ahí, con la misma fecha y
          el mismo monto. No cambia montos ni balances: es una verificación.
        </p>
        <Bullets
          items={[
            "Te asegura que lo registrado en el sistema coincide con lo que realmente pasó en el banco.",
            "Ayuda a encontrar errores: cobros registrados que no llegaron, montos mal digitados, movimientos duplicados, o cargos del banco (comisiones, intereses) que faltan por registrar.",
            <>La tarjeta <strong>Sin conciliar</strong> y el filtro del mismo nombre te dicen cuántos movimientos te faltan por verificar.</>,
          ]}
        />
        <p className="text-sm font-medium text-brand-text">Cómo conciliar paso a paso (por ejemplo, una vez al mes):</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-brand-text">
          <li>Descarga o abre el estado de cuenta del banco del período.</li>
          <li>En Bancos, abre la cuenta y filtra por <strong>Sin conciliar</strong>.</li>
          <li>Por cada línea del estado de cuenta, busca el movimiento con la misma fecha y monto y haz clic en <strong>Marcar</strong>: pasa a <em>✓ Conciliado</em>.</li>
          <li>Lo que quede sin marcar en el sistema, investígalo (¿se registró de más o con otro monto?).</li>
          <li>Lo que esté en el banco y no en el sistema (ej. una comisión), regístralo como <strong>Movimiento manual</strong> y márcalo. Si es una comisión que el banco cobró días después por un pago, cobro o transferencia, elige el tipo <strong>Gasto</strong> y en <strong>¿Comisión de una operación?</strong> la operación: queda ligada a ella y en <em>Comisiones bancarias</em>.</li>
          <li>Al terminar, el balance del sistema debe coincidir con el saldo final del estado de cuenta.</li>
        </ol>
        <p className="text-sm text-brand-muted">
          Si marcas uno por error, vuelve a hacer clic y se desmarca. Conciliar requiere el permiso{" "}
          <code className="rounded bg-brand-surface-hover px-1 py-0.5 text-xs">banks.reconcile</code>.
        </p>
      </>
    ),
  },
  {
    id: "tareas",
    label: "Tareas",
    icon: CheckSquare,
    tone: "teal",
    summary: "Pendientes internos, con alertas cuando te asignan una.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Una tarea se le puede asignar a cualquier usuario del sistema, con
          fecha límite y prioridad. Al asignar (o reasignar) una tarea a
          alguien más, esa persona recibe una notificación automática — la
          campana de notificaciones en la barra superior.
        </p>
        <Bullets
          items={[
            "Las tareas pendientes de cada usuario aparecen también como widget en su Dashboard.",
            "Asignarte una tarea a ti mismo no genera notificación — solo se notifica cuando es a otra persona.",
            "El estado se cambia directo en la lista (el selector de color de cada fila). Las tareas abiertas con fecha pasada se marcan como Atrasadas en rojo, y la prioridad se ve por color (alta en rojo, media en ámbar).",
          ]}
        />
      </>
    ),
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: BarChart3,
    tone: "amber",
    summary: "Vistas de solo lectura, consolidadas en la moneda base.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Todos los reportes son de solo lectura (no se edita nada desde
          aquí) y se pueden filtrar por fecha, cliente/proveedor, proyecto,
          estado y moneda. Los disponibles hoy:
        </p>
        <Bullets
          items={[
            <><strong>Rentabilidad por proyecto</strong> — cotizado, facturado, cobrado, costo real y margen de cada proyecto.</>,
            <><strong>Cuentas por Cobrar y Vencimientos</strong> — el mismo consolidado que ve el Dashboard, con línea de tiempo de vencimientos.</>,
            <><strong>Cuentas por cobrar (detalle)</strong> — el listado completo de facturas pendientes, filtrable.</>,
            <><strong>Cuentas por pagar</strong> — gastos pendientes de pago a proveedores.</>,
            <><strong>Ventas por cliente</strong> — total facturado, agrupado por cliente.</>,
            <><strong>Gastos por categoría</strong> — total gastado, agrupado por categoría.</>,
            <><strong>Ingresos y egresos por categoría</strong> (sección Bancos) — el flujo real de dinero de tus cuentas agrupado por categoría: ingresos, egresos y neto, con vista <em>Por mes</em>. Filtros: fechas, cuenta, <strong>proyecto</strong> (incluye <em>Sin proyecto</em> para ver lo general de la empresa, ej. pagos a suplidores que no son de un evento), <strong>tipo</strong> (solo ingresos o solo egresos), <strong>origen</strong> (cobros de clientes, pagos a proveedores, gastos sin proveedor, movimientos manuales o transferencias), <strong>cliente</strong>, <strong>proveedor</strong> y <strong>categoría</strong>. Ejemplo: Origen <em>Movimientos manuales</em> + Tipo <em>Solo egresos</em> + Proyecto <em>Sin proyecto</em> muestra los egresos manuales generales. Las transferencias entre tus cuentas se excluyen por defecto (no son ingreso ni gasto) y se pueden incluir con la casilla. La fila <em>Sin categoría</em> muestra lo que falta clasificar.</>,
            <><strong>Pagos y cobros por moneda</strong> (sección Bancos) — cada cobro y pago a proveedor con lo <strong>aplicado</strong> a la factura o gasto (en su moneda) y lo que realmente <strong>se movió en el banco</strong> (en la moneda de la cuenta), la <strong>comisión</strong>, la <strong>tasa efectiva</strong>, la <strong>tasa de referencia</strong> (marcada <em>manual</em> si se cambió), el <strong>redondeo</strong> o la <strong>diferencia informativa</strong> y el equivalente en pesos. Arriba, una tarjeta por moneda de cuenta con lo que entró, salió y las comisiones, y el total de diferencias. Filtros: fechas, tipo (cobros o pagos), cuenta, moneda del documento, cliente, proveedor y <em>Solo en moneda diferente</em>. Es un reporte operativo: la diferencia informativa no es ganancia ni pérdida contable. Los cobros y pagos anteriores a la multimoneda se muestran como misma moneda.</>,
          ]}
        />
        <p className="text-sm text-brand-muted">
          Requiere el permiso <code className="rounded bg-brand-surface-hover px-1 py-0.5 text-xs">reports.view</code>.
        </p>
      </>
    ),
  },
  {
    id: "auditoria",
    label: "Auditoría",
    icon: History,
    tone: "amber",
    summary: "Quién hizo qué y cuándo, en toda la operación.",
    content: (
      <p className="text-sm text-brand-text">
        Registra automáticamente los cambios importantes (creación, edición,
        cambios de estado) en cotizaciones, facturas, proyectos, gastos y
        pagos, con el usuario y la fecha/hora. Es de solo lectura y sirve
        para resolver dudas de &ldquo;quién cambió esto&rdquo; sin tener que
        preguntarle a nadie.
      </p>
    ),
  },
  {
    id: "configuracion",
    label: "Configuración y Usuarios",
    icon: Settings,
    tone: "neutral",
    summary: "Datos de la empresa, catálogos, roles y usuarios.",
    content: (
      <>
        <p className="text-sm text-brand-text">
          Agrupa todo lo que normalmente se configura una sola vez: datos de
          la empresa (nombre, logo, color de acento), cuentas bancarias,
          categorías de gasto, tasas de impuesto, términos de pago,
          notificaciones, seguridad y documentos.
        </p>
        <Bullets
          items={[
            <><strong>Categorías</strong> — una sola lista para los gastos y para los ingresos y egresos de Bancos. Se crean una por una o <strong>en lote desde un CSV</strong> (botón Importar, con plantilla descargable: columnas <em>nombre</em> y <em>descripcion</em>). <strong>No se permiten nombres repetidos</strong>: dos nombres que solo cambian en mayúsculas, acentos o espacios cuentan como el mismo (<em>Decoracion</em> = <em>Decoración</em>); al intentarlo sale &ldquo;Ya existe la categoría…&rdquo; y en la importación se omite. Al borrar una categoría en uso, sus gastos y movimientos quedan Sin categoría; no se borran.</>,
            <><strong>Tipos de servicio</strong> — qué hace cada proveedor, dentro de su categoría (ej. Audiovisuales → Alquiler de sonido). Se agregan uno por uno o <strong>en lote desde un CSV</strong> (columnas <em>categoria</em>, <em>tipo_servicio</em> y, opcional, <em>descripcion_categoria</em>; si la categoría no existe se crea con esa descripción, y una fila con el tipo vacío crea solo la categoría). <strong>Un tipo de servicio no se repite</strong> en ninguna categoría (mismas reglas de mayúsculas, acentos y espacios): si ya existe, el sistema dice en qué categoría está. Al borrar un tipo en uso, sus proveedores quedan sin tipo de servicio; no se borran.</>,
            <><strong>Clasificación fiscal</strong> (Tipos de servicio) — para la DGII no es lo mismo pagar un <em>servicio técnico</em>, un <em>servicio profesional</em>, un <em>alquiler</em> o <em>comprar productos</em>: cada uno lleva retenciones distintas. En la columna <strong>Clasificación fiscal</strong> eliges a cuál se parece cada tipo de servicio; se guarda al elegir. Arriba se ve cuántos faltan por clasificar (clic para verlos). Con el filtro de clasificación o de categoría puedes usar <strong>Clasificar los N filtrados</strong> para ponerles la misma de una vez. En <em>Ver y editar las clasificaciones</em> se agregan, renombran o desactivan. Aquí <strong>no</strong> se ponen porcentajes: eso lo deciden las reglas fiscales. El CSV acepta una columna opcional <em>clasificacion_fiscal</em> (ej. &ldquo;Servicio técnico&rdquo;), que también clasifica los tipos que ya existen.</>,
            <><strong>Reglas fiscales</strong> — deciden las <strong>retenciones</strong> al pagar a un proveedor. Cada regla dice <em>a quién aplica</em> (tipo de proveedor, condición fiscal, si es del extranjero, si emite e-CF), <em>qué servicio</em> (clasificación fiscal), <em>qué hacer</em> (retener ISR y/o ITBIS, no retener, pedir revisión o bloquear), <em>desde cuándo</em> y <em>de dónde sale</em> (ley, norma, enlace a la DGII). Arriba se ve cuántas hay vigentes, programadas, vencidas e inactivas. <strong>Nueva regla</strong> abre un asistente de 6 pasos con explicación y un ejemplo en pesos (&ldquo;factura de RD$100,000 + ITBIS → le pagas al proveedor RD$97,000&rdquo;). Si dos reglas aplican, gana la de <strong>prioridad</strong> más baja (número menor); si empatan con resultados distintos, el gasto queda &ldquo;por revisar&rdquo;. Cuando la DGII cambia una tasa no se edita la regla vieja: se guarda una <strong>nueva versión</strong> con la fecha nueva y la anterior se cierra sola; los gastos ya registrados no cambian. <strong>Probar reglas</strong> simula un pago y muestra qué regla aplicaría y por qué. Las reglas iniciales son una propuesta basada en fuentes públicas (Ley 30-26, Normas 07-2007 y 02-05): todas dicen <strong>Revisar con su contador</strong> hasta que pulses <em>Marcar como revisada</em>; las dudosas (como la de emisores e-CF, NG 02-2026) vienen <strong>inactivas</strong>. Una regla usada por gastos no se borra: se desactiva.</>,
            <>Las dos listas (Categorías y Tipos de servicio) se ven <strong>de 25 en 25</strong> con <strong>Anterior / Siguiente</strong> abajo, y tienen <strong>buscador que filtra mientras escribes</strong> (no hace falta pulsar Enter; sin importar mayúsculas ni acentos: con escribir &ldquo;an&rdquo; ya aparece todo lo que lo contiene). En Tipos de servicio también hay un <strong>filtro por categoría</strong>. Arriba a la derecha se ve cuántas hay en total.</>,
            <><strong>Usuarios</strong> — quién tiene acceso al sistema y con qué rol.</>,
            <><strong>Roles</strong> — qué puede hacer cada rol (los permisos como <code className="rounded bg-brand-surface-hover px-1 py-0.5 text-xs">quotations.approve</code> o <code className="rounded bg-brand-surface-hover px-1 py-0.5 text-xs">reports.view</code> que se mencionan en este manual se activan o desactivan aquí, por rol).</>,
            <>
              Todo lo de esta sección requiere el permiso{" "}
              <code className="rounded bg-brand-surface-hover px-1 py-0.5 text-xs">
                settings.manage
              </code>{" "}
              — normalmente reservado al Admin.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "seguridad",
    label: "Seguridad de los datos",
    icon: ShieldCheck,
    tone: "red",
    summary: "Cómo protege el sistema la información financiera.",
    content: (
      <Bullets
        items={[
          "Cada registro financiero (cotización, factura, gasto, pago) queda protegido a nivel de base de datos, no solo por la pantalla — aunque alguien intentara acceder por otra vía, las reglas de seguridad de la base de datos se aplican igual.",
          "El dinero siempre se maneja con precisión exacta (nunca se usan decimales aproximados que puedan generar diferencias de centavos).",
          "Cuando una transacción ocurre en una moneda distinta a la moneda base de la empresa, la tasa de cambio del día queda congelada en ese registro — los reportes históricos no cambian si la tasa de cambio actual es distinta.",
          "El acceso con verificación en dos pasos (MFA) está disponible desde tu Perfil, para una capa extra de seguridad en tu cuenta.",
        ]}
      />
    ),
  },
];

const QUICK_TOPICS = [
  "moneda diferente",
  "tasa",
  "tarjeta",
  "retención",
  "transferencia",
  "comisión",
  "anular",
  "PDF",
  "categoría",
  "sobregiro",
];

function SectionCard({ s, words }: { s: Section; words: string[] }) {
  const Icon = s.icon;
  // Si el nombre del módulo coincide, se muestra completo.
  const titleHit = words.length > 0 && matches(`${s.label} ${s.summary}`, words);
  return (
    <Card id={s.id} className="scroll-mt-20">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <IconBadge icon={<Icon size={18} />} tone={s.tone} size="md" />
          <div>
            <h2 className="text-base font-semibold text-brand-text">{s.label}</h2>
            <p className="text-xs text-brand-muted">{s.summary}</p>
          </div>
        </div>
        <SearchCtx.Provider value={titleHit ? [] : words}>
          <div className="flex flex-col gap-3">{titleHit ? s.content : filterContent(s.content, words)}</div>
        </SearchCtx.Provider>
      </div>
    </Card>
  );
}

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Enlaces directos (/help#bancos) abren ese tema.
  useEffect(() => {
    function fromHash() {
      const id = window.location.hash.slice(1);
      if (SECTIONS.some((s) => s.id === id)) {
        setOpenId(id);
        setQuery("");
      }
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const words = useMemo(
    () => norm(query).split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)),
    [query],
  );
  const index = useMemo(
    () =>
      SECTIONS.map((s) => ({
        title: `${s.label} ${s.summary}`,
        units: contentUnits(s.content).map(nodeText),
      })),
    [],
  );
  // Un módulo aparece si su nombre coincide o si algún párrafo o punto tiene todas las palabras.
  const results = words.length
    ? SECTIONS.filter((_, i) => matches(index[i].title, words) || index[i].units.some((t) => matches(t, words)))
    : [];
  const open = SECTIONS.find((s) => s.id === openId) ?? null;
  const openIndex = open ? SECTIONS.indexOf(open) : -1;

  function openSection(id: string | null) {
    setOpenId(id);
    setQuery("");
    history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
    window.scrollTo({ top: 0 });
  }

  return (
    <main className="flex flex-1 flex-col gap-5 p-4 md:p-8">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold text-brand-primary">Manual del sistema</h1>
          <p className="text-sm text-brand-muted">
            Busca un tema o elige un módulo. Las explicaciones largas se abren con <em>Ver más</em>.
          </p>
        </div>
        <div className="relative max-w-2xl">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en el manual: tasa, tarjeta, retención, cobro, transferencia…"
            aria-label="Buscar en el manual"
            className="w-full rounded-[var(--radius-md)] border border-brand-border bg-brand-surface py-2.5 pl-9 pr-9 text-sm text-brand-text outline-none placeholder:text-brand-muted focus:border-brand-accent focus:ring-2 focus:ring-brand-accent-light"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Borrar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-brand-muted hover:text-brand-text"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-brand-muted">Temas frecuentes:</span>
          {QUICK_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setQuery(t)}
              className={`rounded-full border px-2.5 py-0.5 ${
                norm(query) === norm(t)
                  ? "border-brand-accent bg-brand-accent-light font-medium text-brand-accent"
                  : "border-brand-border text-brand-muted hover:text-brand-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <aside className="hidden w-full shrink-0 md:sticky md:top-20 md:block md:w-60">
          <nav className="flex flex-col gap-0.5 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-2 shadow-[var(--shadow-sm)]">
            <button
              type="button"
              onClick={() => openSection(null)}
              className={`rounded-[var(--radius-md)] px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide ${
                !open && !words.length ? "text-brand-accent" : "text-brand-muted hover:text-brand-text"
              }`}
            >
              Todos los temas
            </button>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = open?.id === s.id && !words.length;
              const hit = words.length > 0 && results.includes(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSection(s.id)}
                  className={`flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left text-sm font-medium transition-colors ${
                    active ? "bg-brand-accent-light text-brand-accent" : "text-brand-text hover:bg-brand-surface-hover"
                  } ${words.length > 0 && !hit ? "opacity-40" : ""}`}
                >
                  <IconBadge icon={<Icon size={15} />} tone={s.tone} size="sm" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {words.length > 0 ? (
            <>
              <p className="text-sm text-brand-muted">
                {results.length === 0
                  ? `No hay temas con “${query}”. Prueba con otra palabra (ej. tasa, cobro, tarjeta).`
                  : `${results.length} ${results.length === 1 ? "módulo habla" : "módulos hablan"} de “${query}”. Solo se muestran los puntos que lo mencionan.`}
              </p>
              {results.map((s) => (
                <SectionCard key={s.id} s={s} words={words} />
              ))}
            </>
          ) : open ? (
            <>
              <button
                type="button"
                onClick={() => openSection(null)}
                className="inline-flex w-fit items-center gap-1 text-sm text-brand-accent hover:underline"
              >
                <ChevronLeft size={15} /> Todos los temas
              </button>
              <SectionCard s={open} words={[]} />
              <div className="flex justify-between gap-2 text-sm">
                {openIndex > 0 ? (
                  <button type="button" onClick={() => openSection(SECTIONS[openIndex - 1].id)} className="inline-flex items-center gap-1 text-brand-accent hover:underline">
                    <ChevronLeft size={15} /> {SECTIONS[openIndex - 1].label}
                  </button>
                ) : (
                  <span />
                )}
                {openIndex < SECTIONS.length - 1 && (
                  <button type="button" onClick={() => openSection(SECTIONS[openIndex + 1].id)} className="inline-flex items-center gap-1 text-brand-accent hover:underline">
                    {SECTIONS[openIndex + 1].label} <ChevronRight size={15} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => openSection(s.id)}
                    className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-4 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-brand-accent"
                  >
                    <IconBadge icon={<Icon size={18} />} tone={s.tone} size="md" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-brand-text">{s.label}</span>
                      <span className="block text-xs text-brand-muted">{s.summary}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
