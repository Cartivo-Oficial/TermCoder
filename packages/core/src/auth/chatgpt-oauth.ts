export interface ChatGPTOAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId?: string;
}

export const CHATGPT_OAUTH = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  deviceAuthorizeUrl: "https://auth.openai.com/oauth/device/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  deviceGrantType: "urn:ietf:params:oauth:grant-type:device_code",
  scopes: "openid profile email offline_access",
};

export interface DeviceGrant {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresAt: number;
}

function accountFromToken(accessToken: string): string | undefined {
  const part = accessToken.split(".")[1];
  if (!part) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
    const auth = claims["https://api.openai.com/auth"] as { chatgpt_account_id?: string } | undefined;
    return auth?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

function toCreds(json: { access_token: string; refresh_token: string; expires_in?: number }): ChatGPTOAuth {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    accountId: accountFromToken(json.access_token),
  };
}

export async function beginChatGPTLogin(fetchImpl: typeof fetch = fetch): Promise<DeviceGrant> {
  const res = await fetchImpl(CHATGPT_OAUTH.deviceAuthorizeUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CHATGPT_OAUTH.clientId, scope: CHATGPT_OAUTH.scopes }).toString(),
  });
  if (!res.ok) throw new Error("Could not start ChatGPT sign-in. Try again, or use an API key.");
  const json = (await res.json()) as { device_code: string; user_code: string; verification_uri: string; interval?: number; expires_in?: number };
  return {
    deviceCode: json.device_code,
    userCode: json.user_code,
    verificationUri: json.verification_uri,
    interval: json.interval ?? 5,
    expiresAt: Date.now() + (json.expires_in ?? 900) * 1000,
  };
}

export async function pollChatGPTLogin(
  deviceCode: string,
  opts: { intervalMs?: number; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ChatGPTOAuth> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const intervalMs = opts.intervalMs ?? 5000;
  while (true) {
    if (opts.signal?.aborted) throw new Error("ChatGPT sign-in cancelled.");
    const res = await fetchImpl(CHATGPT_OAUTH.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: CHATGPT_OAUTH.clientId, device_code: deviceCode, grant_type: CHATGPT_OAUTH.deviceGrantType }).toString(),
    });
    if (res.ok) return toCreds((await res.json()) as { access_token: string; refresh_token: string; expires_in?: number });
    const err = ((await res.json()) as { error?: string }).error ?? "";
    if (err === "authorization_pending" || err === "slow_down") {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    throw new Error("ChatGPT sign-in failed or was denied. Try /login-chatgpt again, or use an API key.");
  }
}

export async function refreshChatGPT(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<ChatGPTOAuth> {
  const res = await fetchImpl(CHATGPT_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CHATGPT_OAUTH.clientId, refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
  });
  if (!res.ok) throw new Error("ChatGPT session refresh failed.");
  return toCreds((await res.json()) as { access_token: string; refresh_token: string; expires_in?: number });
}
