import { apiGetServer } from "@repo/app-shell/server-api";
import { Card } from "@repo/ui/components/card";
import { PageHeader } from "@repo/ui/compositions/page-header";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SkeletonBox } from "skullet/react";

import { CoverageForm } from "@/components/coverage-form";
import { SectionError } from "@/components/section-error";
import { getCoverage } from "@/lib/backoffice-api";

export const metadata: Metadata = { title: "Cobertura" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const CoverageContent = async () => {
  const coverage = await getCoverage(apiGetServer);

  return <CoverageForm initial={coverage.assigned} options={coverage.options} />;
};

const CoverageSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-4">
    <SkeletonBox height={36} width="100%" />
    <SkeletonBox height={36} width="100%" />
    <SkeletonBox height={36} width="100%" />
  </div>
);

const CoveragePage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader
      description="Escolha as empresas e disciplinas que você revisa. A fila de aprovações passa a mostrar só o que está sob sua cobertura; sem nada marcado, você vê tudo."
      title="Minha cobertura"
    />
    <Card className="max-w-2xl p-6">
      <SectionError what="a sua cobertura">
        <Suspense fallback={<CoverageSkeleton />}>
          <CoverageContent />
        </Suspense>
      </SectionError>
    </Card>
  </div>
);

export default CoveragePage;
