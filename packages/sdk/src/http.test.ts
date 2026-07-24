import { describe, expect, it } from "vitest";
import { createHttp } from "./http";

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[i++]!;
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("createHttp.request", () => {
  it("GETs a path and parses JSON", async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { ok: true } }]);
    const http = createHttp({ baseUrl: "http://localhost:9000", fetch: fetchImpl });
    const out = await http.request<{ ok: boolean }>("GET", "status");
    expect(out).toEqual({ ok: true });
    expect(calls[0]!.url).toBe("http://localhost:9000/status");
    expect(calls[0]!.init.method).toBe("GET");
  });

  it("serializes a JSON body and sets content-type + bearer token", async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 201, body: { id: "s1" } }]);
    const http = createHttp({ baseUrl: "http://localhost:9000/", token: "t0k", fetch: fetchImpl });
    await http.request("POST", "sessions", { body: { cwd: "/x" } });
    const init = calls[0]!.init;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ cwd: "/x" });
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer t0k");
  });

  it("appends defined query params only", async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 200, body: [] }]);
    const http = createHttp({ baseUrl: "http://localhost:9000", fetch: fetchImpl });
    await http.request("GET", "models", { query: { a: "1", b: undefined } });
    expect(calls[0]!.url).toBe("http://localhost:9000/models?a=1");
  });

  it("throws HttpError with status and parsed body on non-2xx", async () => {
    const { fetchImpl } = fakeFetch([{ status: 404, body: { error: "session not found" } }]);
    const http = createHttp({ baseUrl: "http://localhost:9000", fetch: fetchImpl });
    await expect(http.request("GET", "sessions/nope")).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
      message: "session not found",
      body: { error: "session not found" },
    });
  });
});
