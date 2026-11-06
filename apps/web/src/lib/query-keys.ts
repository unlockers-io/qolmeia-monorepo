const queryKeys = {
  assetText: (assetId: string | undefined) => ["asset-text", assetId] as const,
  brandAssets: (companyId: string) => ["brand-assets", companyId] as const,
  catalogue: (companyId: string) => ["catalogue", companyId] as const,
  company: (companyId: string) => ["company", companyId] as const,
  team: (companyId: string) => ["team", companyId] as const,
};

export { queryKeys };
