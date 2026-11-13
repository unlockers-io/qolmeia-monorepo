const correspondentIdFor = (companyId: string): string => `corr-${companyId}`;

const plannerIdFor = (companyId: string): string => `planner-${companyId}`;

const teamIdFor = (companyId: string): string => `team-${companyId}`;

const workerIdFor = (templateId: string, companyId: string): string =>
  `worker-${templateId}-${companyId}`;

export { correspondentIdFor, plannerIdFor, teamIdFor, workerIdFor };
