export {
  ConfigSchema,
  AgentSchema,
  PermissionModeSchema,
  PermissionRuleSchema,
  McpServerSchema,
  LspServerSchema,
  loadConfig,
  saveConfig,
  readGlobalConfig,
  writeGlobalConfig,
  type Config,
  type AgentConfig,
  type PermissionMode,
  type PermissionRule,
  type McpServerConfig,
  type LspServerConfig,
  type LoadConfigOptions,
  type SaveConfigOptions,
} from "./config/config";

export {
  connectMcpServers,
  wrapClientTools,
  type McpConnectResult,
  type McpClientLike,
} from "./mcp/mcp";

export {
  connectLspServers,
  LspClient,
  LspManager,
  type LspConnectResult,
  type LspDiagnostic,
  type LspServerHandle,
} from "./lsp/lsp";

export {
  definePlugin,
  loadPlugins,
  type Plugin,
  type PluginApi,
  type LoadPluginsResult,
} from "./plugin/plugin";

export {
  renderSessionHtml,
  renderSessionMarkdown,
  transcriptSegments,
  sessionGistFiles,
  importSessionFromGist,
  type TranscriptSegment,
} from "./share/share";

export { configDir, configFile } from "./util/paths";

export {
  loadDecks,
  saveDecks,
  addCards,
  dueCards,
  gradeCard,
  schedule,
  newCard,
  deckSummaries,
  type Card,
  type Deck,
  type DeckMap,
  type Grade,
} from "./study/decks";

export {
  loadProgress,
  recordReview,
  reviewsToday,
  type Progress,
} from "./study/progress";

export { generateFlashcards, parseCards } from "./study/generate";

export { firstKeyedModel, nextModelOnError, MODEL_RETRIES, type RetryState } from "./provider/reliability";

export { PROVIDERS, providerInfo, type ProviderInfo } from "./provider/registry";

export {
  markProvider,
  providerMarkedBad,
  providerHealthSnapshot,
  clearProviderHealth,
  HEALTH_TTL_MS,
  type ProviderHealth,
} from "./provider/health";

export {
  discoverMemories,
  saveMemory,
  deleteMemory,
  memoryIndex,
  recallMemories,
  slugifyMemoryName,
  looksLikeSecret,
  type MemoryEntry,
  type MemoryScope,
  type MemoryType,
  type DiscoverMemoriesOptions,
} from "./memory/memory";

export {
  runAutonomous,
  runVerify,
  detectVerifyCommand,
  type AutonomousSession,
  type AutonomousEvent,
  type AutonomousStatus,
  type RunAutonomousOptions,
} from "./background/runner";

export {
  CONNECTABLE_PROVIDERS,
  providerAuthMethods,
  type AuthMethod,
  type AuthMethodId,
  type ProviderAuth,
} from "./auth/auth";

export {
  GitHubClient,
  GitHubError,
  gitHubToken,
  parseGistId,
  type Gist,
  type GistFile,
  type GitHubUser,
  type GistComment,
} from "./github/github";

export {
  createClassroom,
  joinClassroom,
  fetchClassroom,
  addAssignment,
  submitAssignment,
  listSubmissions,
  listRoster,
  loadClassrooms,
  rememberClass,
  type Classroom,
  type Assignment,
  type JoinedClass,
  type Submission,
} from "./classroom/classroom";

export {
  pushSync,
  pullSync,
  syncAll,
  isSyncConfigured,
  DEFAULT_SYNC_STORES,
  type SyncEnvelope,
} from "./sync/sync";

export {
  publishPack,
  fetchPack,
  installPack,
  writePack,
  readPack,
  PACK_KINDS,
  type Pack,
  type PackItem,
  type PackKind,
  type PackManifest,
} from "./pack/pack";

export { createSubagentTool, type SubagentDeps } from "./agent/subagent";

export {
  discoverAgents,
  resolveAgent,
  agentToolFilter,
  agentCanMutate,
  BUILTIN_AGENTS,
  type AgentDef,
  type AgentMode,
  type DiscoverAgentsOptions,
} from "./agent/agents";

export {
  discoverSkills,
  getSkill,
  skillsMenu,
  type SkillDef,
  type DiscoverSkillsOptions,
} from "./skill/skills";

export { isTrusted, trustFolder } from "./trust/trust";
export { loadDraft, saveDraft, clearDraft } from "./draft/draft";
export { loadFavorites, toggleFavorite } from "./favorites/favorites";

export { CheckpointManager, checkpointDir } from "./checkpoint/checkpoint";

export {
  discoverCommands,
  expandCommand,
  type CommandDef,
  type DiscoverCommandsOptions,
} from "./command/commands";

export { loadProjectContext } from "./util/context";

export {
  SessionStore,
  defaultSessionsDir,
  type SessionRecord,
  type SessionSummary,
} from "./storage/storage";

export {
  PermissionManager,
  resolvePermissionMode,
  type PermissionKind,
  type PermissionMap,
  type PermissionRequest,
  type PermissionDecision,
  type PermissionAsker,
} from "./permission/permission";

export {
  ToolRegistry,
  builtinTools,
  defineTool,
  type TermTool,
  type ToolContext,
  type ToolResult,
} from "./tools";

export { discoverTools, type DiscoverToolsResult } from "./tool/discover";

export {
  resolveModel,
  pickAutoModel,
  classifyTaskComplexity,
  transcribeAudio,
  completeCode,
  suggestFollowup,
  type ResolveModelOptions,
  type TranscribeOptions,
  type CompleteCodeOptions,
  type TaskComplexity,
} from "./provider/provider";

export { projectSummary, repoDetail } from "./knowledge/repomap";
export { buildSymbolIndex, findSymbols, type SymbolEntry } from "./knowledge/symbols";

export { getModelCatalog, type ModelEntry } from "./models/catalog";

export { formatFile, formattersFor } from "./format/formatters";

export {
  Session,
  type SessionEvent,
  type SessionDeps,
  type ModelRunner,
  type ModelStreamResult,
} from "./session/session";
