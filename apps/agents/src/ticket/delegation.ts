import { OPEN_TICKET_STATUSES } from "@repo/worker-api/contracts";

import type { PrismaClient } from "#/lib/db";
import { emitTeamEvent } from "#/team/events";
import { correspondentIdFor } from "#/team/ids";

type DelegationInput = {
  brief: string;
  companyId: string;
  delegatorId: string;
  workerKind: string;
};

type DelegationResult = { error: string } | { status: "queued"; ticketId: string };

type WorkerCandidate = { busyCount: number; id: string };

const pickWorker = (candidates: ReadonlyArray<WorkerCandidate>): WorkerCandidate | undefined => {
  const idle = candidates.filter((candidate) => candidate.busyCount === 0);
  const pool = idle.length > 0 ? idle : candidates;

  return pool.at(Date.now() % Math.max(pool.length, 1));
};

/** The Company's Correspondent delegates to any active Worker of the requested kind. */
const findWorker = async (
  db: PrismaClient,
  input: DelegationInput,
): Promise<{ error: string } | WorkerCandidate> => {
  if (input.delegatorId !== correspondentIdFor(input.companyId)) {
    return { error: `Você não tem permissão para delegar para "${input.workerKind}".` };
  }

  const candidates = await db.agentInstance.findMany({
    select: {
      _count: { select: { tickets: { where: { status: { in: [...OPEN_TICKET_STATUSES] } } } } },
      id: true,
    },
    where: {
      companyId: input.companyId,
      role: "worker",
      status: "active",
      template: { status: "active", workerKind: input.workerKind },
    },
  });

  return (
    pickWorker(candidates.map(({ _count, id }) => ({ busyCount: _count.tickets, id }))) ?? {
      error: `Nenhum especialista do tipo "${input.workerKind}" no Time desta empresa.`,
    }
  );
};

const delegateTicket = async (
  env: Env,
  db: PrismaClient,
  input: DelegationInput,
): Promise<DelegationResult> => {
  const worker = await findWorker(db, input);

  if ("error" in worker) {
    return worker;
  }

  const ticketId = crypto.randomUUID();
  await db.ticket.create({
    data: {
      agentInstanceId: worker.id,
      brief: input.brief,
      companyId: input.companyId,
      id: ticketId,
      origin: "delegation",
      status: "in_progress",
      title: input.brief.slice(0, 80),
    },
  });

  try {
    await env.WORKER_JOB.create({
      id: ticketId,
      params: { agentInstanceId: worker.id, companyId: input.companyId, ticketId },
    });
  } catch (error) {
    await db.ticket.delete({ where: { id: ticketId } });
    throw error;
  }

  await emitTeamEvent(env, { companyId: input.companyId, type: "team:status" });

  return { status: "queued", ticketId };
};

export { delegateTicket };
