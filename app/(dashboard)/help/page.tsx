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
            "Todos los números son en vivo — no es un corte histórico, se recalculan en cada visita.",
            <>
              Puedes elegir qué tarjetas ver y en qué orden desde{" "}
              <strong>Personalizar Dashboard</strong> (botón arriba a la
              derecha).
            </>,
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
            "El tipo de servicio ayuda a clasificar gastos y pagos por categoría de proveedor.",
            "El listado muestra, por proveedor, cuánto se le ha gastado y cuánto se le debe (por pagar), con búsqueda y filtro de activos/inactivos.",
            <>El detalle del proveedor tiene sus números (total gastado, pagado, por pagar y proyectos) y pestañas con sus <strong>Gastos</strong>, <strong>Pagos</strong> y <strong>Documentos</strong>.</>,
            "Importación en lote por CSV disponible, igual que en Clientes.",
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
            "El balance pendiente baja automáticamente a medida que se registran cobros contra esa factura.",
            "Una factura vencida es la que pasó su fecha de vencimiento sin liquidarse — aparece en el Dashboard y en el reporte de Vencimientos.",
            "Se puede compartir un enlace de la factura sin dar acceso al sistema completo (botón de compartir en el detalle).",
            "El listado resume lo que hay por cobrar, lo vencido, lo que vence en 7 días y los borradores, y marca cada factura con su situación (Vence en 3 días / Vencida hace 2 días).",
            <>En el detalle, los pasos <em>Borrador → Emitida → Pago parcial → Pagada</em> muestran el avance (en rojo si está vencida). En la columna derecha están el resumen con la barra de lo pagado, NCF/vencimiento (en borrador) y la <strong>Gestión de cobro</strong> con su historial.</>,
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
            "Un gasto con proveedor se liquida registrando un pago a proveedor contra él.",
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
            <>Cobro de una factura → <strong>Cobro de factura</strong>.</>,
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
            <>
              Conciliar (permiso{" "}
              <code className="rounded bg-brand-surface-hover px-1 py-0.5 text-xs">
                banks.reconcile
              </code>
              ) marca cada movimiento como verificado contra el estado de
              cuenta real del banco.
            </>,
            "Cada cuenta tiene su propia moneda. Los movimientos manuales y las transferencias se guardan con tasa 1: en cuentas en dólares los reportes los suman sin convertirlos a pesos.",
          ]}
        />
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
            <><strong>Ingresos y egresos por categoría</strong> (sección Bancos) — el flujo real de dinero de tus cuentas agrupado por categoría: ingresos, egresos y neto, con vista <em>Por mes</em>. Se filtra por fecha, cuenta y proyecto. Las transferencias entre tus cuentas se excluyen por defecto (no son ingreso ni gasto) y se pueden incluir con la casilla. La fila <em>Sin categoría</em> muestra lo que falta clasificar.</>,
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
            <><strong>Categorías</strong> — una sola lista para los gastos y para los ingresos y egresos de Bancos. Se crean una por una o <strong>en lote desde un CSV</strong> (botón Importar, con plantilla descargable: columnas <em>nombre</em> y <em>descripcion</em>). Si una categoría ya existe con el mismo nombre (sin importar mayúsculas ni acentos) no se duplica. Al borrar una categoría en uso, sus gastos y movimientos quedan Sin categoría; no se borran.</>,
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
