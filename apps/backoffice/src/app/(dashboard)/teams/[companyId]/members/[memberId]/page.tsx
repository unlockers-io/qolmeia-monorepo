import { apiGetServer } from "@repo/app-shell/server-api";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { MemberEditForm } from "@/components/member-edit-form";
import { getMember } from "@/lib/backoffice-api";
import { orNotFound } from "@/lib/or-not-found";

export const metadata: Metadata = { title: "Agente" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type Props = { params: Promise<{ companyId: string; memberId: string }> };

const MemberEditContent = async ({ params }: Props) => {
  const { companyId, memberId } = await params;

  const { member } = await orNotFound(getMember(apiGetServer, companyId, memberId));

  return (
    <MemberEditForm
      companyId={companyId}
      initialMember={member}
      key={memberId}
      memberId={memberId}
    />
  );
};

const MemberEditSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-6">
    <Skeleton className="h-8 w-56" />
    <Skeleton className="h-72 w-full" />
  </div>
);

const MemberEditPage = (props: Props) => (
  <div className="flex flex-col gap-6">
    <BackLink href="/teams">Times</BackLink>
    <Suspense fallback={<MemberEditSkeleton />}>
      <MemberEditContent {...props} />
    </Suspense>
  </div>
);

export default MemberEditPage;
