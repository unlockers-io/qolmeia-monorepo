import type { Template, TemplateResponse } from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkeletonSuspense } from "skullet/react";

import { TemplateForm } from "@/components/template-form";
import { ApiError } from "@/lib/api-client";
import { apiGetServer } from "@/lib/api-server";
import { requireOperator } from "@/lib/auth-helpers";

export const metadata: Metadata = { title: "Editar modelo" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type EditTemplatePageProps = {
  params: Promise<{ id: string }>;
};

const EditTemplateContent = async ({ params }: EditTemplatePageProps) => {
  await requireOperator();
  const { id } = await params;

  let detail: TemplateResponse | null = null;

  try {
    detail = await apiGetServer<TemplateResponse>(`/templates/${id}`);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  if (!detail) {
    notFound();
  }

  return <TemplateForm initial={detail.template} />;
};

const SAMPLE_TEMPLATE: Template = {
  createdAt: Date.parse("2026-01-01T12:00:00.000Z"),
  defaultActionType: "worker_deliverable",
  defaultPolicies: {},
  description: "Cria imagens, posts e direções visuais alinhados à marca do cliente.",
  displayName: "Designer",
  id: "tpl-designer",
  model: "openai/gpt-6-luna",
  skillIds: ["generateBrandImage", "rememberFact", "recallMemory", "saveAsset"],
  status: "active",
  systemPrompt:
    "Você é o Designer da Qolmeia. Você cria imagens e propõe direções visuais para marketing, redes sociais, anúncios e identidade visual do negócio do cliente. Responda sempre em português do Brasil, de forma direta e criativa.",
  updatedAt: Date.parse("2026-01-01T12:00:00.000Z"),
  version: 1,
  workerKind: "designer",
};

const EditTemplatePage = (props: EditTemplatePageProps) => (
  <SkeletonSuspense label="Carregando modelo" skeleton={<TemplateForm initial={SAMPLE_TEMPLATE} />}>
    <EditTemplateContent {...props} />
  </SkeletonSuspense>
);

export default EditTemplatePage;
