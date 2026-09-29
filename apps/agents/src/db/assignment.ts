import type { CoverageResponse, OperatorCoverage } from "@repo/worker-api/contracts";

import type { Database } from "#/db/client";

const listCoverage = (db: Database, operatorUserId: string): Promise<OperatorCoverage> =>
  db("assignments.get", { operatorUserId });

const setCoverage = async (
  db: Database,
  operatorUserId: string,
  coverage: OperatorCoverage,
): Promise<void> => {
  await db("assignments.set", { coverage, operatorUserId });
};

const getDisciplineOptions = async (
  db: Database,
): Promise<Pick<CoverageResponse["options"], "disciplineNames" | "disciplines">> => {
  const { disciplineNames, disciplines } = await db("assignments.options", {});
  return { disciplineNames, disciplines };
};

export { getDisciplineOptions, listCoverage, setCoverage };
export type { OperatorCoverage } from "@repo/worker-api/contracts";
