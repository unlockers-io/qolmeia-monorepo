import { apiGetServer } from "@repo/app-shell/server-api";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

import { TemplateForm } from "@/components/template-form";
import { requireOperator } from "@/lib/auth-helpers";
import { getTemplate } from "@/lib/backoffice-api";
import { orNotFound } from "@/lib/or-not-found";

export const metadata: Metadata = { title: "Editar modelo" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type EditTemplatePageProps = {
  params: Promise<{ id: string }>;
};

const EditTemplateContent = async ({ params }: EditTemplatePageProps) => {
  await requireOperator();
  const { id } = await params;

  const { template } = await orNotFound(getTemplate(apiGetServer, id));

  return <TemplateForm initial={template} />;
};

const EditTemplateSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const EditTemplatePage = (props: EditTemplatePageProps) => (
  <Suspense fallback={<EditTemplateSkeleton />}>
    <EditTemplateContent {...props} />
  </Suspense>
);

export default EditTemplatePage;
