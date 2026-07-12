import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Static, Text, useApp, useInput, useStdout } from "ink";
import {
  createSubagentTool,
  discoverAgents,
  discoverCommands,
  discoverSkills,
  isTrusted,
  trustFolder,
  saveConfig,
  loadDraft,
  saveDraft,
  clearDraft,
  getModelCatalog,
  type ModelEntry,
  loadFavorites,
  toggleFavorite,
  suggestFollowup,
  CONNECTABLE_PROVIDERS,
  probeProvider,
  providerInfo,
  friendlyError,
  providerHealthSnapshot,
  providerMarkedBad,
  GitHubClient,
  sessionGistFiles,
  importSessionFromGist,
  publishPack,
  installPack,
  readPack,
  syncAll,
  dueCards,
  gradeCard,
  deckSummaries,
  addCards,
  generateFlashcards,
  recordReview,
  loadProgress,
  type Card,
  runVerify,
  detectVerifyCommand,
  createClassroom,
  joinClassroom,
  fetchClassroom,
  addAssignment,
  submitAssignment,
  listSubmissions,
  listRoster,
  loadClassrooms,
  PermissionManager,
  renderSessionHtml,
  Session,
  SessionStore,
  ToolRegistry,
  transcriptSegments,
  saveMemory,
  discoverMemories,
  deleteMemory,
  slugifyMemoryName,
  discoverRecipes,
  getRecipe,
  recipeIndex,
  composeRecipeRun,
  listConnectors,
  getConnector,
  connectorToServerConfig,
  missingRequiredInputs,
  beginClaudeLogin,
  completeClaudeLogin,
  saveClaudeOAuth,
  clearClaudeOAuth,
  beginChatGPTLogin,
  pollChatGPTLogin,
  saveChatGPTOAuth,
  clearChatGPTOAuth,
  type Config,
  type PermissionDecision,
  type PermissionRequest,
  type SessionRecord,
} from "@termcoder/core";
import { getTheme, themes } from "./theme";
import { matchCommands, helpText } from "./commands";
import { listProjectFiles, matchFiles } from "./files";
import type { ViewItem } from "./types";
import { Hero } from "./components/Hero";
import { Composer } from "./components/Composer";
import { PermissionModal } from "./components/PermissionModal";
import { ModelPicker } from "./components/ModelPicker";
import { StatusBar } from "./components/StatusBar";
import { TrustPrompt } from "./components/TrustPrompt";
import { ReviewMode } from "./components/ReviewMode";
import { Transcript, TranscriptItem } from "./components/Transcript";

const VERSION = "0.8.2";

const AGENTS_TEMPLATE = `# Project instructions for termcoder

Describe how the agent should work in this project. For example:

- Stack & conventions: (e.g. TypeScript, ESM, 2-space indent)
- How to run tests: (e.g. \`pnpm test\`)
- Things to avoid: (e.g. don't edit generated files in dist/)
- Anything else the agent should always keep in mind.
`;

function recordToItems(record: SessionRecord): ViewItem[] {
  return transcriptSegments(record).map((seg): ViewItem => {
    if (seg.role === "user") return { kind: "user", text: seg.text };
    if (seg.role === "assistant" && !seg.label) return { kind: "assistant", text: seg.text };
    if (seg.role === "assistant") {
      return { kind: "tool", id: "-", name: seg.label!.replace("→ ", ""), status: "done", detail: seg.text };
    }
    return { kind: "tool", id: "-", name: seg.label ?? "tool", status: "done", output: seg.text };
  });
}

interface AppProps {
  config: Config;
  cwd: string;
  registry?: ToolRegistry;
  notices?: string[];
}

function statusFor(toolName?: string): string {
  switch (toolName) {
    case "read":
    case "ls":
    case "glob":
    case "grep":
      return "Reading…";
    case "write":
      return "Writing…";
    case "edit":
      return "Editing…";
    case "bash":
      return "Running command…";
    case "diagnostics":
      return "Checking diagnostics…";
    case "task":
      return "Delegating to sub-agent…";
    default:
      return toolName ? `Running ${toolName}…` : "Thinking…";
  }
}

function toolStatus(name: string, title?: string, detail?: string): string {
  if (name === "bash" && detail) return `Running: ${detail.split("\n")[0]!.slice(0, 52)}…`;
  if (name === "task") return "Delegating to sub-agent…";
  if (title) return `${title}…`;
  return statusFor(name);
}

function now(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(secs: number): string {
  return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
}

export function App({ config, cwd, registry: registryProp, notices }: AppProps) {
  const [themeName, setThemeName] = useState(config.theme);
  const theme = getTheme(themeName);
  const { exit } = useApp();
  const termRows = useStdout().stdout?.rows;

  const [history, setHistory] = useState<ViewItem[]>(() =>
    (notices ?? []).map((text): ViewItem => ({ kind: "notice", text })),
  );
  const [live, setLive] = useState<ViewItem[]>([]);
  const [input, setInput] = useState(() => loadDraft(cwd)); // restore an unsent draft
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Thinking…");
  const [tokens, setTokens] = useState(0);
  const [tokensIn, setTokensIn] = useState(0);
  const [tokensOut, setTokensOut] = useState(0);
  const [lastCtx, setLastCtx] = useState(0);
  const [autoApprove, setAutoApprove] = useState(false);
  const [clearEpoch, setClearEpoch] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [menuSel, setMenuSel] = useState(0);
  const [trusted, setTrusted] = useState(() => isTrusted(cwd));
  const [catalog, setCatalog] = useState<ModelEntry[]>([]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [review, setReview] = useState<{ deck: string; cards: Card[] } | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);
  const permResolve = useRef<((decision: PermissionDecision) => void) | null>(null);
  const aborted = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const nudgedUpgrade = useRef(false);
  const inputHistory = useRef<string[]>([]);
  const histIndex = useRef(-1);
  const lastPrompt = useRef("");
  const claudeVerifier = useRef<string | null>(null);

  const store = useRef(new SessionStore()).current;
  const subRegistry = useRef(registryProp ?? new ToolRegistry()).current;
  const permission = useRef(
    new PermissionManager(
      config.permission,
      (request) =>
        new Promise<PermissionDecision>((resolve) => {
          permResolve.current = resolve;
          setPermRequest(request);
        }),
    ),
  ).current;
  const registry = useRef(
    new ToolRegistry([
      ...subRegistry.list(),
      createSubagentTool({ store, registry: subRegistry, config, permission }),
    ]),
  ).current;

  const [session, setSession] = useState<Session>(() =>
    Session.create({ store, registry, config, permission }, { cwd }),
  );

  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => {
    const id = setTimeout(() => saveDraft(cwd, input), 400);
    return () => clearTimeout(id);
  }, [input, cwd]);

  useEffect(() => {
    let alive = true;
    getModelCatalog({ config })
      .then((c) => alive && setCatalog(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const isNewer = (a: string, b: string): boolean => {
      const x = a.split(".").map((n) => parseInt(n, 10) || 0);
      const y = b.split(".").map((n) => parseInt(n, 10) || 0);
      for (let i = 0; i < 3; i++) {
        if ((x[i] ?? 0) > (y[i] ?? 0)) return true;
        if ((x[i] ?? 0) < (y[i] ?? 0)) return false;
      }
      return false;
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch("https://registry.npmjs.org/@termcoder/tui/latest", { signal: ctrl.signal })
      .then((r) => r.json() as Promise<{ version?: string }>)
      .then((d) => {
        if (d.version && isNewer(d.version, VERSION)) {
          pushHistory({
            kind: "notice",
            text: `✨ termcoder ${d.version} is available (you have ${VERSION}).  Update:  npm i -g @termcoder/tui@latest`,
          });
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  function providerHasKey(provider: string): boolean {
    if (["ollama", "pollinations", "termcoderfree", "termcoder", "termexplorer"].includes(provider)) return true;
    if (config.providers[provider]?.apiKey) return true;
    if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
    if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
    if (provider === "google")
      return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
    return false;
  }

  function selectModel(id: string) {
    session.record.model = id;
    store.save(session.record);
    try {
      saveConfig({ model: id }); // remember the choice across sessions
    } catch {
    }
    setModelPickerOpen(false);
    forceRender((n) => n + 1);
    pushHistory({ kind: "notice", text: `Model set to ${id}.` });
  }

  const modelReady =
    ["ollama", "termcoder", "termexplorer"].includes(session.record.model.split("/")[0] ?? "") ||
    Boolean(
      process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY,
    ) ||
    Object.values(config.providers).some((p) => p.apiKey);

  const modelCtxK = catalog.find((e) => e.id === session.record.model)?.contextK ?? 128;
  const ctxPct = lastCtx > 0 ? Math.min(100, Math.max(1, Math.round((lastCtx / (modelCtxK * 1000)) * 100))) : 0;

  const projectFiles = useMemo(() => listProjectFiles(cwd), [cwd]);
  const [menuDismissed, setMenuDismissed] = useState(false);

  const showMenus = !busy && !permRequest && !menuDismissed;
  const commandMatches =
    showMenus && input.startsWith("/") && !input.includes(" ") ? matchCommands(input.slice(1)) : [];
  const mentionQuery =
    showMenus && commandMatches.length === 0 ? /(^|\s)@([^\s@]*)$/.exec(input) : null;
  const mentionMatches = mentionQuery ? matchFiles(projectFiles, mentionQuery[2] ?? "") : [];
  const activeLen = commandMatches.length || mentionMatches.length;
  const menuSelClamped = Math.min(menuSel, Math.max(0, activeLen - 1));

  const menuControl = {
    open: activeLen > 0,
    onMove: (delta: number) => setMenuSel(() => (activeLen ? (menuSelClamped + delta + activeLen) % activeLen : 0)),
    onAccept: () => {
      if (commandMatches.length > 0) {
        const chosen = commandMatches[menuSelClamped]!;
        if (chosen.arg) {
          setInput(`/${chosen.name} `);
        } else {
          setInput("");
          setMenuSel(0);
          handleCommand(`/${chosen.name}`);
          return;
        }
      } else if (mentionMatches.length > 0) {
        const chosen = mentionMatches[menuSelClamped]!;
        setInput(input.replace(/(^|\s)@([^\s@]*)$/, (_m, pre: string) => `${pre}@${chosen} `));
      }
      setMenuSel(0);
    },
    onClose: () => setMenuDismissed(true),
  };

  useInput((_input, key) => {
    if (key.escape && busy) {
      aborted.current = true;
      abortController.current?.abort();
    } else if (key.tab && key.shift && !busy && !permRequest && !modelPickerOpen && !review) {
      cycleMode();
    } else if (key.ctrl && _input === "p" && !busy && !permRequest && !modelPickerOpen && !review) {
      setInput("/");
      setMenuSel(0);
    }
  });

  const [, forceRender] = useState(0);
  function cycleMode() {
    const primaries = discoverAgents({ config, cwd })
      .filter((a) => a.mode !== "subagent")
      .map((a) => a.name);
    const list = primaries.length ? primaries : ["build", "plan"];
    const cur = session.record.agent ?? session.record.mode ?? "build";
    const next = list[(list.indexOf(cur) + 1) % list.length]!;
    session.record.agent = next;
    store.save(session.record);
    forceRender((n) => n + 1);
  }

  function onHistory(dir: "up" | "down") {
    const h = inputHistory.current;
    if (dir === "up" && h.length > 0) {
      histIndex.current = histIndex.current === -1 ? h.length - 1 : Math.max(0, histIndex.current - 1);
      setInput(h[histIndex.current] ?? "");
    } else if (dir === "down" && histIndex.current !== -1) {
      if (histIndex.current >= h.length - 1) {
        histIndex.current = -1;
        setInput("");
      } else {
        histIndex.current += 1;
        setInput(h[histIndex.current] ?? "");
      }
    }
  }

  function handleChange(v: string) {
    setInput(v);
    setMenuSel(0);
    setMenuDismissed(false);
  }

  function pushHistory(item: ViewItem) {
    setHistory((prev) => [...prev, item]);
  }

  function onDecision(decision: PermissionDecision) {
    setPermRequest(null);
    permResolve.current?.(decision);
    permResolve.current = null;
  }

  async function runBackground(goal: string) {
    const verify = detectVerifyCommand(cwd);
    const maxRounds = 5;
    const prevAuto = autoApprove;
    setAutoApprove(true);
    permission.setAutoApprove(true);
    pushHistory({
      kind: "notice",
      text: `🤖 Autonomous mode — auto-approving changes${verify ? `, verifying with: ${verify}` : " (no check found; single pass)"}.`,
    });
    let instruction = goal;
    try {
      for (let round = 1; round <= maxRounds; round++) {
        if (aborted.current) break;
        if (round > 1) pushHistory({ kind: "notice", text: `▶ Round ${round} of ${maxRounds}` });
        await runPrompt(instruction);
        if (aborted.current) {
          pushHistory({ kind: "notice", text: "⛔ Autonomous run stopped." });
          break;
        }
        if (!verify) break;
        pushHistory({ kind: "notice", text: `🔎 Running check: ${verify}…` });
        const { ok, output } = await runVerify(verify, cwd);
        if (ok) {
          pushHistory({ kind: "notice", text: "✓ Check passed — goal reached." });
          break;
        }
        if (round === maxRounds) {
          pushHistory({ kind: "notice", text: `✗ Still failing after ${maxRounds} rounds — stopping so you can take a look.` });
          break;
        }
        pushHistory({ kind: "notice", text: "✗ Check failed — fixing…" });
        instruction = `The check \`${verify}\` failed:\n\n${output.slice(-3000)}\n\nFind the cause and fix it so the command passes. Make only the changes needed.`;
      }
    } finally {
      setAutoApprove(prevAuto);
      permission.setAutoApprove(prevAuto);
    }
  }

  async function runPrompt(text: string, useSession: Session = session) {
    aborted.current = false;
    const controller = new AbortController();
    abortController.current = controller;
    const turnStart = Date.now();
    setBusy(true);
    setStatus("Thinking…");

    const localLive: ViewItem[] = [];
    let assistantIdx: number | null = null;
    let thoughtShown = false;
    let rateLimited = false;
    const onFreeModel = ["termcoderfree", "pollinations"].includes(session.record.model.split("/")[0] ?? "");
    const sync = () => setLive([...localLive]);

    const markThought = () => {
      if (thoughtShown) return;
      thoughtShown = true;
      const ms = Date.now() - turnStart;
      localLive.push({ kind: "notice", text: `✻ Thought ${ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}` });
    };

    try {
      for await (const event of useSession.prompt(text, { signal: controller.signal })) {
        if (aborted.current) {
          localLive.push({ kind: "notice", text: "⛔ Interrupted." });
          break;
        }
        switch (event.type) {
          case "text-delta": {
            setStatus("Thinking…");
            if (assistantIdx === null) {
              markThought();
              localLive.push({ kind: "assistant", text: event.text });
              assistantIdx = localLive.length - 1;
            } else {
              const cur = localLive[assistantIdx];
              if (cur?.kind === "assistant") {
                localLive[assistantIdx] = { ...cur, text: cur.text + event.text };
              }
            }
            break;
          }
          case "tool-call": {
            markThought();
            assistantIdx = null;
            setStatus(toolStatus(event.name, event.title, event.detail));
            localLive.push({
              kind: "tool",
              id: event.id,
              name: event.name,
              title: event.title,
              detail: event.detail,
              status: "running",
            });
            break;
          }
          case "tool-result": {
            setStatus("Thinking…");
            const idx = localLive.findIndex((it) => it.kind === "tool" && it.id === event.id);
            const t = idx >= 0 ? localLive[idx] : undefined;
            if (t?.kind === "tool") {
              localLive[idx] = {
                ...t,
                status: event.isError ? "error" : "done",
                output: event.output,
              };
            }
            break;
          }
          case "usage":
            setTokens((t) => t + event.inputTokens + event.outputTokens);
            setTokensIn((t) => t + event.inputTokens);
            setTokensOut((t) => t + event.outputTokens);
            setLastCtx(event.inputTokens);
            break;
          case "error": {
            localLive.push({ kind: "error", text: event.error });
            if (/quota|rate.?limit|too many|429|busy|overload/i.test(event.error)) {
              rateLimited = true;
            } else if (/api key|unauthor|401|403|invalid.*key|no .*credentials/i.test(event.error)) {
              localLive.push({ kind: "notice", text: "→ Fix it with /setup (or /key <provider> <key>)." });
            }
            break;
          }
          case "done":
            break;
        }
        sync();
      }
    } finally {
      const secs = Math.round((Date.now() - turnStart) / 1000);
      const dur = fmtDuration(secs);
      const stamped: ViewItem[] = localLive.map((it) =>
        it.kind === "assistant" ? { ...it, time: now(), dur } : it,
      );
      if (onFreeModel && !nudgedUpgrade.current && !aborted.current && (rateLimited || secs > 90)) {
        nudgedUpgrade.current = true;
        stamped.push({
          kind: "notice",
          text: rateLimited
            ? "The free model is busy — that is its main limit. Connect a better one (free options too) in a step or two:  /upgrade"
            : "The free model is small and slow. For faster, stronger answers — free options included — run  /upgrade",
        });
      }
      setHistory((prev) => [...prev, ...stamped]);
      setLive([]);
      setBusy(false);
    }
  }

  function ghClient(): GitHubClient | null {
    try {
      return GitHubClient.fromConfig(config);
    } catch (err) {
      pushHistory({ kind: "error", text: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }
  function ghErr(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  function handleCommand(text: string) {
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    const arg = rest.join(" ").trim();
    switch (cmd) {
      case "help":
        pushHistory({ kind: "notice", text: helpText() });
        break;
      case "setup":
        pushHistory({
          kind: "notice",
          text: [
            "You're already set — termcoder runs on a FREE model with no API key. Just start typing.",
            "",
            "Want more power or higher limits? Optionally connect a model:",
            "  • Google Gemini (free tier): get a key at https://aistudio.google.com/apikey",
            "      then run:  /key google YOUR_KEY",
            "  • Ollama (local, unlimited, no key): install from https://ollama.com,",
            "      run 'ollama pull llama3.1', then:  /model ollama/llama3.1",
            "  • Anthropic:  /key anthropic sk-ant-…       • OpenAI:  /key openai sk-…",
            "",
            "Keys are saved to your global config; you only do this once.",
          ].join("\n"),
        });
        break;
      case "upgrade": {
        const onKey = providerHasKey("google") || providerHasKey("anthropic") || providerHasKey("openai");
        pushHistory({
          kind: "notice",
          text: onKey
            ? "You're already connected to a provider — you're on the good stuff. /model to pick one."
            : [
                "termcoderfree is free but small, slow, and rate-limited. Any of these makes it much better —",
                "pick whichever you already have; termcoder/auto starts using it right away:",
                "",
                "  Free Gemini key   1. Get one free: https://aistudio.google.com/apikey",
                "                    2. Run:  /key google YOUR_KEY",
                "  Claude Pro/Max    /login-claude     (experimental — your subscription, no API key)",
                "  ChatGPT Plus/Pro  /login-chatgpt    (experimental)",
                "  Local & unlimited install Ollama, then /model to pick it",
              ].join("\n"),
        });
        break;
      }
      case "connect": {
        if (arg) {
          const p = CONNECTABLE_PROVIDERS.find((x) => x.provider === arg);
          if (!p) {
            pushHistory({
              kind: "notice",
              text: `Unknown provider "${arg}". Try: ${CONNECTABLE_PROVIDERS.map((x) => x.provider).join(", ")}`,
            });
            break;
          }
          const lines = p.methods.map(
            (m) => `  ${m.available ? "●" : "○"} ${m.label}${m.available ? "" : "  (coming soon)"}`,
          );
          const loginCmd = arg === "anthropic" ? "\n  Subscription:  /login-claude"
            : arg === "openai" ? "\n  Subscription:  /login-chatgpt"
            : "";
          pushHistory({
            kind: "notice",
            text: `Connect ${p.label}:\n${lines.join("\n")}\n\n  API key:  /key ${arg} <your-key>${loginCmd}`,
          });
        } else {
          const lines = CONNECTABLE_PROVIDERS.map((p) => {
            const sub = p.methods.some((m) => m.available && m.id.startsWith("oauth")) ? "  (or subscription login)" : "";
            const keyUrl = providerInfo(p.provider)?.keyUrl;
            return `  ${p.provider.padEnd(10)} ${p.label}${sub}${keyUrl ? `  ${keyUrl}` : ""}`;
          });
          pushHistory({
            kind: "notice",
            text: `Connect a provider — /connect <name> for methods:\n${lines.join("\n")}\n\nYou don't need any of these — termcoder already runs on a free model. /upgrade for the quickest path.`,
          });
        }
        break;
      }
      case "login-claude": {
        const pasted = arg.trim();
        if (!pasted) {
          const { url, verifier } = beginClaudeLogin();
          claudeVerifier.current = verifier;
          pushHistory({
            kind: "notice",
            text: [
              "Experimental — sign in with your Claude Pro/Max subscription:",
              `  1. Open: ${url}`,
              "  2. Approve, copy the code it shows, then run:  /login-claude <code>",
              "If Anthropic changes their flow this may stop working; you can always use /key or the free model.",
            ].join("\n"),
          });
          break;
        }
        if (!claudeVerifier.current) {
          pushHistory({ kind: "error", text: "Run /login-claude with no argument first to get the sign-in link." });
          break;
        }
        completeClaudeLogin(pasted, claudeVerifier.current)
          .then((creds) => {
            saveClaudeOAuth(creds);
            claudeVerifier.current = null;
            forceRender((n) => n + 1);
            pushHistory({ kind: "notice", text: "✓ Claude subscription connected (experimental). termcoder/auto can now use it." });
          })
          .catch((err) => {
            pushHistory({ kind: "error", text: err instanceof Error ? err.message : String(err) });
          });
        break;
      }
      case "logout-claude": {
        clearClaudeOAuth();
        forceRender((n) => n + 1);
        pushHistory({ kind: "notice", text: "Disconnected the Claude subscription login." });
        break;
      }
      case "login-chatgpt": {
        beginChatGPTLogin().then((grant) => {
          pushHistory({ kind: "notice", text: [
            "Experimental — sign in with your ChatGPT Plus/Pro subscription:",
            `  1. Open: ${grant.verificationUri}`,
            `  2. Enter this code: ${grant.userCode}`,
            "Waiting for you to approve… (this may take a moment; it falls back to /key or the free model if it fails)",
          ].join("\n") });
          return pollChatGPTLogin(grant.deviceCode, { intervalMs: grant.interval * 1000 });
        }).then((creds) => {
          saveChatGPTOAuth(creds);
          forceRender((n) => n + 1);
          pushHistory({ kind: "notice", text: "✓ ChatGPT subscription connected (experimental)." });
        }).catch((err) => {
          pushHistory({ kind: "error", text: err instanceof Error ? err.message : String(err) });
        });
        break;
      }
      case "logout-chatgpt": {
        clearChatGPTOAuth();
        forceRender((n) => n + 1);
        pushHistory({ kind: "notice", text: "Disconnected the ChatGPT subscription login." });
        break;
      }
      case "key": {
        const [rawProv, ...rest] = arg.split(/\s+/);
        const provider = rawProv === "gemini" ? "google" : (rawProv ?? "");
        const value = rest.join(" ").trim();
        const info = providerInfo(provider);
        const validProvider = Boolean(info && (info.kind === "native" || info.kind === "openai-compat"));
        if (!validProvider || !value) {
          pushHistory({ kind: "notice", text: "Usage: /key <provider> <api-key> — /connect lists providers" });
          break;
        }
        try {
          saveConfig({ providers: { [provider]: { apiKey: value } } });
          config.providers[provider] = { ...config.providers[provider], apiKey: value };
          forceRender((n) => n + 1);
          pushHistory({ kind: "notice", text: `✓ Saved your ${provider} API key — testing…` });
          void probeProvider(provider, { config }).then((r) => {
            pushHistory(
              r.ok
                ? { kind: "notice", text: `✓ ${provider} connected — works!` }
                : { kind: "error", text: `✗ ${provider}: ${friendlyError(r.error ?? "did not respond")}` },
            );
            forceRender((n) => n + 1);
          });
        } catch (err) {
          pushHistory({ kind: "error", text: `Could not save the key: ${String(err)}` });
        }
        break;
      }
      case "clear":
        setHistory([]);
        setLive([]);
        setClearEpoch((n) => n + 1);
        break;
      case "new": {
        const fresh = Session.create({ store, registry, config, permission }, { cwd });
        setSession(fresh);
        setHistory([{ kind: "notice", text: "Started a new session." }]);
        setLive([]);
        setClearEpoch((n) => n + 1);
        break;
      }
      case "sessions": {
        const list = store.list().slice(0, 10);
        const lines = list.length
          ? list.map((s) => `  ${s.id.slice(0, 8)}  ${s.messageCount} msgs  ${s.title}`).join("\n")
          : "  (no saved sessions)";
        pushHistory({ kind: "notice", text: `Sessions:\n${lines}` });
        break;
      }
      case "model":
        if (arg) {
          selectModel(arg);
        } else {
          setModelPickerOpen(true); // open the interactive picker
        }
        break;
      case "agent":
        if (arg) {
          const known = discoverAgents({ config, cwd }).map((a) => a.name);
          if (!known.includes(arg)) {
            pushHistory({ kind: "notice", text: `No agent "${arg}". Try /agents. (${known.join(", ")})` });
            break;
          }
          session.record.agent = arg;
          store.save(session.record);
          pushHistory({ kind: "notice", text: `Agent set to ${arg} for this session.` });
        } else {
          pushHistory({ kind: "notice", text: `Agent: ${session.record.agent ?? session.record.mode ?? "build"}` });
        }
        break;
      case "agents": {
        const list = discoverAgents({ config, cwd });
        const lines = list
          .map((a) => `  ${a.builtin ? "○" : "●"} ${a.name.padEnd(10)} ${a.description ?? ""}`)
          .join("\n");
        pushHistory({ kind: "notice", text: `Agents (● custom, ○ built-in):\n${lines}` });
        break;
      }
      case "commands": {
        const list = discoverCommands({ cwd });
        const text = list.length
          ? list.map((c) => `  /${c.name.padEnd(12)} ${c.description ?? ""}`).join("\n")
          : "  (no custom commands — add .termcoder/commands/*.md)";
        pushHistory({ kind: "notice", text: `Project commands:\n${text}` });
        break;
      }
      case "skills": {
        const list = discoverSkills({ cwd });
        const text = list.length
          ? list.map((s) => `  ${s.name.padEnd(14)} ${s.description}`).join("\n")
          : "  (no skills — add .termcoder/skills/*.md with name + description)";
        pushHistory({ kind: "notice", text: `Skills (loaded on demand by the agent):\n${text}` });
        break;
      }
      case "resume": {
        if (!arg) {
          pushHistory({ kind: "notice", text: "Usage: /resume <session-id>" });
          break;
        }
        const match = store.list().find((s) => s.id.startsWith(arg));
        if (!match) {
          pushHistory({ kind: "notice", text: `No session matching "${arg}".` });
          break;
        }
        try {
          const resumed = Session.resume({ store, registry, config, permission }, match.id);
          setSession(resumed);
          setHistory([
            { kind: "notice", text: `Resumed ${match.id.slice(0, 8)} (${match.messageCount} msgs).` },
            ...recordToItems(resumed.record),
          ]);
          setLive([]);
          setClearEpoch((n) => n + 1);
        } catch (err) {
          pushHistory({ kind: "error", text: String(err) });
        }
        break;
      }
      case "share": {
        const file = join(cwd, `termcoder-${session.record.id.slice(0, 8)}.html`);
        try {
          writeFileSync(file, renderSessionHtml(session.record), "utf8");
          pushHistory({ kind: "notice", text: `Saved transcript to ${file}` });
        } catch (err) {
          pushHistory({ kind: "error", text: `Could not write transcript: ${String(err)}` });
        }
        break;
      }
      case "background": {
        if (!arg) {
          pushHistory({
            kind: "notice",
            text: "Usage: /background <goal>\nRuns autonomously (auto-approving) and keeps fixing until the project's tests/build pass.",
          });
          break;
        }
        if (busy) {
          pushHistory({ kind: "notice", text: "Busy — wait for the current turn to finish, then try again." });
          break;
        }
        lastPrompt.current = arg;
        void runBackground(arg);
        break;
      }
      case "flashcards": {
        if (!arg) {
          pushHistory({ kind: "notice", text: "Usage: /flashcards <topic>   (e.g. /flashcards the water cycle)" });
          break;
        }
        const deck = arg.length > 40 ? arg.slice(0, 40) : arg;
        pushHistory({ kind: "notice", text: `Writing flashcards about “${arg}”…` });
        generateFlashcards({ topic: arg, config })
          .then((cards) => {
            if (!cards.length) {
              pushHistory({
                kind: "error",
                text: "The free model didn't return usable cards — try again, or connect a key (/key google …) for faster, more reliable generation.",
              });
              return;
            }
            addCards(deck, cards);
            pushHistory({
              kind: "notice",
              text: `✓ Added ${cards.length} cards to “${deck}”. Study them with:  /review ${deck}`,
            });
          })
          .catch(() =>
            pushHistory({
              kind: "error",
              text: "Couldn't reach the model to write cards (the free service can be busy). Try again in a moment, or connect a key with /key google …",
            }),
          );
        break;
      }
      case "decks": {
        const decks = deckSummaries();
        if (!decks.length) {
          pushHistory({ kind: "notice", text: "No decks yet. Make some with:  /flashcards <topic>" });
          break;
        }
        const p = loadProgress();
        const lines = decks.map((d) => `  ${d.name.padEnd(24)} ${d.due} due / ${d.total} cards`);
        pushHistory({
          kind: "notice",
          text: `Decks (streak: ${p.streak} 🔥):\n${lines.join("\n")}\n\nReview with:  /review [deck]`,
        });
        break;
      }
      case "review": {
        const decks = deckSummaries();
        if (!decks.length) {
          pushHistory({ kind: "notice", text: "No decks yet. Make some with:  /flashcards <topic>" });
          break;
        }
        const deckName = arg || (decks.find((d) => d.due > 0) ?? decks[0]!).name;
        const cards = dueCards(deckName);
        if (!cards.length) {
          pushHistory({ kind: "notice", text: `Nothing due in “${deckName}”. 🎉  (/decks to see all)` });
          break;
        }
        setReview({ deck: deckName, cards });
        break;
      }
      case "login": {
        if (!arg) {
          pushHistory({
            kind: "notice",
            text: [
              "Connect GitHub to sync settings, share sessions, and install packs.",
              "  1. Create a token: https://github.com/settings/tokens/new  (scope: gist)",
              "  2. Run:  /login <your-token>",
            ].join("\n"),
          });
          break;
        }
        try {
          saveConfig({ github: { token: arg } });
          config.github = { ...config.github, token: arg };
        } catch (err) {
          pushHistory({ kind: "error", text: `Could not save the token: ${String(err)}` });
          break;
        }
        pushHistory({ kind: "notice", text: "Connecting to GitHub…" });
        new GitHubClient(arg)
          .whoami()
          .then((u) => pushHistory({ kind: "notice", text: `✓ Connected to GitHub as ${u.login}.` }))
          .catch((err) =>
            pushHistory({ kind: "error", text: `Token saved, but validation failed: ${ghErr(err)}` }),
          );
        break;
      }
      case "logout":
        try {
          saveConfig({ github: { token: "" } });
          config.github = { ...config.github, token: "" };
          pushHistory({ kind: "notice", text: "Disconnected GitHub." });
        } catch (err) {
          pushHistory({ kind: "error", text: String(err) });
        }
        break;
      case "sync": {
        const client = ghClient();
        if (!client) break;
        pushHistory({ kind: "notice", text: "Syncing favorites & drafts via GitHub…" });
        syncAll(client)
          .then(({ pulled, pushed }) =>
            pushHistory({
              kind: "notice",
              text: `✓ Synced — pulled: ${pulled.join(", ") || "none"} · pushed: ${pushed.join(", ") || "none"}`,
            }),
          )
          .catch((err) => pushHistory({ kind: "error", text: ghErr(err) }));
        break;
      }
      case "publish": {
        const client = ghClient();
        if (!client) break;
        pushHistory({ kind: "notice", text: "Publishing session as a private gist…" });
        client
          .createGist({
            description: `termcoder session — ${session.record.title}`,
            public: false,
            files: sessionGistFiles(session.record),
          })
          .then((g) =>
            pushHistory({
              kind: "notice",
              text:
                `✓ Published. Share this link (opens in any browser):\n  https://cartivo-oficial.github.io/TermCoder/viewer.html?gist=${g.id}\n\n` +
                `  Gist: ${g.html_url}\n  Import it elsewhere with:  /import ${g.html_url}`,
            }),
          )
          .catch((err) => pushHistory({ kind: "error", text: ghErr(err) }));
        break;
      }
      case "import": {
        if (!arg) {
          pushHistory({ kind: "notice", text: "Usage: /import <gist-id-or-url>" });
          break;
        }
        const client = ghClient();
        if (!client) break;
        pushHistory({ kind: "notice", text: "Importing shared session…" });
        importSessionFromGist(arg, client, store)
          .then((record) => {
            const resumed = Session.resume({ store, registry, config, permission }, record.id);
            setSession(resumed);
            setHistory([
              { kind: "notice", text: `✓ Imported "${record.title}".` },
              ...recordToItems(resumed.record),
            ]);
            setLive([]);
            setClearEpoch((n) => n + 1);
          })
          .catch((err) => pushHistory({ kind: "error", text: ghErr(err) }));
        break;
      }
      case "pack": {
        const [sub, ...more] = arg.split(/\s+/).filter(Boolean);
        if (sub === "list" || !sub) {
          const items = readPack(join(cwd, ".termcoder"));
          const text = items.length
            ? items.map((i) => `  ${i.kind.padEnd(9)} ${i.filename}`).join("\n")
            : "  (nothing to pack — add .termcoder/{agents,skills,commands}/*.md)";
          pushHistory({ kind: "notice", text: `Pack contents (this project):\n${text}` });
          break;
        }
        const client = ghClient();
        if (!client) break;
        if (sub === "publish") {
          const name = more.join(" ").trim() || "my-termcoder-pack";
          pushHistory({ kind: "notice", text: `Publishing pack "${name}"…` });
          publishPack({ name }, join(cwd, ".termcoder"), client)
            .then((url) =>
              pushHistory({ kind: "notice", text: `✓ Pack published: ${url}\n  Install with:  /pack install ${url}` }),
            )
            .catch((err) => pushHistory({ kind: "error", text: ghErr(err) }));
        } else if (sub === "install") {
          const ref = more.find((m) => m !== "--global") ?? "";
          if (!ref) {
            pushHistory({ kind: "notice", text: "Usage: /pack install <gist|owner/repo> [--global]" });
            break;
          }
          const target = more.includes("--global") ? "global" : "project";
          pushHistory({ kind: "notice", text: `Installing pack from ${ref}…` });
          installPack(ref, client, { target, cwd })
            .then(({ manifest, written }) =>
              pushHistory({
                kind: "notice",
                text: `✓ Installed "${manifest.name}" (${written.length} files) into ${target} .termcoder:\n  ${written.join("\n  ")}`,
              }),
            )
            .catch((err) => pushHistory({ kind: "error", text: ghErr(err) }));
        } else {
          pushHistory({ kind: "notice", text: "Usage: /pack <publish [name] | install <ref> [--global] | list>" });
        }
        break;
      }
      case "class": {
        const [sub, ...more] = arg.split(/\s+/).filter(Boolean);
        const joined = loadClassrooms();
        const def = joined[joined.length - 1];
        const rest = more.join(" ").trim();

        if (!sub || sub === "list") {
          if (!joined.length) {
            pushHistory({
              kind: "notice",
              text: "No classes yet.\n  Teacher:  /class create <name>\n  Student:  /class join <code>",
            });
            break;
          }
          const lines = joined.map(
            (c) => `  ${c.role === "teacher" ? "★" : "•"} ${c.name.padEnd(20)} ${c.code}  (${c.role})`,
          );
          pushHistory({
            kind: "notice",
            text: `Your classes${def ? ` (default: ${def.name})` : ""}:\n${lines.join("\n")}\n\n/class <create|join|assign|submit|submissions|roster|assignments>`,
          });
          break;
        }
        const client = ghClient();
        if (!client) break;

        if (sub === "create") {
          if (!rest) {
            pushHistory({ kind: "notice", text: "Usage: /class create <name>" });
            break;
          }
          pushHistory({ kind: "notice", text: `Creating class “${rest}”…` });
          createClassroom(rest, client)
            .then((c) =>
              pushHistory({
                kind: "notice",
                text: `✓ Class created. Share this code with students:\n  ${c.code}\n\nThey run:  /class join ${c.code}`,
              }),
            )
            .catch((e) => pushHistory({ kind: "error", text: ghErr(e) }));
          break;
        }
        if (sub === "join") {
          const code = more[0];
          if (!code) {
            pushHistory({ kind: "notice", text: "Usage: /class join <code>" });
            break;
          }
          pushHistory({ kind: "notice", text: "Joining class…" });
          joinClassroom(code, client, { cwd })
            .then(({ classroom, installed }) => {
              const aLines = classroom.assignments.length
                ? classroom.assignments.map((a) => `    • ${a.title} (${a.id})${a.due ? ` — due ${a.due}` : ""}`).join("\n")
                : "    (none yet)";
              pushHistory({
                kind: "notice",
                text: `✓ Joined “${classroom.name}”. Installed ${installed.length} shared file(s).\nAssignments:\n${aLines}`,
              });
            })
            .catch((e) => pushHistory({ kind: "error", text: ghErr(e) }));
          break;
        }
        if (!def) {
          pushHistory({ kind: "notice", text: "No class yet — /class create <name> or /class join <code> first." });
          break;
        }
        if (sub === "assignments") {
          fetchClassroom(def.code, client)
            .then((c) => {
              const lines = c.assignments.length
                ? c.assignments.map((a) => `  • ${a.title} (${a.id})${a.due ? ` — due ${a.due}` : ""}`).join("\n")
                : "  (none yet)";
              pushHistory({ kind: "notice", text: `Assignments in “${c.name}”:\n${lines}\n\nSubmit with:  /class submit <id>` });
            })
            .catch((e) => pushHistory({ kind: "error", text: ghErr(e) }));
          break;
        }
        if (sub === "assign") {
          if (def.role !== "teacher") {
            pushHistory({ kind: "notice", text: "Only the class creator can post assignments." });
            break;
          }
          if (!rest) {
            pushHistory({ kind: "notice", text: "Usage: /class assign <title>" });
            break;
          }
          pushHistory({ kind: "notice", text: `Posting to “${def.name}”…` });
          addAssignment(def.code, { title: rest }, client)
            .then((a) => pushHistory({ kind: "notice", text: `✓ Posted “${a.title}” (${a.id}).` }))
            .catch((e) => pushHistory({ kind: "error", text: ghErr(e) }));
          break;
        }
        if (sub === "submit") {
          const aid = more[0];
          if (!aid) {
            pushHistory({ kind: "notice", text: "Usage: /class submit <assignment-id>   (see ids with /class assignments)" });
            break;
          }
          pushHistory({ kind: "notice", text: "Publishing your session and submitting…" });
          client
            .createGist({
              description: `termcoder session — ${session.record.title}`,
              public: false,
              files: sessionGistFiles(session.record),
            })
            .then((g) =>
              submitAssignment(
                def.code,
                { assignmentId: aid, link: `https://cartivo-oficial.github.io/TermCoder/viewer.html?gist=${g.id}` },
                client,
              ),
            )
            .then(() => pushHistory({ kind: "notice", text: `✓ Submitted to “${def.name}”.` }))
            .catch((e) => pushHistory({ kind: "error", text: ghErr(e) }));
          break;
        }
        if (sub === "submissions") {
          listSubmissions(def.code, client)
            .then((subs) => {
              const lines = subs.length
                ? subs.map((s) => `  @${s.user}  a=${s.assignmentId}  ${s.link}${s.note ? `  — ${s.note}` : ""}`).join("\n")
                : "  (no submissions yet)";
              pushHistory({ kind: "notice", text: `Submissions for “${def.name}”:\n${lines}` });
            })
            .catch((e) => pushHistory({ kind: "error", text: ghErr(e) }));
          break;
        }
        if (sub === "roster") {
          listRoster(def.code, client)
            .then((r) => {
              const lines = r.length ? r.map((x) => `  @${x.user}`).join("\n") : "  (nobody yet)";
              pushHistory({ kind: "notice", text: `Roster for “${def.name}”:\n${lines}` });
            })
            .catch((e) => pushHistory({ kind: "error", text: ghErr(e) }));
          break;
        }
        pushHistory({
          kind: "notice",
          text: "Usage: /class <create <name> | join <code> | assignments | assign <title> | submit <id> | submissions | roster>",
        });
        break;
      }
      case "theme":
        if (arg && themes[arg]) {
          setThemeName(arg);
          try {
            saveConfig({ theme: arg }); // remember it across sessions
          } catch {
          }
          pushHistory({ kind: "notice", text: `Theme set to ${arg} (saved).` });
        } else {
          pushHistory({
            kind: "notice",
            text: `Themes: ${Object.keys(themes).join(", ")}. Usage: /theme <name>`,
          });
        }
        break;
      case "tools": {
        const lines = registry
          .list()
          .map((t) => `  ${t.readOnly ? "○" : "●"} ${t.name}`)
          .join("\n");
        pushHistory({ kind: "notice", text: `Tools (● asks permission, ○ read-only):\n${lines}` });
        break;
      }
      case "auto": {
        const next = !autoApprove;
        setAutoApprove(next);
        permission.setAutoApprove(next);
        pushHistory({
          kind: "notice",
          text: next
            ? "Auto-approve ON — tools run without asking. /auto to turn off."
            : "Auto-approve OFF — you'll be asked before changes.",
        });
        break;
      }
      case "retry":
        if (!lastPrompt.current) {
          pushHistory({ kind: "notice", text: "Nothing to retry yet." });
          break;
        }
        pushHistory({ kind: "user", text: lastPrompt.current, time: now() });
        void runPrompt(lastPrompt.current);
        break;
      case "tokens":
        pushHistory({
          kind: "notice",
          text: `Tokens — input: ${tokensIn}, output: ${tokensOut}, total: ${tokensIn + tokensOut}`,
        });
        break;
      case "suggest": {
        const lastAssistant = [...history].reverse().find((h) => h.kind === "assistant");
        if (!lastAssistant || lastAssistant.kind !== "assistant") {
          pushHistory({ kind: "notice", text: "Ask something first — then /suggest proposes a next step." });
          break;
        }
        pushHistory({ kind: "notice", text: "💡 thinking of a next step…" });
        void suggestFollowup({ config, env: process.env, context: lastAssistant.text }).then((s) => {
          if (s) setInput(s); // fill the composer with the suggestion (editable)
          else pushHistory({ kind: "notice", text: "(no suggestion — needs a working model)" });
        });
        break;
      }
      case "init": {
        const file = join(cwd, "AGENTS.md");
        if (existsSync(file)) {
          pushHistory({ kind: "notice", text: "AGENTS.md already exists." });
          break;
        }
        try {
          writeFileSync(file, AGENTS_TEMPLATE, "utf8");
          pushHistory({ kind: "notice", text: `Created ${file}. Edit it to guide the agent.` });
        } catch (err) {
          pushHistory({ kind: "error", text: String(err) });
        }
        break;
      }
      case "remember": {
        const text = arg.trim();
        if (!text) { pushHistory({ kind: "notice", text: "Usage: /remember [project] <text>" }); break; }
        const isProject = /^project\s+/i.test(text);
        const bodyText = isProject ? text.replace(/^project\s+/i, "") : text;
        const description = bodyText.length > 60 ? `${bodyText.slice(0, 57)}…` : bodyText;
        try {
          const m = saveMemory({
            scope: isProject ? "project" : "user",
            name: slugifyMemoryName(bodyText.split(/\s+/).slice(0, 5).join(" ")),
            description,
            type: isProject ? "project" : "preference",
            body: bodyText,
            cwd,
          });
          pushHistory({ kind: "notice", text: `✓ Remembered (${m.scope}): ${m.name}` });
        } catch (err) {
          pushHistory({ kind: "error", text: err instanceof Error ? err.message : String(err) });
        }
        break;
      }
      case "memories": {
        const mems = discoverMemories({ cwd });
        pushHistory({
          kind: "notice",
          text: mems.length
            ? `Memory:\n${mems.map((m) => `  • [${m.scope}] ${m.name} — ${m.description}`).join("\n")}`
            : "No memories yet. Save one with /remember, or just tell me something worth keeping.",
        });
        break;
      }
      case "forget": {
        const name = arg.trim();
        if (!name) { pushHistory({ kind: "notice", text: "Usage: /forget <name>" }); break; }
        const removed = deleteMemory({ name, cwd });
        pushHistory({ kind: removed ? "notice" : "error", text: removed ? `Forgot "${slugifyMemoryName(name)}".` : `No memory named "${name}".` });
        break;
      }
      case "exit":
      case "quit":
        exit();
        break;
      case "connectors": {
        const lines = listConnectors().map((c) => {
          const needs = (c.inputs ?? []).filter((i) => i.required).map((i) => i.key);
          const req = needs.length ? `  · needs ${needs.join(", ")}` : "";
          return `  ${c.id.padEnd(20)} ${c.name} — ${c.runtime ?? ""}${req}`;
        });
        pushHistory({
          kind: "notice",
          text: ["One-click MCP connectors. Add one with  /mcp add <id> [key=value …]", "", ...lines].join("\n"),
        });
        break;
      }
      case "mcp": {
        const sub = rest[0];
        if (!sub) {
          const entries = Object.entries(config.mcp ?? {});
          if (entries.length === 0) {
            pushHistory({
              kind: "notice",
              text: "No MCP servers configured. Browse ready-made ones with /connectors, then /mcp add <id>.",
            });
            break;
          }
          const lines = entries.map(([name, s]) => {
            const where = s.type === "http" ? s.url : `${s.command} ${(s.args ?? []).join(" ")}`.trim();
            return `  ${s.enabled === false ? "○" : "●"} ${name.padEnd(16)} ${where}`;
          });
          pushHistory({
            kind: "notice",
            text: ["Configured MCP servers (● on / ○ off) — they connect on next start:", ...lines].join("\n"),
          });
          break;
        }
        if (sub === "add") {
          const connector = rest[1] ? getConnector(rest[1]) : undefined;
          if (!connector) {
            pushHistory({ kind: "notice", text: `Unknown connector "${rest[1] ?? ""}". /connectors to list them.` });
            break;
          }
          const values: Record<string, string> = {};
          for (const pair of rest.slice(2)) {
            const eq = pair.indexOf("=");
            if (eq > 0) values[pair.slice(0, eq)] = pair.slice(eq + 1);
          }
          const missing = missingRequiredInputs(connector, values);
          if (missing.length) {
            const hint = missing.map((i) => `${i.key}=<${i.label}>`).join(" ");
            pushHistory({
              kind: "notice",
              text: `"${connector.name}" needs: ${hint}\nExample:  /mcp add ${connector.id} ${hint}`,
            });
            break;
          }
          const name = connector.id;
          const serverCfg = connectorToServerConfig(connector, values);
          saveConfig({ mcp: { [name]: serverCfg } });
          config.mcp = { ...config.mcp, [name]: serverCfg };
          forceRender((n) => n + 1);
          pushHistory({
            kind: "notice",
            text: `Added MCP server "${name}" (${connector.name}). Restart termcoder to connect it — its tools then appear to the agent.`,
          });
          break;
        }
        pushHistory({ kind: "notice", text: "Usage: /mcp (list) · /mcp add <id> [key=value …] · /connectors (browse)" });
        break;
      }
      case "recipes": {
        const idx = recipeIndex(discoverRecipes({ cwd }));
        pushHistory({
          kind: "notice",
          text: idx
            ? `Saved recipes — run one with /recipe <name>:\n${idx}`
            : "No recipes yet. Ask the agent to save one with the recipe tool, or add a markdown file under .termcoder/recipes/.",
        });
        break;
      }
      case "recipe": {
        if (!arg) {
          const idx = recipeIndex(discoverRecipes({ cwd }));
          pushHistory({
            kind: "notice",
            text: idx ? `Usage: /recipe <name>\n\n${idx}` : "No recipes yet. Ask the agent to save one with the recipe tool.",
          });
          break;
        }
        const r = getRecipe(arg, { cwd });
        if (!r) {
          pushHistory({ kind: "notice", text: `No recipe named "${arg}". /recipes to list.` });
          break;
        }
        const composed = composeRecipeRun(r);
        lastPrompt.current = composed;
        pushHistory({ kind: "user", text: `/recipe ${r.name}`, time: now() });
        void runPrompt(composed);
        break;
      }
      default:
        pushHistory({ kind: "notice", text: `Unknown command: /${cmd} (try /help)` });
    }
  }

  function onSubmit(raw: string) {
    const text = raw.trim();
    setInput("");
    clearDraft(cwd); // the draft has been sent (or discarded)
    if (!text) return;
    inputHistory.current.push(text);
    histIndex.current = -1;
    if (text.startsWith("/")) {
      setMenuSel(0);
      handleCommand(text);
      return;
    }
    if (text.startsWith("$")) {
      const task = text.slice(1).trim();
      if (task) void runSubagent(task);
      return;
    }
    lastPrompt.current = text;
    pushHistory({ kind: "user", text, time: now() });
    void runPrompt(text);
  }

  function runSubagent(task: string) {
    pushHistory({ kind: "user", text: `$ ${task}`, time: now() });
    pushHistory({ kind: "notice", text: "Delegating to a sub-agent…" });
    const sub = Session.create(
      { store, registry: subRegistry, config, permission },
      { cwd, agent: "general" },
    );
    return runPrompt(task, sub);
  }

  const conversationEmpty =
    !busy &&
    live.length === 0 &&
    !history.some((h) => h.kind === "user" || h.kind === "assistant");

  if (review) {
    return (
      <ReviewMode
        theme={theme}
        deck={review.deck}
        cards={review.cards}
        onGrade={(id, grade) => {
          gradeCard(review.deck, id, grade as 0 | 1 | 2 | 3 | 4 | 5);
          recordReview();
        }}
        onExit={(reviewed) => {
          setReview(null);
          const streak = loadProgress().streak;
          pushHistory({
            kind: "notice",
            text: reviewed
              ? `Reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}. Streak: ${streak} 🔥`
              : "Review stopped.",
          });
        }}
      />
    );
  }

  if (!trusted) {
    return (
      <TrustPrompt
        theme={theme}
        cwd={cwd}
        onDecision={(ok) => {
          if (ok) {
            trustFolder(cwd);
            setTrusted(true);
          } else {
            exit();
          }
        }}
      />
    );
  }

  const setupHint =
    conversationEmpty && !modelReady ? (
      <Box justifyContent="center" marginTop={1}>
        <Text color={theme.running}>{"⚠  No model set — type "}</Text>
        <Text color={theme.accent} bold>
          /setup
        </Text>
        <Text color={theme.running}>{" to get started (free options)"}</Text>
      </Box>
    ) : null;

  const inputArea = permRequest ? (
    <PermissionModal theme={theme} request={permRequest} onDecision={onDecision} />
  ) : modelPickerOpen ? (
    <ModelPicker
      theme={theme}
      entries={catalog}
      readiness={(e) => {
        const info = providerInfo(e.provider);
        const alwaysOn = info?.kind === "local" || info?.kind === "keyless" || e.provider === "termcoder" || e.provider === "termexplorer";
        if (alwaysOn) {
          const healthId = e.provider === "termcoderfree" ? "pollinations" : e.provider;
          return providerMarkedBad(healthId) ? "unverified" : "ready";
        }
        const hasKey = providerHasKey(e.provider);
        const h = providerHealthSnapshot()[e.provider];
        if (h && Date.now() < h.until && h.ok) return "ready";
        return hasKey ? "unverified" : "needs-key";
      }}
      current={session.record.model}
      favorites={favorites}
      onSelect={selectModel}
      onToggleFavorite={(id) => setFavorites(toggleFavorite(id))}
      onConnectProvider={() => {
        setModelPickerOpen(false);
        handleCommand("/setup");
      }}
      onClose={() => setModelPickerOpen(false)}
    />
  ) : (
    <Composer
      theme={theme}
      value={input}
      onChange={handleChange}
      onSubmit={onSubmit}
      busy={busy}
      disabled={busy}
      status={status}
      elapsed={elapsed}
      onHistory={onHistory}
      commandMenu={commandMatches}
      mentionMenu={mentionMatches}
      menuSelected={menuSelClamped}
      menuControl={menuControl}
      model={session.record.model}
      agent={session.record.agent ?? session.record.mode ?? "build"}
      cwd={cwd}
    />
  );

  const footer = (
    <StatusBar
      theme={theme}
      cwd={cwd}
      tokens={tokens}
      lastCtx={lastCtx}
      ctxPct={ctxPct}
      autoApprove={autoApprove}
      version={VERSION}
    />
  );

  if (conversationEmpty) {
    return (
      <Box flexDirection="column" minHeight={termRows} key={`${session.record.id}:${clearEpoch}`}>
        <Static items={history}>
          {(item, index) => <TranscriptItem key={index} theme={theme} item={item} />}
        </Static>
        <Box flexGrow={1} flexDirection="column" justifyContent="center">
          <Hero theme={theme} />
          {setupHint}
          {inputArea}
        </Box>
        {footer}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" key={`${session.record.id}:${clearEpoch}`}>
      <Static items={history}>
        {(item, index) => <TranscriptItem key={index} theme={theme} item={item} />}
      </Static>

      {live.length > 0 ? <Transcript theme={theme} items={live} /> : null}

      {inputArea}
      {footer}
    </Box>
  );
}
