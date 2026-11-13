import { apiCall, type ApiGet } from "@repo/worker-api";
import {
  type BrandAsset,
  type BrandCategory,
  type LibraryAsset,
  UPLOAD_POLICIES,
  type UploadResponse,
  type UploadTarget,
} from "@repo/worker-api/contracts";
import { CUSTOMER } from "@repo/worker-api/endpoints";

const BYTES_PER_MB = 1024 * 1024;

type UploadMimeType = (typeof UPLOAD_POLICIES)[UploadTarget]["mimeTypes"][number];

const FORMAT_ORDER = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const satisfies ReadonlyArray<UploadMimeType>;

const FORMAT_LABELS = {
  "image/gif": "GIF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/svg+xml": "SVG",
  "image/webp": "WEBP",
} satisfies Record<UploadMimeType, string>;

const FORMAT_LIST = new Intl.ListFormat("pt-BR", { type: "disjunction" });

const formatsOf = (target: UploadTarget): string => {
  const accepted = new Set<UploadMimeType>(UPLOAD_POLICIES[target].mimeTypes);

  return FORMAT_LIST.format(
    FORMAT_ORDER.flatMap((mimeType) => (accepted.has(mimeType) ? [FORMAT_LABELS[mimeType]] : [])),
  );
};

const uploadAccept = (target: UploadTarget): string => UPLOAD_POLICIES[target].mimeTypes.join(",");

const uploadRefusal = (file: File, target: UploadTarget): string | null => {
  const policy = UPLOAD_POLICIES[target];

  if (!policy.mimeTypes.some((mimeType) => mimeType === file.type)) {
    return `Formato não suportado. Use ${formatsOf(target)}.`;
  }

  if (file.size > policy.maxBytes) {
    return `Imagem grande demais (máx ${policy.maxBytes / BYTES_PER_MB} MB).`;
  }

  return null;
};

const uploadChatFile = (file: File): Promise<UploadResponse> => {
  const form = new FormData();
  form.append("file", file);

  return apiCall(CUSTOMER.uploadChatFile, { body: form });
};

const deleteAssets = async (ids: ReadonlyArray<string>): Promise<void> => {
  await apiCall(CUSTOMER.deleteAssets, { body: { ids } });
};

const fetchLibraryAssets = async (get: ApiGet = apiCall): Promise<ReadonlyArray<LibraryAsset>> => {
  const { items } = await get(CUSTOMER.assets, { query: { limit: 200 } });

  return items;
};

const fetchBrandAssets = async (get: ApiGet = apiCall): Promise<ReadonlyArray<BrandAsset>> => {
  const { items } = await get(CUSTOMER.brandAssets);

  return items;
};

const uploadBrandAsset = async (file: File, category: BrandCategory): Promise<BrandAsset> => {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  const { asset } = await apiCall(CUSTOMER.uploadBrandAsset, { body: form });

  return asset;
};

const deleteBrandAsset = async (id: string): Promise<void> => {
  await apiCall(CUSTOMER.deleteBrandAsset, { params: { id } });
};

export {
  deleteAssets,
  deleteBrandAsset,
  fetchBrandAssets,
  fetchLibraryAssets,
  uploadAccept,
  uploadBrandAsset,
  uploadChatFile,
  uploadRefusal,
};
