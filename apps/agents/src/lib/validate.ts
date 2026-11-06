import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

/** Hono parses only bodies matching this; under any other content type the body validates as `{}`. */
const JSON_CONTENT_TYPE = /^application\/(?:[a-z\-.]+\+)?json(?:;\s*[a-z0-9\-]+=[^;]+)*$/iv;

const jsonBody = <Schema extends z.ZodType>(schema: Schema) =>
  zValidator("json", schema, (result, c) => {
    if (!JSON_CONTENT_TYPE.test(c.req.header("content-type") ?? "")) {
      return c.json({ error: "expected application/json" }, 415);
    }

    return result.success
      ? undefined
      : c.json({ error: "invalid body", issues: result.error.issues }, 400);
  });

export { jsonBody };
