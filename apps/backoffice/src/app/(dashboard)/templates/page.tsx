import { buttonVariants } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { cn } from "@repo/ui/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TemplatesList, TemplatesListSkeleton } from "@/components/templates-list";
import { requireOperator } from "@/lib/auth-helpers";

export const metadata: Metadata = { title: "Modelos" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const TemplatesContent = async () => {
  await requireOperator();

  return <TemplatesList />;
};

const TemplatesPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader
      actions={
        <Link className={cn(buttonVariants())} href="/templates/new">
          Novo modelo
        </Link>
      }
      description="O catálogo de tipos de especialista que os times podem materializar."
      title="Modelos"
    />
    <Suspense fallback={<TemplatesListSkeleton />}>
      <TemplatesContent />
    </Suspense>
  </div>
);

export default TemplatesPage;
