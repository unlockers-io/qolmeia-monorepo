import { briefCompleteness } from "@repo/worker-api/brief";
import type { CompanyResponse } from "@repo/worker-api/contracts";
import { CUSTOMER } from "@repo/worker-api/endpoints";
import { Hono } from "hono";

import { listActivity } from "#/activity/log";
import { getCompany, updateBrief, type Company } from "#/company/company";
import { requireCustomer, type IdentityEnv } from "#/identity/gates";
import { answer } from "#/lib/endpoint";
import { parsePositiveInt } from "#/lib/pagination";
import { libraryRoutes } from "#/routes/me-assets";
import { teamRoutes } from "#/routes/me-team";
import { getCatalogue } from "#/team/roster";

const companyResponse = (company: Company): CompanyResponse => ({
  company,
  completeness: briefCompleteness(company.brief),
});

/** The customer surface: every route acts in the Company of the caller's CUSTOMER membership. */
const customerRoutes = new Hono<IdentityEnv>();

customerRoutes.use("/api/me/*", requireCustomer);

answer(customerRoutes, CUSTOMER.company, async (c) =>
  companyResponse(await getCompany(c.var.db, c.var.session.companyId)),
);

answer(customerRoutes, CUSTOMER.patchCompany, async (c, { body }) =>
  companyResponse(await updateBrief(c.var.db, c.var.session.companyId, body)),
);

answer(customerRoutes, CUSTOMER.catalogue, async (c) => ({
  templates: await getCatalogue(c.var.db, c.var.session.companyId),
}));

answer(customerRoutes, CUSTOMER.activity, async (c, { query }) => {
  const entries = await listActivity(c.var.db, {
    companyId: c.var.session.companyId,
    limit: parsePositiveInt(query.limit, 50, 200),
  });

  return {
    items: entries.map(({ createdAt, id, summary, type }) => ({ createdAt, id, summary, type })),
  };
});

customerRoutes.route("/", teamRoutes);

customerRoutes.route("/", libraryRoutes);

export { customerRoutes };
