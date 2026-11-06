import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendEmail, type EmailClientFactory } from "./send-email";

const sendMock = vi.fn();

const createClient: EmailClientFactory = () => ({
  emails: { send: sendMock },
});

describe("sendEmail", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: "test" }, error: null });
  });

  const template = createElement("div", null, "hi");

  it("sends from the Qolmeia sender on the email subdomain", async () => {
    const result = await sendEmail(
      { apiKey: "re_test", subject: "x", template, to: "delivered+test@resend.dev" },
      createClient,
    );

    expect(result.success).toBe(true);
    expect(sendMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ from: "Qolmeia <noreply@email.qolmeia.com>" }),
    );
  });

  it("refuses a recipient that is not an e-mail address", async () => {
    const result = await sendEmail(
      { apiKey: "re_test", subject: "x", template, to: "not-an-email" },
      createClient,
    );

    expect(result.success).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
