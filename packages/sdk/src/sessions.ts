import type { createHttp } from "./http";
import { openStream, type SessionStream } from "./stream";
import type {
  SessionRecord,
  SessionSummary,
  SessionSettingsInput,
  CreateSessionInput,
  WebSocketCtor,
} from "./types";

type Http = ReturnType<typeof createHttp>;

export interface SessionsResource {
  create(input?: CreateSessionInput): Promise<SessionRecord>;
  list(): Promise<SessionSummary[]>;
  get(id: string): Promise<SessionRecord>;
  delete(id: string): Promise<{ id: string }>;
  deleteAll(): Promise<{ removed: number }>;
  setModel(id: string, model: string): Promise<{ model: string }>;
  setSettings(id: string, settings: SessionSettingsInput): Promise<SessionSettingsInput>;
  setTitle(id: string, title: string): Promise<{ title: string }>;
  stream(id: string, opts?: { name?: string }): SessionStream;
}

export function createSessions(http: Http, deps: { baseUrl: string; WebSocket?: WebSocketCtor }): SessionsResource {
  return {
    create: (input) => http.request<SessionRecord>("POST", "sessions", { body: input ?? {} }),
    list: () => http.request<SessionSummary[]>("GET", "sessions"),
    get: (id) => http.request<SessionRecord>("GET", `sessions/${encodeURIComponent(id)}`),
    delete: (id) => http.request<{ id: string }>("DELETE", `sessions/${encodeURIComponent(id)}`),
    deleteAll: () => http.request<{ removed: number }>("DELETE", "sessions"),
    setModel: (id, model) =>
      http.request<{ model: string }>("POST", `sessions/${encodeURIComponent(id)}/model`, { body: { model } }),
    setSettings: (id, settings) =>
      http.request<SessionSettingsInput>("POST", `sessions/${encodeURIComponent(id)}/settings`, { body: settings }),
    setTitle: (id, title) =>
      http.request<{ title: string }>("POST", `sessions/${encodeURIComponent(id)}/title`, { body: { title } }),
    stream: (id, opts) => {
      if (!deps.WebSocket) {
        throw new Error(
          "stream() needs a WebSocket: pass one to createClient (Node: inject `ws`) or run where globalThis.WebSocket exists.",
        );
      }
      return openStream({ baseUrl: deps.baseUrl, WebSocket: deps.WebSocket, sessionId: id, name: opts?.name });
    },
  };
}
