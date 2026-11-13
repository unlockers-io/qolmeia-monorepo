import type { Prisma } from "@repo/db/worker";
import {
  briefCompleteness,
  mergeBrief,
  parseBrief,
  type CompanyBrief,
} from "@repo/worker-api/brief";
import type { CompanyOverview, CompanyResponse } from "@repo/worker-api/contracts";

import type { Db, PrismaClient } from "#/lib/db";
import { notFound } from "#/lib/errors";

type Company = CompanyResponse["company"];

const companySelect = {
  brief: true,
  id: true,
  slug: true,
  status: true,
} as const satisfies Prisma.CompanySelect;

const toCompany = (row: Prisma.CompanyGetPayload<{ select: typeof companySelect }>): Company => ({
  ...row,
  brief: parseBrief(row.brief),
});

const companyNotFound = () => notFound("company not found");

const getCompany = async (db: Db, id: string): Promise<Company> => {
  const row = await db.company.findUnique({ select: companySelect, where: { id } });

  if (!row) {
    throw companyNotFound();
  }

  return toCompany(row);
};

const updateBrief = (
  db: PrismaClient,
  companyId: string,
  updates: Partial<CompanyBrief>,
): Promise<Company> =>
  db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ brief: Prisma.JsonValue }>>`
      SELECT brief FROM company WHERE id = ${companyId} FOR UPDATE`;

    const current = locked.at(0);

    if (current === undefined) {
      throw companyNotFound();
    }

    const row = await tx.company.update({
      data: { brief: mergeBrief(parseBrief(current.brief), updates) },
      select: companySelect,
      where: { id: companyId },
    });

    return toCompany(row);
  });

const listCompaniesOverview = async (db: Db): Promise<ReadonlyArray<CompanyOverview>> => {
  const rows = await db.company.findMany({ orderBy: { createdAt: "asc" } });

  return rows.map((row) => ({
    briefPercent: briefCompleteness(parseBrief(row.brief)).percent,
    id: row.id,
    name: row.name,
    status: row.status,
  }));
};

const listActiveCompanies = async (db: Db): Promise<ReadonlyArray<Company>> => {
  const rows = await db.company.findMany({ select: companySelect, where: { status: "active" } });

  return rows.map(toCompany);
};

export { getCompany, listActiveCompanies, listCompaniesOverview, updateBrief };

export type { Company };
