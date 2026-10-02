import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { agentAvatarClass, agentInitials } from "@repo/ui/lib/agent-avatar";
import { cn } from "@repo/ui/lib/utils";
import type { TicketsResponse } from "@repo/worker-api/contracts";
import { Ticket as TicketIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StatusPill } from "@/components/status-pill";
import { apiGetServer } from "@/lib/api-server";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Tickets" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

const TicketsContent = async () => {
  const res = await apiGetServer<TicketsResponse>("/tickets?limit=50");

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <CardContent className="p-0">
        {res.items.length === 0 ? (
          <EmptyState
            description="Quando um cliente fizer um pedido, o Correspondente abre um ticket aqui."
            icon={<TicketIcon aria-hidden />}
            title="Nenhum ticket ainda"
          />
        ) : (
          <div>
            <div
              aria-hidden
              className="hidden grid-cols-tickets gap-3 border-b border-border bg-muted/40 px-6 py-3 font-mono text-xs tracking-wide text-muted-foreground uppercase md:grid"
            >
              <span>Entregável</span>
              <span>Empresa</span>
              <span>Agente</span>
              <span>Status</span>
              <span>Atualizado</span>
            </div>
            <ul className="flex flex-col">
              {res.items.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    className="grid gap-3 border-b border-border/60 px-4 py-4 transition-colors outline-none last:border-b-0 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:grid-cols-2 md:grid-cols-tickets md:items-center md:px-6 md:py-3.5"
                    href={`/tickets/${ticket.id}`}
                  >
                    <div className="min-w-0 sm:col-span-2 md:col-span-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {ticket.title}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{ticket.id}</div>
                    </div>
                    <div className="min-w-0">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                        Empresa
                      </span>
                      <span className="block truncate text-(length:--text-label) text-foreground/70">
                        {ticket.companyName}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                        Agente
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-cell text-(length:--text-micro) font-bold text-white",
                            agentAvatarClass(ticket.agent.role, ticket.agent.workerKind),
                          )}
                        >
                          {agentInitials(ticket.agent.name)}
                        </span>
                        <span className="truncate text-(length:--text-label) text-foreground/70">
                          {ticket.agent.name}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                        Status
                      </span>
                      <StatusPill status={ticket.status} />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                        Atualizado
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(ticket.updatedAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const TicketsSkeleton = () => (
  <Card aria-hidden className="gap-0 overflow-hidden p-0">
    <CardContent className="flex flex-col gap-4 p-6">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </CardContent>
  </Card>
);

const TicketsPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader description="Unidades de trabalho delegado · todas as empresas." title="Tickets" />
    <Suspense fallback={<TicketsSkeleton />}>
      <TicketsContent />
    </Suspense>
  </div>
);

export default TicketsPage;
