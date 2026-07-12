import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useI18n } from "./i18n";

interface QuickTool {
  id: string;
  label: string;
  command: string;
}

function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    background: v("--bg", "#0C0B0A"),
    foreground: v("--text", "#ECEAE6"),
    cursor: v("--accent", "#FF7A45"),
    cursorAccent: v("--bg", "#0C0B0A"),
    selectionBackground: v("--elev2", "#232019"),
  };
}

export function TerminalPane({
  id,
  cwd,
  hidden,
  themeKey,
}: {
  id: number;
  cwd: string | null;
  hidden: boolean;
  themeKey: string;
}) {
  const { t } = useI18n();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const startedRef = useRef(false);
  const [tools, setTools] = useState<QuickTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exited, setExited] = useState<number | null>(null);

  useEffect(() => {
    const api = window.api?.pty;
    if (!api) {
      setError("unavailable");
      return;
    }
    void api.available().then((r) => {
      if (!r.ok) setError(r.error ?? "unavailable");
    });
    void api.tools().then(setTools);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const api = window.api?.pty;
    if (!host || !api || error || termRef.current) return;

    const mono = getComputedStyle(document.documentElement).getPropertyValue("--mono").trim();
    const term = new Terminal({
      fontFamily: mono || "monospace",
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      theme: readTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;

    const offData = api.onData(id, (data) => term.write(data));
    const offExit = api.onExit(id, (code) => {
      setExited(code);
      startedRef.current = false;
      term.write(`\r\n\x1b[2m${t("term.exited", { code })}\x1b[0m\r\n`);
    });
    const disposeInput = term.onData((data) => api.write(id, data));

    return () => {
      offData();
      offExit();
      disposeInput.dispose();
      api.kill(id);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      startedRef.current = false;
    };
  }, [error, t, id]);

  useEffect(() => {
    if (hidden || error) return;
    const term = termRef.current;
    const fit = fitRef.current;
    const api = window.api?.pty;
    if (!term || !fit || !api) return;

    fit.fit();
    if (!startedRef.current) {
      startedRef.current = true;
      void api.start(id, { cwd, cols: term.cols, rows: term.rows }).then((r) => {
        if (!r.ok) {
          startedRef.current = false;
          setError(r.error);
        } else {
          setExited(null);
          term.focus();
        }
      });
    } else {
      api.resize(id, term.cols, term.rows);
      term.focus();
    }
  }, [hidden, cwd, error, id]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || error) return;
    const observer = new ResizeObserver(() => {
      if (hidden) return;
      const term = termRef.current;
      const fit = fitRef.current;
      if (!term || !fit) return;
      fit.fit();
      window.api?.pty?.resize(id, term.cols, term.rows);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [hidden, error, id]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = readTheme();
  }, [themeKey, hidden]);

  const restart = async (): Promise<boolean> => {
    const term = termRef.current;
    const api = window.api?.pty;
    if (!term || !api) return false;
    startedRef.current = true;
    const r = await api.start(id, { cwd, cols: term.cols, rows: term.rows });
    if (!r.ok) {
      startedRef.current = false;
      setError(r.error);
      return false;
    }
    term.clear();
    setExited(null);
    term.focus();
    return true;
  };

  const run = async (command: string) => {
    if (exited !== null && !(await restart())) return;
    window.api?.pty?.write(id, `${command}\r`);
    termRef.current?.focus();
  };

  return (
    <div className={`term-pane ${hidden ? "hidden" : ""}`}>
      {error ? (
        <div className="term-error">
          <div>{t("term.unavailable")}</div>
          <pre>{error}</pre>
        </div>
      ) : (
        <>
          <div className="term-bar">
            {tools.map((tool) => (
              <button key={tool.id} className="term-chip" onClick={() => void run(tool.command)}>
                {tool.label}
              </button>
            ))}
            <span className="term-spacer" />
            {exited !== null ? (
              <button className="term-chip restart" onClick={() => void restart()}>
                {t("term.restart")}
              </button>
            ) : null}
          </div>
          <div className="term-host" ref={hostRef} />
        </>
      )}
    </div>
  );
}
