import type { AgentInstanceStatus, CompanyStatus, Prisma, TicketStatus } from "@repo/db/worker";
import { correspondentIdFor, teamIdFor } from "@repo/worker-api/contracts";
import { env } from "cloudflare:workers";

import { withDb, type PrismaClient } from "#/lib/db";

const db = <Result>(run: (client: PrismaClient) => Promise<Result>): Promise<Result> =>
  withDb(env, run);

type CompanySeed = {
  brief?: Prisma.InputJsonValue;
  id: string;
  name?: string;
  status?: CompanyStatus;
};

const seedCompany = async ({ brief, id, name, status }: CompanySeed): Promise<void> => {
  await db((client) =>
    client.company.create({
      data: { brief, id, name: name ?? id, slug: id, status: status ?? "active" },
    }),
  );
};

const entitle = async (
  companyId: string,
  templateIds: ReadonlyArray<string> = ["tpl-designer"],
): Promise<void> => {
  await db((client) =>
    client.companyTemplateEntitlement.createMany({
      data: templateIds.map((templateId) => ({ companyId, templateId })),
    }),
  );
};

type WorkerSeed = {
  displayName?: string;
  id: string;
  status?: AgentInstanceStatus;
  templateId?: string;
};

const seedTeam = async (companyId: string, workers: ReadonlyArray<WorkerSeed> = []) => {
  const teamId = teamIdFor(companyId);
  const correspondentId = correspondentIdFor(companyId);
  await db(async (client) => {
    await client.agentInstance.create({
      data: {
        companyId,
        displayName: "Correspondente",
        id: correspondentId,
        role: "correspondent",
      },
    });
    await client.agentInstance.createMany({
      data: workers.map((worker) => ({
        companyId,
        displayName: worker.displayName ?? "Designer",
        id: worker.id,
        role: "worker" as const,
        status: worker.status ?? "active",
        templateId: worker.templateId ?? "tpl-designer",
        templateVersion: 1,
      })),
    });
    await client.team.create({ data: { companyId, confirmedAt: new Date(), id: teamId } });
    await client.teamMember.createMany({
      data: [
        { agentInstanceId: correspondentId, canDelegateTo: workers.map(({ id }) => id), teamId },
        ...workers.map(({ id }) => ({ agentInstanceId: id, canDelegateTo: [], teamId })),
      ],
    });
  });
  return { correspondentId, teamId };
};

type TicketSeed = {
  agentInstanceId: string;
  brief?: string;
  companyId: string;
  id: string;
  status?: TicketStatus;
  workflowId?: string;
};

const seedTicket = async (seed: TicketSeed): Promise<void> => {
  await db((client) =>
    client.ticket.create({
      data: {
        agentInstanceId: seed.agentInstanceId,
        brief: seed.brief ?? "brief",
        companyId: seed.companyId,
        id: seed.id,
        origin: "delegation",
        status: seed.status ?? "in_progress",
        title: (seed.brief ?? "brief").slice(0, 80),
        workflowId: seed.workflowId ?? null,
      },
    }),
  );
};

export { db, entitle, seedCompany, seedTeam, seedTicket };
