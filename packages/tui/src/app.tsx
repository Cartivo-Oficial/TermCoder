import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { useMemo, useRef, useState } from "react";
import { Box, Static, useApp, useInput } from "ink";
import {
  createSubagentTool,
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
import { getTheme } from "./theme";
import type { ViewItem } from "./types";
import { Banner } from "./components/Banner";
import { Composer } from "./components/Composer";
import { PermissionModal } from "./components/PermissionModal";
import { Transcript, TranscriptItem } from "./components/Transcript";

const HELP = [
  "Commands:",
  "  /help              show this help",
  "  /new               start a new session",
  "  /sessions          list saved sessions",
  "  /resume <id>       resume a saved session",
  "  /model [id]        show or set the model (e.g. /model openai/gpt-4o)",
  "  /share             export this session to an HTML file",
  "  /clear             clear the screen",
  "  /exit              quit",
  "",
  "↑/↓ browse input history · esc interrupt a running turn",
].join("\n");

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

export function App({ config, cwd, registry: registryProp, notices }: AppProps) {
  const theme = getTheme(config.theme);
  const { exit } = useApp();

  const [history, setHistory] = useState<ViewItem[]>(() => [
    { kind: "notice", text: "Welcome to termcoder. Type /help for commands." },
    ...(notices ?? []).map((text): ViewItem => ({ kind: "notice", text })),
  ]);
  const [live, setLive] = useState<ViewItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Thinking…");
  const [clearEpoch, setClearEpoch] = useState(0);
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);
  const permResolve = useRef<((decision: PermissionDecision) => void) | null>(null);
  const aborted = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const inputHistory = useRef<string[]>([]);
  const histIndex = useRef(-1);

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

  // Esc interrupts the active turn; ↑/↓ browse input history when idle.
  useInput((_input, key) => {
    if (key.escape && busy) {
      aborted.current = true;
      abortController.current?.abort();
      return;
    }
    if (busy || permRequest) return;
    const h = inputHistory.current;
    if (key.upArrow && h.length > 0) {
      histIndex.current = histIndex.current === -1 ? h.length - 1 : Math.max(0, histIndex.current - 1);
      setInput(h[histIndex.current] ?? "");
    } else if (key.downArrow && histIndex.current !== -1) {
      if (histIndex.current >= h.length - 1) {
        histIndex.current = -1;
        setInput("");
      } else {
        histIndex.current += 1;
        setInput(h[histIndex.current] ?? "");
      }
    }
  });

  function pushHistory(item: ViewItem) {
    setHistory((prev) => [...prev, item]);
  }

  function onDecision(decision: PermissionDecision) {
    setPermRequest(null);
    permResolve.current?.(decision);
    permResolve.current = null;
  }

  async function runPrompt(text: string) {
    aborted.current = false;
    const controller = new AbortController();
    abortController.current = controller;
    setBusy(true);
    setStatus("Thinking…");

    const localLive: ViewItem[] = [];
    let assistantIdx: number | null = null;
    const sync = () => setLive([...localLive]);

    try {
      for await (const event of session.prompt(text, { signal: controller.signal })) {
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
            setStatus(statusFor(event.name));
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
          case "error":
            localLive.push({ kind: "error", text: event.error });
            break;
          case "done":
            break;
        }
        sync();
      }
    } finally {
      // Commit the finished turn to the static scrollback.
      setHistory((prev) => [...prev, ...localLive]);
      setLive([]);
      setBusy(false);
    }
  }

  function handleCommand(text: string) {
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    const arg = rest.join(" ").trim();
    switch (cmd) {
      case "help":
        pushHistory({ kind: "notice", text: HELP });
        break;
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
          session.record.model = arg;
          store.save(session.record);
          pushHistory({ kind: "notice", text: `Model set to ${arg} for this session.` });
        } else {
          pushHistory({ kind: "notice", text: `Model: ${session.record.model}` });
        }
        break;
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
    if (!text) return;
    inputHistory.current.push(text);
    histIndex.current = -1;
    if (text.startsWith("/")) {
      handleCommand(text);
      return;
    }
    pushHistory({ kind: "user", text });
    void runPrompt(text);
  }

  type StaticEntry = { banner: true } | { banner: false; item: ViewItem };
  const staticEntries = useMemo<StaticEntry[]>(
    () => [{ banner: true }, ...history.map((item) => ({ banner: false as const, item }))],
    [history],
  );

  return (
    <Box flexDirection="column" key={`${session.record.id}:${clearEpoch}`}>
      <Static items={staticEntries}>
        {(entry, index) =>
          entry.banner ? (
            <Banner
              key="banner"
              theme={theme}
              model={config.model}
              cwd={cwd}
              sessionId={session.record.id}
            />
          ) : (
            <TranscriptItem key={index} theme={theme} item={entry.item} />
          )
        }
      </Static>

      {live.length > 0 ? <Transcript theme={theme} items={live} /> : null}

      {permRequest ? (
        <PermissionModal theme={theme} request={permRequest} onDecision={onDecision} />
      ) : (
        <Composer
          theme={theme}
          value={input}
          onChange={setInput}
          onSubmit={onSubmit}
          busy={busy}
          disabled={busy}
          status={status}
        />
      )}
    </Box>
  );
}
