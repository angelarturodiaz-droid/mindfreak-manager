import type { Metadata } from "next";
import "./globals.css";

// TODO (F5+): mover a companies.platform_name vía Settings (sección 26 del prompt maestro).
export const metadata: Metadata = {
  title: "Mindfreak Manager",
  description: "Plataforma de gestión para Mindfreak Events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-brand-background text-brand-text font-sans">
        {children}
      </body>
    </html>
  );
}
