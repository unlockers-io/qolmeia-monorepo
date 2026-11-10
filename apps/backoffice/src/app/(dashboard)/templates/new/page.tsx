import type { Metadata } from "next";
import { Suspense } from "react";
import { SkeletonBox } from "skullet/react";

import { TemplateForm } from "@/components/template-form";
import { requireOperator } from "@/lib/auth-helpers";

export const metadata: Metadata = { title: "Novo modelo" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const NewTemplateContent = async () => {
  await requireOperator();

  return <TemplateForm />;
};

const NewTemplateSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <SkeletonBox height={32} width={192} />
    <SkeletonBox height={256} width="100%" />
  </div>
);

const NewTemplatePage = () => (
  <Suspense fallback={<NewTemplateSkeleton />}>
    <NewTemplateContent />
  </Suspense>
);

export default NewTemplatePage;
