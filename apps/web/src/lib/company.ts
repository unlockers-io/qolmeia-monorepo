import { apiGet, apiSend, apiSendForm } from "@/lib/api-client";

type ChannelValue =
  | "discord"
  | "email"
  | "instagram"
  | "other"
  | "slack"
  | "telegram"
  | "web"
  | "whatsapp";

type Brand = {
  palette?: string;
  references?: string;
  voice?: string;
};

type CompanyBrief = {
  audience?: string;
  brand?: Brand;
  channels?: ReadonlyArray<ChannelValue>;
  industry?: string;
  locale?: string;
  primaryGoal?: string;
  schemaVersion?: number;
};

type BriefFieldId =
  | "audience"
  | "brand.palette"
  | "brand.references"
  | "brand.voice"
  | "industry"
  | "primaryGoal";

type BriefCompleteness = {
  filled: ReadonlyArray<BriefFieldId>;
  isComplete: boolean;
  missing: ReadonlyArray<BriefFieldId>;
  percent: number;
};

type CompanyResponse = {
  company: { brief: CompanyBrief; id: string; slug: string; status: string };
  completeness: BriefCompleteness;
};

type BriefPatch = {
  audience?: string;
  brand?: Brand;
  channels?: ReadonlyArray<ChannelValue>;
  industry?: string;
  primaryGoal?: string;
};

const fetchCompany = (): Promise<CompanyResponse> => apiGet<CompanyResponse>("/api/me/company");

const patchCompanyBrief = (patch: BriefPatch): Promise<CompanyResponse> =>
  apiSend<CompanyResponse>("PATCH", "/api/me/company", patch);

type BrandCategory = "logo" | "other" | "post" | "reference";

const BRAND_CATEGORIES: ReadonlyArray<{ label: string; value: BrandCategory }> = [
  { label: "Logotipo", value: "logo" },
  { label: "Post de exemplo", value: "post" },
  { label: "Referência visual", value: "reference" },
  { label: "Outro", value: "other" },
];

const BRAND_CATEGORY_LABEL = {
  logo: "Logotipo",
  other: "Outro",
  post: "Post de exemplo",
  reference: "Referência visual",
} satisfies Record<BrandCategory, string>;

type BrandAsset = {
  category: BrandCategory;
  createdAt: string;
  id: string;
  mimeType: string;
  name: string | null;
  url: string;
};

const fetchBrandAssets = async (): Promise<Array<BrandAsset>> => {
  const body = await apiGet<{ items: Array<BrandAsset> }>("/api/me/brand-assets");
  return body.items;
};

const uploadBrandAsset = async (file: File, category: BrandCategory): Promise<BrandAsset> => {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  const uploaded = await apiSendForm<{ assetId: string; mime: string; url: string }>(
    "/api/me/brand-assets",
    form,
  );
  return {
    category,
    createdAt: new Date().toISOString(),
    id: uploaded.assetId,
    mimeType: uploaded.mime,
    name: file.name || null,
    url: uploaded.url,
  };
};

const deleteBrandAsset = async (id: string): Promise<boolean> => {
  await apiSend("DELETE", `/api/me/brand-assets/${id}`);
  return true;
};

export {
  BRAND_CATEGORIES,
  BRAND_CATEGORY_LABEL,
  deleteBrandAsset,
  fetchBrandAssets,
  fetchCompany,
  patchCompanyBrief,
  uploadBrandAsset,
};
export type {
  BrandAsset,
  BrandCategory,
  BriefCompleteness,
  BriefFieldId,
  BriefPatch,
  ChannelValue,
  CompanyBrief,
  CompanyResponse,
};
