type Entitlement = { companyId: string; templateId: string };

/** The two delegates it needs, so the Node and the Worker Prisma clients both satisfy it. */
type EntitlementDb = {
  agentTemplate: {
    findMany: (args: {
      select: { id: true };
      where: { status: "active" };
    }) => PromiseLike<Array<{ id: string }>>;
  };
  companyTemplateEntitlement: {
    createMany: (args: {
      data: Array<Entitlement>;
      skipDuplicates: true;
    }) => PromiseLike<{ count: number }>;
  };
};

/** Every Company is entitled to every active Template. */
const entitleToActiveTemplates = async (
  db: EntitlementDb,
  companyIds: ReadonlyArray<string>,
): Promise<void> => {
  const templates = await db.agentTemplate.findMany({
    select: { id: true },
    where: { status: "active" },
  });

  await db.companyTemplateEntitlement.createMany({
    data: companyIds.flatMap((companyId) =>
      templates.map(({ id: templateId }) => ({ companyId, templateId })),
    ),
    skipDuplicates: true,
  });
};

export { entitleToActiveTemplates };
