import type { MeOrg, MeResponse, OrgRole } from "./contracts";

type FetchInit = Omit<RequestInit, "body" | "method">;
type JsonRequestValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | ReadonlyArray<JsonRequestValue>
  | { readonly [key: string]: JsonRequestValue };

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

const buildHeaders = (init?: FetchInit, contentType?: string): Headers => {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (contentType !== undefined && contentType !== "" && !headers.has("Content-Type")) {
    headers.set("Content-Type", contentType);
  }
  return headers;
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) {
    // SAFETY: Delete endpoints bind T to null and HTTP 204 has no response body.
    // oxlint-disable-next-line no-unsafe-type-assertion -- a generic T cannot be narrowed to null from the status code
    return null as T;
  }
  // SAFETY: Callers bind T to the contract of the first-party route they request.
  // oxlint-disable-next-line no-unsafe-type-assertion -- Response.json() is untyped and callers own the route contract
  return res.json() as Promise<T>;
};

type SendMethod = "DELETE" | "PATCH" | "POST" | "PUT";

const ME_PATH = "/api/me";
const ORG_ID_HEADER = "X-Org-Id";
const ORG_ID_QUERY_PARAM = "org_id";

const resolveActiveOrg = (me: MeResponse, allow: ReadonlyArray<OrgRole>): MeOrg | null => {
  const allowed = new Set(allow);
  return me.currentOrg ?? me.orgs.find((org) => allowed.has(org.role)) ?? null;
};

const withOrgQuery = (path: string, orgId: string | null): string =>
  orgId === null
    ? path
    : `${path}${path.includes("?") ? "&" : "?"}${ORG_ID_QUERY_PARAM}=${encodeURIComponent(orgId)}`;

type OrgDiscovery = { promise: Promise<string | null> | null };

type BrowserApiConfig = {
  allow: ReadonlyArray<OrgRole>;
  basePath?: string;
};

type BrowserApi = {
  activeOrgId: () => Promise<string | null>;
  apiGet: <T>(path: string, init?: FetchInit) => Promise<T>;
  apiSend: <T>(
    method: SendMethod,
    path: string,
    body?: JsonRequestValue,
    init?: FetchInit,
  ) => Promise<T>;
  apiSendForm: <T>(path: string, formData: FormData, init?: FetchInit) => Promise<T>;
};

const createBrowserApi = ({ allow, basePath = "" }: BrowserApiConfig): BrowserApi => {
  const discovery: OrgDiscovery = { promise: null };

  const discoverOrgId = async (): Promise<string | null> => {
    const res = await fetch(ME_PATH, { credentials: "include", headers: buildHeaders() });
    const me = await handleResponse<MeResponse>(res);
    return resolveActiveOrg(me, allow)?.id ?? null;
  };

  const activeOrgId = async (): Promise<string | null> => {
    discovery.promise ??= discoverOrgId();
    try {
      return await discovery.promise;
    } catch (error) {
      discovery.promise = null;
      throw error;
    }
  };

  const request = async <T>(path: string, init: RequestInit & { headers: Headers }): Promise<T> => {
    const orgId = await activeOrgId();
    if (orgId !== null) {
      init.headers.set(ORG_ID_HEADER, orgId);
    }
    const res = await fetch(`${basePath}${path}`, { ...init, credentials: "include" });
    return handleResponse<T>(res);
  };

  return {
    activeOrgId,
    apiGet: <T>(path: string, init?: FetchInit): Promise<T> =>
      request<T>(path, { ...init, headers: buildHeaders(init), method: "GET" }),
    apiSend: <T>(
      method: SendMethod,
      path: string,
      body?: JsonRequestValue,
      init?: FetchInit,
    ): Promise<T> => {
      const serialized = body === undefined ? undefined : JSON.stringify(body);
      return request<T>(path, {
        ...init,
        body: serialized,
        headers: buildHeaders(init, serialized === undefined ? undefined : "application/json"),
        method,
      });
    },
    apiSendForm: <T>(path: string, formData: FormData, init?: FetchInit): Promise<T> => {
      const headers = buildHeaders(init);
      headers.delete("Content-Type");
      return request<T>(path, { ...init, body: formData, headers, method: "POST" });
    },
  };
};

type ServerApiConfig = {
  basePath?: string;
  baseUrl: string;
  readCookieHeader: () => Promise<string>;
  readOrgId: () => Promise<string>;
};

type ServerApi = {
  apiGetServer: <T>(path: string) => Promise<T>;
};

const createServerApi = (config: ServerApiConfig): ServerApi => ({
  apiGetServer: async <T>(path: string): Promise<T> => {
    const [cookie, orgId] = await Promise.all([config.readCookieHeader(), config.readOrgId()]);
    const headers = new Headers({ Accept: "application/json", [ORG_ID_HEADER]: orgId });
    if (cookie !== "") {
      headers.set("Cookie", cookie);
    }
    const res = await fetch(`${config.baseUrl}${config.basePath ?? ""}${path}`, {
      cache: "no-store",
      headers,
    });
    return handleResponse<T>(res);
  },
});

export {
  ApiError,
  createBrowserApi,
  createServerApi,
  describeRequestError,
  handleResponse,
  resolveActiveOrg,
  withOrgQuery,
};
export type { BrowserApi, BrowserApiConfig, FetchInit, ServerApi, ServerApiConfig };
