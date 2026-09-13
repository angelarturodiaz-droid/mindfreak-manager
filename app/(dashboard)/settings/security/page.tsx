import Link from "next/link";

export default function SecuritySettingsPage() {
  return (
    <div className="max-w-2xl">
      <h2 className="mb-3 text-lg font-semibold text-brand-primary">
        Seguridad
      </h2>
      <p className="text-sm text-brand-muted">
        La autenticación, las sesiones y las políticas de acceso las maneja
        Supabase Auth internamente — no hay nada propio de la aplicación que
        configurar aquí (login, logout, recuperación de contraseña y
        expiración de sesión ya están cubiertos).
      </p>
      <p className="mt-3 text-sm text-brand-muted">
        Lo que sí es propio de la aplicación (permisos por rol, quién puede
        hacer qué) se revisa desde{" "}
        <Link href="/settings/users" className="text-brand-accent hover:underline">
          Usuarios
        </Link>
        . El registro de auditoría (quién hizo qué y cuándo) está en{" "}
        <Link href="/audit" className="text-brand-accent hover:underline">
          Auditoría
        </Link>
        .
      </p>
    </div>
  );
}
