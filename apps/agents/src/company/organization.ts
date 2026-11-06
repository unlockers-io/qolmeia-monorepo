import { entitleToActiveTemplates, Prisma } from "@repo/db/worker";

import type { PrismaClient } from "#/lib/db";
import { DomainError } from "#/lib/errors";
import { correspondentIdFor, plannerIdFor } from "#/team/ids";

type Organization = { id: string; name: string; slug: string };

const insertOrganization = (
  db: PrismaClient,
  input: { name: string; slug: string },
): Promise<Organization> =>
  db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: input.name, slug: input.slug },
      select: { id: true, name: true, slug: true },
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
    await entitleToActiveTemplates(tx, [org.id]);

    return org;
  });

const createOrganization = async (
  db: PrismaClient,
  input: { name: string; slug: string },
): Promise<Organization> => {
  try {
    return await insertOrganization(db, input);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DomainError(409, "slug already in use");
    }

    throw error;
  }
};

export { createOrganization };
