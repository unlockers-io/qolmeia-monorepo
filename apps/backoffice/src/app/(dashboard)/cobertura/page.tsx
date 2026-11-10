import { apiGetServer } from "@repo/app-shell/server-api";
import { Card } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SkeletonBox } from "skullet/react";

import { CoverageForm } from "@/components/coverage-form";
import { getCoverage } from "@/lib/backoffice-api";

export const metadata: Metadata = { title: "Cobertura" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const CoverageContent = async () => {
  const coverage = await getCoverage(apiGetServer).catch(() => null);

  return (
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
};

const CoverageSkeleton = () => (
  <Card aria-hidden className="max-w-2xl p-6">
    <div className="flex flex-col gap-4">
      <SkeletonBox height={36} width="100%" />
      <SkeletonBox height={36} width="100%" />
      <SkeletonBox height={36} width="100%" />
    </div>
  </Card>
);

const CoveragePage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader
      description="Escolha as empresas e disciplinas que você revisa. A fila de aprovações passa a mostrar só o que está sob sua cobertura; sem nada marcado, você vê tudo."
      title="Minha cobertura"
    />
    <Suspense fallback={<CoverageSkeleton />}>
      <CoverageContent />
    </Suspense>
  </div>
);

export default CoveragePage;
