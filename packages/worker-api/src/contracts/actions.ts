import { ActionPolicy } from "@repo/db/enums";
import { z } from "zod";

const ACTION_TYPES = ["publish_post", "worker_deliverable"] as const;

type ActionType = (typeof ACTION_TYPES)[number];

const actionTypeSchema = z.enum(ACTION_TYPES);

const actionPolicySchema = z.enum(ActionPolicy);

const deliverableSchema = z.object({
  assetIds: z.array(z.string()),
  summary: z.string(),
});

const POST_PLATFORMS = ["instagram", "facebook", "linkedin", "twitter"] as const;

type PostPlatform = (typeof POST_PLATFORMS)[number];

const POST_PLATFORM_NAMES = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
} as const satisfies Record<PostPlatform, string>;

const postDraftSchema = z.object({
  body: z
    .string()
    .min(1)
    .max(2200)
    .describe("Texto principal do post, em pt-BR. Já formatado para a plataforma escolhida."),
  callToAction: z
    .string()
    .min(1)
    .max(120)
    .describe("CTA final do post (ex: 'Visite-nos hoje', 'Compre agora')."),
  hashtags: z
    .array(z.string().min(1).max(60))
    .max(20)
    .optional()
    .describe("Lista de hashtags relevantes, sem o `#`."),
  platform: z.enum(POST_PLATFORMS).describe("Plataforma alvo da publicação."),
  tone: z.string().min(1).max(60).describe("Tom da copy (ex: acolhedor, urgente, informativo)."),
});

const publishPostSchema = deliverableSchema.extend({ draft: postDraftSchema.optional() });

/** What each Action type proposes, as stored on the Action row and shown to Operators. */
const PROPOSED_SCHEMAS = {
  publish_post: publishPostSchema,
  worker_deliverable: deliverableSchema,
} satisfies Record<ActionType, z.ZodType>;

type ProposedOf<Type extends ActionType> = z.infer<(typeof PROPOSED_SCHEMAS)[Type]>;

const ticketResultSchema = z.object({ summary: z.string() });

const DECISION_OUTCOMES = ["approved", "changes_requested", "rejected"] as const;

type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];

const FEEDBACK_MAX_LENGTH = 2000;

const decisionInputSchema = z.object({
  decision: z.enum(DECISION_OUTCOMES),
  feedback: z.string().max(FEEDBACK_MAX_LENGTH).optional(),
});

type Deliverable = z.infer<typeof deliverableSchema>;

type DecisionInput = z.infer<typeof decisionInputSchema>;

type PostDraft = z.infer<typeof postDraftSchema>;

type TicketResult = z.infer<typeof ticketResultSchema>;

export {
  actionPolicySchema,
  ACTION_TYPES,
  actionTypeSchema,
  DECISION_OUTCOMES,
  decisionInputSchema,
  deliverableSchema,
  FEEDBACK_MAX_LENGTH,
  POST_PLATFORM_NAMES,
  postDraftSchema,
  PROPOSED_SCHEMAS,
  ticketResultSchema,
};

export type {
  ActionType,
  DecisionInput,
  DecisionOutcome,
  Deliverable,
  PostDraft,
  PostPlatform,
  ProposedOf,
  TicketResult,
};
