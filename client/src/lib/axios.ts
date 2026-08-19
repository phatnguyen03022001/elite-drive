type QueryPrimitive = string | number | boolean | null | undefined | Date;
type QueryValue = QueryPrimitive | QueryPrimitive[];

type ResponseType = "json" | "text" | "blob" | "arraybuffer";

export type ApiRequestConfig = {
  params?: Record<string, QueryValue>;
  headers?: HeadersInit;
  timeout?: number;
  responseType?: ResponseType;
  signal?: AbortSignal;
  data?: unknown;
};

export class ApiClientError<T = unknown> extends Error {
  readonly response: { status: number; data: T };

  constructor(message: string, status: number, data: T) {
    super(message);
    this.name = "ApiClientError";
    this.response = { status, data };
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

function appendParams(url: string, params?: Record<string, QueryValue>) {
  if (!params) return url;

  const [pathAndQuery, hash = ""] = url.split("#", 2);
  const [path, existingQuery = ""] = pathAndQuery.split("?", 2);
  const search = new URLSearchParams(existingQuery);

  for (const [key, rawValue] of Object.entries(params)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value === undefined || value === null || value === "") continue;
      search.append(key, value instanceof Date ? value.toISOString() : String(value));
    }
  }

  const query = search.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

function isNativeBody(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    (typeof FormData !== "undefined" && value instanceof FormData) ||
    (typeof Blob !== "undefined" && value instanceof Blob) ||
    (typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams) ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

function serializeBody(value: unknown, headers: Headers): BodyInit | undefined {
  if (value === undefined || value === null) return undefined;
  if (isNativeBody(value)) return value;

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=UTF-8");
  }
  return JSON.stringify(value);
}

async function parseResponse(response: Response, responseType?: ResponseType) {
  if (response.status === 204 || response.status === 205) return undefined;
  if (responseType === "blob") return response.blob();
  if (responseType === "arraybuffer") return response.arrayBuffer();
  if (responseType === "text") return response.text();

  const contentType = response.headers.get("content-type") ?? "";
  if (responseType === "json" || contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  const text = await response.text();
  return text || undefined;
}

function createSignal(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      globalThis.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}

async function request<T>(
  method: string,
  url: string,
  body: unknown,
  config: ApiRequestConfig = {},
): Promise<T> {
  const headers = new Headers(config.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const timeoutMs = Math.max(1, config.timeout ?? DEFAULT_TIMEOUT_MS);
  const { signal, cleanup } = createSignal(timeoutMs, config.signal);

  try {
    const response = await fetch(appendParams(url, config.params), {
      method,
      headers,
      body: serializeBody(body, headers),
      credentials: "include",
      signal,
    });

    const payload = await parseResponse(response, config.responseType);
    if (!response.ok) {
      const fallback = `Request failed with status ${response.status}`;
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? String((payload as { message?: unknown }).message ?? fallback)
          : fallback;
      throw new ApiClientError(message, response.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiClientError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out or was cancelled");
    }
    throw error;
  } finally {
    cleanup();
  }
}

const api = {
  get<T = unknown>(url: string, config?: ApiRequestConfig) {
    return request<T>("GET", url, undefined, config);
  },
  post<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig) {
    return request<T>("POST", url, data, config);
  },
  put<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig) {
    return request<T>("PUT", url, data, config);
  },
  patch<T = unknown>(url: string, data?: unknown, config?: ApiRequestConfig) {
    return request<T>("PATCH", url, data, config);
  },
  delete<T = unknown>(url: string, config: ApiRequestConfig = {}) {
    return request<T>("DELETE", url, config.data, config);
  },
};

export default api;
