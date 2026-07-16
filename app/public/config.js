// Public OAuth config — safe to commit. Client IDs and the Worker URL are NOT
// secrets. The client SECRETS live only in the Cloudflare Worker environment
// (see website/auth/README.md). Until these are filled in, the Sign-in buttons
// fall through to the dashboard preview.
window.TC_AUTH = {
  workerUrl: "https://termcoder-auth.eduardo-wankax.workers.dev", // Cloudflare Worker (auth/worker.js)
  github: { clientId: "Ov23liSR2sI4lUCrZNtb" }, // GitHub OAuth App client ID
  google: { clientId: "811964169804-05orndflh9nljq5pj2uvg08q52h2fdn2.apps.googleusercontent.com" }, // Google OAuth client ID (Web application) — public, safe to commit
};
