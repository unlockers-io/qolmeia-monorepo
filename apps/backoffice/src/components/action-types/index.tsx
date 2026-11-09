import type {
  ActionOf,
  ActionType,
  AgentSummary,
  DecisionOutcome,
  ProposedOf,
} from "@repo/worker-api/contracts";
import type { ComponentType } from "react";

import { ProposalCard } from "./proposal-card";
import { PublishPostCard } from "./publish-post-card";

type ActionTypeView<Type extends ActionType> = {
  Card: ComponentType<{ agent: AgentSummary; proposed: ProposedOf<Type> }>;
  defaultDecision: DecisionOutcome | null;
  label: string;
};

const ACTION_TYPE_VIEWS = {
  publish_post: {
    Card: PublishPostCard,
    defaultDecision: null,
    label: "Publicar post",
  },
  worker_deliverable: {
    Card: ProposalCard,
    defaultDecision: "approved",
    label: "Entrega",
  },
} satisfies { [Type in ActionType]: ActionTypeView<Type> };

const ActionCard = <Type extends ActionType>({ action }: { action: ActionOf<Type> }) => {
  const { Card } = ACTION_TYPE_VIEWS[action.actionType];

  return <Card agent={action.agent} proposed={action.proposed} />;
};

export { ACTION_TYPE_VIEWS, ActionCard };
