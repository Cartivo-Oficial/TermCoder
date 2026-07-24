import { createHttp } from "./http";
import { createSessions, type SessionsResource } from "./sessions";
import type { StatusResponse, ModelInfo, WebSocketCtor } from "./types";

export interface ClientConfig {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
  WebSocket?: WebSocketCtor;
}

export interface TermClient {
  status(): Promise<StatusResponse>;
  models(): Promise<ModelInfo[]>;
  config(): Promise<unknown>;
  sessions: SessionsResource;
}

export function createClient(config: ClientConfig): TermClient {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("createClient: no fetch available; pass config.fetch");
  const WS = config.WebSocket ?? (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  const http = createHttp({ baseUrl: config.baseUrl, token: config.token, fetch: fetchImpl });
  return {
    status: () => http.request<StatusResponse>("GET", "status"),
    models: () => http.request<ModelInfo[]>("GET", "models"),
    config: () => http.request<unknown>("GET", "config"),
    sessions: createSessions(http, { baseUrl: config.baseUrl, WebSocket: WS }),
  };
}
