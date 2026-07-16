// TermCoder auth Worker — the ONLY place the OAuth client secrets live.
// It exchanges an OAuth `code` for a token server-side, fetches the user's
// public profile, and returns just { name, email, avatar } to the browser.
// The access token never leaves the Worker.
//
// Deploy: see website/auth/README.md. Secrets are set with
//   wrangler secret put GITHUB_CLIENT_SECRET
//   wrangler secret put GOOGLE_CLIENT_SECRET
// Client IDs are public vars (wrangler.toml or the dashboard).

import { signSession } from "./session.mjs";

const ALLOWED_ORIGINS = ["https://cartivo-oficial.github.io"];

export function allowOrigin(origin) {
  if (!origin) return "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin;
  return "";
}

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin(request.headers.get("Origin")),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (request.method !== "POST" || !url.pathname.endsWith("/callback")) {
      return json({ error: "not_found" }, 404, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: "bad_json" }, 400, cors);
    }
    const { provider, code, redirect_uri } = body || {};
    if (!code || !redirect_uri) return json({ error: "missing_code_or_redirect" }, 400, cors);

    try {
      let profile = null;
      if (provider === "github") profile = await github(code, redirect_uri, env);
      if (provider === "google") profile = await google(code, redirect_uri, env);
      if (!profile) return json({ error: "unknown_provider" }, 400, cors);
      if (!env.SESSION_SECRET) return json({ error: "auth_not_configured" }, 503, cors);
      profile.session = await signSession(
        { sub: profile.sub, email: profile.email, name: profile.name, provider: profile.provider },
        env.SESSION_SECRET,
      );
      return json(profile, 200, cors);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

export async function github(code, redirect_uri, env, deps = {}) {
  const doFetch = deps.fetch ?? fetch;
  const tokRes = await doFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri,
    }),
  });
  const tok = await tokRes.json();
  if (!tok.access_token) throw new Error(tok.error_description || "github_token_exchange_failed");

  const headers = {
    authorization: "Bearer " + tok.access_token,
    "user-agent": "termcoder-auth",
    accept: "application/vnd.github+json",
  };
  const u = await (await doFetch("https://api.github.com/user", { headers })).json();
  let email = u.email;
  if (!email) {
    const emRes = await doFetch("https://api.github.com/user/emails", { headers });
    if (emRes.ok) {
      const ems = await emRes.json();
      const primary = Array.isArray(ems) ? ems.find((e) => e.primary) || ems[0] : null;
      email = primary && primary.email;
    }
  }
  // token is returned so the dashboard can read the user's own synced gist
  // (decks/progress) client-side. It carries only read:user/user:email/gist.
  // Trade-off: it lives in the browser's localStorage — acceptable for a
  // personal dashboard reading your own data; not returned for Google.
  return {
    provider: "github",
    sub: "github:" + u.id,
    login: u.login,
    name: u.name || u.login || "",
    email: email || "",
    avatar: u.avatar_url || "",
    token: tok.access_token,
  };
}

export async function google(code, redirect_uri, env, deps = {}) {
  const doFetch = deps.fetch ?? fetch;
  const tokRes = await doFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      redirect_uri,
      grant_type: "authorization_code",
    }),
  });
  const tok = await tokRes.json();
  if (!tok.access_token) throw new Error(tok.error_description || "google_token_exchange_failed");

  const u = await (
    await doFetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: "Bearer " + tok.access_token },
    })
  ).json();
  return { provider: "google", sub: "google:" + u.sub, name: u.name || "", email: u.email || "", avatar: u.picture || "" };
}
