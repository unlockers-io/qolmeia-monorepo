const agentsServerUrl = (): string => process.env.AGENTS_INTERNAL_URL ?? "http://127.0.0.1:8787";

export { agentsServerUrl };
