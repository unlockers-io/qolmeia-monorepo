import { cn } from "@repo/ui/lib/utils";
import type { SkillCatalogEntry } from "@repo/worker-api/contracts";
import { Skeleton } from "skullet/react";

type SkillOption = Pick<SkillCatalogEntry, "displayName" | "id">;

type TemplateFormSkillPickerProps = {
  busy: boolean;
  onToggle: (id: string) => void;
  selected: ReadonlyArray<string>;
  skills: ReadonlyArray<SkillOption> | null;
};

const SAMPLE_SKILLS: ReadonlyArray<SkillOption> = [
  { displayName: "Atualizar brief", id: "extractBrief" },
  { displayName: "Delegar para especialista", id: "delegateToWorker" },
  { displayName: "Propor time", id: "proposeTeam" },
  { displayName: "Rascunhar post social", id: "draftSocialPost" },
  { displayName: "Gerar imagem de marca", id: "generateBrandImage" },
  { displayName: "Lembrar fato", id: "rememberFact" },
  { displayName: "Recordar memória", id: "recallMemory" },
  { displayName: "Listar arquivos", id: "listAssets" },
  { displayName: "Ler arquivo", id: "readAsset" },
  { displayName: "Salvar arquivo", id: "saveAsset" },
  { displayName: "Buscar na web", id: "webSearch" },
  { displayName: "Ler página da web", id: "fetchUrl" },
];

const TemplateFormSkillPicker = ({
  busy,
  onToggle,
  selected,
  skills,
}: TemplateFormSkillPickerProps) => {
  const selectedIds = new Set(selected);

  return (
    <Skeleton data={skills} label="Carregando habilidades" sample={SAMPLE_SKILLS}>
      {(options) =>
        options.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma habilidade disponível.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {options.map((skill) => {
              const checked = selectedIds.has(skill.id);

              return (
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                    checked
                      ? "border-primary bg-highlight-surface ring-1 ring-primary/40"
                      : "border-border hover:border-input hover:bg-accent",
                  )}
                  key={skill.id}
                >
                  <input
                    aria-label={skill.displayName}
                    checked={checked}
                    className="mt-0.5 size-4 accent-primary"
                    disabled={busy}
                    onChange={() => {
                      onToggle(skill.id);
                    }}
                    type="checkbox"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {skill.displayName}
                    </span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {skill.id}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )
      }
    </Skeleton>
  );
};

export { TemplateFormSkillPicker };
