import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transport } from "../transport";

import { sendEmail } from "./send-email";

const transport = vi.fn<Transport>();

describe("sendEmail", () => {
  beforeEach(() => {
    transport.mockReset();
    transport.mockResolvedValue({ data: { id: "test" }, error: null, headers: null });
  });

  const template = createElement("div", null, "hi");

  it("sends from the Qolmeia sender on the email subdomain", async () => {
    const result = await sendEmail({
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport,
    });

    expect(result.success).toBe(true);
    expect(transport).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ from: "Qolmeia <noreply@email.qolmeia.com>" }),
    );
  });

  it("refuses a recipient that is not an e-mail address", async () => {
    const result = await sendEmail({ subject: "x", template, to: "not-an-email", transport });

    expect(result.success).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it("reports a rejected message as a failed send", async () => {
    transport.mockResolvedValue({
      data: null,
      error: { message: "quota", name: "rate_limit_exceeded", statusCode: 429 },
      headers: null,
    });

    const result = await sendEmail({
      subject: "x",
      template,
      to: "delivered+test@resend.dev",
      transport,
    });

    expect(result).toMatchObject({
      error: "Failed to queue email: rate_limit_exceeded - quota",
      success: false,
    });
  });
});
