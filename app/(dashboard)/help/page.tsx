import type { ReactNode } from "react";
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

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm text-brand-text">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-muted" />
          <span>{it}</span>
        </li>
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
            <><strong>Páginas</strong>: se muestran 25 registros por página. Abajo aparece <em>Mostrando 1–25 de N</em> con <em>Anterior</em> y <em>Siguiente</em>; los filtros se mantienen al cambiar de página.</>,
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
            <>En el detalle del cliente, la <strong>Etapa comercial</strong> se ve como pasos: haz clic en la siguiente etapa para avanzar. Debajo están sus números (cotizado aprobado, facturado, por cobrar, vencido y proyectos activos) y pestañas con sus <strong>Cotizaciones</strong>, <strong>Facturas</strong>, <strong>Proyectos</strong> y <strong>Documentos</strong>.</>,
            <>Desde el cliente, <strong>Nueva cotización</strong> y <strong>Nueva factura</strong> abren el formulario con ese cliente ya elegido.</>,
            "Se pueden importar clientes en lote desde un archivo CSV (botón Importar CSV).",
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
            <><strong>Categoría y Tipo de servicio</strong>: al crear o editar un proveedor eliges su <strong>Categoría</strong> de la lista de Configuración → Categorías y luego su <strong>Tipo de servicio</strong>, que solo muestra los tipos de esa categoría. Ejemplo: <em>Sonus Eventos</em> → Categoría <em>Audiovisuales</em> → Tipo de servicio <em>Alquiler de sonido</em>.</>,
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
            { label: "Vista", status: "VIEWED" },
            { label: "Negociando", status: "NEGOTIATING" },
            { label: "Aprobada", status: "APPROVED" },
            { label: "Rechazada", status: "REJECTED" },
            { label: "Vencida", status: "EXPIRED" },
            { label: "Cancelada", status: "CANCELLED" },
          ]}
        />
        <Bullets
          items={[
            "Mientras está en Borrador se puede editar libremente; una vez enviada, los cambios importantes quedan registrados.",
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
            "No se puede cobrar o pagar más del balance pendiente.",
            "La pantalla Cobros y pagos resume lo cobrado y pagado en el mes, el neto del mes y lo cobrado en el año, con dos pestañas: Cobros de clientes y Pagos a proveedores.",
            "Cada cobro o pago genera su movimiento en Bancos con la categoría asignada automáticamente (ver Bancos).",
            <><strong>Categoría del cobro</strong>: al registrar un cobro en una factura, el campo <strong>Categoría</strong> viene con &ldquo;Cobro de factura&rdquo;. Déjalo así para un cobro normal, o elige otra si ese dinero se debe clasificar distinto (ej. Anticipo de cliente, Servicios, Reembolso). La categoría solo afecta cómo se ve el ingreso en Bancos y en el reporte de Ingresos y egresos por categoría; el monto, el balance y el estado de la factura se calculan igual. Si después quieres cambiarla, hazlo desde Bancos con el selector de la fila.</>,
            <><strong>Pagos a proveedores</strong>: no tienen campo de categoría porque toman la <strong>categoría del gasto</strong>. Elígela en el gasto antes de pagar (o cámbiala luego en Bancos).</>,
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
          ]}
        />
        <p className="text-sm font-medium text-brand-text">Transferencias entre monedas distintas (ej. pagar una tarjeta en dólares desde una cuenta en pesos):</p>
        <Bullets
          items={[
            <>Al elegir una cuenta destino con otra moneda aparece el campo <strong>Tasa</strong>: cuántos pesos vale 1 dólar según tu banco (ej. <em>59.50</em>).</>,
            <>Escribe en <strong>Monto que sale</strong> lo que se descuenta de la cuenta de origen, en su moneda. El sistema calcula y te muestra lo que entra en la otra cuenta antes de guardar. Ejemplo: sale <strong>RD$5,950.00</strong> a tasa 59.50 → entran <strong>US$100.00</strong> a la tarjeta.</>,
            "También funciona al revés (de dólares a pesos): sale el monto en dólares y entra el equivalente en pesos.",
            "Cada movimiento guarda su tasa, así los reportes convierten correctamente a pesos. Una de las dos cuentas debe estar en la moneda base de la empresa (pesos).",
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
          <li>Lo que esté en el banco y no en el sistema (ej. una comisión), regístralo como <strong>Movimiento manual</strong> y márcalo.</li>
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

export default function HelpPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-xl font-semibold text-brand-primary">Manual del sistema</h1>
        <p className="text-sm text-brand-muted">
          Cómo funciona Mindfreak Manager, módulo por módulo.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <aside className="w-full shrink-0 md:sticky md:top-20 md:w-64">
          <nav className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface p-2 shadow-[var(--shadow-sm)]">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-2 text-sm font-medium text-brand-text transition-colors hover:bg-brand-surface-hover"
                >
                  <IconBadge icon={<Icon size={15} />} tone={s.tone} size="sm" />
                  <span className="truncate">{s.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.id} id={s.id} className="scroll-mt-20">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <IconBadge icon={<Icon size={18} />} tone={s.tone} size="md" />
                    <div>
                      <h2 className="text-base font-semibold text-brand-text">{s.label}</h2>
                      <p className="text-xs text-brand-muted">{s.summary}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">{s.content}</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
