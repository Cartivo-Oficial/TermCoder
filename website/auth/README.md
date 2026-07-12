# TermCoder site auth (free serverless)

The website is static (GitHub Pages), so the OAuth **code → token** exchange —
which needs a client *secret* — runs in a tiny Cloudflare Worker. Free tier is
plenty (100k requests/day). The secret lives only in the Worker; the browser
only ever receives your name, email, and avatar.

```
login.html ──redirect──▶ GitHub/Google  ──redirect──▶ callback.html
                                                          │  POST {code}
                                                          ▼
                                                   Worker /callback
                                              (holds secret, exchanges code)
                                                          │  {name,email,avatar}
                                                          ▼
                                                    dashboard.html
```

## 1. Create the OAuth apps

**GitHub** — Settings → Developer settings → **OAuth Apps** → *New*:
- Homepage URL: your site (e.g. `https://cartivo-oficial.github.io/TermCoder/`)
- **Authorization callback URL**: `https://<your-site>/callback.html`
- Copy the **Client ID** and generate a **Client secret**.

**Google** — [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → *Create credentials* → **OAuth client ID** → **Web application**:
- **Authorized redirect URI**: `https://<your-site>/callback.html`
- Copy the **Client ID** and **Client secret**.

> Use the exact same `callback.html` URL in both apps and in the browser — OAuth
> requires the redirect URI to match precisely. For local testing, add
> `http://localhost:8137/callback.html` too.

## 2. Deploy the Worker

```sh
npm i -g wrangler          # or: npx wrangler ...
cd website/auth
wrangler login             # your Cloudflare account
# public client IDs:
wrangler deploy            # first deploy creates the worker
# then set the two SECRETS (never committed):
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
```

Set the public client IDs either in `wrangler.toml` `[vars]` or the Cloudflare
dashboard (`GITHUB_CLIENT_ID`, `GOOGLE_CLIENT_ID`). `wrangler deploy` prints the
Worker URL (e.g. `https://termcoder-auth.<you>.workers.dev`).

## 3. Point the site at the Worker

Edit `website/config.js` (this file **is** safe to commit — IDs and the Worker
URL are not secrets):

```js
window.TC_AUTH = {
  workerUrl: "https://termcoder-auth.<you>.workers.dev",
  github: { clientId: "<github client id>" },
  google: { clientId: "<google client id>" },
};
```

That's it. Until `config.js` is filled in, the Sign-in buttons fall through to
the dashboard **preview** (sample data), so the site works either way.

## Security notes

- Client **secrets** live only in the Worker (via `wrangler secret put`) — never
  in the repo or the browser.
- The Worker returns only `{ name, email, avatar }`; the OAuth access token is
  used once inside the Worker and discarded.
- CORS is scoped to the requesting origin. Lock it to your site's origin in
  `worker.js` if you want to be strict.
