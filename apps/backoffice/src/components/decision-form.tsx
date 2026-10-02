"use client";

import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";
import type { ActionsResponse, DecisionOutcome } from "@repo/worker-api/contracts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { apiGet, apiSend, describeRequestError } from "@/lib/api-client";

type DecisionFormProps = {
  actionId: string;
  allowChanges: boolean;
  defaultDecision: DecisionOutcome | null;
};

const PLACEHOLDER = {
  approved: "Comentário opcional ao especialista.",
  changes_requested: "Diga o que precisa mudar; o especialista vai usar para revisar.",
  rejected: "Diga por que está rejeitando; vai virar memória do agente.",
} satisfies Record<DecisionOutcome, string>;

const OPTIONS: ReadonlyArray<{
  description: string;
  label: string;
  value: DecisionOutcome;
}> = [
  {
    description: "Executa a proposta exatamente como foi apresentada.",
    label: "Aprovar",
    value: "approved",
  },
  {
    description: "Devolve para o especialista com seu pedido de ajuste.",
    label: "Pedir ajustes",
    value: "changes_requested",
  },
  {
    description: "Encerra a proposta. O especialista é notificado.",
    label: "Rejeitar",
    value: "rejected",
  },
];

const SUBMIT_LABEL = {
  approved: "Aprovar e executar",
  changes_requested: "Pedir ajustes",
  rejected: "Rejeitar ação",
} satisfies Record<DecisionOutcome, string>;

const MAX_FEEDBACK = 2000;

const SUCCESS_COPY = {
  approved: "Aprovado. O especialista vai executar.",
  changes_requested: "Ajustes pedidos. O especialista vai revisar.",
  rejected: "Rejeitado. O especialista foi avisado.",
} satisfies Record<DecisionOutcome, string>;

const submitLabel = (decision: DecisionOutcome | null): string =>
  decision === null ? "Escolha uma decisão" : SUBMIT_LABEL[decision];

const nextPendingId = async (currentId: string): Promise<string | null> => {
  try {
    const { items } = await apiGet<ActionsResponse>("/actions?status=pending");
    return items.find((item) => item.id !== currentId)?.id ?? null;
  } catch {
    return null;
  }
};

const DecisionForm = ({ actionId, allowChanges, defaultDecision }: DecisionFormProps) => {
  const { push, refresh } = useRouter();
  const [decision, setDecision] = useState<DecisionOutcome | null>(defaultDecision);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMissing, setFeedbackMissing] = useState(false);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  const feedbackRequired = decision !== null && decision !== "approved";
  const options = allowChanges
    ? OPTIONS
    : OPTIONS.filter((opt) => opt.value !== "changes_requested");

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || decision === null) {
      return;
    }
    if (feedbackRequired && feedback.trim().length === 0) {
      setFeedbackMissing(true);
      feedbackRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await apiSend("POST", `/actions/${actionId}/decide`, {
        decision,
        feedback: feedback.trim() || undefined,
      });
      const nextId = await nextPendingId(actionId);
      toast.success(
        nextId === null ? SUCCESS_COPY[decision] : `${SUCCESS_COPY[decision]} Abrindo a próxima.`,
      );
      push(nextId === null ? "/approvals" : `/approvals/${nextId}`);
      refresh();
    } catch (error) {
      toast.error(describeRequestError(error, "Não foi possível enviar a decisão."));
    }
    setSubmitting(false);
  };

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Decisão</legend>
        {options.map((opt) => {
          const inputId = `decision-${opt.value}`;
          const descriptionId = `${inputId}-description`;
          const selected = decision === opt.value;
          return (
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                selected
                  ? "border-primary bg-highlight-surface ring-1 ring-primary/40"
                  : "border-border hover:border-input hover:bg-accent",
              )}
              htmlFor={inputId}
              key={opt.value}
            >
              <input
                aria-describedby={descriptionId}
                checked={selected}
                className="sr-only"
                id={inputId}
                name="decision"
                onChange={() => {
                  setDecision(opt.value);
                  setFeedbackMissing(false);
                }}
                type="radio"
                value={opt.value}
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-(length:--decision-border-width) transition-colors",
                  selected ? "border-primary" : "border-input",
                )}
              >
                {selected && <span className="size-2 rounded-full bg-primary" />}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <span className="text-xs leading-snug text-muted-foreground" id={descriptionId}>
                  {opt.description}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {!allowChanges && (
        <p className="text-xs text-muted-foreground">
          Esta é a última revisão permitida: aprove ou rejeite esta versão.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center justify-between" htmlFor="decision-feedback">
          <span className="text-sm font-medium text-foreground">
            Observações{" "}
            <span
              className={cn(
                "ml-1 text-xs font-normal",
                feedbackRequired ? "text-warning-surface-foreground" : "text-muted-foreground",
              )}
            >
              {feedbackRequired ? "(obrigatório)" : "(opcional)"}
            </span>
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {feedback.length}/{MAX_FEEDBACK}
          </span>
        </label>
        <Textarea
          aria-describedby={feedbackMissing ? "decision-feedback-error" : undefined}
          aria-invalid={feedbackMissing}
          aria-required={feedbackRequired}
          id="decision-feedback"
          maxLength={MAX_FEEDBACK}
          onChange={(e) => {
            setFeedback(e.target.value);
            setFeedbackMissing(false);
          }}
          placeholder={decision === null ? "Escolha uma decisão acima." : PLACEHOLDER[decision]}
          ref={feedbackRef}
          value={feedback}
        />
        {feedbackMissing && (
          <p className="text-xs text-destructive" id="decision-feedback-error" role="alert">
            Escreva o motivo: o especialista usa isso para entender a decisão.
          </p>
        )}
      </div>

      <Button
        className="w-full"
        disabled={submitting || decision === null}
        size="lg"
        type="submit"
        variant={decision === "rejected" ? "destructive" : "default"}
      >
        {submitting ? "Enviando…" : submitLabel(decision)}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        A decisão retoma o fluxo de trabalho do agente.
      </p>
    </form>
  );
};

export { DecisionForm };
