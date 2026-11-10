import type { ReactElement } from "react";
import { render } from "react-email";
import { z } from "zod";

import { createResendClient } from "../client";

const resendErrorSchema = z.object({
  message: z.string().optional(),
  name: z.string().optional(),
});

const emailTagSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const emailConfigSchema = z.object({
  subject: z.string(),
  tags: z.array(emailTagSchema).optional(),
  to: z.email(),
});

type SendEmailOptions = z.input<typeof emailConfigSchema> & {
  apiKey: string;
  template: ReactElement;
};

type ResendClient = ReturnType<typeof createResendClient>;

type EmailClient = {
  emails: Pick<ResendClient["emails"], "send">;
};

type EmailClientFactory = (apiKey: string) => EmailClient;

const sendEmail = async (
  { apiKey, template, ...config }: SendEmailOptions,
  createClient: EmailClientFactory = createResendClient,
) => {
  if (!apiKey) {
    throw new Error("API key is required for sending emails");
  }

  try {
    const validatedConfig = emailConfigSchema.parse(config);
    const resend = createClient(apiKey);

    const [html, text] = await Promise.all([
      render(template),
      render(template, { plainText: true }),
    ]);

    const result = await resend.emails.send({
      from: "Qolmeia <noreply@email.qolmeia.com>",
      html,
      subject: validatedConfig.subject,
      tags: validatedConfig.tags,
      text,
      to: validatedConfig.to,
    });

    if (result.error) {
      const error = resendErrorSchema.safeParse(result.error).data;
      throw new Error(
        `Resend failed to queue email: ${error?.name ?? "unknown_error"} - ${error?.message ?? "No message"}`,
      );
    }

    return {
      data: result.data,
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to send email",
      success: false,
    };
  }
};

const previewEmail = async (template: ReactElement) => {
  const [html, text] = await Promise.all([render(template), render(template, { plainText: true })]);

  return {
    html,
    text,
  };
};

export { sendEmail, previewEmail };

export type { EmailClient, EmailClientFactory };
