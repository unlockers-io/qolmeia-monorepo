import type { TeamMemberDetailView } from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SkeletonSuspense } from "skullet/react";

import { BackLink } from "@/components/back-link";
import { MemberEditForm } from "@/components/member-edit-form";
import { ApiError } from "@/lib/api-client";
import { apiGetServer } from "@/lib/api-server";

export const metadata: Metadata = { title: "Agente" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type Props = { params: Promise<{ companyId: string; memberId: string }> };

const MemberEditContent = async ({ params }: Props) => {
  const { companyId, memberId } = await params;

  let member: TeamMemberDetailView | null;

  try {
    const body = await apiGetServer<{ member: TeamMemberDetailView }>(
      `/teams/${companyId}/members/${memberId}`,
    );

    member = body.member;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }

    member = null;
  }

  if (!member) {
    notFound();
  }

  return (
    <MemberEditForm
      companyId={companyId}
      initialMember={member}
      key={memberId}
      memberId={memberId}
    />
  );
};

const SAMPLE_MEMBER: TeamMemberDetailView = {
  capabilities: "Cria imagens, posts e direções visuais alinhados à marca do cliente.",
  companyName: "Empresa Exemplo",
  createdAt: Date.parse("2026-01-01T12:00:00.000Z"),
  currentWork: [],
  displayName: "Designer",
  hasPromptOverride: false,
  id: "00000000-0000-4000-8000-000000000002",
  lifetimeDone: 12,
  promptOverride: null,
  promptOverrideUpdatedAt: null,
  role: "worker",
  status: "available",
  templateId: "tpl-designer",
  templateName: "Designer",
  templateSystemPrompt:
    "Você é o Designer da Qolmeia. Você cria imagens e propõe direções visuais.",
  workerKind: "designer",
};

const MemberEditPage = (props: Props) => (
  <div className="flex flex-col gap-6">
    <BackLink href="/teams">Times</BackLink>
    <SkeletonSuspense
      label="Carregando agente"
      skeleton={
        <MemberEditForm
          companyId="00000000-0000-4000-8000-000000000001"
          initialMember={SAMPLE_MEMBER}
          memberId={SAMPLE_MEMBER.id}
        />
      }
    >
      <MemberEditContent {...props} />
    </SkeletonSuspense>
  </div>
);

export default MemberEditPage;
