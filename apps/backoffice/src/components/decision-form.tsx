"use client";

import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { ClientReadyForm } from "@repo/ui/compositions/client-ready-form";
import { FormAlert } from "@repo/ui/compositions/form-alert";
import { focusFirstInvalidField } from "@repo/ui/lib/focus-first-invalid-field";
import { cn } from "@repo/ui/lib/utils";
import type { ActionsResponse, DecisionOutcome } from "@repo/worker-api/contracts";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
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

const feedbackError = (feedback: string, required: boolean): string | null => {
  const length = feedback.trim().length;
  if (length > MAX_FEEDBACK) {
    return `Use no máximo ${MAX_FEEDBACK} caracteres.`;
  }
  if (required && length === 0) {
    return "Escreva o motivo: o especialista usa isso para entender a decisão.";
  }
  return null;
};

const nextPendingId = async (currentId: string): Promise<string | null> => {
  try {
    const { items } = await apiGet<ActionsResponse>("/actions?status=pending");
    return items.find((item) => item.id !== currentId)?.id ?? null;
  } catch {
    return null;
  }
};

type DecisionOptionProps = {
  decisionMissing: boolean;
  onSelect: () => void;
  option: (typeof OPTIONS)[number];
  selected: boolean;
};

const DecisionOption = ({ decisionMissing, onSelect, option, selected }: DecisionOptionProps) => {
  const inputId = `decision-${option.value}`;
  const descriptionId = `${inputId}-description`;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-highlight-surface ring-1 ring-primary/40"
          : "border-border hover:border-input hover:bg-accent",
      )}
      htmlFor={inputId}
    >
      <input
        aria-describedby={decisionMissing ? `${descriptionId} decision-error` : descriptionId}
        // oxlint-disable-next-line jsx-a11y/role-supports-aria-props -- focusFirstInvalidField finds the first option through it, and browsers still expose it on radios
        aria-invalid={decisionMissing}
        checked={selected}
        className="sr-only"
        id={inputId}
        name="decision"
        onChange={onSelect}
        type="radio"
        value={option.value}
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
        <span className="text-sm font-semibold text-foreground">{option.label}</span>
        <span className="text-xs leading-snug text-muted-foreground" id={descriptionId}>
          {option.description}
        </span>
      </span>
    </label>
  );
};

type FeedbackFieldProps = {
  decision: DecisionOutcome | null;
  error: string | null;
  onChange: (value: string) => void;
  required: boolean;
  value: string;
};

const FeedbackField = ({ decision, error, onChange, required, value }: FeedbackFieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex items-center justify-between" htmlFor="decision-feedback">
      <span className="text-sm font-medium text-foreground">
        Observações{" "}
        <span
          className={cn(
            "ml-1 text-xs font-normal",
            required ? "text-warning-surface-foreground" : "text-muted-foreground",
          )}
        >
          {required ? "(obrigatório)" : "(opcional)"}
        </span>
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {value.length}/{MAX_FEEDBACK}
      </span>
    </label>
    <Textarea
      aria-describedby={error === null ? undefined : "decision-feedback-error"}
      aria-invalid={error !== null}
      aria-required={required}
      id="decision-feedback"
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={decision === null ? "Escolha uma decisão acima." : PLACEHOLDER[decision]}
      value={value}
    />
    {error !== null && (
      <p className="text-xs text-destructive" id="decision-feedback-error" role="alert">
        {error}
      </p>
    )}
  </div>
);

const DecisionForm = ({ actionId, allowChanges, defaultDecision }: DecisionFormProps) => {
  const { push, refresh } = useRouter();
  const formId = useId();
  const [decision, setDecision] = useState<DecisionOutcome | null>(defaultDecision);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const feedbackRequired = decision !== null && decision !== "approved";
  const invalidFeedback = feedbackError(feedback, feedbackRequired);
  const decisionMissing = submitAttempted && decision === null;
  const options = allowChanges
    ? OPTIONS
    : OPTIONS.filter((opt) => opt.value !== "changes_requested");

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitAttempted(true);
    if (decision === null || invalidFeedback !== null) {
      focusFirstInvalidField(formId);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
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
      setSubmitError(describeRequestError(error, "Não foi possível enviar a decisão."));
    }
    setSubmitting(false);
  };

  return (
    <ClientReadyForm
      className="flex flex-col gap-3.5"
      id={formId}
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <FormAlert message={submitError} />
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Decisão</legend>
        {options.map((opt) => (
          <DecisionOption
            decisionMissing={decisionMissing}
            key={opt.value}
            onSelect={() => {
              setDecision(opt.value);
              setSubmitError(null);
            }}
            option={opt}
            selected={decision === opt.value}
          />
        ))}
      </fieldset>
      {decisionMissing && (
        <p className="text-xs text-destructive" id="decision-error" role="alert">
          Escolha uma decisão.
        </p>
      )}
      {!allowChanges && (
        <p className="text-xs text-muted-foreground">
          Esta é a última revisão permitida: aprove ou rejeite esta versão.
        </p>
      )}

      <FeedbackField
        decision={decision}
        error={submitAttempted ? invalidFeedback : null}
        onChange={(value) => {
          setFeedback(value);
          setSubmitError(null);
        }}
        required={feedbackRequired}
        value={feedback}
      />

      <Button
        className="w-full"
        disabled={submitting}
        size="lg"
        type="submit"
        variant={decision === "rejected" ? "destructive" : "default"}
      >
        {submitting ? "Enviando…" : submitLabel(decision)}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        A decisão retoma o fluxo de trabalho do agente.
      </p>
    </ClientReadyForm>
  );
};

export { DecisionForm };
