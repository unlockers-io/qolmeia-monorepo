"use client";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { PageContainer } from "@repo/ui/compositions/page-container";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { useClientReady } from "@repo/ui/hooks/use-client-ready";
import { describeRequestError } from "@repo/worker-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { AgentCard } from "@/components/agent-card";
import { BrandAssets, BrandAssetsCard, SAMPLE_BRAND_ASSETS } from "@/components/brand-assets";
import { BriefCard, CompanyBriefForm, SAMPLE_COMPANY } from "@/components/company-brief-form";
import { HireDialog } from "@/components/hire-dialog";
import { PromptEditor } from "@/components/prompt-editor";
import { SAMPLE_TEAM } from "@/components/team-sidebar";
import type { BrandAsset, CompanyResponse } from "@/lib/company";
import {
  fetchCatalogue,
  fetchMemberDetail,
  patchMember,
  setPaused,
  type HireableTemplate,
  type TeamMemberDetailView,
  type TeamMemberView,
} from "@/lib/team";
import { teamQueryKey, useTeamRoster } from "@/lib/use-team-roster";

const catalogueQueryKey = (companyId: string) => ["catalogue", companyId] as const;

type EmpresaClientProps = {
  companyId: string;
  initialBrandAssets?: Array<BrandAsset>;
  initialCatalogue?: Array<HireableTemplate>;
  initialCompany?: CompanyResponse;
  initialMembers?: Array<TeamMemberView>;
};

type EmpresaViewProps = {
  brandAssets: ReactNode;
  brief: ReactNode;
  busyId: string | null;
  catalogue: ReadonlyArray<HireableTemplate>;
  children?: ReactNode;
  detail: TeamMemberDetailView | null;
  members: ReadonlyArray<TeamMemberView>;
  onCloseDetail: (id: string) => void;
  onHire: (template: HireableTemplate) => void;
  onOpenDetail: (id: string) => void;
  onSavePrompt: (id: string, promptOverride: string | null) => Promise<void>;
  onTogglePause: (id: string, paused: boolean) => void;
  ready: boolean;
};

const EmpresaView = ({
  brandAssets,
  brief,
  busyId,
  catalogue,
  children,
  detail,
  members,
  onCloseDetail,
  onHire,
  onOpenDetail,
  onSavePrompt,
  onTogglePause,
  ready,
}: EmpresaViewProps) => (
  <PageContainer>
    <PageHeader
      description="Os dados da sua marca e o seu time: o que eles sabem sobre você, quem trabalha e quem mais contratar."
      title="Minha empresa"
    />

    {brief}

    {brandAssets}

    <section aria-label="Meu time" className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">Meu time</h2>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {members.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex flex-col gap-4">
              <AgentCard member={m} variant="detailed" />
              <div className="flex flex-wrap gap-2">
                {m.role === "worker" && (
                  <>
                    {detail?.id === m.id ? (
                      <Button
                        disabled={!ready}
                        onClick={() => {
                          onCloseDetail(m.id);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Fechar editor
                      </Button>
                    ) : (
                      <Button
                        disabled={!ready}
                        onClick={() => {
                          onOpenDetail(m.id);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Personalizar instruções
                      </Button>
                    )}
                    <Button
                      disabled={!ready || busyId === m.id}
                      onClick={() => {
                        onTogglePause(m.id, m.status !== "paused");
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      {m.status === "paused" ? "Retomar" : "Pausar"}
                    </Button>
                  </>
                )}
              </div>
              {detail?.id === m.id && m.role === "worker" && (
                <PromptEditor
                  busy={busyId === m.id}
                  initialValue={detail.promptOverride}
                  onReset={() => onSavePrompt(m.id, null)}
                  onSave={(v) => onSavePrompt(m.id, v)}
                  updatedAt={detail.promptOverrideUpdatedAt}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>

    <section aria-label="Contratar mais agentes" className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">Contratar mais agentes</h2>
      <div className="grid items-start gap-3 md:grid-cols-2">
        {catalogue.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="text-base">
                <h3>{t.displayName}</h3>
              </CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {t.hiredCount > 0 ? `Você já tem ${t.hiredCount}` : "Nenhum ainda"}
              </span>
              <Button
                aria-label={`Contratar ${t.displayName}`}
                disabled={!ready}
                onClick={() => {
                  onHire(t);
                }}
                size="sm"
                variant="outline"
              >
                Contratar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>

    {children}
  </PageContainer>
);

const EmpresaClient = ({
  companyId,
  initialBrandAssets,
  initialCatalogue,
  initialCompany,
  initialMembers,
}: EmpresaClientProps) => {
  const [hireTemplate, setHireTemplate] = useState<HireableTemplate | null>(null);
  const [detail, setDetail] = useState<TeamMemberDetailView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const ready = useClientReady();

  const queryClient = useQueryClient();
  const rosterQueryKey = teamQueryKey(companyId);
  const catalogueKey = catalogueQueryKey(companyId);
  const { members, refetch } = useTeamRoster(companyId, initialMembers);

  const { data: catalogue = [] } = useQuery({
    initialData: initialCatalogue,
    meta: { errorToast: "Falha ao carregar catálogo" },
    queryFn: fetchCatalogue,
    queryKey: catalogueKey,
  });

  const handleOpenDetail = async (id: string) => {
    try {
      setDetail(await fetchMemberDetail(id));
    } catch {
      toast.error("Falha ao carregar agente. Tente novamente.");
    }
  };

  const handleCloseDetail = (id: string) => {
    if (detail?.id === id) {
      setDetail(null);
    }
  };

  const savePrompt = async (id: string, promptOverride: string | null) => {
    setBusyId(id);

    try {
      await patchMember(id, { promptOverride });
    } catch (error) {
      setBusyId(null);
      throw error;
    }

    toast.success(promptOverride === null ? "Prompt restaurado." : "Prompt atualizado.");
    await handleOpenDetail(id);
    await refetch();
    setBusyId(null);
  };

  const handleTogglePause = async (id: string, paused: boolean) => {
    setBusyId(id);
    await queryClient.cancelQueries({ queryKey: rosterQueryKey });
    const previousMembers = queryClient.getQueryData<Array<TeamMemberView>>(rosterQueryKey);
    queryClient.setQueryData<Array<TeamMemberView>>(rosterQueryKey, (current) =>
      current?.map((member) =>
        member.id === id ? { ...member, status: paused ? "paused" : "available" } : member,
      ),
    );

    try {
      const updated = await setPaused(id, paused);
      queryClient.setQueryData<Array<TeamMemberView>>(rosterQueryKey, (current) =>
        current?.map((member) => (member.id === id ? updated : member)),
      );
    } catch (error) {
      if (previousMembers !== undefined) {
        queryClient.setQueryData(rosterQueryKey, previousMembers);
      }

      toast.error(describeRequestError(error, "Não foi possível salvar. Tente de novo."));
    }

    setBusyId(null);
  };

  const handleHired = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: catalogueKey });
  };

  return (
    <EmpresaView
      brandAssets={<BrandAssets companyId={companyId} initialData={initialBrandAssets} />}
      brief={<CompanyBriefForm companyId={companyId} initialData={initialCompany} />}
      busyId={busyId}
      catalogue={catalogue}
      detail={detail}
      members={members}
      onCloseDetail={handleCloseDetail}
      onHire={setHireTemplate}
      onOpenDetail={(id) => {
        void handleOpenDetail(id);
      }}
      onSavePrompt={savePrompt}
      onTogglePause={(id, paused) => {
        void handleTogglePause(id, paused);
      }}
      ready={ready}
    >
      <HireDialog
        onClose={() => {
          setHireTemplate(null);
        }}
        onHired={handleHired}
        open={hireTemplate !== null}
        template={hireTemplate}
      />
    </EmpresaView>
  );
};

const SAMPLE_CATALOGUE: ReadonlyArray<HireableTemplate> = [
  {
    description: "Cria artes para posts, stories e anúncios no estilo da sua marca.",
    displayName: "Designer",
    hiredCount: 1,
    id: "00000000-0000-4000-8000-000000000031",
    workerKind: "designer",
  },
  {
    description: "Pesquisa palavras-chave e sugere pautas para o blog e o site.",
    displayName: "Pesquisador SEO",
    hiredCount: 0,
    id: "00000000-0000-4000-8000-000000000032",
    workerKind: "seo-researcher",
  },
];

const ignore = () => undefined;

const EmpresaSample = () => (
  <EmpresaView
    brandAssets={
      <BrandAssetsCard
        assets={SAMPLE_BRAND_ASSETS}
        category="logo"
        onCategoryChange={ignore}
        onFileSelected={ignore}
        onRemove={ignore}
        ready={false}
        removing={false}
        uploading={false}
      />
    }
    brief={
      <BriefCard companyId={SAMPLE_COMPANY.company.id} initial={SAMPLE_COMPANY.company.brief} />
    }
    busyId={null}
    catalogue={SAMPLE_CATALOGUE}
    detail={null}
    members={SAMPLE_TEAM}
    onCloseDetail={ignore}
    onHire={ignore}
    onOpenDetail={ignore}
    onSavePrompt={() => Promise.resolve()}
    onTogglePause={ignore}
    ready={false}
  />
);

export { EmpresaClient, EmpresaSample };
