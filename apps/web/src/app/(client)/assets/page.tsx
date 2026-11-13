import { apiGetServer } from "@repo/app-shell/server-api";
import { PageContainer } from "@repo/ui/compositions/page-container";
import { PageHeader } from "@repo/ui/compositions/page-header";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SkeletonBox } from "skullet/react";

import { AssetsGallery } from "@/components/assets-gallery";
import { SectionError } from "@/components/section-error";
import { fetchLibraryAssets } from "@/lib/library";

export const metadata: Metadata = {
  title: "Assets",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const AssetsContent = async () => <AssetsGallery assets={await fetchLibraryAssets(apiGetServer)} />;

const AssetsSkeleton = () => (
  <div aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3">
    <SkeletonBox height={160} width="100%" />
    <SkeletonBox height={160} width="100%" />
    <SkeletonBox height={160} width="100%" />
  </div>
);

const AssetsPage = () => (
  <PageContainer>
    <PageHeader
      description="A biblioteca da sua empresa, com tudo que o Time criou e usa: imagens, documentos, planos e arquivos enviados."
      title="Assets"
    />
    <SectionError framed what="os seus arquivos">
      <Suspense fallback={<AssetsSkeleton />}>
        <AssetsContent />
      </Suspense>
    </SectionError>
  </PageContainer>
);

export default AssetsPage;
