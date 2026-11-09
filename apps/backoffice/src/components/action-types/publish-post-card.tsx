import { agentAvatarClass, agentInitials } from "@repo/app-shell/agent-avatar";
import { Card } from "@repo/ui/components/card";
import { AssetImage } from "@repo/ui/compositions/asset-image";
import { cn } from "@repo/ui/lib/utils";
import {
  type AgentSummary,
  POST_PLATFORM_NAMES,
  type PostPlatform,
  type ProposedOf,
} from "@repo/worker-api/contracts";

import { ProposalCard } from "./proposal-card";

const PLATFORM_ABBR = {
  facebook: "FB",
  instagram: "IG",
  linkedin: "in",
  twitter: "X",
} satisfies Record<PostPlatform, string>;

const MARKDOWN_IMAGE = /!\[[^\]]*\]\((?<url>[^\s\)]+)\)/gv;

const markdownImages = (markdown: string): ReadonlyArray<string> =>
  [...markdown.matchAll(MARKDOWN_IMAGE)].flatMap((match) =>
    match.groups?.url === undefined ? [] : [match.groups.url],
  );

type PublishPostCardProps = {
  agent: AgentSummary;
  proposed: ProposedOf<"publish_post">;
};

const PublishPostCard = ({ agent, proposed }: PublishPostCardProps) => {
  const { draft } = proposed;

  if (draft === undefined) {
    return <ProposalCard proposed={proposed} />;
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3.5">
        <div
          aria-hidden
          className="flex size-7 items-center justify-center rounded-panel bg-muted text-xs font-bold text-foreground"
        >
          {PLATFORM_ABBR[draft.platform]}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">
            Publicar em {POST_PLATFORM_NAMES[draft.platform]}
          </div>
          <div className="text-xs text-muted-foreground">Tom · {draft.tone}</div>
        </div>
      </div>

      {markdownImages(proposed.summary).map((url) => (
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
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{draft.body}</p>

        <p className="text-sm font-medium text-foreground">{draft.callToAction}</p>

        {draft.hashtags !== undefined && draft.hashtags.length > 0 && (
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
