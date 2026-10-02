/**
 * Explicaciones cortas de los botones de acción. Aparecen al pasar el mouse
 * por encima (sin hacer clic). <Button> las busca por el texto del botón;
 * para un caso especial se puede pasar `hint="..."` (o `hint=""` para no
 * mostrar nada). Los botones obvios (Guardar, Cancelar, Volver, Filtrar)
 * no llevan explicación a propósito.
 */
export const BUTTON_HINTS: Record<string, string> = {
  // Crear
  "Nueva cotización": "Crea una cotización en borrador para un cliente.",
  "Nueva factura": "Crea una factura en borrador; no cuenta como venta hasta emitirla.",
  "Nuevo proyecto": "Crea un proyecto o evento sin partir de una cotización.",
  "Nuevo cliente": "Registra un cliente o prospecto nuevo.",
  "Nuevo proveedor": "Registra un proveedor nuevo con su categoría y tipo de servicio.",
  "Nuevo gasto": "Registra un gasto o factura de proveedor.",
  "Nuevo acuse": "Registra una entrega a un cliente y genera el acuse para firmar.",
  "Nueva cuenta o tarjeta": "Agrega una cuenta de banco (ahorro o corriente) o una tarjeta de crédito.",
  "Crear cotización": "Crea una cotización con los datos de este cliente o proyecto.",
  "Crear factura": "Crea una factura en borrador con estos datos.",
  "Crear proyecto": "Crea el proyecto con estos datos.",
  "Crear gasto": "Registra el gasto con estos datos.",
  "Crear tarea": "Agrega una tarea con responsable y fecha límite.",
  "Invitar usuario": "Envía un correo para que la persona cree su contraseña y entre al sistema.",
  "Importar": "Carga varios registros de una vez desde un archivo CSV.",
  "Importar CSV": "Carga varios registros de una vez desde un archivo CSV.",
  "Agregar línea": "Agrega un servicio o producto a la lista.",
  "Agregar contacto": "Agrega una persona de contacto de este cliente.",
  "Agregar movimiento": "Registra una entrada o salida de dinero manual en la cuenta.",
  "Transferir": "Mueve dinero entre dos de tus cuentas. No cuenta como ingreso ni gasto.",
  "Personalizar": "Elige qué tarjetas ver en el tablero y en qué orden.",
  "Subir logo": "Sube el logo que sale en PDFs, correos y la encuesta.",

  // Cotizaciones
  "Marcar como enviada": "Indica que ya se la mandaste al cliente. Después ya no se editan las líneas.",
  "Pasar a negociación": "El cliente pidió cambios: vuelve a permitir editar líneas y precios.",
  "Marcar como enviada de nuevo": "Ya le mandaste la versión corregida al cliente. Vuelve a Enviada.",
  "Aprobar": "El cliente aceptó. Luego puedes convertirla en proyecto.",
  "Rechazar": "El cliente no aceptó. Queda guardada como Rechazada.",
  "Convertir a Proyecto": "Crea el proyecto o evento con las líneas de esta cotización aprobada.",
  "Convertir en proyecto": "Crea el proyecto o evento con las líneas de esta cotización aprobada.",
  "Cancelar cotización": "La anula. Se conserva para auditoría pero ya no se puede editar.",
  "Duplicar cotización": "Crea una copia nueva en borrador con las mismas líneas.",
  "Generar PDF / Link para compartir": "Crea el PDF y un enlace para enviárselo al cliente.",
  "Descargar PDF": "Descarga el PDF a tu computadora.",

  // Facturas
  "Emitir factura": "La factura pasa a ser oficial: cuenta como venta y queda pendiente de cobro.",
  "Registrar cobro": "Anota un pago del cliente. Baja el balance y entra el dinero a la cuenta elegida.",
  "Marcar como enviada al cliente": "Solo anota que ya se la mandaste. No cambia el estado ni los montos.",
  "Quitar marca de enviada": "Quita la anotación de enviada al cliente (si la marcaste por error).",
  "Cancelar factura": "La anula. Deja de contar como venta y no se puede cobrar.",
  "Duplicar factura": "Crea una factura nueva en borrador con las mismas líneas.",

  // Gastos y pagos
  "Registrar pago": "Anota un pago al proveedor. Sale el dinero de la cuenta elegida.",
  "Cancelar gasto": "Anula el gasto. Deja de contar en los costos y no se puede pagar.",

  // Proyectos
  "Cancelar proyecto": "Lo deja como Cancelado. No borra nada y se puede reactivar.",
  "Reactivar en Planificación": "Vuelve a abrir el proyecto cancelado en estado Planificación.",
  "Ver proyecto": "Abre el proyecto o evento.",
  "Copiar del proyecto": "Llena los datos con los del proyecto.",
  "Finalizar proyecto": "Marca el proyecto como Completado.",
  "Finalizar y enviar encuesta": "Marca el proyecto como Completado y envía la encuesta de satisfacción.",

  // Clientes y proveedores
  "Convertir en cliente": "El prospecto ya es cliente: se le pueden hacer cotizaciones y facturas.",
  "Marcar prospecto": "Lo pasa a prospecto (cliente potencial que todavía no compra).",
  "Reactivar cliente": "Vuelve a activar el cliente para usarlo en cotizaciones y facturas.",
  "Desactivar proveedor": "Deja de aparecer en las listas para elegir. No borra su historial.",
  "Reactivar": "Lo vuelve a activar para que aparezca en las listas.",
  "Desactivar": "Deja de aparecer en las listas para elegir. No borra nada.",
  "Activar": "Lo vuelve a activar para que aparezca en las listas.",
  "Desactivar cuenta": "La cuenta deja de aparecer para elegir. Conserva sus movimientos.",
  "Activar cuenta": "La cuenta vuelve a aparecer para elegir.",
  "Hacer predeterminada": "Se elige sola por defecto en los formularios nuevos.",
  "Marcar": "Marca el movimiento como conciliado (ya lo verificaste contra el estado del banco).",
  "✓ Conciliado": "Ya está verificado contra el banco. Clic para quitar la marca.",

  // Borradores y duplicados (varios módulos)
  "Duplicar": "Crea una copia nueva en borrador con los mismos datos.",
  "Descartar borrador": "Borra este borrador por completo. No se puede deshacer.",
  "Volver a borrador": "Lo regresa a Borrador para poder editarlo otra vez.",
  "Anular": "Lo deja como anulado. Se conserva en el historial pero no se puede usar.",

  // Entregas y acuses
  "Imprimir / descargar PDF": "Abre el acuse para imprimirlo y llevarlo a firmar.",
  "Marcar como pendiente de firma": "Ya lo imprimiste y entregaste: queda esperando el acuse firmado.",
  "Adjuntar acuse firmado": "Sube el acuse firmado (PDF o foto). Queda como Firmado.",
  "Subir otra copia firmada": "Sube otra copia del acuse firmado (la anterior se conserva).",

  // Encuesta de satisfacción
  "Enviar encuesta": "Envía la encuesta de satisfacción al cliente por correo y/o WhatsApp.",
  "Enviar otra encuesta": "Crea una encuesta nueva con otro enlace. La anterior queda en el historial.",
  "Enviar por correo": "Envía el enlace de la encuesta por correo.",
  "Reenviar correo": "Vuelve a enviar el mismo enlace por correo (sirve de recordatorio).",
  "Enviar por WhatsApp": "Abre WhatsApp con el mensaje y el enlace listos; solo tocas Enviar.",
  "Reenviar por WhatsApp": "Abre WhatsApp otra vez con el mismo enlace (sirve de recordatorio).",
  "Abrir WhatsApp": "Abre WhatsApp con el mensaje y el enlace listos; solo tocas Enviar.",
  "Copiar enlace": "Copia el enlace de la encuesta para pegarlo donde quieras.",
  "Reabrir": "Permite que el cliente responda otra vez con el mismo enlace.",
  "Agregar pregunta": "Agrega una pregunta al final de la encuesta.",
  "Hacer opcional": "El cliente podrá dejar esta pregunta sin responder.",
  "Hacer obligatoria": "El cliente tendrá que responder esta pregunta para enviar.",

  // Usuarios y seguridad
  "Enviar enlace": "Envía un correo con un enlace para crear una contraseña nueva.",
  "Revocar todos": "Cierra la sesión en todos los equipos de confianza; tendrán que verificar de nuevo.",
  "Revocar": "Ese equipo deja de ser de confianza y pedirá el código otra vez.",
  "Generar códigos": "Crea códigos de un solo uso para entrar si pierdes el celular.",
  "Generar códigos nuevos": "Crea códigos nuevos; los anteriores dejan de servir.",
  "Copiar todos": "Copia todos los códigos para guardarlos en un lugar seguro.",
  "Generar": "Crea una contraseña segura al azar.",
};
