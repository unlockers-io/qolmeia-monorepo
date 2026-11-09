import { loopbackUrl } from "@repo/portless-env/apps";

const agentsServerUrl = (): string =>
  process.env.AGENTS_INTERNAL_URL ?? loopbackUrl("agents", "127.0.0.1");

export { agentsServerUrl };
