import { correspondentIdFor, plannerIdFor } from "@repo/worker-api/contracts";

import type { PrismaClient } from "#/lib/db";
import { entitleToActiveTemplates } from "#/template/template";

type Organization = { id: string; name: string; slug: string };

const createOrganization = (
  db: PrismaClient,
  input: { name: string; ownerUserId: string; slug: string },
): Promise<Organization> =>
  db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: input.name, slug: input.slug },
      select: { id: true, name: true, slug: true },
    });
    await tx.orgMembership.create({
      data: { orgId: org.id, role: "OWNER", userId: input.ownerUserId },
    });
    await tx.company.create({ data: org });
    await tx.agentInstance.createMany({
      data: [
        {
          companyId: org.id,
          displayName: "Correspondente Qolmeia",
          id: correspondentIdFor(org.id),
          role: "correspondent",
        },
        {
          companyId: org.id,
          displayName: "Planejador Qolmeia",
          id: plannerIdFor(org.id),
          role: "planner",
        },
      ],
    });
    await entitleToActiveTemplates(tx, org.id);
    return org;
  });

export { createOrganization };
