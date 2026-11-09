import type { AssetKind, CompanyStatus } from "@repo/db/enums";
import { z } from "zod";

import type { BriefCompleteness, CompanyBrief } from "../brief";

import type { HireableTemplate, TeamMemberDetailView, TeamMemberView } from "./agents";

type CompanyResponse = {
  company: { brief: Partial<CompanyBrief>; id: string; slug: string; status: CompanyStatus };
  completeness: BriefCompleteness;
};

type CatalogueResponse = { templates: ReadonlyArray<HireableTemplate> };

type TeamResponse = { members: ReadonlyArray<TeamMemberView> };

type MemberResponse = { member: TeamMemberView };

type MemberDetailResponse = { member: TeamMemberDetailView };

const MEMBER_NAME_MAX_LENGTH = 80;

const PROMPT_MAX_LENGTH = 20_000;

const TEAM_SIZE_MAX = 20;

const memberNameSchema = z.string().trim().min(1).max(MEMBER_NAME_MAX_LENGTH);

const memberPatchSchema = z.object({
  displayName: memberNameSchema.optional(),
  promptOverride: z.union([z.string().trim().min(1).max(PROMPT_MAX_LENGTH), z.null()]).optional(),
});

const hireInputSchema = z.object({
  displayName: memberNameSchema.optional(),
  templateId: z.string().min(1),
});

const confirmTeamInputSchema = z.object({
  templateIds: z.array(z.string().min(1)).min(1).max(TEAM_SIZE_MAX),
});

type ConfirmTeamResponse = {
  team: { correspondentId: string; teamId: string; workerIds: ReadonlyArray<string> };
};

type CustomerActivityEntry = { createdAt: number; id: string; summary: string; type: string };

type CustomerActivityResponse = { items: ReadonlyArray<CustomerActivityEntry> };

type LibraryAsset = {
  createdAt: number;
  id: string;
  kind: AssetKind;
  mimeType: string;
  name: string;
  size: number;
  url: string;
};

type LibraryAssetsResponse = { items: ReadonlyArray<LibraryAsset> };

const deleteAssetsInputSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
});

type DeleteAssetsResponse = { deleted: number };

const BRAND_CATEGORIES = ["logo", "post", "reference", "other"] as const;

type BrandCategory = (typeof BRAND_CATEGORIES)[number];

type BrandAsset = {
  category: BrandCategory;
  createdAt: number;
  id: string;
  mimeType: string;
  name: string | null;
  size: number;
  url: string;
};

type BrandAssetsResponse = { items: ReadonlyArray<BrandAsset> };

type BrandAssetResponse = { asset: BrandAsset };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Image formats a model can read: chat attachments and brand references are limited to them. */
const MODEL_IMAGE_TYPES = ["image/gif", "image/jpeg", "image/png", "image/webp"] as const;

/** Chat attachments go to the model; the brand kit also keeps SVG logos. */
const UPLOAD_POLICIES = {
  brand: { maxBytes: MAX_UPLOAD_BYTES, mimeTypes: [...MODEL_IMAGE_TYPES, "image/svg+xml"] },
  chat: { maxBytes: MAX_UPLOAD_BYTES, mimeTypes: MODEL_IMAGE_TYPES },
} as const;

type UploadTarget = keyof typeof UPLOAD_POLICIES;

type UploadResponse = { assetId: string; mimeType: string; size: number; url: string };

const TEAM_EVENT_TYPES = ["team:roster", "team:status"] as const;

type TeamEvent = { companyId: string; type: (typeof TEAM_EVENT_TYPES)[number] };

export {
  BRAND_CATEGORIES,
  confirmTeamInputSchema,
  deleteAssetsInputSchema,
  hireInputSchema,
  MEMBER_NAME_MAX_LENGTH,
  memberPatchSchema,
  PROMPT_MAX_LENGTH,
  TEAM_EVENT_TYPES,
  MODEL_IMAGE_TYPES,
  TEAM_SIZE_MAX,
  UPLOAD_POLICIES,
};

export type {
  BrandAsset,
  BrandAssetResponse,
  BrandAssetsResponse,
  BrandCategory,
  CatalogueResponse,
  CompanyResponse,
  ConfirmTeamResponse,
  CustomerActivityEntry,
  CustomerActivityResponse,
  DeleteAssetsResponse,
  LibraryAsset,
  LibraryAssetsResponse,
  MemberDetailResponse,
  MemberResponse,
  TeamEvent,
  TeamResponse,
  UploadResponse,
  UploadTarget,
};
