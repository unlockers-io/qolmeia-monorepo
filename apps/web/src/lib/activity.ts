import { apiGet } from "@repo/worker-api";
import type { CustomerActivityEntry, CustomerActivityResponse } from "@repo/worker-api/contracts";

const fetchActivity = async (
  get: typeof apiGet = apiGet,
): Promise<ReadonlyArray<CustomerActivityEntry>> => {
  const { items } = await get<CustomerActivityResponse>("/api/me/activity?limit=50");

  return items;
};

export { fetchActivity };
