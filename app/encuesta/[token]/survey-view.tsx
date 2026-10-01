import { CheckCircle2, CircleSlash, LinkIcon } from "lucide-react";
import { fillPlaceholders } from "@/features/surveys/schema";
import type { PublicSurvey } from "@/features/surveys/public";
import { PublicSurveyForm } from "./survey-form";

/** Vista de la encuesta pública (con branding de la empresa) según su estado. */

function colors(s: PublicSurvey | null) {
  const p = s?.company.brand_primary;
  const dark = !p || p.toLowerCase() === "#000000" ? "#141b20" : p;
  const accent = s?.company.brand_accent || "#17a6b8";
  return { dark, accent };
}

function formatDate(date: string | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T00:00:00Z`),
  );
}

function Shell({ survey, children }: { survey: PublicSurvey | null; children: React.ReactNode }) {
  const { dark, accent } = colors(survey);
  const company = survey?.company;
  return (
    <div className="flex min-h-dvh flex-col bg-[#f2f4f7]" style={{ ["--sv-dark" as string]: dark, ["--sv-accent" as string]: accent }}>
      <div className="h-1 w-full" style={{ background: accent }} />
      <header className="px-4 pb-16 pt-6 sm:pb-20" style={{ background: dark }}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-12 w-12 shrink-0 rounded-full border-2 bg-white object-contain"
              style={{ borderColor: accent }}
            />
          ) : company ? (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-white text-xl font-bold"
              style={{ borderColor: accent, color: dark }}
            >
              {company.name.charAt(0)}
            </div>
          ) : null}
          <p className="text-lg font-bold uppercase tracking-[0.18em] text-white">{company?.name ?? ""}</p>
        </div>
      </header>
      <main className="mx-auto -mt-12 w-full max-w-xl flex-1 px-4 pb-10 sm:-mt-14">{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-[#667085]">
        {company ? (
          <>
            {company.legal_name || company.name}
            {company.email ? ` · ${company.email}` : ""}
            {company.phone ? ` · ${company.phone}` : ""}
          </>
        ) : null}
      </footer>
    </div>
  );
}

function StateCard({
  icon,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: "accent" | "muted";
}) {
  return (
    <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-black/5">
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        style={
          tone === "accent"
            ? { background: "color-mix(in srgb, var(--sv-accent) 14%, white)", color: "var(--sv-accent)" }
            : { background: "#f2f4f7", color: "#667085" }
        }
      >
        {icon}
      </div>
      <h1 className="text-xl font-bold text-[#101828]">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[#475467]">{text}</p>
    </div>
  );
}

export function SurveyPageView({ survey, token }: { survey: PublicSurvey | null; token: string }) {
  if (!survey) {
    return (
      <Shell survey={null}>
        <StateCard
          tone="muted"
          icon={<LinkIcon className="h-7 w-7" />}
          title="Enlace no válido"
          text="Este enlace de encuesta no existe o está incompleto. Verifica que lo copiaste completo desde el correo."
        />
      </Shell>
    );
  }

  const values = {
    empresa: survey.company.name,
    proyecto: survey.project.name,
    cliente: survey.client_name,
    contacto: survey.recipient_name,
  };
  const thanks = fillPlaceholders(survey.texts.thanks, values);

  if (survey.status === "ANSWERED") {
    return (
      <Shell survey={survey}>
        <StateCard
          tone="accent"
          icon={<CheckCircle2 className="h-8 w-8" />}
          title="Encuesta respondida"
          text={`Ya recibimos tus respuestas. ${thanks}`}
        />
      </Shell>
    );
  }

  if (survey.status === "CANCELLED") {
    return (
      <Shell survey={survey}>
        <StateCard
          tone="muted"
          icon={<CircleSlash className="h-7 w-7" />}
          title="Encuesta no disponible"
          text="Esta encuesta ya no recibe respuestas. Si crees que es un error, escríbenos."
        />
      </Shell>
    );
  }

  const eventDate = formatDate(survey.project.event_date);
  const intro = fillPlaceholders(survey.texts.intro, values);

  return (
    <Shell survey={survey}>
      <div className="rounded-2xl bg-white px-5 py-6 shadow-sm ring-1 ring-black/5 sm:px-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--sv-accent)" }}>
          Encuesta de satisfacción
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight text-[#101828]">
          {fillPlaceholders(survey.texts.title, values)}
        </h1>
        {intro ? <p className="mt-3 text-[15px] leading-relaxed text-[#475467]">{intro}</p> : null}
        <div className="mt-4 rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb, var(--sv-accent) 8%, white)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#667085]">Evento</p>
          <p className="font-semibold text-[#101828]">{survey.project.name}</p>
          {eventDate ? <p className="text-sm text-[#667085]">{eventDate}</p> : null}
        </div>
      </div>

      <PublicSurveyForm token={token} questions={survey.questions} thanks={thanks} defaultName={survey.recipient_name ?? ""} />
    </Shell>
  );
}
