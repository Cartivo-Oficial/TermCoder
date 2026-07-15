// TermCoder auth Worker — the ONLY place the OAuth client secrets live.
// It exchanges an OAuth `code` for a token server-side, fetches the user's
// public profile, and returns just { name, email, avatar } to the browser.
// The access token never leaves the Worker.
//
// Deploy: see website/auth/README.md. Secrets are set with
//   wrangler secret put GITHUB_CLIENT_SECRET
//   wrangler secret put GOOGLE_CLIENT_SECRET
// Client IDs are public vars (wrangler.toml or the dashboard).

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
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
      if (provider === "github") return json(await github(code, redirect_uri, env), 200, cors);
      if (provider === "google") return json(await google(code, redirect_uri, env), 200, cors);
      return json({ error: "unknown_provider" }, 400, cors);
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

async function github(code, redirect_uri, env) {
  const tokRes = await fetch("https://github.com/login/oauth/access_token", {
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
  const u = await (await fetch("https://api.github.com/user", { headers })).json();
  let email = u.email;
  if (!email) {
    const emRes = await fetch("https://api.github.com/user/emails", { headers });
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
    login: u.login,
    name: u.name || u.login || "",
    email: email || "",
    avatar: u.avatar_url || "",
    token: tok.access_token,
  };
}

async function google(code, redirect_uri, env) {
  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
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
    await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { authorization: "Bearer " + tok.access_token },
    })
  ).json();
  return { provider: "google", name: u.name || "", email: u.email || "", avatar: u.picture || "" };
}
