import type {
  BodySchema,
  Endpoint,
  ParamsOf,
  QueryOf,
  ResponseOf,
} from "@repo/worker-api/endpoints";
import type { Context, Hono } from "hono";
import type { z } from "zod";

import type { IdentityEnv } from "#/identity/gates";
import { jsonBody } from "#/lib/validate";

type EndpointRequest<Target extends Endpoint> = {
  body: Target["body"] extends BodySchema ? z.output<Target["body"]> : undefined;
  params: ParamsOf<Target>;
  query: { [Name in keyof QueryOf<Target>]?: string };
};

type Answer<Target extends Endpoint> = Response | ResponseOf<Target>;

type EndpointHandler<Target extends Endpoint> = (
  c: Context<IdentityEnv>,
  request: EndpointRequest<Target>,
) => Answer<Target> | Promise<Answer<Target>>;

/**
 * Mounts an endpoint from `@repo/worker-api/endpoints` on a gated router: its method, path, body
 * schema and status come from the declaration, and the handler answers its response type.
 */
const answer = <Target extends Endpoint>(
  router: Hono<IdentityEnv>,
  endpoint: Target,
  handler: EndpointHandler<Target>,
): void => {
  const { body: schema, method, path, status } = endpoint;

  const respond = async (
    c: Context<IdentityEnv>,
    body?: z.output<BodySchema>,
  ): Promise<Response> => {
    const result = await handler(c, {
      // SAFETY: `body` is the endpoint schema's output when it has one, and absent when it has none.
      // oxlint-disable-next-line no-unsafe-type-assertion -- the schema is a runtime value of a generic endpoint
      body: body as EndpointRequest<Target>["body"],
      // SAFETY: Hono matched the endpoint's path, so its `:name` segments are the route's parameters.
      // oxlint-disable-next-line no-unsafe-type-assertion -- Hono types parameters from a literal path, not from a generic endpoint
      params: c.req.param() as ParamsOf<Target>,
      query: c.req.query(),
    });

    return result instanceof Response ? result : c.json(result, status);
  };

  if (schema === null || schema === "form") {
    router.on(method, path, (c) => respond(c));

    return;
  }

  router.on(method, path, jsonBody(schema), (c) => respond(c, c.req.valid("json")));
};

export { answer };
