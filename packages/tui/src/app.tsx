import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Static, Text, useApp, useInput } from "ink";
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
  PermissionManager,
  renderSessionHtml,
  Session,
  SessionStore,
  ToolRegistry,
  transcriptSegments,
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
import { TrustPrompt } from "./components/TrustPrompt";
import { Transcript, TranscriptItem } from "./components/Transcript";

const VERSION = "0.1.3";

const AGENTS_TEMPLATE = `# Project instructions for termcoder

Describe how the agent should work in this project. For example:

- Stack & conventions: (e.g. TypeScript, ESM, 2-space indent)
- How to run tests: (e.g. \`pnpm test\`)
- Things to avoid: (e.g. don't edit generated files in dist/)
- Anything else the agent should always keep in mind.
`;

/** Convert a saved session's messages into renderable transcript items. */
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

/** A descriptive busy status for a tool call: the concrete target when known. */
function toolStatus(name: string, title?: string, detail?: string): string {
  if (name === "bash" && detail) return `Running: ${detail.split("\n")[0]!.slice(0, 52)}…`;
  if (name === "task") return "Delegating to sub-agent…";
  if (title) return `${title}…`;
  return statusFor(name);
}

/** Current wall-clock time as a compact HH:MM for message timestamps. */
function now(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** A short turn duration, e.g. "48s" or "2m 48s". */
function fmtDuration(secs: number): string {
  return secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
}

export function App({ config, cwd, registry: registryProp, notices }: AppProps) {
  const [themeName, setThemeName] = useState(config.theme);
  const theme = getTheme(themeName);
  const { exit } = useApp();

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
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);
  const permResolve = useRef<((decision: PermissionDecision) => void) | null>(null);
  const aborted = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const inputHistory = useRef<string[]>([]);
  const histIndex = useRef(-1);
  const lastPrompt = useRef("");

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

  // While a turn runs, tick an elapsed-seconds counter for the status line.
  useEffect(() => {
    if (!busy) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  // Auto-save an unsent draft (debounced) so it survives a restart.
  useEffect(() => {
    const id = setTimeout(() => saveDraft(cwd, input), 400);
    return () => clearTimeout(id);
  }, [input, cwd]);

  // Load the model catalog once (Models.dev + local Ollama + our models).
  useEffect(() => {
    let alive = true;
    getModelCatalog({ config })
      .then((c) => alive && setCatalog(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function providerHasKey(provider: string): boolean {
    if (["ollama", "termcoder", "termexplorer"].includes(provider)) return true;
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
      /* config not writable — still applies this session */
    }
    setModelPickerOpen(false);
    forceRender((n) => n + 1);
    pushHistory({ kind: "notice", text: `Model set to ${id}.` });
  }

  // Whether a usable model/provider is configured (drives the readiness dot).
  const modelReady =
    ["ollama", "termcoder", "termexplorer"].includes(session.record.model.split("/")[0] ?? "") ||
    Boolean(
      process.env.ANTHROPIC_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY,
    ) ||
    Object.values(config.providers).some((p) => p.apiKey);

  // Percentage of the current model's context window used last turn.
  const modelCtxK = catalog.find((e) => e.id === session.record.model)?.contextK ?? 128;
  const ctxPct = lastCtx > 0 ? Math.min(100, Math.max(1, Math.round((lastCtx / (modelCtxK * 1000)) * 100))) : 0;

  // Project files for @-mention completion (scanned once per cwd).
  const projectFiles = useMemo(() => listProjectFiles(cwd), [cwd]);
  const [menuDismissed, setMenuDismissed] = useState(false);

  // Derive the active dropdown from the current input (end-anchored). A leading
  // "/" opens the command menu; a trailing "@token" opens the file menu.
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
        // No-arg commands run immediately; ones taking an argument complete and wait.
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

  // Esc interrupts the active turn; Shift+Tab cycles the mode/agent. Editing,
  // menu and history keys live in MultilineInput.
  useInput((_input, key) => {
    if (key.escape && busy) {
      aborted.current = true;
      abortController.current?.abort();
    } else if (key.tab && key.shift && !busy && !permRequest && !modelPickerOpen) {
      cycleMode();
    } else if (key.ctrl && _input === "p" && !busy && !permRequest && !modelPickerOpen) {
      // Command palette: open the "/" menu.
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

  async function runPrompt(text: string, useSession: Session = session) {
    aborted.current = false;
    const controller = new AbortController();
    abortController.current = controller;
    const turnStart = Date.now();
    setBusy(true);
    setStatus("Thinking…");

    const localLive: ViewItem[] = [];
    let assistantIdx: number | null = null;
    const sync = () => setLive([...localLive]);

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
            // Point key/quota errors at the built-in setup flow.
            if (/api key|unauthor|401|403|invalid.*key|quota|rate.?limit|no .*credentials/i.test(event.error)) {
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
      // Commit the finished turn to the static scrollback, timestamping the
      // assistant reply with the wall-clock time and how long it took.
      const dur = fmtDuration(Math.round((Date.now() - turnStart) / 1000));
      const stamped = localLive.map((it) =>
        it.kind === "assistant" ? { ...it, time: now(), dur } : it,
      );
      setHistory((prev) => [...prev, ...stamped]);
      setLive([]);
      setBusy(false);
    }
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
            "Set up a model — pick one (the first two are free):",
            "",
            "  • Google Gemini (free tier): get a key at https://aistudio.google.com/apikey",
            "      then run:  /key google YOUR_KEY",
            "  • Ollama (local, no key, no account): install from https://ollama.com,",
            "      run 'ollama pull llama3.1', then:  /model ollama/llama3.1",
            "  • Anthropic:  /key anthropic sk-ant-…       • OpenAI:  /key openai sk-…",
            "",
            "Keys are saved to your global config; you only do this once.",
          ].join("\n"),
        });
        break;
      case "key": {
        const [rawProv, ...rest] = arg.split(/\s+/);
        const provider = rawProv === "gemini" ? "google" : (rawProv ?? "");
        const value = rest.join(" ").trim();
        if (!["google", "anthropic", "openai"].includes(provider) || !value) {
          pushHistory({ kind: "notice", text: "Usage: /key <google|anthropic|openai> <api-key>" });
          break;
        }
        try {
          saveConfig({ providers: { [provider]: { apiKey: value } } });
          config.providers[provider] = { ...config.providers[provider], apiKey: value };
          forceRender((n) => n + 1);
          pushHistory({ kind: "notice", text: `✓ Saved your ${provider} API key — you're ready to go!` });
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
      case "theme":
        if (arg && themes[arg]) {
          setThemeName(arg);
          try {
            saveConfig({ theme: arg }); // remember it across sessions
          } catch {
            /* config not writable — theme still applies this session */
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
      case "exit":
      case "quit":
        exit();
        break;
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
      // Delegate straight to a fresh sub-agent (keeps the main thread clean).
      const task = text.slice(1).trim();
      if (task) void runSubagent(task);
      return;
    }
    lastPrompt.current = text;
    pushHistory({ kind: "user", text, time: now() });
    void runPrompt(text);
  }

  /** Run a one-off task in a fresh general sub-agent, streamed inline. */
  function runSubagent(task: string) {
    pushHistory({ kind: "user", text: `$ ${task}`, time: now() });
    pushHistory({ kind: "notice", text: "Delegating to a sub-agent…" });
    const sub = Session.create(
      { store, registry: subRegistry, config, permission },
      { cwd, agent: "general" },
    );
    return runPrompt(task, sub);
  }

  // Show the animated hero until a real conversation starts (startup notices
  // don't count). It lives outside <Static> so its starfield can twinkle.
  const conversationEmpty =
    !busy &&
    live.length === 0 &&
    !history.some((h) => h.kind === "user" || h.kind === "assistant");

  // Gate the whole interface behind the trust decision — the "do you trust this
  // folder?" question appears on its own, before the splash and composer.
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

  return (
    <Box flexDirection="column" key={`${session.record.id}:${clearEpoch}`}>
      <Static items={history}>
        {(item, index) => <TranscriptItem key={index} theme={theme} item={item} />}
      </Static>

      {conversationEmpty ? <Hero theme={theme} /> : null}

      {conversationEmpty && !modelReady ? (
        <Box justifyContent="center" marginBottom={1}>
          <Text color={theme.running}>{"⚠  No model set — type "}</Text>
          <Text color={theme.accent} bold>
            /setup
          </Text>
          <Text color={theme.running}>{" to get started (free options)"}</Text>
        </Box>
      ) : null}

      {live.length > 0 ? <Transcript theme={theme} items={live} /> : null}

      {permRequest ? (
        <PermissionModal theme={theme} request={permRequest} onDecision={onDecision} />
      ) : modelPickerOpen ? (
        <ModelPicker
          theme={theme}
          entries={catalog}
          ready={(e) => providerHasKey(e.provider)}
          current={session.record.model}
          onSelect={selectModel}
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
          tokens={tokens}
          lastCtx={lastCtx}
          ctxPct={ctxPct}
          autoApprove={autoApprove}
          version={VERSION}
          ready={modelReady}
        />
      )}
    </Box>
  );
}
