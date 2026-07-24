import type { SessionRecord, SessionSummary, SessionEvent, ModelEntry } from "@termcoder/core";

export type { SessionRecord, SessionSummary, SessionEvent, ModelEntry };

export interface CreateSessionInput {
  cwd?: string;
  title?: string;
  mode?: "plan" | "build";
  agent?: string;
  temperature?: number;
  maxSteps?: number;
}

export interface SessionSettingsInput {
  mode?: "plan" | "build";
  agent?: string;
  temperature?: number;
  maxSteps?: number;
}

export type ModelInfo = ModelEntry & { configured: boolean };

export interface StatusResponse {
  model: string;
  providers: Array<{ name: string; configured: boolean }>;
  mcp: unknown[];
  lsp: unknown[];
  plugins: unknown[];
}

export type PermissionDecision = "allow" | "allow-always" | "deny";

export type StreamEvent =
  | { kind: "event"; event: SessionEvent }
  | { kind: "prompt"; from: string; text: string }
  | { kind: "permission"; id: string; request: unknown }
  | { kind: "stopped" }
  | { kind: "error"; error: string };

export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (ev: { data?: unknown }) => void): void;
}

export type WebSocketCtor = new (url: string) => WebSocketLike;
