export { createClient, type ClientConfig, type TermClient } from "./client";
export { createSessions, type SessionsResource } from "./sessions";
export { openStream, type SessionStream } from "./stream";
export { HttpError, createHttp, type HttpConfig, type RequestOptions } from "./http";
export type {
  SessionRecord,
  SessionSummary,
  SessionEvent,
  ModelEntry,
  ModelInfo,
  CreateSessionInput,
  SessionSettingsInput,
  StatusResponse,
  PermissionDecision,
  StreamEvent,
  WebSocketLike,
  WebSocketCtor,
} from "./types";
