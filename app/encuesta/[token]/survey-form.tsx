"use client";

import { useActionState, useState, startTransition } from "react";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { submitPublicSurveyAction, type PublicSubmitState } from "@/features/surveys/public-actions";
import type { PublicQuestion } from "@/features/surveys/public";

type Value = string | number | string[] | undefined;

const RATING_LABELS = ["Muy mala", "Mala", "Regular", "Buena", "Excelente"];

function isEmpty(v: Value): boolean {
  return v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "string" && !v.trim());
}

export function PublicSurveyForm({
  token,
  questions,
  thanks,
  defaultName,
}: {
  token: string;
  questions: PublicQuestion[];
  thanks: string;
  defaultName: string;
}) {
  const [values, setValues] = useState<Record<string, Value>>(() => {
    const init: Record<string, Value> = {};
    const nameQ = questions.find((q) => q.metric === "RESPONDENT_NAME");
    if (nameQ && defaultName) init[nameQ.key] = defaultName;
    return init;
  });
  const [missing, setMissing] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState<PublicSubmitState, FormData>(
    submitPublicSurveyAction.bind(null, token),
    { done: false, error: null },
  );

  function set(key: string, v: Value) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setMissing((m) => m.filter((k) => k !== key));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const miss = questions.filter((q) => q.required && isEmpty(values[q.key])).map((q) => q.key);
    setMissing(miss);
    if (miss.length > 0) {
      document.getElementById(`q-${miss[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const answers: Record<string, Value> = {};
    for (const q of questions) {
      const v = values[q.key];
      if (!isEmpty(v)) answers[q.key] = typeof v === "string" ? v.trim() : v;
    }
    const fd = new FormData();
    fd.set("answers", JSON.stringify(answers));
    startTransition(() => formAction(fd));
  }

  if (state.done) {
    return (
      <div className="mt-4 rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-black/5">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--sv-accent) 14%, white)", color: "var(--sv-accent)" }}
        >
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-[#101828]">¡Gracias!</h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[#475467]">{thanks}</p>
      </div>
    );
  }

  const serverMissing = state.question ? questions.find((q) => q.text === state.question)?.key : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
      {questions.map((q, i) => {
        const invalid = missing.includes(q.key) || serverMissing === q.key;
        return (
          <fieldset
            key={q.key}
            id={`q-${q.key}`}
            className={`rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 transition sm:px-7 ${
              invalid ? "ring-2 ring-[#f04438]" : "ring-black/5"
            }`}
          >
            <legend className="sr-only">{q.text}</legend>
            <div className="flex gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "var(--sv-dark)" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold leading-snug text-[#101828]">
                  {q.text}
                  {q.required ? <span className="ml-1 text-[#f04438]">*</span> : null}
                </p>
                {q.help ? <p className="mt-1 text-sm text-[#667085]">{q.help}</p> : null}
              </div>
            </div>
            <div className="mt-4">
              <QuestionInput q={q} value={values[q.key]} onChange={(v) => set(q.key, v)} />
            </div>
            {invalid ? <p className="mt-3 text-sm font-medium text-[#f04438]">Esta pregunta es obligatoria.</p> : null}
          </fieldset>
        );
      })}

      {state.error ? (
        <div className="rounded-xl bg-[#fdecec] px-4 py-3 text-sm font-medium text-[#b42318]" role="alert">
          {state.error}
        </div>
      ) : null}
      {missing.length > 0 ? (
        <div className="rounded-xl bg-[#fdecec] px-4 py-3 text-sm font-medium text-[#b42318]" role="alert">
          {missing.length === 1 ? "Falta responder 1 pregunta obligatoria." : `Faltan ${missing.length} preguntas obligatorias.`}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-70"
        style={{ background: "var(--sv-accent)" }}
      >
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {pending ? "Enviando…" : "Enviar respuestas"}
      </button>
      <p className="text-center text-xs text-[#98a2b3]">
        <span className="text-[#f04438]">*</span> Obligatoria
      </p>
    </form>
  );
}

function QuestionInput({ q, value, onChange }: { q: PublicQuestion; value: Value; onChange: (v: Value) => void }) {
  const base =
    "w-full rounded-xl border border-[#d0d5dd] bg-white px-4 py-3 text-[16px] text-[#101828] outline-none transition focus:border-[var(--sv-accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--sv-accent)_18%,transparent)]";

  switch (q.type) {
    case "RATING_5": {
      const n = typeof value === "number" ? value : 0;
      return (
        <div>
          <div className="flex justify-between gap-1.5 sm:justify-start sm:gap-3" role="radiogroup" aria-label={q.text}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={n === s}
                aria-label={`${s} de 5 · ${RATING_LABELS[s - 1]}`}
                onClick={() => onChange(s)}
                className="flex h-14 flex-1 items-center justify-center rounded-xl border transition sm:w-14 sm:flex-none"
                style={
                  s <= n
                    ? { borderColor: "var(--sv-accent)", background: "color-mix(in srgb, var(--sv-accent) 10%, white)" }
                    : { borderColor: "#e4e7ec" }
                }
              >
                <Star
                  className="h-7 w-7"
                  strokeWidth={1.8}
                  style={s <= n ? { color: "var(--sv-accent)", fill: "var(--sv-accent)" } : { color: "#c4cad3" }}
                />
              </button>
            ))}
          </div>
          <p className="mt-2 h-5 text-sm font-medium" style={{ color: n ? "var(--sv-accent)" : "#98a2b3" }}>
            {n ? `${n} · ${RATING_LABELS[n - 1]}` : "Toca una estrella"}
          </p>
        </div>
      );
    }
    case "NPS_10": {
      const n = typeof value === "number" ? value : -1;
      return (
        <div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11" role="radiogroup" aria-label={q.text}>
            {Array.from({ length: 11 }, (_, s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={n === s}
                onClick={() => onChange(s)}
                className="h-12 rounded-lg border text-base font-semibold transition"
                style={
                  n === s
                    ? { background: "var(--sv-accent)", borderColor: "var(--sv-accent)", color: "white" }
                    : { borderColor: "#e4e7ec", color: "#344054" }
                }
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-[#667085]">
            <span>0 · Nada probable</span>
            <span>10 · Muy probable</span>
          </div>
        </div>
      );
    }
    case "SHORT_TEXT":
      return (
        <input
          type="text"
          className={base}
          maxLength={300}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={q.metric === "RESPONDENT_NAME" ? "name" : "off"}
          placeholder="Tu respuesta"
        />
      );
    case "LONG_TEXT":
      return (
        <textarea
          className={`${base} min-h-32 resize-y`}
          maxLength={5000}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe aquí…"
        />
      );
    case "YES_NO":
      return (
        <ChoiceList
          options={[
            { value: "SI", label: "Sí" },
            { value: "NO", label: "No" },
          ]}
          selected={typeof value === "string" ? [value] : []}
          onToggle={(v) => onChange(v)}
          multiple={false}
          columns
        />
      );
    case "SINGLE_CHOICE":
      return (
        <ChoiceList
          options={q.options.map((o) => ({ value: o, label: o }))}
          selected={typeof value === "string" ? [value] : []}
          onToggle={(v) => onChange(v)}
          multiple={false}
        />
      );
    case "MULTIPLE_CHOICE": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <ChoiceList
          options={q.options.map((o) => ({ value: o, label: o }))}
          selected={arr}
          onToggle={(v) => onChange(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])}
          multiple
        />
      );
    }
    default:
      return null;
  }
}

function ChoiceList({
  options,
  selected,
  onToggle,
  multiple,
  columns,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  multiple: boolean;
  columns?: boolean;
}) {
  return (
    <div className={columns ? "grid grid-cols-2 gap-2" : "space-y-2"} role={multiple ? "group" : "radiogroup"}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => onToggle(o.value)}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] font-medium transition"
            style={
              on
                ? { borderColor: "var(--sv-accent)", background: "color-mix(in srgb, var(--sv-accent) 8%, white)", color: "#101828" }
                : { borderColor: "#e4e7ec", color: "#344054" }
            }
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${multiple ? "rounded-md" : "rounded-full"}`}
              style={{ borderColor: on ? "var(--sv-accent)" : "#c4cad3", background: on ? "var(--sv-accent)" : "white" }}
            >
              {on ? <span className={`bg-white ${multiple ? "h-2 w-2 rounded-sm" : "h-2 w-2 rounded-full"}`} /> : null}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
