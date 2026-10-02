"use client";

import { Button } from "@repo/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@repo/ui/components/field";
import { Textarea } from "@repo/ui/components/textarea";
import { useState } from "react";

type PromptEditorProps = {
  busy?: boolean;
  initialValue: string | null;
  onReset: () => Promise<void>;
  onSave: (value: string) => Promise<void>;
  updatedAt: number | null;
};

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });

const PromptEditor = ({ busy, initialValue, onReset, onSave, updatedAt }: PromptEditorProps) => {
  const [value, setValue] = useState(initialValue ?? "");
  const overridden = initialValue !== null;
  const dirty = value !== (initialValue ?? "");

  return (
    <section aria-label="Comportamento do agente" className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="prompt-editor">Instruções para este agente</FieldLabel>
        <Textarea
          disabled={busy}
          id="prompt-editor"
          onChange={(e) => {
            setValue(e.target.value);
          }}
          placeholder="Ex.: Use um tom descontraído e sempre inclua o endereço da loja."
          rows={8}
          value={value}
        />
        <FieldDescription>
          {overridden && updatedAt !== null
            ? `Você personalizou estas instruções em ${formatDate(updatedAt)}. Mudanças passam a valer na próxima interação.`
            : "Mudanças passam a valer na próxima interação."}
        </FieldDescription>
      </Field>
      <div className="flex justify-end gap-2">
        <Button
          disabled={busy === true || !overridden}
          onClick={() => {
            void (async () => {
              await onReset();
              setValue("");
            })();
          }}
          variant="outline"
        >
          Restaurar padrão
        </Button>
        <Button
          disabled={busy === true || !dirty}
          onClick={() => {
            void onSave(value);
          }}
        >
          Salvar
        </Button>
      </div>
    </section>
  );
};

export { PromptEditor };
