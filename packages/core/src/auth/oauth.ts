import { createHash, randomBytes } from "node:crypto";

export interface ClaudeOAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export const CLAUDE_OAUTH = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://console.anthropic.com/v1/oauth/token",
  redirectUri: "https://console.anthropic.com/oauth/code/callback",
  scopes: "org:create_api_key user:profile user:inference",
  betaHeader: "oauth-2025-04-20",
  systemPreamble: "You are Claude Code, Anthropic's official CLI for Claude.",
};

export function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function beginClaudeLogin(): { url: string; verifier: string } {
  const { verifier, challenge } = pkce();
  const u = new URL(CLAUDE_OAUTH.authorizeUrl);
  u.searchParams.set("code", "true");
  u.searchParams.set("client_id", CLAUDE_OAUTH.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", CLAUDE_OAUTH.redirectUri);
  u.searchParams.set("scope", CLAUDE_OAUTH.scopes);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("state", verifier);
  return { url: u.toString(), verifier };
}
