"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";
import {
  createSurveyQuestionAction,
  deleteSurveyQuestionAction,
  moveSurveyQuestionAction,
  toggleSurveyQuestionAction,
  updateSurveyQuestionAction,
  type SurveyActionState,
} from "@/features/surveys/actions";
import { CHOICE_TYPES, METRIC_LABELS, METRICS_BY_TYPE, QUESTION_TYPES, QUESTION_TYPE_LABELS } from "@/features/surveys/schema";

type Question = {
  id: string;
  position: number;
  question_text: string;
  help_text: string | null;
  question_type: string;
  options: string[];
  is_required: boolean;
  is_active: boolean;
  metric: string | null;
};

export function SurveyQuestionsManager({ questions, canManage }: { questions: Question[]; canManage: boolean }) {
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const [pending, startAction] = useTransition();
  const active = questions.filter((q) => q.is_active).length;

  function run(fn: () => Promise<void>) {
    startAction(async () => {
      try {
        await fn();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold text-brand-text">Preguntas</h3>
          <p className="text-xs text-brand-muted">
            {active} activa{active === 1 ? "" : "s"} de {questions.length}. El cliente las ve en este orden.
          </p>
        </div>
        {canManage && (
          <Button type="button" size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setEditing("new")}>
            Agregar pregunta
          </Button>
        )}
      </div>

      <Card padded={false}>
        <ol className="divide-y divide-brand-border">
          {questions.map((q, i) => (
            <li key={q.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${q.is_active ? "" : "bg-brand-background"}`}>
              <div className="flex min-w-0 flex-1 gap-3">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    q.is_active ? "bg-brand-primary text-white" : "bg-brand-disabled text-white"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${q.is_active ? "text-brand-text" : "text-brand-muted line-through"}`}>
                    {q.question_text}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{QUESTION_TYPE_LABELS[q.question_type] ?? q.question_type}</Badge>
                    {q.is_required ? <Badge tone="info">Obligatoria</Badge> : <Badge tone="neutral">Opcional</Badge>}
                    {q.metric && <Badge tone="success">{METRIC_LABELS[q.metric]}</Badge>}
                    {!q.is_active && <Badge tone="warning">Desactivada</Badge>}
                  </div>
                  {q.options.length > 0 && (
                    <p className="mt-1 text-xs text-brand-muted">Opciones: {q.options.join(" · ")}</p>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 flex-wrap items-center gap-1 pl-9 sm:pl-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Subir"
                    aria-label="Subir"
                    disabled={pending || i === 0}
                    onClick={() => run(() => moveSurveyQuestionAction(q.id, "up"))}
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Bajar"
                    aria-label="Bajar"
                    disabled={pending || i === questions.length - 1}
                    onClick={() => run(() => moveSurveyQuestionAction(q.id, "down"))}
                  >
                    <ArrowDown size={15} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => toggleSurveyQuestionAction(q.id, "is_required"))}
                  >
                    {q.is_required ? "Hacer opcional" : "Hacer obligatoria"}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title={q.is_active ? "Desactivar" : "Activar"}
                    aria-label={q.is_active ? "Desactivar" : "Activar"}
                    disabled={pending}
                    onClick={() => run(() => toggleSurveyQuestionAction(q.id, "is_active"))}
                  >
                    {q.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                  <Button type="button" size="icon" variant="ghost" title="Editar" aria-label="Editar" onClick={() => setEditing(q)}>
                    <Pencil size={15} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Eliminar"
                    aria-label="Eliminar"
                    onClick={() => setDeleting(q)}
                  >
                    <Trash2 size={15} className="text-brand-danger" />
                  </Button>
                </div>
              )}
            </li>
          ))}
          {questions.length === 0 && <li className="px-4 py-6 text-center text-sm text-brand-muted">Sin preguntas todavía.</li>}
        </ol>
      </Card>

      {editing && (
        <QuestionDialog
          key={editing === "new" ? "new" : editing.id}
          question={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && <DeleteQuestionDialog question={deleting} onClose={() => setDeleting(null)} />}
    </section>
  );
}

function QuestionDialog({ question, onClose }: { question: Question | null; onClose: () => void }) {
  const action = question ? updateSurveyQuestionAction.bind(null, question.id) : createSurveyQuestionAction;
  const [state, formAction, pending] = useActionState<SurveyActionState, FormData>(action, { error: null });
  const [type, setType] = useState(question?.question_type ?? "RATING_5");
  const [metric, setMetric] = useState(question?.metric ?? "");

  useEffect(() => {
    if (state.successId) {
      toast.success(state.success ?? "Guardado.");
      onClose();
    }
  }, [state.successId, state.success, onClose]);

  const metrics = METRICS_BY_TYPE[type] ?? [];
  const isChoice = CHOICE_TYPES.includes(type);

  return (
    <Modal open onClose={() => !pending && onClose()} title={question ? "Editar pregunta" : "Nueva pregunta"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
        className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
      >
        <Textarea label="Pregunta" name="question_text" required rows={2} defaultValue={question?.question_text ?? ""} />
        <Input
          label="Ayuda (opcional)"
          name="help_text"
          defaultValue={question?.help_text ?? ""}
          hint="Texto pequeño debajo de la pregunta, ej. “1 = Muy mala · 5 = Excelente”."
        />
        <Select
          label="Tipo de respuesta"
          name="question_type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            if (!(METRICS_BY_TYPE[e.target.value] ?? []).includes(metric)) setMetric("");
          }}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        {isChoice && (
          <Textarea
            label="Opciones"
            name="options"
            required
            rows={4}
            defaultValue={question?.options.join("\n") ?? ""}
            hint="Una opción por línea."
          />
        )}
        {metrics.length > 0 && (
          <Select
            label="Cuenta para el indicador (reportes)"
            name="metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            hint="Así la respuesta alimenta la calificación, el NPS, la recomendación, etc. del proyecto."
          >
            <option value="">Ninguno</option>
            {metrics.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m]}
              </option>
            ))}
          </Select>
        )}
        <label className="flex items-center gap-2 text-sm text-brand-text">
          <input
            type="checkbox"
            name="is_required"
            defaultChecked={question?.is_required ?? true}
            className="h-4 w-4 rounded border-brand-border accent-[var(--brand-accent)]"
          />
          Obligatoria
        </label>
        {state.error && <p className="text-sm text-brand-danger">{state.error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            {question ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteQuestionDialog({ question, onClose }: { question: Question; onClose: () => void }) {
  const [pending, startDelete] = useTransition();
  return (
    <Modal open onClose={() => !pending && onClose()} title="¿Eliminar esta pregunta?">
      <p className="text-sm text-brand-text">“{question.question_text}”</p>
      <p className="mt-2 text-sm text-brand-muted">
        Si ya tiene respuestas, no se borra: se desactiva para conservar los reportes. Las encuestas ya enviadas no
        cambian.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Volver
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={() =>
            startDelete(async () => {
              const res = await deleteSurveyQuestionAction(question.id);
              if (res.error) toast.error(res.error);
              else toast.success(res.success ?? "Pregunta eliminada.");
              onClose();
            })
          }
        >
          Eliminar
        </Button>
      </div>
    </Modal>
  );
}
