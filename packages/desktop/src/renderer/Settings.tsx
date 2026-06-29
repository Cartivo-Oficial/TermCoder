import { useEffect } from "react";
import { IconClose } from "./Icons";

export type SettingsTab =
  | "general"
  | "appearance"
  | "shortcuts"
  | "servers"
  | "providers"
  | "models"
  | "about";

export interface ServerStatus {
  model: string;
  providers: Array<{ name: string; configured: boolean }>;
  mcp: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
  lsp: Array<{ name: string; ok: boolean; error?: string }>;
  plugins: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
}

interface Props {
  onClose: () => void;
  tab: SettingsTab;
  setTab: (t: SettingsTab) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  model: string;
  defaultModel: string;
  setDefaultModel: (m: string) => void;
  changeModel: (m: string) => void;
  models: string[];
  autoApprove: boolean;
  setAutoApprove: (b: boolean) => void;
  sendOnEnter: boolean;
  setSendOnEnter: (b: boolean) => void;
  expandTools: boolean;
  setExpandTools: (b: boolean) => void;
  progressBar: boolean;
  setProgressBar: (b: boolean) => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  cwd: string | null;
  chooseFolder: () => void;
  serverStatus: ServerStatus | null;
  refreshStatus: () => void;
  port: number;
}

function Switch({ on, onChange }: { on: boolean; onChange: (b: boolean) => void }) {
  return (
    <button className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)} aria-pressed={on}>
      <span className="knob" />
    </button>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="srow">
      <div className="srow-text">
        <div className="srow-title">{title}</div>
        {desc ? <div className="srow-desc">{desc}</div> : null}
      </div>
      <div className="srow-ctl">{children}</div>
    </div>
  );
}

const TABS: Array<{ group: string; items: Array<[SettingsTab, string]> }> = [
  {
    group: "Desktop",
    items: [
      ["general", "General"],
      ["appearance", "Appearance"],
      ["shortcuts", "Shortcuts"],
      ["servers", "Servers"],
    ],
  },
  {
    group: "Model",
    items: [
      ["providers", "Providers"],
      ["models", "Models"],
    ],
  },
];

const TITLES: Record<SettingsTab, string> = {
  general: "General",
  appearance: "Appearance",
  shortcuts: "Shortcuts",
  servers: "Servers",
  providers: "Providers",
  models: "Models",
  about: "About",
};

export function Settings(p: Props) {
  useEffect(() => {
    if (p.tab === "servers" || p.tab === "providers") p.refreshStatus();
  }, [p.tab]);

  return (
    <div className="settings" onClick={p.onClose}>
      <div className="settings-card big" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-nav">
          {TABS.map((g) => (
            <div key={g.group}>
              <div className="sn-group">{g.group}</div>
              {g.items.map(([id, label]) => (
                <button key={id} className={p.tab === id ? "active" : ""} onClick={() => p.setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
          ))}
          <div className="sn-spacer" />
          <button className={p.tab === "about" ? "active" : ""} onClick={() => p.setTab("about")}>
            About
          </button>
        </nav>

        <div className="settings-main">
          <div className="settings-head">
            <span>{TITLES[p.tab]}</span>
            <button className="icon" onClick={p.onClose}><IconClose /></button>
          </div>
          <div className="settings-body">
            {p.tab === "general" && (
              <>
                <Row title="Auto-approve actions" desc="Run tools without asking for permission each time.">
                  <Switch on={p.autoApprove} onChange={p.setAutoApprove} />
                </Row>
                <Row title="Send on Enter" desc="Enter sends; otherwise use Ctrl/Cmd+Enter (Enter adds a newline).">
                  <Switch on={p.sendOnEnter} onChange={p.setSendOnEnter} />
                </Row>
                <Row title="Expand tool details" desc="Show tool diffs and output expanded by default in the timeline.">
                  <Switch on={p.expandTools} onChange={p.setExpandTools} />
                </Row>
                <Row title="Session progress bar" desc="Show an animated bar at the top while the agent is working.">
                  <Switch on={p.progressBar} onChange={p.setProgressBar} />
                </Row>
              </>
            )}

            {p.tab === "appearance" && (
              <>
                <Row title="Theme" desc="Light or dark interface.">
                  <div className="seg">
                    <button className={p.theme === "dark" ? "active" : ""} onClick={() => p.setTheme("dark")}>Dark</button>
                    <button className={p.theme === "light" ? "active" : ""} onClick={() => p.setTheme("light")}>Light</button>
                  </div>
                </Row>
                <Row title="Font size" desc={`Interface text size (${p.fontSize}px).`}>
                  <div className="stepper">
                    <button onClick={() => p.setFontSize(Math.max(11, p.fontSize - 1))}>−</button>
                    <span>{p.fontSize}</span>
                    <button onClick={() => p.setFontSize(Math.min(20, p.fontSize + 1))}>+</button>
                  </div>
                </Row>
              </>
            )}

            {p.tab === "shortcuts" && (
              <div className="shortcuts">
                <div><kbd>Ctrl K</kbd> Command palette</div>
                <div><kbd>Ctrl N</kbd> New session</div>
                <div><kbd>Ctrl B</kbd> Toggle sessions</div>
                <div><kbd>Ctrl J</kbd> Toggle files</div>
                <div><kbd>Ctrl O</kbd> Open folder</div>
                <div><kbd>@</kbd> Mention a file</div>
                <div><kbd>Enter</kbd> Send message</div>
                <div><kbd>Esc</kbd> Close overlays</div>
              </div>
            )}

            {p.tab === "servers" && (
              <>
                <Row title="Local server" desc={`Embedded termcoder server on localhost:${p.port}.`}>
                  <span className="badge ok">running</span>
                </Row>
                <h4 className="sub">MCP servers</h4>
                {p.serverStatus?.mcp.length ? (
                  p.serverStatus.mcp.map((s) => (
                    <Row key={s.name} title={s.name} desc={s.ok ? `${s.toolCount} tools` : s.error}>
                      <span className={`badge ${s.ok ? "ok" : "bad"}`}>{s.ok ? "ok" : "error"}</span>
                    </Row>
                  ))
                ) : (
                  <p className="hint">No MCP servers. Add them under <code>mcp</code> in .termcoder/config.json.</p>
                )}
                <h4 className="sub">Language servers</h4>
                {p.serverStatus?.lsp.length ? (
                  p.serverStatus.lsp.map((s) => (
                    <Row key={s.name} title={s.name} desc={s.ok ? "running" : s.error}>
                      <span className={`badge ${s.ok ? "ok" : "bad"}`}>{s.ok ? "ok" : "error"}</span>
                    </Row>
                  ))
                ) : (
                  <p className="hint">No language servers configured.</p>
                )}
                <h4 className="sub">Plugins</h4>
                {p.serverStatus?.plugins.length ? (
                  p.serverStatus.plugins.map((s) => (
                    <Row key={s.name} title={s.name} desc={s.ok ? `${s.toolCount} tools` : s.error}>
                      <span className={`badge ${s.ok ? "ok" : "bad"}`}>{s.ok ? "ok" : "error"}</span>
                    </Row>
                  ))
                ) : (
                  <p className="hint">No plugins loaded.</p>
                )}
              </>
            )}

            {p.tab === "providers" && (
              <>
                {(p.serverStatus?.providers ?? []).map((pr) => (
                  <Row key={pr.name} title={pr.name} desc={pr.configured ? "Ready" : "No API key configured"}>
                    <span className={`badge ${pr.configured ? "ok" : "muted"}`}>{pr.configured ? "ready" : "not set"}</span>
                  </Row>
                ))}
                <p className="hint">
                  Add API keys under <code>providers</code> in .termcoder/config.json, or set env vars
                  (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY). Ollama runs locally with no key.
                </p>
              </>
            )}

            {p.tab === "models" && (
              <>
                <p className="hint">Pick the model used for new sessions.</p>
                <div className="model-list">
                  {p.models.map((m) => (
                    <button
                      key={m}
                      className={`model-item ${(p.defaultModel || p.model) === m ? "active" : ""}`}
                      onClick={() => {
                        p.setDefaultModel(m);
                        p.changeModel(m);
                      }}
                    >
                      <span>{m}</span>
                      {(p.defaultModel || p.model) === m ? <span className="check">✓</span> : null}
                    </button>
                  ))}
                </div>
              </>
            )}

            {p.tab === "about" && (
              <>
                <Row title="termcoder Desktop" desc="An open-source AI coding agent.">
                  <span className="muted">v0.1.0</span>
                </Row>
                <Row title="Workspace" desc={p.cwd ?? "—"}>
                  <button className="settings-btn" onClick={p.chooseFolder}>Change…</button>
                </Row>
                <Row title="Server" desc={`localhost:${p.port}`}>
                  <span className="badge ok">connected</span>
                </Row>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
