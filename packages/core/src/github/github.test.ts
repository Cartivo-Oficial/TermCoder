import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubClient, GitHubError, parseGistId } from "./github";
import type { Gist } from "./github";

function mockFetch(responses: Array<{ ok?: boolean; status?: number; json?: unknown; text?: string }>) {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
      text: async () => r.text ?? "",
    });
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("GitHubClient", () => {
  it("whoami returns the authenticated user", async () => {
    const fetchFn = mockFetch([{ json: { login: "octocat" } }]);
    const user = await new GitHubClient("t").whoami();
    expect(user.login).toBe("octocat");
    expect(fetchFn.mock.calls[0]![0]).toBe("https://api.github.com/user");
    expect((fetchFn.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ authorization: "Bearer t" });
  });

  it("createGist posts the files and returns the gist", async () => {
    const fetchFn = mockFetch([{ json: { id: "abc", html_url: "https://gist.github.com/x/abc", files: {} } }]);
    const gist = await new GitHubClient("t").createGist({ files: { "a.txt": { content: "hi" } }, description: "d" });
    expect(gist.id).toBe("abc");
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.files["a.txt"].content).toBe("hi");
    expect(body.public).toBe(false);
  });

  it("throws GitHubError with the status on a non-ok response", async () => {
    mockFetch([{ ok: false, status: 401, text: "Bad credentials" }]);
    await expect(new GitHubClient("t").whoami()).rejects.toMatchObject({ status: 401 });
  });

  it("gistFileContent falls back to the raw url when truncated", async () => {
    mockFetch([{ text: "RAW BODY" }]);
    const gist = {
      files: { "big.json": { filename: "big.json", truncated: true, raw_url: "https://raw/x" } },
    } as unknown as Gist;
    expect(await new GitHubClient("t").gistFileContent(gist, "big.json")).toBe("RAW BODY");
  });

  it("fromConfig throws without a token", () => {
    expect(() => GitHubClient.fromConfig(undefined, {})).toThrow(GitHubError);
  });
});

describe("parseGistId", () => {
  it("extracts the id from a bare id or any gist URL", () => {
    expect(parseGistId("abc123")).toBe("abc123");
    expect(parseGistId("https://gist.github.com/octocat/abc123")).toBe("abc123");
    expect(parseGistId("https://gist.github.com/abc123")).toBe("abc123");
  });
});
