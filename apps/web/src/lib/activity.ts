import { apiCall, type ApiGet } from "@repo/worker-api";
import type { CustomerActivityEntry } from "@repo/worker-api/contracts";
import { CUSTOMER } from "@repo/worker-api/endpoints";

const fetchActivity = async (
  get: ApiGet = apiCall,
): Promise<ReadonlyArray<CustomerActivityEntry>> => {
  const { items } = await get(CUSTOMER.activity, { query: { limit: 50 } });

  return items;
};

export { fetchActivity };
