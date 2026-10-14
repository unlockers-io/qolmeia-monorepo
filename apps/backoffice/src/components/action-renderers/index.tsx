import type { Action, ActionType, AgentSummary } from "@repo/worker-api/contracts";
import type { ComponentType } from "react";

import { ProposalCard } from "./proposal-card";
import { PublishPostCard } from "./publish-post-card";

type ActionRendererProps = { agent: AgentSummary; proposed: Action["proposed"] };

const ACTION_RENDERERS = {
  publish_post: PublishPostCard,
  worker_deliverable: ProposalCard,
} satisfies Record<ActionType, ComponentType<ActionRendererProps>>;

export { ACTION_RENDERERS };
