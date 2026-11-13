import type { AgentTemplate, Prisma } from "@repo/db/worker";
import {
  ACTION_TYPES,
  actionPolicySchema,
  actionTypeSchema,
  type Template,
  type TemplateInput,
  type TemplateStatus,
} from "@repo/worker-api/contracts";
import { z } from "zod";

import type { Db } from "#/lib/db";
import { notFound } from "#/lib/errors";

const storedRecordSchema = z.record(z.string(), z.unknown());

/** A key that names no Action type is dropped; an unrecognised policy fails closed to the safest one. */
const readStoredPolicies = (stored: Prisma.JsonValue): Template["defaultPolicies"] => {
  const policies = storedRecordSchema.parse(stored);

  return Object.fromEntries(
    ACTION_TYPES.flatMap((type) =>
      Object.hasOwn(policies, type)
        ? [[type, actionPolicySchema.safeParse(policies[type]).data ?? "require_approval"] as const]
        : [],
    ),
  );
};

const skillIdsSchema = z.array(z.string());

const toTemplate = (row: AgentTemplate): Template => ({
  defaultActionType: actionTypeSchema.parse(row.defaultActionType),
  defaultPolicies: readStoredPolicies(row.defaultPolicies),
  description: row.description,
  displayName: row.displayName,
  id: row.id,
  model: row.model,
  skillIds: skillIdsSchema.parse(row.skillIds),
  status: row.status,
  systemPrompt: row.systemPrompt,
  workerKind: row.workerKind,
});

const getTemplate = async (db: Db, id: string): Promise<Template> => {
  const row = await db.agentTemplate.findUnique({ where: { id } });

  if (!row) {
    throw notFound();
  }

  return toTemplate(row);
};

const listAllTemplates = async (db: Db): Promise<ReadonlyArray<Template>> => {
  const rows = await db.agentTemplate.findMany({ orderBy: { createdAt: "desc" } });

  return rows.map(toTemplate);
};

const listEntitledTemplates = async (
  db: Db,
  companyId: string,
  ids?: ReadonlyArray<string>,
): Promise<ReadonlyArray<Template>> => {
  const rows = await db.agentTemplate.findMany({
    orderBy: { displayName: "asc" },
    where: {
      entitlements: { some: { companyId, enabled: true } },
      id: ids === undefined ? undefined : { in: [...ids] },
      status: "active",
    },
  });

  return rows.map(toTemplate);
};

const createTemplate = async (db: Db, input: TemplateInput): Promise<Template> =>
  toTemplate(
    await db.agentTemplate.create({
      data: { ...input, id: `tpl-${crypto.randomUUID()}`, skillIds: [...input.skillIds] },
    }),
  );

const updateTemplate = async (db: Db, id: string, input: TemplateInput): Promise<Template> => {
  await db.agentTemplate.updateMany({
    data: { ...input, skillIds: [...input.skillIds] },
    where: { id },
  });

  return getTemplate(db, id);
};

const setTemplateStatus = async (db: Db, id: string, status: TemplateStatus): Promise<Template> => {
  await db.agentTemplate.updateMany({ data: { status }, where: { id } });

  return getTemplate(db, id);
};

export {
  createTemplate,
  getTemplate,
  listAllTemplates,
  listEntitledTemplates,
  setTemplateStatus,
  updateTemplate,
};
