import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LEGAL_DOCS, type LegalSlug } from "@/lib/legal/content";
import { LegalDocument } from "@/components/legal/legal-document";
import { LegalFooter } from "@/components/legal/legal-footer";

/** Página pública (sin iniciar sesión) de la Política de Privacidad / Términos de Uso. */
export function generateStaticParams() {
  return Object.keys(LEGAL_DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug as LegalSlug];
  return { title: doc ? `${doc.title} · Mindfreak Manager` : "Mindfreak Manager" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in LEGAL_DOCS)) notFound();
  const doc = LEGAL_DOCS[slug as LegalSlug];
  const other = slug === "privacidad" ? LEGAL_DOCS.terminos : LEGAL_DOCS.privacidad;

  return (
    <main className="flex min-h-full flex-1 flex-col bg-brand-background">
      <header className="flex items-center gap-3 bg-brand-secondary px-5 py-3">
        <Image src="/brand/mindfreak-logo-on-dark.png" alt="Mindfreak Events" width={175} height={86} className="h-8 w-auto" />
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-brand-muted hover:text-brand-accent">
            <ArrowLeft size={14} /> Volver al sistema
          </Link>
          <div className="flex-1" />
          <Link href={`/legal/${other.slug}`} className="text-sm font-medium text-brand-accent hover:underline">
            Ver {other.title}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-brand-primary">{doc.title}</h1>
        <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-brand-border bg-brand-surface md:h-[70vh]">
          <LegalDocument slug={slug as LegalSlug} />
        </div>
      </div>
      <LegalFooter />
    </main>
  );
}
