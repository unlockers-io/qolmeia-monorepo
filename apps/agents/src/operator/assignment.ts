import type { CoverageResponse, OperatorCoverage } from "@repo/worker-api/contracts";

import type { Db, PrismaClient } from "#/lib/db";

const getCoverage = async (db: Db, operatorUserId: string): Promise<OperatorCoverage> => {
  const rows = await db.operatorAssignment.findMany({
    select: { kind: true, value: true },
    where: { operatorUserId },
  });
  const companies: Array<string> = [];
  const disciplines: Array<string> = [];
  for (const row of rows) {
    (row.kind === "company" ? companies : disciplines).push(row.value);
  }
  return { companies, disciplines };
};

const setCoverage = (
  db: PrismaClient,
  operatorUserId: string,
  coverage: OperatorCoverage,
): Promise<void> =>
  db.$transaction(async (tx) => {
    await tx.operatorAssignment.deleteMany({ where: { operatorUserId } });
    const assignment = (kind: "company" | "discipline", value: string) => ({
      id: crypto.randomUUID(),
      kind,
      operatorUserId,
      value,
    });
    await tx.operatorAssignment.createMany({
      data: [
        ...coverage.companies.map((value) => assignment("company", value)),
        ...coverage.disciplines.map((value) => assignment("discipline", value)),
      ],
      skipDuplicates: true,
    });
  });

const getCoverageOptions = async (db: Db): Promise<CoverageResponse["options"]> => {
  const [companies, disciplines] = await Promise.all([
    db.company.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.agentTemplate.findMany({
      distinct: ["workerKind"],
      orderBy: { displayName: "asc" },
      select: { displayName: true, workerKind: true },
    }),
  ]);
  return {
    companies,
    disciplineNames: Object.fromEntries(
      disciplines.map((row) => [row.workerKind, row.displayName]),
    ),
    disciplines: disciplines.map((row) => row.workerKind),
  };
};

export { getCoverage, getCoverageOptions, setCoverage };
