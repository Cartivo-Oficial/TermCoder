import { describe, it, expect, vi } from "vitest";
import worker, { allowOrigin, github, google } from "./worker.js";
import { verifySession } from "./session.mjs";

describe("allowOrigin", () => {
  it("allows the production site", () => {
    expect(allowOrigin("https://cartivo-oficial.github.io")).toBe("https://cartivo-oficial.github.io");
  });

  it("allows localhost for development", () => {
    expect(allowOrigin("http://localhost:4199")).toBe("http://localhost:4199");
  });

  it("refuses an unknown origin", () => {
    expect(allowOrigin("https://evil.example.com")).toBe("");
  });

  it("refuses a missing origin", () => {
    expect(allowOrigin(null)).toBe("");
  });
});

function githubFetch({ id = 12345, login = "octocat", email = "octocat@example.com", emails = null } = {}) {
  return async (url) => {
    const u = String(url);
    if (u.includes("/login/oauth/access_token")) {
      return { ok: true, json: async () => ({ access_token: "gh-tok-123" }) };
    }
    if (u.endsWith("/user/emails")) {
      return { ok: true, json: async () => emails ?? [{ email: "fallback@example.com", primary: true }] };
    }
    if (u.endsWith("/user")) {
      return { ok: true, json: async () => ({ id, login, name: "The Octocat", avatar_url: "https://avatar.example/o", email }) };
    }
    throw new Error("unexpected github url " + u);
  };
}

function googleFetch({ sub = "1122334455", name = "G Person", email = "g@example.com", picture = "https://pic.example/g" } = {}) {
  return async (url) => {
    const u = String(url);
    if (u.includes("googleapis.com/token")) {
      return { ok: true, json: async () => ({ access_token: "g-tok-123" }) };
    }
    if (u.includes("userinfo")) {
      return { ok: true, json: async () => ({ sub, name, email, picture }) };
    }
    throw new Error("unexpected google url " + u);
  };
}

const GITHUB_ENV = { GITHUB_CLIENT_ID: "gh-id", GITHUB_CLIENT_SECRET: "gh-secret" };
const GOOGLE_ENV = { GOOGLE_CLIENT_ID: "g-id", GOOGLE_CLIENT_SECRET: "g-secret" };

describe("github", () => {
  it("uses the numeric account id as sub, never the renameable login", async () => {
    const f = githubFetch({ id: 12345, login: "octocat" });
    const profile = await github("code", "https://example.com/callback.html", GITHUB_ENV, { fetch: f });
    expect(profile.sub).toBe("github:12345");
    expect(profile.sub).not.toContain("octocat");
    expect(profile.login).toBe("octocat");
  });

  it("falls back to /user/emails when the primary /user response has a null email", async () => {
    const f = githubFetch({
      id: 1,
      login: "nomail",
      email: null,
      emails: [
        { email: "secondary@example.com", primary: false },
        { email: "primary@example.com", primary: true },
      ],
    });
    const profile = await github("code", "https://example.com/callback.html", GITHUB_ENV, { fetch: f });
    expect(profile.email).toBe("primary@example.com");
  });
});

describe("google", () => {
  it("uses the sub claim from userinfo as sub", async () => {
    const f = googleFetch({ sub: "1122334455" });
    const profile = await google("code", "https://example.com/callback.html", GOOGLE_ENV, { fetch: f });
    expect(profile.sub).toBe("google:1122334455");
  });
});

describe("fetch handler (end-to-end)", () => {
  it("returns a stable sub and a session that verifies with matching claims", async () => {
    vi.stubGlobal("fetch", githubFetch({ id: 777, login: "someone-else" }));
    try {
      const req = new Request("https://auth.example.com/callback", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:4199" },
        body: JSON.stringify({ provider: "github", code: "abc", redirect_uri: "https://example.com/callback.html" }),
      });
      const env = { ...GITHUB_ENV, SESSION_SECRET: "shh-secret" };
      const res = await worker.fetch(req, env);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.sub).toBe("github:777");
      const claims = await verifySession(body.session, "shh-secret");
      expect(claims).toMatchObject({
        sub: "github:777",
        email: body.email,
        name: body.name,
        provider: "github",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns 503 auth_not_configured when SESSION_SECRET is missing", async () => {
    vi.stubGlobal("fetch", githubFetch({ id: 1, login: "x" }));
    try {
      const req = new Request("https://auth.example.com/callback", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:4199" },
        body: JSON.stringify({ provider: "github", code: "abc", redirect_uri: "https://example.com/callback.html" }),
      });
      const res = await worker.fetch(req, { ...GITHUB_ENV });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe("auth_not_configured");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not touch the network (and so does not burn the OAuth code) when SESSION_SECRET is missing", async () => {
    const spy = vi.fn(githubFetch({ id: 1, login: "x" }));
    vi.stubGlobal("fetch", spy);
    try {
      const req = new Request("https://auth.example.com/callback", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:4199" },
        body: JSON.stringify({ provider: "github", code: "abc", redirect_uri: "https://example.com/callback.html" }),
      });
      const res = await worker.fetch(req, { ...GITHUB_ENV });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe("auth_not_configured");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
