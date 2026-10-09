import { z } from "zod";

import type { PrismaClient } from "#/lib/db";
import { emitTeamEvent } from "#/team/events";

type DelegationInput = {
  brief: string;
  companyId: string;
  delegatorId: string;
  workerKind: string;
};

type DelegationResult =
  | { error: string }
  | { status: "queued"; ticketId: string; workflowId: string };

type WorkerCandidate = { busyCount: number; id: string };

const delegationTargetsSchema = z.array(z.string());

const pickWorker = (
  candidates: ReadonlyArray<WorkerCandidate>,
  allowed: ReadonlyArray<string>,
): WorkerCandidate | undefined => {
  const allowedIds = new Set(allowed);
  const eligible = candidates.filter((candidate) => allowedIds.has(candidate.id));
  const idle = eligible.filter((candidate) => candidate.busyCount === 0);
  const pool = idle.length > 0 ? idle : eligible;
  return pool.at(Date.now() % Math.max(pool.length, 1));
};

const findWorker = async (
  db: PrismaClient,
  input: DelegationInput,
): Promise<{ error: string } | WorkerCandidate> => {
  const [candidates, delegator] = await Promise.all([
    db.agentInstance.findMany({
      select: {
        _count: {
          select: { tickets: { where: { status: { in: ["in_progress", "awaiting_approval"] } } } },
        },
        id: true,
      },
      where: {
        companyId: input.companyId,
        role: "worker",
        status: "active",
        template: { status: "active", workerKind: input.workerKind },
      },
    }),
    db.teamMember.findFirst({
      select: { canDelegateTo: true },
      where: { agentInstanceId: input.delegatorId },
    }),
  ]);
  if (candidates.length === 0) {
    return { error: `Nenhum especialista do tipo "${input.workerKind}" no Time desta empresa.` };
  }
  const worker = pickWorker(
    candidates.map((candidate) => ({ busyCount: candidate._count.tickets, id: candidate.id })),
    delegationTargetsSchema.safeParse(delegator?.canDelegateTo).data ?? [],
  );
  return worker ?? { error: `Você não tem permissão para delegar para "${input.workerKind}".` };
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
      workflowId: ticketId,
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
  await emitTeamEvent(env, {
    companyId: input.companyId,
    reason: "ticket_changed",
    type: "team:status",
  });
  return { status: "queued", ticketId, workflowId: ticketId };
};

export { delegateTicket };
