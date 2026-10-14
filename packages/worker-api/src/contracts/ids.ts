/**
 * Agent and team row ids are derived, not stored: the Worker writes them, addresses Durable
 * Objects by the same strings, and the apps link to them, so the derivations live here.
 */

const correspondentIdFor = (companyId: string): string => `corr-${companyId}`;

const plannerIdFor = (companyId: string): string => `planner-${companyId}`;

const teamIdFor = (companyId: string): string => `team-${companyId}`;

const workerIdFor = (templateId: string, companyId: string): string =>
  `worker-${templateId}-${companyId}`;

export { correspondentIdFor, plannerIdFor, teamIdFor, workerIdFor };
