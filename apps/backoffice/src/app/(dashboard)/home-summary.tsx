import { cn } from "@repo/ui/lib/utils";
import type { ActionsResponse, CompanyRoster, TicketsResponse } from "@repo/worker-api/contracts";
import Link from "next/link";

import { formatDurationSeconds } from "@/lib/format";

const UNAVAILABLE = "Não foi possível carregar";

type SummaryItemProps = {
  emphasis?: boolean;
  href?: string;
  label: string;
  sub?: string;
  value: number | null;
};

const SummaryItem = ({ emphasis = false, href, label, sub, value }: SummaryItemProps) => {
  const content = (
    <>
      <dt className="text-(length:--text-label) text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight tabular-nums",
          emphasis ? "text-warning-surface-foreground" : "text-foreground",
        )}
      >
        {value ?? "—"}
      </dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{value === null ? UNAVAILABLE : sub}</dd>
    </>
  );
  return href === undefined ? (
    <div className="px-5 py-4">{content}</div>
  ) : (
    <Link
      className="block px-5 py-4 transition-colors outline-none hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      href={href}
    >
      {content}
    </Link>
  );
};

const OPEN_STATUSES = new Set(["in_progress", "open", "awaiting_approval"]);

const startOfMonth = (now: Date): number =>
  new Date(now.getFullYear(), now.getMonth(), 1).getTime();

const PendingSummary = ({ pending }: { pending: ActionsResponse["items"] | null }) => {
  const pendingCount = pending?.length ?? null;
  const oldestPendingAge = pending?.[0]?.ageSeconds;
  return (
    <SummaryItem
      emphasis={pendingCount !== null && pendingCount > 0}
      href="/approvals"
      label="Aprovações pendentes"
      sub={
        oldestPendingAge === undefined
          ? "Fila em dia"
          : `A mais antiga há ${formatDurationSeconds(oldestPendingAge)}`
      }
      value={pendingCount}
    />
  );
};

const TicketSummary = ({ tickets }: { tickets: TicketsResponse["items"] | null }) => {
  const monthStart = startOfMonth(new Date());
  const openTickets = tickets?.filter((ticket) => OPEN_STATUSES.has(ticket.status)).length ?? null;
  const doneThisMonth =
    tickets?.filter((ticket) => ticket.status === "done" && ticket.updatedAt >= monthStart)
      .length ?? null;
  return (
    <>
      <SummaryItem
        href="/tickets"
        label="Tickets abertos"
        sub={tickets === null ? undefined : `De ${tickets.length} no total`}
        value={openTickets}
      />
      <SummaryItem label="Concluídos no mês" sub="Tickets entregues" value={doneThisMonth} />
    </>
  );
};

const CompanySummary = ({ companies }: { companies: Array<CompanyRoster> | null }) => {
  const activeCompanies =
    companies?.filter((company) => company.status === "active").length ?? null;
  const onboardingCompanies =
    companies?.filter((company) => company.status === "onboarding").length ?? 0;
  return (
    <SummaryItem
      href="/teams"
      label="Empresas ativas"
      sub={`${onboardingCompanies} em onboarding`}
      value={activeCompanies}
    />
  );
};

export { CompanySummary, PendingSummary, TicketSummary };
