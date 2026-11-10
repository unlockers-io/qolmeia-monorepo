import { agentAvatarClass, agentInitials, agentRoleLabel } from "@repo/app-shell/agent-avatar";
import { AGENT_STATUS } from "@repo/app-shell/agent-status";
import { apiGetServer } from "@repo/app-shell/server-api";
import { Card } from "@repo/ui/components/card";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { StatusPill, type StatusTone } from "@repo/ui/compositions/status-pill";
import { cn } from "@repo/ui/lib/utils";
import type { CompanyRoster, CompanyStatus } from "@repo/worker-api/contracts";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SkeletonBox, SkeletonSuspense } from "skullet/react";

import { InviteCustomerForm } from "@/components/invite-customer-form";
import { requireOperator } from "@/lib/auth-helpers";
import { getCompanies } from "@/lib/backoffice-api";

export const metadata: Metadata = { title: "Times" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const COMPANY_STATUS = {
  active: { label: "Ativo", tone: "success" },
  onboarding: { label: "Onboarding", tone: "warning" },
  paused: { label: "Pausado", tone: "neutral" },
} satisfies Record<CompanyStatus, { label: string; tone: StatusTone }>;

type TeamsGridProps = {
  companies: ReadonlyArray<CompanyRoster>;
  sample: boolean;
};

const TeamsGrid = ({ companies, sample }: TeamsGridProps) => (
  <div className="grid gap-4 md:grid-cols-2">
    {companies.map((company) => {
      const companyStatus = COMPANY_STATUS[company.status];

      return (
        <Card className="gap-0 overflow-hidden p-0" key={company.id}>
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-panel bg-avatar-7 font-display text-sm font-bold text-white"
            >
              {agentInitials(company.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-foreground">{company.name}</div>
              <div className="text-xs text-muted-foreground">
                {company.members.length} agentes · brief {company.briefPercent}%
              </div>
            </div>
            <StatusPill
              className="shrink-0"
              label={companyStatus.label}
              tone={companyStatus.tone}
            />
          </div>
          <div className="flex flex-col px-3 py-3">
            {company.members.map((m) => {
              const memberStatus = AGENT_STATUS[m.status];

              return (
                <Link
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
                  href={`/teams/${company.id}/members/${m.id}`}
                  key={m.id}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-7.5 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold text-white",
                      agentAvatarClass(m.role, m.workerKind),
                    )}
                  >
                    {agentInitials(m.displayName)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-(length:--text-label-lg) font-semibold text-foreground">
                      {m.displayName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {agentRoleLabel(m.role, m.templateName)}
                    </span>
                  </span>
                  <StatusPill
                    className="shrink-0"
                    label={memberStatus.label}
                    pulse={memberStatus.pulse}
                    tone={memberStatus.tone}
                  />
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/60" />
                </Link>
              );
            })}
          </div>
          <div className="border-t border-border px-5 py-4">
            {sample ? (
              <SkeletonBox height={40} width="100%" />
            ) : (
              <InviteCustomerForm companyId={company.id} />
            )}
          </div>
        </Card>
      );
    })}
  </div>
);

const TeamsContent = async () => {
  await requireOperator();

  const { companies } = await getCompanies(apiGetServer);

  return <TeamsGrid companies={companies} sample={false} />;
};

const SAMPLE_COMPANIES: ReadonlyArray<CompanyRoster> = [
  {
    briefPercent: 80,
    id: "00000000-0000-4000-8000-000000000001",
    members: [
      {
        currentWork: [],
        displayName: "Correspondente",
        hasPromptOverride: false,
        id: "00000000-0000-4000-8000-000000000011",
        lifetimeDone: 0,
        role: "correspondent",
        status: "available",
        templateId: null,
        templateName: null,
        workerKind: null,
      },
      {
        currentWork: [],
        displayName: "Designer",
        hasPromptOverride: false,
        id: "00000000-0000-4000-8000-000000000012",
        lifetimeDone: 12,
        role: "worker",
        status: "working",
        templateId: "tpl-designer",
        templateName: "Designer",
        workerKind: "designer",
      },
      {
        currentWork: [],
        displayName: "Redator",
        hasPromptOverride: false,
        id: "00000000-0000-4000-8000-000000000013",
        lifetimeDone: 7,
        role: "worker",
        status: "available",
        templateId: "tpl-redator",
        templateName: "Redator",
        workerKind: "redator",
      },
    ],
    name: "Empresa Exemplo",
    status: "active",
  },
  {
    briefPercent: 40,
    id: "00000000-0000-4000-8000-000000000002",
    members: [
      {
        currentWork: [],
        displayName: "Correspondente",
        hasPromptOverride: false,
        id: "00000000-0000-4000-8000-000000000021",
        lifetimeDone: 0,
        role: "correspondent",
        status: "available",
        templateId: null,
        templateName: null,
        workerKind: null,
      },
      {
        currentWork: [],
        displayName: "Estrategista de marketing",
        hasPromptOverride: false,
        id: "00000000-0000-4000-8000-000000000022",
        lifetimeDone: 3,
        role: "worker",
        status: "awaiting_approval",
        templateId: "tpl-marketing-strategist",
        templateName: "Estrategista de marketing",
        workerKind: "marketing-strategist",
      },
    ],
    name: "Outra Empresa",
    status: "onboarding",
  },
];

const TeamsPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader description="Empresas e seus agentes." title="Times" />
    <SkeletonSuspense
      label="Carregando times"
      skeleton={<TeamsGrid companies={SAMPLE_COMPANIES} sample />}
    >
      <TeamsContent />
    </SkeletonSuspense>
  </div>
);

export default TeamsPage;
