import { createTransport } from "@repo/transactional/transport";
import type { Transport } from "@repo/transactional/transport";

// workerd cannot write host files, so the dev server keeps the outbox on the Worker's behalf.
const devServerOutbox = (url: string | undefined): Transport => {
  if (url === undefined || url === "") {
    throw new Error("MAIL_TRANSPORT=outbox needs MAIL_OUTBOX_URL, which `vite dev` sets");
  }

  return async (payload) => {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`The dev server outbox answered ${response.status}`);
    }

    return response.json<Awaited<ReturnType<Transport>>>();
  };
};

const mailTransport = (env: Env): Transport =>
  env.MAIL_TRANSPORT === "outbox"
    ? devServerOutbox(env.MAIL_OUTBOX_URL)
    : createTransport({ apiKey: env.RESEND_API_KEY, transport: undefined });

export { mailTransport };
