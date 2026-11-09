import { type ActivityCategory, activityCategoryOf } from "@repo/worker-api/contracts";

type CategoryStyle = { dot: string; label: string; tag: string };

const CATEGORY_STYLE = {
  ACTION: {
    dot: "bg-primary",
    label: "Ações",
    tag: "bg-highlight-surface text-highlight-surface-foreground",
  },
  CUSTOMER: {
    dot: "bg-warning",
    label: "Clientes",
    tag: "bg-warning-surface text-warning-surface-foreground",
  },
  MEMBER: { dot: "bg-muted-foreground", label: "Agentes", tag: "bg-muted text-foreground" },
  TEAM: {
    dot: "bg-success",
    label: "Times",
    tag: "bg-success-surface text-success-surface-foreground",
  },
  TICKET: { dot: "bg-info", label: "Tickets", tag: "bg-info-surface text-info-surface-foreground" },
  WORKER: {
    dot: "bg-worker-surface-foreground",
    label: "Especialistas",
    tag: "bg-worker-surface text-worker-surface-foreground",
  },
} satisfies Record<ActivityCategory, CategoryStyle>;

const NEUTRAL_STYLE: CategoryStyle = {
  dot: "bg-muted-foreground",
  label: "Outros",
  tag: "bg-muted text-foreground",
};

const activityStyle = (type: string): CategoryStyle => {
  const category = activityCategoryOf(type);

  return category === null ? NEUTRAL_STYLE : CATEGORY_STYLE[category];
};

export { activityStyle, CATEGORY_STYLE };
