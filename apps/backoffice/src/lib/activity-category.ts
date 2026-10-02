const ACTIVITY_CATEGORIES = ["ACTION", "TICKET", "WORKER", "TEAM", "MEMBER"] as const;

type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

type CategoryStyle = { dot: string; label: string; tag: string };

const CATEGORY_STYLE = {
  ACTION: {
    dot: "bg-primary",
    label: "Ações",
    tag: "bg-highlight-surface text-highlight-surface-foreground",
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

const activityCategory = (type: string): ActivityCategory | null =>
  ACTIVITY_CATEGORIES.find((category) => type.startsWith(`${category}_`)) ?? null;

const activityStyle = (type: string): CategoryStyle => {
  const category = activityCategory(type);
  return category === null ? NEUTRAL_STYLE : CATEGORY_STYLE[category];
};

export { ACTIVITY_CATEGORIES, activityStyle, CATEGORY_STYLE };
export type { ActivityCategory };
