import type { AgentTemplate } from "@repo/db/worker";
import type { Template, TemplateInput, TemplateStatus } from "@repo/worker-api/contracts";
import { z } from "zod";

import { actionTypeSchema } from "#/action/action-types";
import type { Db } from "#/lib/db";

const stringRecordSchema = z.record(z.string(), z.string());
const stringArraySchema = z.array(z.string());

const toTemplate = (row: AgentTemplate): Template => ({
  createdAt: row.createdAt.getTime(),
  defaultActionType: actionTypeSchema.parse(row.defaultActionType),
  defaultPolicies: stringRecordSchema.parse(row.defaultPolicies),
  description: row.description,
  displayName: row.displayName,
  id: row.id,
  model: row.model,
  skillIds: stringArraySchema.parse(row.skillIds),
  status: row.status,
  systemPrompt: row.systemPrompt,
  updatedAt: row.updatedAt.getTime(),
  version: row.version,
  workerKind: row.workerKind,
});

const getTemplate = async (db: Db, id: string): Promise<Template | null> => {
  const row = await db.agentTemplate.findUnique({ where: { id } });
  return row ? toTemplate(row) : null;
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

const updateTemplate = async (
  db: Db,
  id: string,
  input: TemplateInput,
): Promise<Template | null> => {
  const result = await db.agentTemplate.updateMany({
    data: { ...input, skillIds: [...input.skillIds], version: { increment: 1 } },
    where: { id },
  });
  return result.count > 0 ? getTemplate(db, id) : null;
};

const setTemplateStatus = async (
  db: Db,
  id: string,
  status: TemplateStatus,
): Promise<Template | null> => {
  const result = await db.agentTemplate.updateMany({ data: { status }, where: { id } });
  return result.count > 0 ? getTemplate(db, id) : null;
};

const entitleToActiveTemplates = async (db: Db, companyId: string): Promise<void> => {
  const templates = await db.agentTemplate.findMany({
    select: { id: true },
    where: { status: "active" },
  });
  await db.companyTemplateEntitlement.createMany({
    data: templates.map(({ id: templateId }) => ({ companyId, templateId })),
    skipDuplicates: true,
  });
};

export {
  createTemplate,
  entitleToActiveTemplates,
  getTemplate,
  listAllTemplates,
  listEntitledTemplates,
  setTemplateStatus,
  updateTemplate,
};
