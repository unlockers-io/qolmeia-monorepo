import { Card } from "@repo/ui/components/card";
import { AssetImage } from "@repo/ui/compositions/asset-image";
import { agentAvatarClass, agentInitials } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import type { Action, AgentSummary } from "@repo/worker-api/contracts";
import { z } from "zod";

import { ProposalCard } from "./proposal-card";
import { proposalSummary } from "./proposal-summary";

type PlatformCopyContract = Record<string, string>;

const PLATFORM_COPY = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
} satisfies PlatformCopyContract;

const platformCopy = new Map<string, string>(Object.entries(PLATFORM_COPY));

type PlatformAbbrContract = Record<string, string>;

const PLATFORM_ABBR = {
  facebook: "FB",
  instagram: "IG",
  linkedin: "in",
  twitter: "X",
} satisfies PlatformAbbrContract;

const platformAbbrByName = new Map<string, string>(Object.entries(PLATFORM_ABBR));

type Draft = {
  body?: string;
  callToAction?: string;
  hashtags?: ReadonlyArray<string>;
  platform?: string;
  tone?: string;
};

const hasText = (value: string | undefined): value is string => value !== undefined && value !== "";

const draftSchema = z.record(z.string(), z.unknown());

const readDraft = (proposed: Action["proposed"]): Draft | null => {
  const parsed = draftSchema.safeParse(proposed.draft);
  if (!parsed.success) {
    return null;
  }
  const draft = parsed.data;
  return {
    body: typeof draft.body === "string" ? draft.body : undefined,
    callToAction: typeof draft.callToAction === "string" ? draft.callToAction : undefined,
    hashtags: Array.isArray(draft.hashtags)
      ? draft.hashtags.filter((h): h is string => typeof h === "string")
      : undefined,
    platform: typeof draft.platform === "string" ? draft.platform : undefined,
    tone: typeof draft.tone === "string" ? draft.tone : undefined,
  };
};

const MARKDOWN_IMAGE = /!\[[^\]]*\]\((?<url>[^\s\)]+)\)/gv;

const summaryImages = (proposed: Action["proposed"]): ReadonlyArray<string> =>
  [...(proposalSummary(proposed) ?? "").matchAll(MARKDOWN_IMAGE)].flatMap((match) =>
    match.groups?.url === undefined ? [] : [match.groups.url],
  );

type PublishPostCardProps = {
  agent: AgentSummary;
  proposed: Action["proposed"];
};

const PublishPostCard = ({ agent, proposed }: PublishPostCardProps) => {
  const draft = readDraft(proposed);
  if (!draft) {
    return <ProposalCard proposed={proposed} />;
  }
  const images = summaryImages(proposed);

  const platformLabel = hasText(draft.platform)
    ? (platformCopy.get(draft.platform) ?? draft.platform)
    : "Rede social";
  const platformAbbr = hasText(draft.platform)
    ? (platformAbbrByName.get(draft.platform) ?? "•")
    : "•";

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3.5">
        <div
          aria-hidden
          className="flex size-7 items-center justify-center rounded-panel bg-muted text-xs font-bold text-foreground"
        >
          {platformAbbr}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">Publicar em {platformLabel}</div>
          {hasText(draft.tone) && (
            <div className="text-xs text-muted-foreground">Tom · {draft.tone}</div>
          )}
        </div>
      </div>

      {images.map((url) => (
        <AssetImage
          alt={`Arte proposta por ${agent.name}`}
          className="h-auto max-h-(--layout-max-h-dialog-viewport) w-full object-contain"
          height={1024}
          key={url}
          loading="eager"
          src={url}
          width={1024}
        />
      ))}

      <div className="flex flex-col gap-3 px-4 py-4">
        {hasText(draft.body) && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {draft.body}
          </p>
        )}

        {hasText(draft.callToAction) && (
          <p className="text-sm font-medium text-foreground">{draft.callToAction}</p>
        )}

        {draft.hashtags && draft.hashtags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {draft.hashtags.map((tag) => (
              <li
                className="rounded-full bg-highlight-surface px-2 py-2 text-xs font-medium text-highlight-surface-foreground"
                key={tag}
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
          <div
            aria-hidden
            className={cn(
              "flex size-5.5 items-center justify-center rounded-control-inset text-xs font-bold text-white",
              agentAvatarClass(agent.role, agent.workerKind),
            )}
          >
            {agentInitials(agent.name)}
          </div>
          <span className="text-xs text-muted-foreground">Proposto por {agent.name}</span>
        </div>
      </div>
    </Card>
  );
};

export { PublishPostCard };
