import type { z } from "zod";

import type { Endpoint, NoQuery, ParamsOf, PathParams, QueryOf, ResponseOf } from "./endpoints";

class ApiError extends Error {
  body: string;
  status: number;

  constructor(status: number, body: string) {
    super(`API request failed (${status}): ${body}`);
    this.body = body;
    this.name = "ApiError";
    this.status = status;
  }
}

const STATUS_MESSAGES = new Map<number, string>([
  [401, "Sua sessão expirou. Entre de novo para continuar."],
  [403, "Você não tem permissão para fazer isso."],
  [404, "Não encontramos este item. Ele pode ter sido removido."],
  [409, "Isso não é possível no estado atual. Atualize a página e tente de novo."],
  [413, "O arquivo é grande demais."],
  [429, "Muitas tentativas seguidas. Aguarde um instante e tente de novo."],
]);

const SERVER_ERROR = 500;

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- this is the parser for values thrown into catch clauses, which TypeScript types as unknown
const describeRequestError = (error: unknown, fallback: string): string => {
  if (!(error instanceof ApiError)) {
    return error instanceof TypeError
      ? "Não foi possível conectar. Verifique sua internet e tente de novo."
      : fallback;
  }

  if (error.status >= SERVER_ERROR) {
    return "Algo falhou do nosso lado. Tente de novo em instantes.";
  }

  return STATUS_MESSAGES.get(error.status) ?? fallback;
};

type ParamsPart<Target extends Endpoint> = [PathParams<Target["path"]>] extends [never]
  ? object
  : { params: ParamsOf<Target> };

/** A body is only serialized, so callers may pass readonly values. */
type Immutable<Value> =
  Value extends ReadonlyArray<infer Item>
    ? ReadonlyArray<Immutable<Item>>
    : Value extends object
      ? { readonly [Key in keyof Value]: Immutable<Value[Key]> }
      : Value;

type BodyPart<Target extends Endpoint> = Target["body"] extends z.ZodType
  ? { body: Immutable<z.input<Target["body"]>> }
  : Target["body"] extends "form"
    ? { body: FormData }
    : object;

type QueryPart<Target extends Endpoint> = [QueryOf<Target>] extends [NoQuery]
  ? object
  : { query?: QueryOf<Target> };

type RequestOf<Target extends Endpoint> = ParamsPart<Target> & BodyPart<Target> & QueryPart<Target>;

/** The request argument is optional when the endpoint takes no path parameter and no body. */
type RequestArgs<Target extends Endpoint> =
  Partial<RequestOf<Target>> extends RequestOf<Target>
    ? [request?: RequestOf<Target>]
    : [request: RequestOf<Target>];

type ApiCall<Target extends Endpoint = Endpoint> = <Called extends Target>(
  endpoint: Called,
  ...args: RequestArgs<Called>
) => Promise<ResponseOf<Called>>;

type ApiGet = ApiCall<Endpoint<unknown, "GET">>;

type RequestParts = {
  body?: FormData | object;
  params?: Record<string, string>;
  query?: Record<string, number | string | undefined>;
};

const partsOf = (args: ReadonlyArray<object | undefined>): RequestParts => args[0] ?? {};

const urlOf = ({ path }: Endpoint, { params = {}, query = {} }: RequestParts): string => {
  const resolved = path.replaceAll(/:(?<name>\w+)/gv, (_match, name: string) =>
    encodeURIComponent(params[name] ?? ""),
  );

  const search = new URLSearchParams(
    Object.entries(query).flatMap(([name, value]) =>
      value === undefined ? [] : [[name, String(value)]],
    ),
  ).toString();

  return search === "" ? resolved : `${resolved}?${search}`;
};

const initOf = ({ method }: Endpoint, { body }: RequestParts, cookie = ""): RequestInit => {
  const headers = new Headers({ Accept: "application/json" });

  if (cookie !== "") {
    headers.set("Cookie", cookie);
  }

  if (body === undefined || body instanceof FormData) {
    return { body, headers, method };
  }

  headers.set("Content-Type", "application/json");

  return { body: JSON.stringify(body), headers, method };
};

const readResponse = async <Target extends Endpoint>(
  res: Response,
): Promise<ResponseOf<Target>> => {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }

  // SAFETY: The Worker types each handler's answer with the same endpoint the caller passes.
  // oxlint-disable-next-line no-unsafe-type-assertion -- Response.json() is untyped; the endpoint is the contract
  return (await res.json()) as ResponseOf<Target>;
};

const apiCall: ApiCall = async (endpoint, ...args) => {
  const request = partsOf(args);

  const res = await fetch(urlOf(endpoint, request), {
    ...initOf(endpoint, request),
    credentials: "include",
  });

  return readResponse<typeof endpoint>(res);
};

type ServerApiConfig = {
  baseUrl: string;
  readCookieHeader: () => Promise<string>;
};

type ServerApi = { apiGetServer: ApiGet };

const createServerApi = ({ baseUrl, readCookieHeader }: ServerApiConfig): ServerApi => ({
  apiGetServer: async (endpoint, ...args) => {
    const request = partsOf(args);

    const res = await fetch(`${baseUrl}${urlOf(endpoint, request)}`, {
      ...initOf(endpoint, request, await readCookieHeader()),
      cache: "no-store",
    });

    return readResponse<typeof endpoint>(res);
  },
});

export { ApiError, apiCall, createServerApi, describeRequestError };

export type { ApiGet };
