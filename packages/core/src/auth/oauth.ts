import { createHash, randomBytes } from "node:crypto";
import { readGlobalConfig, writeGlobalConfig, type Config } from "../config/config";

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

async function postToken(body: Record<string, string>, fetchImpl: typeof fetch): Promise<ClaudeOAuth> {
  const res = await fetchImpl(CLAUDE_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("Claude sign-in failed. Try /login-claude again, or use an API key.");
  }
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export function completeClaudeLogin(pasted: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<ClaudeOAuth> {
  const [code, state] = pasted.trim().split("#");
  return postToken(
    {
      grant_type: "authorization_code",
      code: code ?? "",
      state: state ?? "",
      client_id: CLAUDE_OAUTH.clientId,
      redirect_uri: CLAUDE_OAUTH.redirectUri,
      code_verifier: verifier,
    },
    fetchImpl,
  );
}

export function refreshClaude(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<ClaudeOAuth> {
  return postToken(
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: CLAUDE_OAUTH.clientId },
    fetchImpl,
  );
}

export function loadClaudeOAuth(config: Config): ClaudeOAuth | undefined {
  return config.providers.anthropic?.oauth;
}

export function saveClaudeOAuth(creds: ClaudeOAuth): void {
  const config = readGlobalConfig();
  const providers = { ...((config.providers as Record<string, unknown>) ?? {}) };
  providers.anthropic = { ...((providers.anthropic as Record<string, unknown>) ?? {}), oauth: creds };
  writeGlobalConfig({ ...config, providers });
}

export function clearClaudeOAuth(): void {
  const config = readGlobalConfig();
  const providers = { ...((config.providers as Record<string, unknown>) ?? {}) };
  const anthropic = providers.anthropic as Record<string, unknown> | undefined;
  if (!anthropic?.oauth) return;
  const next = { ...anthropic };
  delete next.oauth;
  providers.anthropic = next;
  writeGlobalConfig({ ...config, providers });
}
