import { PageContainer } from "@repo/ui/compositions/page-container";
import { PageHeader } from "@repo/ui/compositions/page-header";
import type { Metadata } from "next";
import { SkeletonSuspense } from "skullet/react";

import { AssetsGallery } from "@/components/assets-gallery";
import { apiGetServer } from "@/lib/api-server";
import type { ListResponse, WebChatAsset } from "@/lib/api-types";
import { log } from "@/lib/observability";

export const metadata: Metadata = {
  title: "Assets",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const loadAssets = async (): Promise<ReadonlyArray<WebChatAsset>> => {
  try {
    const result = await apiGetServer<ListResponse<WebChatAsset>>("/api/me/assets?limit=200");

    return result.items;
  } catch (error) {
    log.error({ error, message: "assets: failed to load" });

    return [];
  }
};

const AssetsContent = async () => {
  const assets = await loadAssets();

  return <AssetsGallery assets={assets} />;
};

const BLANK_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const SAMPLE_ASSET = {
  createdAt: "2026-01-01T12:00:00.000Z",
  metadata: null,
  url: BLANK_IMAGE,
};

const SAMPLE_ASSETS: ReadonlyArray<WebChatAsset> = [
  {
    ...SAMPLE_ASSET,
    id: "00000000-0000-4000-8000-000000000001",
    kind: "generated_image",
    mimeType: "image/png",
    name: "post-acai-verao.png",
    size: 482_304,
  },
  {
    ...SAMPLE_ASSET,
    id: "00000000-0000-4000-8000-000000000002",
    kind: "generated_image",
    mimeType: "image/png",
    name: "story-cardapio-verao.png",
    size: 391_168,
  },
  {
    ...SAMPLE_ASSET,
    id: "00000000-0000-4000-8000-000000000003",
    kind: "generated_image",
    mimeType: "image/png",
    name: "anuncio-cafe-da-manha.png",
    size: 455_680,
  },
  {
    ...SAMPLE_ASSET,
    id: "00000000-0000-4000-8000-000000000004",
    kind: "knowledge_doc",
    mimeType: "text/markdown",
    name: "plano-de-conteudo-verao.md",
    size: 6144,
  },
];

const AssetsPage = () => (
  <PageContainer>
    <PageHeader
      description="A biblioteca da sua empresa, com tudo que o Time criou e usa: imagens, documentos, planos e arquivos enviados."
      title="Assets"
    />
    <SkeletonSuspense label="Carregando assets" skeleton={<AssetsGallery assets={SAMPLE_ASSETS} />}>
      <AssetsContent />
    </SkeletonSuspense>
  </PageContainer>
);

export default AssetsPage;
