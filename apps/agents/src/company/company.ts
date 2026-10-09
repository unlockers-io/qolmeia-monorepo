import type { CompanyStatus, Prisma } from "@repo/db/worker";
import {
  briefCompleteness,
  mergeBrief,
  parseBrief,
  type CompanyBrief,
} from "@repo/worker-api/brief";
import type { CompanyOverview } from "@repo/worker-api/contracts";

import type { Db, PrismaClient } from "#/lib/db";

type Company = {
  brief: Partial<CompanyBrief>;
  id: string;
  slug: string;
  status: CompanyStatus;
};

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

const getCompany = async (db: Db, id: string): Promise<Company | null> => {
  const row = await db.company.findUnique({ select: companySelect, where: { id } });
  return row ? toCompany(row) : null;
};

const updateBrief = (
  db: PrismaClient,
  companyId: string,
  updates: Partial<CompanyBrief>,
): Promise<Company | null> =>
  db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ brief: Prisma.JsonValue }>>`
      SELECT brief FROM company WHERE id = ${companyId} FOR UPDATE`;
    const current = locked.at(0);
    if (current === undefined) {
      return null;
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
