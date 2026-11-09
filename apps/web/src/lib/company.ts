import { apiGet, apiSend } from "@repo/worker-api";
import type { BriefPatch } from "@repo/worker-api/brief";
import type { CompanyResponse } from "@repo/worker-api/contracts";

const fetchCompany = (get: typeof apiGet = apiGet): Promise<CompanyResponse> =>
  get<CompanyResponse>("/api/me/company");

const patchCompanyBrief = (patch: BriefPatch): Promise<CompanyResponse> =>
  apiSend<CompanyResponse>("PATCH", "/api/me/company", patch);

export { fetchCompany, patchCompanyBrief };
