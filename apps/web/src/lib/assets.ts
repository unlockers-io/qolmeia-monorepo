import { apiSend } from "@/lib/api-client";

const deleteAssets = async (ids: ReadonlyArray<string>): Promise<void> => {
  await apiSend("POST", "/api/me/assets/delete", { ids });
};

export { deleteAssets };
