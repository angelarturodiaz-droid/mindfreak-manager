export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold text-brand-primary">
        Mindfreak Manager
      </h1>
      <p className="text-brand-muted">
        Plataforma de gestión para Mindfreak Events.
      </p>
      <a href="/login" className="mt-2 text-sm text-brand-accent hover:underline">
        Ingresar →
      </a>
    </main>
  );
}
