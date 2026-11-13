import type { ReactElement } from "react";
import { render } from "react-email";
import { z } from "zod";

import type { Transport } from "../transport";

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
  template: ReactElement;
  transport: Transport;
};

const sendEmail = async ({ template, transport, ...config }: SendEmailOptions) => {
  try {
    const validatedConfig = emailConfigSchema.parse(config);

    const [html, text] = await Promise.all([
      render(template),
      render(template, { plainText: true }),
    ]);

    const result = await transport({
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
        `Failed to queue email: ${error?.name ?? "unknown_error"} - ${error?.message ?? "No message"}`,
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
