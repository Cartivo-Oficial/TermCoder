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
  type Config,
  type PermissionDecision,
  type PermissionRequest,
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
  "  /model             show the active model",
  "  /share             export this session to an HTML file",
  "  /clear             clear the screen",
  "  /exit              quit",
].join("\n");

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

  // Esc interrupts the active turn (the stream is abandoned client-side).
  useInput((_input, key) => {
    if (key.escape && busy) aborted.current = true;
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
    setBusy(true);
    setStatus("Thinking…");

    const localLive: ViewItem[] = [];
    let assistantIdx: number | null = null;
    const sync = () => setLive([...localLive]);

    try {
      for await (const event of session.prompt(text)) {
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
    const [cmd] = text.slice(1).split(/\s+/);
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
        pushHistory({ kind: "notice", text: `Model: ${config.model}` });
        break;
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
