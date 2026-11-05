import type { Metadata } from "next";
import { SkeletonSuspense } from "skullet/react";

import { EmpresaClient, EmpresaSample } from "@/components/empresa-client";
import { apiGetServer } from "@/lib/api-server";
import { requireCustomer } from "@/lib/auth-helpers";
import type { BrandAsset, CompanyResponse } from "@/lib/company";
import type { HireableTemplate, TeamMemberView } from "@/lib/team";

export const metadata: Metadata = {
  title: "Minha empresa",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const EmpresaContent = async () => {
  const me = await requireCustomer();

  const [company, brandAssets, members, catalogue] = await Promise.allSettled([
    apiGetServer<CompanyResponse>("/api/me/company"),
    apiGetServer<{ items: Array<BrandAsset> }>("/api/me/brand-assets"),
    apiGetServer<{ members: Array<TeamMemberView> }>("/api/me/team"),
    apiGetServer<{ templates: Array<HireableTemplate> }>("/api/me/catalogue"),
  ]);

  return (
    <EmpresaClient
      companyId={me.org.id}
      initialBrandAssets={brandAssets.status === "fulfilled" ? brandAssets.value.items : undefined}
      initialCatalogue={catalogue.status === "fulfilled" ? catalogue.value.templates : undefined}
      initialCompany={company.status === "fulfilled" ? company.value : undefined}
      initialMembers={members.status === "fulfilled" ? members.value.members : undefined}
    />
  );
};

const EmpresaPage = () => (
  <SkeletonSuspense label="Carregando sua empresa" skeleton={<EmpresaSample />}>
    <EmpresaContent />
  </SkeletonSuspense>
);

export default EmpresaPage;
