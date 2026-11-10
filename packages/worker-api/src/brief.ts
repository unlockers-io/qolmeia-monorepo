import { z } from "zod";

const BRIEF_SCHEMA_VERSION = 1;

const channelEnum = z.enum([
  "discord",
  "email",
  "instagram",
  "other",
  "slack",
  "telegram",
  "web",
  "whatsapp",
]);

const BRIEF_MAX_LENGTH = {
  audience: 500,
  industry: 200,
  palette: 200,
  primaryGoal: 500,
  references: 500,
  voice: 200,
} as const;

const brandSchema = z.object({
  palette: z
    .string()
    .max(BRIEF_MAX_LENGTH.palette)
    .optional()
    .describe("Cores principais e secundárias (texto curto: hex ou nomes)."),
  references: z
    .string()
    .max(BRIEF_MAX_LENGTH.references)
    .optional()
    .describe("Marcas ou estilos de inspiração."),
  voice: z
    .string()
    .max(BRIEF_MAX_LENGTH.voice)
    .optional()
    .describe("Tom da marca (formal, descontraído, técnico, etc.)."),
});

const companyBriefSchema = z.object({
  audience: z
    .string()
    .min(1)
    .max(BRIEF_MAX_LENGTH.audience)
    .optional()
    .describe("Quem é o cliente final do negócio (perfil, dor, contexto)."),
  brand: brandSchema.optional(),
  channels: z.array(channelEnum).optional().describe("Canais onde o negócio quer (ou já) atua."),
  industry: z
    .string()
    .min(1)
    .max(BRIEF_MAX_LENGTH.industry)
    .optional()
    .describe("Setor do negócio (ex: alimentação, beleza, SaaS)."),
  locale: z.string().default("pt-BR"),
  primaryGoal: z
    .string()
    .min(1)
    .max(BRIEF_MAX_LENGTH.primaryGoal)
    .optional()
    .describe("Objetivo principal nos próximos 3 meses."),
  schemaVersion: z.number().default(BRIEF_SCHEMA_VERSION),
});

type CompanyBrief = z.infer<typeof companyBriefSchema>;

const briefPatchSchema = companyBriefSchema.partial();

type BriefPatch = z.input<typeof briefPatchSchema>;

const mergeBrief = (
  existing: Partial<CompanyBrief>,
  updates: Partial<CompanyBrief>,
): CompanyBrief => {
  const definedUpdates = Object.fromEntries(
    Object.entries<CompanyBrief[keyof CompanyBrief] | undefined>(updates).filter(
      ([, value]) => value !== undefined,
    ),
  );

  const parsed = briefPatchSchema.parse({ ...existing, ...definedUpdates });

  return {
    ...parsed,
    locale: parsed.locale ?? "pt-BR",
    schemaVersion: parsed.schemaVersion ?? BRIEF_SCHEMA_VERSION,
  };
};

const hasText = (value: string | undefined): boolean => value !== undefined && value !== "";

type BriefInput = Parameters<typeof briefPatchSchema.safeParse>[0];

const parseBrief = (raw: BriefInput): Partial<CompanyBrief> =>
  briefPatchSchema.safeParse(raw).data ?? {};

const BRIEF_REQUIRED_FIELDS = [
  "industry",
  "primaryGoal",
  "audience",
  "brand.voice",
  "brand.palette",
  "brand.references",
] as const;

type BriefFieldId = (typeof BRIEF_REQUIRED_FIELDS)[number];

const BRIEF_FIELD_FILLED = {
  audience: (brief) => hasText(brief.audience),
  "brand.palette": (brief) => hasText(brief.brand?.palette),
  "brand.references": (brief) => hasText(brief.brand?.references),
  "brand.voice": (brief) => hasText(brief.brand?.voice),
  industry: (brief) => hasText(brief.industry),
  primaryGoal: (brief) => hasText(brief.primaryGoal),
} satisfies Record<BriefFieldId, (brief: Partial<CompanyBrief>) => boolean>;

const isBriefFieldFilled = (brief: Partial<CompanyBrief>, field: BriefFieldId): boolean =>
  BRIEF_FIELD_FILLED[field](brief);

type BriefCompleteness = {
  filled: Array<BriefFieldId>;
  isComplete: boolean;
  missing: Array<BriefFieldId>;
  percent: number;
};

const briefCompleteness = (brief: Partial<CompanyBrief> | null | undefined): BriefCompleteness => {
  const safe = brief ?? {};
  const filled: Array<BriefFieldId> = [];
  const missing: Array<BriefFieldId> = [];

  for (const field of BRIEF_REQUIRED_FIELDS) {
    if (isBriefFieldFilled(safe, field)) {
      filled.push(field);
    } else {
      missing.push(field);
    }
  }

  return {
    filled,
    isComplete: missing.length === 0,
    missing,
    percent: Math.round((filled.length / BRIEF_REQUIRED_FIELDS.length) * 100),
  };
};

export { BRIEF_MAX_LENGTH, briefCompleteness, briefPatchSchema, mergeBrief, parseBrief };

export type { BriefCompleteness, BriefFieldId, BriefPatch, CompanyBrief };
