import { briefCompleteness, briefPatchSchema } from "@repo/worker-api/brief";
import type {
  CatalogueResponse,
  CompanyResponse,
  CustomerActivityResponse,
} from "@repo/worker-api/contracts";
import { Hono } from "hono";

import { listActivity } from "#/activity/log";
import { getCompany, updateBrief, type Company } from "#/company/company";
import { requireCustomer, type IdentityEnv } from "#/identity/gates";
import { parsePositiveInt } from "#/lib/pagination";
import { jsonBody } from "#/lib/validate";
import { libraryRoutes } from "#/routes/me-assets";
import { teamRoutes } from "#/routes/me-team";
import { getCatalogue } from "#/team/roster";

const companyResponse = (company: Company): CompanyResponse => ({
  company,
  completeness: briefCompleteness(company.brief),
});

/** The customer surface: every route acts in the Company of the caller's CUSTOMER membership. */
const customerRoutes = new Hono<IdentityEnv>();

customerRoutes.use("*", requireCustomer);

customerRoutes.get("/company", async (c) => {
  const company = await getCompany(c.var.db, c.var.session.companyId);

  if (!company) {
    return c.json({ error: "company not found" }, 404);
  }

  return c.json(companyResponse(company));
});

customerRoutes.patch("/company", jsonBody(briefPatchSchema), async (c) => {
  const company = await updateBrief(c.var.db, c.var.session.companyId, c.req.valid("json"));

  if (!company) {
    return c.json({ error: "company not found" }, 404);
  }

  return c.json(companyResponse(company));
});

customerRoutes.get("/catalogue", async (c) => {
  const body: CatalogueResponse = {
    templates: await getCatalogue(c.var.db, c.var.session.companyId),
  };

  return c.json(body);
});

customerRoutes.get("/activity", async (c) => {
  const entries = await listActivity(c.var.db, {
    companyId: c.var.session.companyId,
    limit: parsePositiveInt(c.req.query("limit"), 50, 200),
  });

  const body: CustomerActivityResponse = {
    items: entries.map(({ createdAt, id, summary, type }) => ({ createdAt, id, summary, type })),
  };

  return c.json(body);
});

customerRoutes.route("/team", teamRoutes);

customerRoutes.route("/", libraryRoutes);

export { customerRoutes };
