import type { Metadata } from "next";
import { SkeletonSuspense } from "skullet/react";

import { TemplateForm } from "@/components/template-form";
import { requireOperator } from "@/lib/auth-helpers";

export const metadata: Metadata = { title: "Novo modelo" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const NewTemplateContent = async () => {
  await requireOperator();

  return <TemplateForm />;
};

const NewTemplatePage = () => (
  <SkeletonSuspense label="Carregando formulário" skeleton={<TemplateForm />}>
    <NewTemplateContent />
  </SkeletonSuspense>
);

export default NewTemplatePage;
