import { agentAvatarClass, agentInitials } from "@repo/app-shell/agent-avatar";
import { apiGetServer } from "@repo/app-shell/server-api";
import { Card, CardContent } from "@repo/ui/components/card";
import { EmptyState } from "@repo/ui/compositions/empty-state";
import { PageHeader } from "@repo/ui/compositions/page-header";
import { StatusPill } from "@repo/ui/compositions/status-pill";
import { cn } from "@repo/ui/lib/utils";
import type { TicketsResponse } from "@repo/worker-api/contracts";
import { Ticket as TicketIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SkeletonSuspense } from "skullet/react";

import { getTickets } from "@/lib/backoffice-api";
import { formatRelative } from "@/lib/format";
import { TICKET_STATUS } from "@/lib/status";

export const metadata: Metadata = { title: "Tickets" };

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

type TicketsCardProps = {
  items: ReadonlyArray<
    Pick<
      TicketsResponse["items"][number],
      "agent" | "companyName" | "id" | "status" | "title" | "updatedAt"
    >
  >;
  now: Date;
};

const TicketsCard = ({ items, now }: TicketsCardProps) => (
  <Card className="gap-0 overflow-hidden p-0">
    <CardContent className="p-0">
      {items.length === 0 ? (
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
            {items.map((ticket) => (
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
                    <StatusPill {...TICKET_STATUS[ticket.status]} />
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                      Atualizado
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(ticket.updatedAt, now)}
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

const TicketsContent = async () => {
  const res = await getTickets(apiGetServer, 50);
  const now = new Date();

  return <TicketsCard items={res.items} now={now} />;
};

const SAMPLE_NOW = new Date("2026-01-01T12:00:00.000Z");

const SAMPLE_TICKETS: TicketsCardProps["items"] = [
  {
    agent: { name: "Designer", role: "worker", workerKind: "designer" },
    companyName: "Empresa Exemplo",
    id: "00000000-0000-4000-8000-000000000001",
    status: "awaiting_approval",
    title: "Carrossel de lançamento da coleção",
    updatedAt: SAMPLE_NOW.getTime() - 5 * 60_000,
  },
  {
    agent: { name: "Redator", role: "worker", workerKind: "copywriter" },
    companyName: "Outra Empresa",
    id: "00000000-0000-4000-8000-000000000002",
    status: "in_progress",
    title: "Legendas para a semana",
    updatedAt: SAMPLE_NOW.getTime() - 2 * 60 * 60_000,
  },
  {
    agent: { name: "Correspondente", role: "correspondent", workerKind: null },
    companyName: "Empresa Exemplo",
    id: "00000000-0000-4000-8000-000000000003",
    status: "done",
    title: "Post de boas-vindas",
    updatedAt: SAMPLE_NOW.getTime() - 26 * 60 * 60_000,
  },
];

const TicketsPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader description="Unidades de trabalho delegado · todas as empresas." title="Tickets" />
    <SkeletonSuspense
      label="Carregando tickets"
      skeleton={<TicketsCard items={SAMPLE_TICKETS} now={SAMPLE_NOW} />}
    >
      <TicketsContent />
    </SkeletonSuspense>
  </div>
);

export default TicketsPage;
