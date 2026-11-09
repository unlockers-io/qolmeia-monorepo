/** Activity types are free-form strings; their prefix up to the first `_` is the category. */
const ACTIVITY_CATEGORIES = ["ACTION", "TICKET", "WORKER", "TEAM", "MEMBER", "CUSTOMER"] as const;

type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

const activityCategoryOf = (type: string): ActivityCategory | null =>
  ACTIVITY_CATEGORIES.find((category) => type.startsWith(`${category}_`)) ?? null;

export { ACTIVITY_CATEGORIES, activityCategoryOf };

export type { ActivityCategory };
