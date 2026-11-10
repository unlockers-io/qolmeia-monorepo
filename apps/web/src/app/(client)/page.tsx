import { apiGetServer } from "@repo/app-shell/server-api";
import { CompanyStatus } from "@repo/worker-api/contracts";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { Chat, ChatSkeleton } from "@/components/chat";
import { OnboardingActions } from "@/components/onboarding-actions";
import { TeamSidebar, TeamSidebarView } from "@/components/team-sidebar";
import { requireCustomer } from "@/lib/auth-helpers";
import { fetchCompany } from "@/lib/company";
import { fetchCatalogue } from "@/lib/team";

export const metadata: Metadata = {
  title: "Chat",
};

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const ActiveChat = ({ chat, sidebar }: { chat: ReactNode; sidebar: ReactNode }) => (
  <div className="flex min-h-0 flex-1 bg-background" data-chat>
    <div className="flex min-w-0 flex-1 flex-col">{chat}</div>
    <div className="hidden lg:flex">{sidebar}</div>
  </div>
);

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
    <ActiveChat
      chat={<Chat agent="correspondent" companyId={companyId} />}
      sidebar={<TeamSidebar companyId={companyId} />}
    />
  );
};

const ChatPage = () => (
  <Suspense
    fallback={
      <ActiveChat
        chat={<ChatSkeleton agent="correspondent" />}
        sidebar={<TeamSidebarView error={null} members={null} />}
      />
    }
  >
    <ChatContent />
  </Suspense>
);

export default ChatPage;
