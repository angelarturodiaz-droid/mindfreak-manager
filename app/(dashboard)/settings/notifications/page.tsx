export default function NotificationsSettingsPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">
        Notificaciones
      </h2>
      <p className="text-sm text-brand-muted">
        El envío real de notificaciones por correo (facturas por vencer,
        cobros pendientes, tareas asignadas) sigue clasificado como **V2** en
        la arquitectura original — todavía no hay proveedor de email
        configurado más allá de la recuperación de contraseña de Supabase.
      </p>
      <p className="mt-3 text-sm text-brand-muted">
        La campana de notificaciones dentro de la app (tabla{" "}
        <code>notifications</code>, ya existe desde F3 con RLS) sigue en el
        backlog, pendiente de construir su UI.
      </p>
    </div>
  );
}
