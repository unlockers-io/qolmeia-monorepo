import { apiGetServer } from "@repo/app-shell/server-api";
import { PageContainer } from "@repo/ui/compositions/page-container";
import { PageHeader } from "@repo/ui/compositions/page-header";
import type { LibraryAsset } from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SkeletonBox } from "skullet/react";

import { AssetsGallery } from "@/components/assets-gallery";
import { fetchLibraryAssets } from "@/lib/library";
import { log } from "@/lib/observability";

export const metadata: Metadata = {
  title: "Assets",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const loadAssets = async (): Promise<ReadonlyArray<LibraryAsset>> => {
  try {
    return await fetchLibraryAssets(apiGetServer);
  } catch (error) {
    log.error({ error, message: "assets: failed to load" });

    return [];
  }
};

const AssetsContent = async () => {
  const assets = await loadAssets();

  return <AssetsGallery assets={assets} />;
};

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
    <Suspense fallback={<AssetsSkeleton />}>
      <AssetsContent />
    </Suspense>
  </PageContainer>
);

export default AssetsPage;
