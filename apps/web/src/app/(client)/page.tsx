import { Skeleton } from "@repo/ui/components/skeleton";
import { ApiError } from "@repo/worker-api";
import type { Metadata } from "next";
import { Suspense } from "react";

import { Chat } from "@/components/chat";
import { OnboardingActions } from "@/components/onboarding-actions";
import { TeamSidebar } from "@/components/team-sidebar";
import { apiGetServer } from "@/lib/api-server";
import { requireCustomer } from "@/lib/auth-helpers";

export const metadata: Metadata = {
  title: "Chat",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type CompanyResponse = {
  company: { id: string; slug: string; status: string };
};

type TemplatesResponse = {
  templates: ReadonlyArray<{
    description: string;
    displayName: string;
    id: string;
    workerKind: string;
  }>;
};

const getUnlessMissing = async <T,>(path: string): Promise<T | null> => {
  try {
    return await apiGetServer<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
};

const ChatContent = async () => {
  const me = await requireCustomer();
  const companyId = me.org.id;

  const companyRes = await getUnlessMissing<CompanyResponse>("/api/me/company");
  const status = companyRes?.company.status ?? "onboarding";

  if (status === "onboarding") {
    const templatesRes = await getUnlessMissing<TemplatesResponse>("/api/me/templates");
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-background" data-chat>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Chat agent="planner" companyId={companyId} />
        </div>
        <OnboardingActions companyId={companyId} templates={templatesRes?.templates ?? []} />
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
