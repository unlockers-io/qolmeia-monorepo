import { apiCall, type ApiGet } from "@repo/worker-api";
import type { BriefPatch } from "@repo/worker-api/brief";
import type { CompanyResponse } from "@repo/worker-api/contracts";
import { CUSTOMER } from "@repo/worker-api/endpoints";

const fetchCompany = (get: ApiGet = apiCall): Promise<CompanyResponse> => get(CUSTOMER.company);

const patchCompanyBrief = (patch: BriefPatch): Promise<CompanyResponse> =>
  apiCall(CUSTOMER.patchCompany, { body: patch });

export { fetchCompany, patchCompanyBrief };
