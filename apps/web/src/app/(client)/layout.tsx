import type { ReactNode } from "react";
import { Suspense } from "react";
import { Skeleton } from "skullet/react";

import { Nav } from "@/components/nav";
import { requireCustomer } from "@/lib/auth-helpers";

const NavData = async () => {
  const me = await requireCustomer();

  return <Nav orgName={me.org.name} />;
};

const ClientLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-dvh flex-col bg-background has-data-chat:h-dvh">
    <Suspense
      fallback={
        <Skeleton label="Carregando navegação" loading>
          <Nav orgName="Padaria Pão Dourado" />
        </Skeleton>
      }
    >
      <NavData />
    </Suspense>
    <main className="flex min-h-0 flex-1 flex-col" id="main-content">
      {children}
    </main>
  </div>
);

export default ClientLayout;
