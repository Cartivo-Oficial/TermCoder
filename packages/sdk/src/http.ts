export class HttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const message =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `HTTP ${status}`;
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export interface HttpConfig {
  baseUrl: string;
  token?: string;
  fetch: typeof fetch;
}

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createHttp(cfg: HttpConfig) {
  const base = cfg.baseUrl.endsWith("/") ? cfg.baseUrl : cfg.baseUrl + "/";
  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(path.replace(/^\//, ""), base);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (cfg.token) headers["authorization"] = `Bearer ${cfg.token}`;
    const res = await cfg.fetch(url.toString(), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    const parsed = text ? safeJson(text) : undefined;
    if (!res.ok) throw new HttpError(res.status, parsed ?? text);
    return parsed as T;
  }
  return { request };
}
