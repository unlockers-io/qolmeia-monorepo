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

const jsonHeaders = (contentType?: string): Headers => {
  const headers = new Headers({ Accept: "application/json" });

  if (contentType !== undefined) {
    headers.set("Content-Type", contentType);
  }

  return headers;
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }

  const body: unknown = res.status === 204 ? null : await res.json();

  // SAFETY: Callers bind T to the contract of the first-party route they request; 204 routes bind it to null.
  // oxlint-disable-next-line no-unsafe-type-assertion -- Response.json() is untyped and callers own the route contract
  return body as T;
};

type SendMethod = "DELETE" | "PATCH" | "POST" | "PUT";

const apiGet = async <T>(path: string): Promise<T> => {
  const res = await fetch(path, { credentials: "include", headers: jsonHeaders(), method: "GET" });

  return handleResponse<T>(res);
};

const apiSend = async <T>(
  method: SendMethod,
  path: string,
  body?: JsonRequestValue,
): Promise<T> => {
  const serialized = body === undefined ? undefined : JSON.stringify(body);

  const res = await fetch(path, {
    body: serialized,
    credentials: "include",
    headers: jsonHeaders(serialized === undefined ? undefined : "application/json"),
    method,
  });

  return handleResponse<T>(res);
};

const apiSendForm = async <T>(path: string, formData: FormData): Promise<T> => {
  const res = await fetch(path, {
    body: formData,
    credentials: "include",
    headers: jsonHeaders(),
    method: "POST",
  });

  return handleResponse<T>(res);
};

type ServerApiConfig = {
  baseUrl: string;
  readCookieHeader: () => Promise<string>;
};

const createServerApi = ({ baseUrl, readCookieHeader }: ServerApiConfig) => ({
  apiGetServer: async <T>(path: string): Promise<T> => {
    const cookie = await readCookieHeader();
    const headers = jsonHeaders();

    if (cookie !== "") {
      headers.set("Cookie", cookie);
    }

    const res = await fetch(`${baseUrl}${path}`, { cache: "no-store", headers });

    return handleResponse<T>(res);
  },
});

export { ApiError, apiGet, apiSend, apiSendForm, createServerApi, describeRequestError };
