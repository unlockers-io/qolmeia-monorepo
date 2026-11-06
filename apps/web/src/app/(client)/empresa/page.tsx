import { apiGetServer } from "@repo/app-shell/server-api";
import { Skeleton } from "@repo/ui/components/skeleton";
import { PageContainer } from "@repo/ui/compositions/page-container";
import type { Metadata } from "next";
import { Suspense } from "react";

import { EmpresaClient } from "@/components/empresa-client";
import { requireCustomer } from "@/lib/auth-helpers";
import { fetchCompany } from "@/lib/company";
import { fetchBrandAssets } from "@/lib/library";
import { fetchCatalogue, fetchTeam } from "@/lib/team";

export const metadata: Metadata = {
  title: "Minha empresa",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const EmpresaContent = async () => {
  const me = await requireCustomer();

  const [company, brandAssets, members, catalogue] = await Promise.allSettled([
    fetchCompany(apiGetServer),
    fetchBrandAssets(apiGetServer),
    fetchTeam(apiGetServer),
    fetchCatalogue(apiGetServer),
  ]);

  return (
    <EmpresaClient
      companyId={me.org.id}
      initialBrandAssets={brandAssets.status === "fulfilled" ? brandAssets.value : undefined}
      initialCatalogue={catalogue.status === "fulfilled" ? catalogue.value : undefined}
      initialCompany={company.status === "fulfilled" ? company.value : undefined}
      initialMembers={members.status === "fulfilled" ? members.value : undefined}
    />
  );
};

const EmpresaSkeleton = () => (
  <PageContainer aria-hidden>
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  </PageContainer>
);

const EmpresaPage = () => (
  <Suspense fallback={<EmpresaSkeleton />}>
    <EmpresaContent />
  </Suspense>
);

export default EmpresaPage;
