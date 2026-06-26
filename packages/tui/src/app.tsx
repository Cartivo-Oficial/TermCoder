import { useRef, useState } from "react";
import { Box, useApp } from "ink";
import {
  PermissionManager,
  Session,
  SessionStore,
  ToolRegistry,
  type Config,
  type PermissionDecision,
  type PermissionRequest,
} from "@termcoder/core";
import { getTheme } from "./theme";
import type { ViewItem } from "./types";
import { Header } from "./components/Header";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { PermissionModal } from "./components/PermissionModal";

const HELP = [
  "Commands:",
  "  /help              show this help",
  "  /new               start a new session",
  "  /sessions          list saved sessions",
  "  /model             show the active model",
  "  /clear             clear the screen",
  "  /exit              quit",
].join("\n");

interface AppProps {
  config: Config;
  cwd: string;
}

export function App({ config, cwd }: AppProps) {
  const theme = getTheme(config.theme);
  const { exit } = useApp();

  const [items, setItems] = useState<ViewItem[]>([
    { kind: "notice", text: "Welcome to termcoder. Type /help for commands." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [permRequest, setPermRequest] = useState<PermissionRequest | null>(null);
  const permResolve = useRef<((decision: PermissionDecision) => void) | null>(null);

  // Built once; the permission asker bridges the core's promise to the modal.
  const store = useRef(new SessionStore()).current;
  const registry = useRef(new ToolRegistry()).current;
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

  const [session, setSession] = useState<Session>(() =>
    Session.create({ store, registry, config, permission }, { cwd }),
  );

  const push = (item: ViewItem) => setItems((prev) => [...prev, item]);

  function onDecision(decision: PermissionDecision) {
    setPermRequest(null);
    permResolve.current?.(decision);
    permResolve.current = null;
  }

  async function runPrompt(text: string) {
    setBusy(true);
    let assistantIdx: number | null = null;
    for await (const event of session.prompt(text)) {
      setItems((prev) => {
        const next = [...prev];
        switch (event.type) {
          case "text-delta": {
            if (assistantIdx === null) {
              next.push({ kind: "assistant", text: event.text });
              assistantIdx = next.length - 1;
            } else {
              const cur = next[assistantIdx];
              if (cur?.kind === "assistant") {
                next[assistantIdx] = { ...cur, text: cur.text + event.text };
              }
            }
            break;
          }
          case "tool-call": {
            assistantIdx = null;
            next.push({
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
            const idx = next.findIndex((it) => it.kind === "tool" && it.id === event.id);
            const t = idx >= 0 ? next[idx] : undefined;
            if (t?.kind === "tool") {
              next[idx] = {
                ...t,
                status: event.isError ? "error" : "done",
                output: event.output,
              };
            }
            break;
          }
          case "error":
            next.push({ kind: "error", text: event.error });
            break;
          case "done":
            break;
        }
        return next;
      });
    }
    setBusy(false);
  }

  function handleCommand(text: string) {
    const [cmd] = text.slice(1).split(/\s+/);
    switch (cmd) {
      case "help":
        push({ kind: "notice", text: HELP });
        break;
      case "clear":
        setItems([]);
        break;
      case "new": {
        const fresh = Session.create({ store, registry, config, permission }, { cwd });
        setSession(fresh);
        setItems([{ kind: "notice", text: "Started a new session." }]);
        break;
      }
      case "sessions": {
        const list = store.list().slice(0, 10);
        const lines = list.length
          ? list
              .map((s) => `  ${s.id.slice(0, 8)}  ${s.messageCount} msgs  ${s.title}`)
              .join("\n")
          : "  (no saved sessions)";
        push({ kind: "notice", text: `Sessions:\n${lines}` });
        break;
      }
      case "model":
        push({ kind: "notice", text: `Model: ${config.model}` });
        break;
      case "exit":
      case "quit":
        exit();
        break;
      default:
        push({ kind: "notice", text: `Unknown command: /${cmd} (try /help)` });
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
    push({ kind: "user", text });
    void runPrompt(text);
  }

  return (
    <Box flexDirection="column">
      <Header theme={theme} model={config.model} cwd={cwd} sessionId={session.record.id} />
      <Transcript theme={theme} items={items} />
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
        />
      )}
    </Box>
  );
}
