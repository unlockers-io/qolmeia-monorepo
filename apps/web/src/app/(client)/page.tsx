import { apiGetServer } from "@repo/app-shell/server-api";
import { Skeleton } from "@repo/ui/components/skeleton";
import { CompanyStatus } from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Chat } from "@/components/chat";
import { OnboardingActions } from "@/components/onboarding-actions";
import { TeamSidebar } from "@/components/team-sidebar";
import { requireCustomer } from "@/lib/auth-helpers";
import { fetchCompany } from "@/lib/company";
import { fetchCatalogue } from "@/lib/team";

export const metadata: Metadata = {
  title: "Chat",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const ChatContent = async () => {
  const me = await requireCustomer();
  const companyId = me.org.id;

  const { company } = await fetchCompany(apiGetServer);

  if (company.status === CompanyStatus.onboarding) {
    const templates = await fetchCatalogue(apiGetServer);

    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background" data-chat>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Chat agent="planner" companyId={companyId} />
        </div>
        <OnboardingActions templates={templates} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 bg-background" data-chat>
      <div className="flex min-w-0 flex-1 flex-col">
        <Chat agent="correspondent" companyId={companyId} />
      </div>
      <div className="hidden lg:flex">
        <TeamSidebar companyId={companyId} />
      </div>
    </div>
  );
};

const ChatSkeleton = () => (
  <div aria-hidden className="flex min-h-0 flex-1 flex-col gap-4 bg-background p-6" data-chat>
    <Skeleton className="h-6 w-40" />
    <Skeleton className="min-h-0 flex-1" />
    <Skeleton className="h-12 w-full" />
  </div>
);

const ChatPage = () => (
  <Suspense fallback={<ChatSkeleton />}>
    <ChatContent />
  </Suspense>
);

export default ChatPage;
