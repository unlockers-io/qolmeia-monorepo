import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import type { CoverageResponse } from "@repo/worker-api/contracts";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { SkeletonSuspense } from "skullet/react";

import { CoverageForm } from "@/components/coverage-form";
import { apiGetServer } from "@/lib/api-server";

export const metadata: Metadata = { title: "Cobertura" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const CoverageCard = ({ coverage }: { coverage: CoverageResponse | null }) => (
  <Card className="max-w-2xl p-6">
    {coverage ? (
      <CoverageForm initial={coverage.assigned} options={coverage.options} />
    ) : (
      <EmptyState
        className="py-10"
        description="Não foi possível carregar sua cobertura. Recarregue a página."
        icon={<TriangleAlert aria-hidden />}
        title="Falha ao carregar"
      />
    )}
  </Card>
);

const CoverageContent = async () => {
  const coverage = await apiGetServer<CoverageResponse>("/assignments/me").catch(() => null);

  return <CoverageCard coverage={coverage} />;
};

const SAMPLE_COVERAGE: CoverageResponse = {
  assigned: { companies: [], disciplines: [] },
  options: {
    companies: [
      { id: "00000000-0000-4000-8000-000000000001", name: "Empresa Exemplo" },
      { id: "00000000-0000-4000-8000-000000000002", name: "Outra Empresa" },
      { id: "00000000-0000-4000-8000-000000000003", name: "Loja Nova" },
    ],
    disciplineNames: {
      copywriter: "Redator",
      designer: "Designer",
      "seo-researcher": "Pesquisador SEO",
    },
    disciplines: ["designer", "copywriter", "seo-researcher"],
  },
};

const CoveragePage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader
      description="Escolha as empresas e disciplinas que você revisa. A fila de aprovações passa a mostrar só o que está sob sua cobertura; sem nada marcado, você vê tudo."
      title="Minha cobertura"
    />
    <SkeletonSuspense
      label="Carregando cobertura"
      skeleton={<CoverageCard coverage={SAMPLE_COVERAGE} />}
    >
      <CoverageContent />
    </SkeletonSuspense>
  </div>
);

export default CoveragePage;
