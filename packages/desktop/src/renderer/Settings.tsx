import { useEffect, useState } from "react";
import { IconClose } from "./Icons";
import { LANGS, useI18n } from "./i18n";
import { COLOR_THEMES } from "./themes";
import { EDITOR_THEMES } from "./editorThemes";
import { KEYBIND_ACTIONS, comboFor, comboFromEvent, formatCombo } from "./keybinds";

type PermMode = "ask" | "allow" | "deny";
interface McpEntry {
  type: "stdio" | "http";
  enabled?: boolean;
  command?: string;
  args?: string[];
  url?: string;
}
interface LiveConfig {
  permission: { bash: PermMode; write: PermMode; edit: PermMode; mcp: PermMode };
  providers: Record<string, { hasKey: boolean; baseURL?: string }>;
  mcp: Record<string, McpEntry>;
  formatter?: boolean | Record<string, unknown>;
  github?: { hasToken: boolean };
  context?: { maxToolOutputChars: number; keepRecentToolResults: number };
}
interface MicDevice {
  deviceId: string;
  label: string;
}

interface AuthMethodInfo {
  id: string;
  label: string;
  available: boolean;
  hint?: string;
}
interface ProviderAuthInfo {
  provider: string;
  label: string;
  configured: boolean;
  methods: AuthMethodInfo[];
  keyUrl?: string;
  freeTier?: string;
  health?: "ok" | "bad" | "unknown";
}
interface ConnectorInput {
  key: string;
  label: string;
  kind: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
}
interface Connector {
  id: string;
  name: string;
  description: string;
  category: string;
  transport: string;
  runtime?: string;
  inputs?: ConnectorInput[];
  docsUrl?: string;
}

export type SettingsTab =
  | "general"
  | "appearance"
  | "shortcuts"
  | "servers"
  | "sessions"
  | "permissions"
  | "voice"
  | "files"
  | "integrations"
  | "automations"
  | "providers"
  | "models"
  | "agents"
  | "skills"
  | "memory"
  | "behavior"
  | "about";

export interface ServerStatus {
  model: string;
  providers: Array<{ name: string; configured: boolean }>;
  mcp: Array<{ name: string; ok: boolean; toolCount: number; error?: string; connected?: boolean; reconnects?: number }>;
  lsp: Array<{ name: string; ok: boolean; error?: string }>;
  plugins: Array<{ name: string; ok: boolean; toolCount: number; error?: string }>;
}

interface Props {
  onClose: () => void;
  tab: SettingsTab;
  setTab: (t: SettingsTab) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  colorTheme: string;
  setColorTheme: (id: string) => void;
  studentMode: boolean;
  setStudentMode: (v: boolean) => void;
  keybinds: Record<string, string>;
  setKeybinds: (k: Record<string, string>) => void;
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
  accent: string;
  setAccent: (c: string) => void;
  density: "comfortable" | "compact";
  setDensity: (d: "comfortable" | "compact") => void;
  reduceMotion: boolean;
  setReduceMotion: (b: boolean) => void;
  autoScroll: boolean;
  setAutoScroll: (b: boolean) => void;
  confirmDelete: boolean;
  setConfirmDelete: (b: boolean) => void;
  temperature: number;
  setTemperature: (n: number) => void;
  maxSteps: number;
  setMaxSteps: (n: number) => void;
  soundOnFinish: boolean;
  setSoundOnFinish: (b: boolean) => void;
  micDeviceId: string;
  setMicDeviceId: (s: string) => void;
  wordWrap: boolean;
  setWordWrap: (b: boolean) => void;
  aiSuggest: boolean;
  setAiSuggest: (b: boolean) => void;
  codeTheme: string;
  setCodeTheme: (id: string) => void;
  notifyOnFinish: boolean;
  setNotifyOnFinish: (b: boolean) => void;
  autoCommit: boolean;
  setAutoCommit: (b: boolean) => void;
  openAtLogin: boolean;
  setOpenAtLogin: (b: boolean) => void;
  enableTray: boolean;
  setEnableTray: (b: boolean) => void;
  enableHotkey: boolean;
  setEnableHotkey: (b: boolean) => void;
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

function MemoryAdd({
  onAdd,
  t,
}: {
  onAdd: (scope: string, name: string, description: string, body: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [scope, setScope] = useState<"project" | "user">("project");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  return (
    <div className="agent-form">
      <select className="lang-select" value={scope} onChange={(e) => setScope(e.target.value as "project" | "user")}>
        <option value="project">{t("settings.memory.scopeProject")}</option>
        <option value="user">{t("settings.memory.scopeUser")}</option>
      </select>
      <input
        className="settings-input"
        placeholder={t("settings.memory.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="settings-input"
        placeholder={t("settings.memory.desc")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="settings-input agent-prompt"
        placeholder={t("settings.memory.body")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button
        className="settings-btn"
        disabled={!name.trim() || !body.trim()}
        onClick={() => {
          onAdd(scope, name.trim(), description.trim(), body.trim());
          setName("");
          setDescription("");
          setBody("");
        }}
      >
        {t("settings.memory.create")}
      </button>
    </div>
  );
}

const ACCENTS = ["#FF7A45", "#4f8cff", "#4ade80", "#b794f6", "#f59e0b", "#f87171"];

const TABS: Array<{ groupKey: string; items: Array<[SettingsTab, string]> }> = [
  {
    groupKey: "settings.group.desktop",
    items: [
      ["general", "settings.general"],
      ["appearance", "settings.appearance"],
      ["shortcuts", "settings.shortcuts"],
      ["servers", "settings.servers"],
    ],
  },
  {
    groupKey: "settings.group.workspace",
    items: [
      ["sessions", "settings.sessions"],
      ["permissions", "settings.permissions"],
      ["voice", "settings.voice"],
      ["files", "settings.files"],
      ["integrations", "settings.integrations"],
      ["automations", "settings.automations"],
    ],
  },
  {
    groupKey: "settings.group.model",
    items: [
      ["providers", "settings.providers"],
      ["models", "settings.models"],
      ["agents", "settings.agents"],
      ["skills", "settings.skills"],
      ["memory", "settings.memory"],
      ["behavior", "settings.behavior"],
    ],
  },
];

const TITLE_KEYS: Record<SettingsTab, string> = {
  general: "settings.general",
  appearance: "settings.appearance",
  shortcuts: "settings.shortcuts",
  servers: "settings.servers",
  sessions: "settings.sessions",
  permissions: "settings.permissions",
  voice: "settings.voice",
  files: "settings.files",
  integrations: "settings.integrations",
  automations: "settings.automations",
  providers: "settings.providers",
  models: "settings.models",
  agents: "settings.agents",
  skills: "settings.skills",
  memory: "settings.memory",
  behavior: "settings.behavior",
  about: "settings.about",
};

export function Settings(p: Props) {
  const { t, lang, setLang } = useI18n();
  const httpBase = `http://localhost:${p.port}`;
  const [cfg, setCfg] = useState<LiveConfig | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [connectFor, setConnectFor] = useState<string | null>(null);
  const [providerAuth, setProviderAuth] = useState<ProviderAuthInfo[]>([]);
  const [probeState, setProbeState] = useState<Record<string, { busy?: boolean; ok?: boolean; error?: string }>>({});
  const [claudeUrl, setClaudeUrl] = useState<string | null>(null);
  const [claudeCode, setClaudeCode] = useState("");
  const [claudeBusy, setClaudeBusy] = useState(false);
  const [claudeResult, setClaudeResult] = useState<"ok" | string | null>(null);
  const [chatgptCode, setChatgptCode] = useState<{ userCode: string; url: string } | null>(null);
  const [chatgptStatus, setChatgptStatus] = useState<string | null>(null);
  const [chatgptBusy, setChatgptBusy] = useState(false);

  useEffect(() => {
    if (!chatgptCode) return;
    const id = setInterval(async () => {
      try {
        const s = await fetch(`${httpBase}/auth/chatgpt/status`).then((x) => x.json() as Promise<{ state: string; error?: string }>);
        setChatgptStatus(s.state);
        if (s.state === "connected") {
          clearInterval(id);
          loadProviderAuth();
          p.refreshStatus();
        }
        if (s.state === "failed") clearInterval(id);
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [chatgptCode]);

  function loadProviderAuth() {
    fetch(`${httpBase}/providers`)
      .then((r) => r.json())
      .then((d) => setProviderAuth(Array.isArray(d) ? (d as ProviderAuthInfo[]) : []))
      .catch(() => {});
  }

  async function testProvider(name: string) {
    setProbeState((s) => ({ ...s, [name]: { busy: true } }));
    try {
      const r = await fetch(`${httpBase}/providers/probe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: name }),
      }).then((x) => x.json() as Promise<{ ok: boolean; error?: string }>);
      setProbeState((s) => ({ ...s, [name]: { ok: r.ok, error: r.error } }));
    } catch {
      setProbeState((s) => ({ ...s, [name]: { ok: false, error: "server unreachable" } }));
    }
  }
  const [githubDraft, setGithubDraft] = useState("");
  const [savingGithub, setSavingGithub] = useState(false);
  const [ghStatus, setGhStatus] = useState<string>("");
  const [packRef, setPackRef] = useState("");
  const [packMsg, setPackMsg] = useState<string>("");

  async function testGitHub() {
    setGhStatus("Checking…");
    try {
      const res = await fetch(`${httpBase}/github`);
      const data = (await res.json()) as { user?: { login: string }; error?: string };
      setGhStatus(res.ok && data.user ? `Connected as ${data.user.login}` : data.error ?? "Not connected");
    } catch (err) {
      setGhStatus(String(err));
    }
  }

  async function packAction(body: Record<string, unknown>) {
    setPackMsg("Working…");
    try {
      const res = await fetch(`${httpBase}/packs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { url?: string; manifest?: { name: string }; written?: string[]; error?: string };
      if (!res.ok) setPackMsg(data.error ?? "Failed");
      else if (data.url) setPackMsg(`Published: ${data.url}`);
      else setPackMsg(`Installed "${data.manifest?.name}" (${data.written?.length ?? 0} files)`);
    } catch (err) {
      setPackMsg(String(err));
    }
  }
  const [recording, setRecording] = useState<string | null>(null);
  const [mics, setMics] = useState<MicDevice[]>([]);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [agentList, setAgentList] = useState<
    Array<{ name: string; description?: string; builtin: boolean; readOnly: boolean }>
  >([]);
  const [newAgent, setNewAgent] = useState({ name: "", description: "", model: "", prompt: "", readOnly: false, editPaths: "" });

  function loadAgents() {
    fetch(`${httpBase}/agents`)
      .then((r) => r.json())
      .then((list) => setAgentList(Array.isArray(list) ? list : []))
      .catch(() => {});
  }
  async function createAgent() {
    if (!newAgent.name.trim()) return;
    const editPaths = newAgent.editPaths
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    await fetch(`${httpBase}/agents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...newAgent, editPaths }),
    }).catch(() => {});
    setNewAgent({ name: "", description: "", model: "", prompt: "", readOnly: false, editPaths: "" });
    loadAgents();
  }
  async function deleteAgent(name: string) {
    await fetch(`${httpBase}/agents/${name}`, { method: "DELETE" }).catch(() => {});
    loadAgents();
  }

  const [skillList, setSkillList] = useState<
    Array<{ name: string; description: string; source: string }>
  >([]);
  const [newSkill, setNewSkill] = useState({ name: "", description: "", body: "" });
  function loadSkills() {
    fetch(`${httpBase}/skills`)
      .then((r) => r.json())
      .then((list) => setSkillList(Array.isArray(list) ? list : []))
      .catch(() => {});
  }
  async function createSkill() {
    if (!newSkill.name.trim() || !newSkill.body.trim()) return;
    await fetch(`${httpBase}/skills`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newSkill),
    }).catch(() => {});
    setNewSkill({ name: "", description: "", body: "" });
    loadSkills();
  }
  async function deleteSkill(name: string) {
    await fetch(`${httpBase}/skills/${name}`, { method: "DELETE" }).catch(() => {});
    loadSkills();
  }

  const [memories, setMemories] = useState<
    Array<{ name: string; description: string; type: string; scope: string; body: string }>
  >([]);
  function loadMemories() {
    fetch(`${httpBase}/memory`)
      .then((r) => r.json())
      .then((d) => setMemories(Array.isArray(d?.memories) ? d.memories : []))
      .catch(() => {});
  }
  async function addMemory(scope: string, name: string, description: string, body: string) {
    await fetch(`${httpBase}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, name, description, body, type: scope === "user" ? "preference" : "project" }),
    }).catch(() => {});
    loadMemories();
  }
  async function delMemory(name: string) {
    await fetch(`${httpBase}/memory/${encodeURIComponent(name)}`, { method: "DELETE" }).catch(() => {});
    loadMemories();
  }

  const [mcpName, setMcpName] = useState("");
  const [mcpType, setMcpType] = useState<"stdio" | "http">("stdio");
  const [mcpCommand, setMcpCommand] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [pickedConnector, setPickedConnector] = useState<string | null>(null);
  const [connectorValues, setConnectorValues] = useState<Record<string, string>>({});

  function loadConnectors() {
    if (connectors.length) return;
    fetch(`${httpBase}/connectors`)
      .then((r) => r.json())
      .then((d) => setConnectors(Array.isArray(d?.connectors) ? (d.connectors as Connector[]) : []))
      .catch(() => {});
  }

  function loadConfig() {
    fetch(`${httpBase}/config`)
      .then((r) => r.json())
      .then(setCfg)
      .catch(() => {});
  }
  async function patchConfig(partial: Record<string, unknown>) {
    try {
      await fetch(`${httpBase}/config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(partial),
      });
    } catch {
    }
    loadConfig();
    p.refreshStatus();
  }

  function setKeybind(id: string, combo: string) {
    const next = { ...p.keybinds, [id]: combo };
    p.setKeybinds(next);
    void patchConfig({ keybinds: { [id]: combo } });
  }

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRecording(null);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo) return; // bare modifier — keep waiting
      e.preventDefault();
      setKeybind(recording, combo);
      setRecording(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  useEffect(() => {
    if (p.tab === "servers" || p.tab === "providers") p.refreshStatus();
    if (p.tab === "providers") loadProviderAuth();
    if (p.tab === "permissions" || p.tab === "providers" || p.tab === "integrations" || p.tab === "files" || p.tab === "behavior") loadConfig();
    if (p.tab === "integrations") loadConnectors();
    if (p.tab === "agents") loadAgents();
    if (p.tab === "skills") loadSkills();
    if (p.tab === "memory") loadMemories();
    if (p.tab === "sessions") {
      fetch(`${httpBase}/sessions`)
        .then((r) => r.json())
        .then((list: unknown[]) => setSessionCount(Array.isArray(list) ? list.length : 0))
        .catch(() => {});
    }
    if (p.tab === "voice") {
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then((ds) =>
          setMics(
            ds
              .filter((d) => d.kind === "audioinput")
              .map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" })),
          ),
        )
        .catch(() => {});
    }
  }, [p.tab]);

  async function clearOldSessions() {
    try {
      const list = (await (await fetch(`${httpBase}/sessions`)).json()) as Array<{
        id: string;
        updatedAt: number;
      }>;
      const cutoff = Date.now() - retentionDays * 86400_000;
      const old = list.filter((s) => s.updatedAt < cutoff);
      await Promise.all(
        old.map((s) => fetch(`${httpBase}/sessions/${s.id}`, { method: "DELETE" })),
      );
      setSessionCount(list.length - old.length);
    } catch {
    }
  }

  async function addMcp() {
    const name = mcpName.trim();
    if (!name) return;
    const payload =
      mcpType === "http"
        ? { name, type: "http", url: mcpUrl.trim() }
        : { name, type: "stdio", command: mcpCommand.trim(), args: [] };
    try {
      await fetch(`${httpBase}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
    }
    setMcpName("");
    setMcpCommand("");
    setMcpUrl("");
    loadConfig();
  }
  async function addConnector(c: Connector) {
    const missing = (c.inputs ?? []).filter((i) => i.required && !((connectorValues[i.key] ?? "").trim()));
    if (missing.length) return;
    try {
      await fetch(`${httpBase}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectorId: c.id, values: connectorValues }),
      });
    } catch {
    }
    setPickedConnector(null);
    setConnectorValues({});
    loadConfig();
  }
  async function toggleMcp(name: string) {
    try {
      await fetch(`${httpBase}/mcp/${encodeURIComponent(name)}/toggle`, { method: "POST" });
    } catch {
    }
    loadConfig();
  }
  async function deleteMcp(name: string) {
    try {
      await fetch(`${httpBase}/mcp/${encodeURIComponent(name)}`, { method: "DELETE" });
    } catch {
    }
    loadConfig();
  }

  const PERM_KINDS: Array<["bash" | "write" | "edit" | "mcp", string]> = [
    ["write", "settings.perm.write"],
    ["edit", "settings.perm.edit"],
    ["bash", "settings.perm.bash"],
    ["mcp", "settings.perm.mcp"],
  ];
  return (
    <div className="settings" onClick={p.onClose}>
      <div className="settings-card big" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-nav">
          {TABS.map((g) => (
            <div key={g.groupKey}>
              <div className="sn-group">{t(g.groupKey)}</div>
              {g.items.map(([id, labelKey]) => (
                <button key={id} className={p.tab === id ? "active" : ""} onClick={() => p.setTab(id)}>
                  {t(labelKey)}
                </button>
              ))}
            </div>
          ))}
          <div className="sn-spacer" />
          <button className={p.tab === "about" ? "active" : ""} onClick={() => p.setTab("about")}>
            {t("settings.about")}
          </button>
        </nav>

        <div className="settings-main">
          <div className="settings-head">
            <span>{t(TITLE_KEYS[p.tab])}</span>
            <button className="icon" onClick={p.onClose}><IconClose /></button>
          </div>
          <div className="settings-body">
           <div className="tab-pane" key={p.tab}>
            {p.tab === "general" && (
              <>
                <Row title={t("settings.studentMode")} desc={t("settings.studentMode.desc")}>
                  <Switch on={p.studentMode} onChange={p.setStudentMode} />
                </Row>
                <Row title={t("settings.autoApprove")} desc={t("settings.autoApprove.desc")}>
                  <Switch on={p.autoApprove} onChange={p.setAutoApprove} />
                </Row>
                <Row title={t("settings.sendOnEnter")} desc={t("settings.sendOnEnter.desc")}>
                  <Switch on={p.sendOnEnter} onChange={p.setSendOnEnter} />
                </Row>
                <Row title={t("settings.progress")} desc={t("settings.progress.desc")}>
                  <Switch on={p.progressBar} onChange={p.setProgressBar} />
                </Row>
                <Row title={t("settings.autoScroll")} desc={t("settings.autoScroll.desc")}>
                  <Switch on={p.autoScroll} onChange={p.setAutoScroll} />
                </Row>
                <Row title={t("settings.confirmDelete")} desc={t("settings.confirmDelete.desc")}>
                  <Switch on={p.confirmDelete} onChange={p.setConfirmDelete} />
                </Row>
              </>
            )}

            {p.tab === "appearance" && (
              <>
                <Row title={t("settings.colorTheme")} desc={t("settings.colorTheme.desc")}>
                  <div className="theme-grid">
                    {COLOR_THEMES.map((ct) => (
                      <button
                        key={ct.id}
                        className={`theme-swatch ${p.colorTheme === ct.id ? "active" : ""}`}
                        title={ct.name}
                        onClick={() => {
                          p.setColorTheme(ct.id);
                          p.setAccent(ct.accent);
                          if (ct.id !== "default") p.setTheme(ct.dark ? "dark" : "light");
                        }}
                        style={{
                          background: ct.vars["--panel"] ?? (ct.dark ? "#100F0D" : "#f2f0ea"),
                          borderColor: p.colorTheme === ct.id ? ct.accent : "var(--border)",
                        }}
                      >
                        <span className="theme-dot" style={{ background: ct.accent }} />
                        <span className="theme-name" style={{ color: ct.vars["--text"] ?? (ct.dark ? "#ECEAE6" : "#20201c") }}>{ct.name}</span>
                      </button>
                    ))}
                  </div>
                </Row>
                {p.colorTheme === "default" ? (
                  <Row title={t("settings.theme")} desc={t("settings.theme.desc")}>
                    <div className="seg">
                      <button className={p.theme === "dark" ? "active" : ""} onClick={() => p.setTheme("dark")}>{t("settings.dark")}</button>
                      <button className={p.theme === "light" ? "active" : ""} onClick={() => p.setTheme("light")}>{t("settings.light")}</button>
                    </div>
                  </Row>
                ) : null}
                <Row title={t("settings.accent")} desc={t("settings.accent.desc")}>
                  <div className="swatches">
                    {ACCENTS.map((c) => (
                      <button
                        key={c}
                        className={`swatch ${p.accent.toLowerCase() === c ? "active" : ""}`}
                        style={{ background: c }}
                        onClick={() => p.setAccent(c)}
                        aria-label={c}
                      />
                    ))}
                    <input
                      type="color"
                      className="swatch-pick"
                      value={p.accent}
                      onChange={(e) => p.setAccent(e.target.value)}
                      title={t("settings.accent.custom")}
                    />
                  </div>
                </Row>
                <Row title={t("settings.density")} desc={t("settings.density.desc")}>
                  <div className="seg">
                    <button className={p.density === "comfortable" ? "active" : ""} onClick={() => p.setDensity("comfortable")}>{t("settings.comfortable")}</button>
                    <button className={p.density === "compact" ? "active" : ""} onClick={() => p.setDensity("compact")}>{t("settings.compact")}</button>
                  </div>
                </Row>
                <Row title={t("settings.reduceMotion")} desc={t("settings.reduceMotion.desc")}>
                  <Switch on={p.reduceMotion} onChange={p.setReduceMotion} />
                </Row>
                <Row title={t("settings.language")} desc={t("settings.language.desc")}>
                  <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
                    {LANGS.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </Row>
                <Row title={t("settings.fontSize")} desc={t("settings.fontSize.desc", { n: p.fontSize })}>
                  <div className="stepper">
                    <button onClick={() => p.setFontSize(Math.max(11, p.fontSize - 1))}>−</button>
                    <span>{p.fontSize}</span>
                    <button onClick={() => p.setFontSize(Math.min(20, p.fontSize + 1))}>+</button>
                  </div>
                </Row>
              </>
            )}

            {p.tab === "shortcuts" && (
              <>
                <p className="hint">{t("settings.shortcuts.hint")}</p>
                {KEYBIND_ACTIONS.map((action) => {
                  const combo = comboFor(p.keybinds, action);
                  const isDefault = combo === action.default;
                  return (
                    <Row key={action.id} title={t(action.labelKey)} desc={t("keybind.default", { combo: formatCombo(action.default) })}>
                      <div className="keybind-edit">
                        <button
                          className={`kbd-btn${recording === action.id ? " recording" : ""}`}
                          onClick={() => setRecording((r) => (r === action.id ? null : action.id))}
                        >
                          {recording === action.id ? t("keybind.recording") : formatCombo(combo)}
                        </button>
                        {!isDefault && (
                          <button
                            className="settings-btn ghost"
                            title={t("keybind.reset")}
                            onClick={() => setKeybind(action.id, action.default)}
                          >
                            ↺
                          </button>
                        )}
                      </div>
                    </Row>
                  );
                })}
                <div className="shortcuts fixed">
                  <div><kbd>@</kbd> {t("keybind.mention")}</div>
                  <div><kbd>Enter</kbd> {t("keybind.send")}</div>
                  <div><kbd>Esc</kbd> {t("keybind.close")}</div>
                </div>
              </>
            )}

            {p.tab === "servers" && (
              <>
                <Row title={t("settings.localServer")} desc={t("settings.localServer.desc", { port: p.port })}>
                  <span className="badge ok">{t("servers.running")}</span>
                </Row>
                <h4 className="sub eyebrow">{t("settings.mcpServers")}</h4>
                {p.serverStatus?.mcp.length ? (
                  p.serverStatus.mcp.map((s) => (
                    <Row key={s.name} title={s.name} desc={s.ok ? `${s.toolCount} tools` : s.error}>
                      <span className={`badge ${s.ok ? "ok" : "bad"}`}>{s.ok ? t("badge.ok") : t("badge.error")}</span>
                    </Row>
                  ))
                ) : (
                  <p className="hint">{t("settings.noMcp")}</p>
                )}
                <h4 className="sub eyebrow">{t("settings.languageServers")}</h4>
                {p.serverStatus?.lsp.length ? (
                  p.serverStatus.lsp.map((s) => (
                    <Row key={s.name} title={s.name} desc={s.ok ? t("servers.running") : s.error}>
                      <span className={`badge ${s.ok ? "ok" : "bad"}`}>{s.ok ? t("badge.ok") : t("badge.error")}</span>
                    </Row>
                  ))
                ) : (
                  <p className="hint">{t("settings.noLsp")}</p>
                )}
                <h4 className="sub eyebrow">{t("settings.plugins")}</h4>
                {p.serverStatus?.plugins.length ? (
                  p.serverStatus.plugins.map((s) => (
                    <Row key={s.name} title={s.name} desc={s.ok ? `${s.toolCount} tools` : s.error}>
                      <span className={`badge ${s.ok ? "ok" : "bad"}`}>{s.ok ? t("badge.ok") : t("badge.error")}</span>
                    </Row>
                  ))
                ) : (
                  <p className="hint">{t("settings.noPlugins")}</p>
                )}
              </>
            )}

            {p.tab === "sessions" && (
              <>
                <Row
                  title={t("settings.retention")}
                  desc={t("settings.retention.desc")}
                >
                  <div className="stepper">
                    <button onClick={() => setRetentionDays(Math.max(1, retentionDays - 1))}>−</button>
                    <span>{retentionDays}</span>
                    <button onClick={() => setRetentionDays(Math.min(365, retentionDays + 1))}>+</button>
                  </div>
                </Row>
                <Row title={t("settings.retention.run")} desc={sessionCount === null ? "—" : t("settings.sessionCount", { n: sessionCount })}>
                  <button className="settings-btn" onClick={() => void clearOldSessions()}>{t("settings.retention.btn")}</button>
                </Row>
                <Row title={t("settings.autoTitles")} desc={t("settings.autoTitles.desc")}>
                  <span className="badge ok">{t("badge.on")}</span>
                </Row>
                <Row title={t("settings.github")} desc={t("settings.github.desc")}>
                  <div className="provider-key">
                    <input
                      type="password"
                      className="settings-input"
                      placeholder={cfg?.github?.hasToken ? "••••••••" : "ghp_…"}
                      value={githubDraft}
                      onChange={(e) => setGithubDraft(e.target.value)}
                    />
                    <button
                      className="settings-btn"
                      disabled={!githubDraft.trim() || savingGithub}
                      onClick={async () => {
                        setSavingGithub(true);
                        await patchConfig({ github: { token: githubDraft.trim() } });
                        setGithubDraft("");
                        setSavingGithub(false);
                        void testGitHub();
                      }}
                    >
                      {savingGithub ? t("settings.saving") : t("settings.save")}
                    </button>
                    <button className="settings-btn" onClick={() => void testGitHub()}>
                      Test connection
                    </button>
                  </div>
                </Row>
                {ghStatus && (
                  <Row title="GitHub status" desc="Whether your token works (needs the gist scope).">
                    <span className={`badge ${ghStatus.startsWith("Connected") ? "ok" : ""}`}>{ghStatus}</span>
                  </Row>
                )}
                <Row title="Packs" desc="Share this project's agents, skills, and commands — or install someone's.">
                  <div className="provider-key" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                    <div className="provider-key">
                      <input
                        className="settings-input"
                        placeholder="gist id/URL or owner/repo"
                        value={packRef}
                        onChange={(e) => setPackRef(e.target.value)}
                      />
                      <button
                        className="settings-btn"
                        disabled={!packRef.trim()}
                        onClick={() => void packAction({ action: "install", ref: packRef.trim() })}
                      >
                        Install
                      </button>
                    </div>
                    <button className="settings-btn" onClick={() => void packAction({ action: "publish", name: "my-termcoder-pack" })}>
                      Publish this project as a pack
                    </button>
                    {packMsg && <span className="hint">{packMsg}</span>}
                  </div>
                </Row>
              </>
            )}

            {p.tab === "permissions" && (
              <>
                <p className="hint">{t("settings.permissions.hint")}</p>
                {PERM_KINDS.map(([kind, labelKey]) => {
                  const val = cfg?.permission?.[kind] ?? "ask";
                  return (
                    <Row key={kind} title={t(labelKey)} desc={t(`settings.perm.${kind}.desc`)}>
                      <div className="seg">
                        {(["ask", "allow", "deny"] as PermMode[]).map((m) => (
                          <button
                            key={m}
                            className={val === m ? "active" : ""}
                            onClick={() => void patchConfig({ permission: { [kind]: m } })}
                          >
                            {t(`settings.perm.${m}`)}
                          </button>
                        ))}
                      </div>
                    </Row>
                  );
                })}
                <p className="hint">{t("settings.privacy.note")}</p>
              </>
            )}

            {p.tab === "voice" && (
              <>
                <Row title={t("settings.micDevice")} desc={t("settings.micDevice.desc")}>
                  <select
                    className="lang-select"
                    value={p.micDeviceId}
                    onChange={(e) => p.setMicDeviceId(e.target.value)}
                  >
                    <option value="">{t("settings.micDefault")}</option>
                    {mics.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                    ))}
                  </select>
                </Row>
                <Row title={t("settings.soundOnFinish")} desc={t("settings.soundOnFinish.desc")}>
                  <Switch on={p.soundOnFinish} onChange={p.setSoundOnFinish} />
                </Row>
                <p className="hint">{t("settings.voice.hint")}</p>
              </>
            )}

            {p.tab === "files" && (
              <>
                <Row title={t("settings.formatter")} desc={t("settings.formatter.desc")}>
                  <Switch
                    on={cfg?.formatter === true || (typeof cfg?.formatter === "object" && cfg?.formatter !== null)}
                    onChange={(v) => void patchConfig({ formatter: v })}
                  />
                </Row>
                <Row title={t("settings.wordWrap")} desc={t("settings.wordWrap.desc")}>
                  <Switch on={p.wordWrap} onChange={p.setWordWrap} />
                </Row>
                <Row title={t("settings.aiSuggest")} desc={t("settings.aiSuggest.desc")}>
                  <Switch on={p.aiSuggest} onChange={p.setAiSuggest} />
                </Row>
                <Row title={t("settings.codeTheme")} desc={t("settings.codeTheme.desc")}>
                  <select className="lang-select" value={p.codeTheme} onChange={(e) => p.setCodeTheme(e.target.value)}>
                    {EDITOR_THEMES.map((th) => (
                      <option key={th.id} value={th.id}>{th.name}</option>
                    ))}
                  </select>
                </Row>
                <Row title={t("settings.expandTools")} desc={t("settings.expandTools.desc")}>
                  <Switch on={p.expandTools} onChange={p.setExpandTools} />
                </Row>
                <Row title={t("settings.workspace")} desc={p.cwd ?? "—"}>
                  <button className="settings-btn" onClick={p.chooseFolder}>{t("settings.change")}</button>
                </Row>
              </>
            )}

            {p.tab === "integrations" && (
              <>
                <p className="hint">{t("settings.integrations.hint")}</p>
                {Object.entries(cfg?.mcp ?? {}).map(([name, s]) => (
                  <Row
                    key={name}
                    title={name}
                    desc={s.type === "http" ? s.url : `${s.command ?? ""} ${(s.args ?? []).join(" ")}`.trim()}
                  >
                    <div className="seg-inline">
                      <Switch on={s.enabled !== false} onChange={() => void toggleMcp(name)} />
                      <button className="icon sm" title={t("settings.remove")} onClick={() => void deleteMcp(name)}>
                        <IconClose />
                      </button>
                    </div>
                  </Row>
                ))}
                {Object.keys(cfg?.mcp ?? {}).length === 0 ? <p className="hint">{t("settings.noMcpYet")}</p> : null}
                <h4 className="sub eyebrow">{t("settings.connectors")}</h4>
                <div className="connector-grid">
                  {connectors.map((c) => (
                    <div key={c.id} className={`connector-card ${pickedConnector === c.id ? "on" : ""}`}>
                      <button
                        className="connector-head"
                        onClick={() => {
                          setPickedConnector(pickedConnector === c.id ? null : c.id);
                          setConnectorValues({});
                        }}
                      >
                        <span className="connector-name">{c.name}</span>
                        {c.runtime ? <span className="connector-meta">{c.runtime}</span> : null}
                      </button>
                      <p className="connector-desc">{c.description}</p>
                      {pickedConnector === c.id ? (
                        <div className="connector-form">
                          {(c.inputs ?? []).map((i) => (
                            <input
                              key={i.key}
                              className="settings-input"
                              type={i.secret ? "password" : "text"}
                              placeholder={`${i.label}${i.required ? " *" : ""}`}
                              value={connectorValues[i.key] ?? ""}
                              onChange={(e) => setConnectorValues((v) => ({ ...v, [i.key]: e.target.value }))}
                            />
                          ))}
                          <button className="settings-btn" onClick={() => void addConnector(c)}>
                            {t("settings.add")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <h4 className="sub eyebrow">{t("settings.addMcp")}</h4>
                <div className="mcp-form">
                  <input
                    className="settings-input"
                    placeholder={t("settings.mcpName")}
                    value={mcpName}
                    onChange={(e) => setMcpName(e.target.value)}
                  />
                  <div className="seg">
                    <button className={mcpType === "stdio" ? "active" : ""} onClick={() => setMcpType("stdio")}>stdio</button>
                    <button className={mcpType === "http" ? "active" : ""} onClick={() => setMcpType("http")}>http</button>
                  </div>
                  {mcpType === "stdio" ? (
                    <input
                      className="settings-input"
                      placeholder={t("settings.mcpCommand")}
                      value={mcpCommand}
                      onChange={(e) => setMcpCommand(e.target.value)}
                    />
                  ) : (
                    <input
                      className="settings-input"
                      placeholder="https://…"
                      value={mcpUrl}
                      onChange={(e) => setMcpUrl(e.target.value)}
                    />
                  )}
                  <button className="settings-btn" disabled={!mcpName.trim()} onClick={() => void addMcp()}>
                    {t("settings.add")}
                  </button>
                </div>
                <p className="hint">{t("settings.mcpRestart")}</p>
              </>
            )}

            {p.tab === "automations" && (
              <>
                <Row title={t("settings.notify")} desc={t("settings.notify.desc")}>
                  <Switch on={p.notifyOnFinish} onChange={p.setNotifyOnFinish} />
                </Row>
                <Row title={t("settings.autoCommit")} desc={t("settings.autoCommit.desc")}>
                  <Switch on={p.autoCommit} onChange={p.setAutoCommit} />
                </Row>
                <Row title={t("settings.tray")} desc={t("settings.tray.desc")}>
                  <Switch on={p.enableTray} onChange={p.setEnableTray} />
                </Row>
                <Row title={t("settings.hotkey")} desc={t("settings.hotkey.desc")}>
                  <Switch on={p.enableHotkey} onChange={p.setEnableHotkey} />
                </Row>
                <Row title={t("settings.openAtLogin")} desc={t("settings.openAtLogin.desc")}>
                  <Switch on={p.openAtLogin} onChange={p.setOpenAtLogin} />
                </Row>
              </>
            )}

            {p.tab === "providers" && (
              <>
                {providerAuth.map((pa) => {
                  const probe = probeState[pa.provider];
                  return (
                    <div className="srow provider-row" key={pa.provider}>
                      <div className="srow-text">
                        <div className="srow-title">
                          {pa.label}
                          <span className={`badge ${pa.configured ? "ok" : "muted"}`} style={{ marginLeft: 8 }}>
                            {pa.configured ? t("badge.ready") : t("badge.notSet")}
                          </span>
                        </div>
                        {pa.freeTier ? <div className="srow-desc">{pa.freeTier}</div> : null}
                        {pa.keyUrl ? (
                          <a
                            className="srow-desc"
                            href={pa.keyUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {t("providers.getKey")}
                          </a>
                        ) : null}
                        {probe && probe.ok === true ? (
                          <div className="srow-desc" style={{ color: "var(--ok)" }}>{t("providers.works")}</div>
                        ) : probe && probe.ok === false ? (
                          <div className="srow-desc" style={{ color: "var(--bad)" }}>{probe.error ?? t("badge.error")}</div>
                        ) : null}
                      </div>
                      <div className="seg-inline">
                        <button className="settings-btn ghost" disabled={probe?.busy} onClick={() => void testProvider(pa.provider)}>
                          {probe?.busy ? t("providers.testing") : t("providers.test")}
                        </button>
                        <button
                          className="settings-btn"
                          onClick={() => {
                            setClaudeUrl(null);
                            setClaudeCode("");
                            setClaudeResult(null);
                            setConnectFor(pa.provider);
                          }}
                        >
                          {pa.configured ? "Manage" : "Connect"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <p className="hint">
                  You don't need a provider — termcoder runs on a free model out of the box. Connect one for
                  more power or higher limits.
                </p>
              </>
            )}

            {p.tab === "models" && (
              <>
                <p className="hint">{t("settings.models.hint")}</p>
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

            {p.tab === "agents" && (
              <>
                <p className="hint">{t("settings.agents.hint")}</p>
                {agentList.map((a) => (
                  <Row key={a.name} title={a.name} desc={a.description}>
                    <div className="seg-inline">
                      {a.readOnly ? <span className="badge muted">{t("mode.plan")}</span> : null}
                      {a.builtin ? (
                        <span className="badge muted">{t("settings.builtin")}</span>
                      ) : (
                        <button className="icon sm" title={t("settings.remove")} onClick={() => void deleteAgent(a.name)}>
                          <IconClose />
                        </button>
                      )}
                    </div>
                  </Row>
                ))}
                <h4 className="sub eyebrow">{t("settings.agents.new")}</h4>
                <div className="agent-form">
                  <input
                    className="settings-input"
                    placeholder={t("settings.agents.name")}
                    value={newAgent.name}
                    onChange={(e) => setNewAgent((s) => ({ ...s, name: e.target.value }))}
                  />
                  <input
                    className="settings-input"
                    placeholder={t("settings.agents.desc")}
                    value={newAgent.description}
                    onChange={(e) => setNewAgent((s) => ({ ...s, description: e.target.value }))}
                  />
                  <input
                    className="settings-input"
                    placeholder={t("settings.agents.model")}
                    value={newAgent.model}
                    onChange={(e) => setNewAgent((s) => ({ ...s, model: e.target.value }))}
                  />
                  <textarea
                    className="settings-input agent-prompt"
                    placeholder={t("settings.agents.prompt")}
                    value={newAgent.prompt}
                    onChange={(e) => setNewAgent((s) => ({ ...s, prompt: e.target.value }))}
                  />
                  <label className="agent-ro">
                    <Switch on={newAgent.readOnly} onChange={(v) => setNewAgent((s) => ({ ...s, readOnly: v }))} />
                    <span>{t("settings.agents.readonly")}</span>
                  </label>
                  {!newAgent.readOnly && (
                    <input
                      className="settings-input"
                      placeholder={t("settings.agents.editPaths")}
                      value={newAgent.editPaths}
                      onChange={(e) => setNewAgent((s) => ({ ...s, editPaths: e.target.value }))}
                    />
                  )}
                  <button className="settings-btn" disabled={!newAgent.name.trim()} onClick={() => void createAgent()}>
                    {t("settings.agents.create")}
                  </button>
                </div>
              </>
            )}

            {p.tab === "skills" && (
              <>
                <p className="hint">{t("settings.skills.hint")}</p>
                {skillList.map((s) => (
                  <Row key={`${s.source}:${s.name}`} title={s.name} desc={s.description}>
                    <div className="seg-inline">
                      <span className="badge muted">{s.source}</span>
                      {s.source === "project" ? (
                        <button className="icon sm" title={t("settings.remove")} onClick={() => void deleteSkill(s.name)}>
                          <IconClose />
                        </button>
                      ) : null}
                    </div>
                  </Row>
                ))}
                {skillList.length === 0 ? <p className="hint">{t("settings.skills.empty")}</p> : null}
                <h4 className="sub eyebrow">{t("settings.skills.new")}</h4>
                <div className="agent-form">
                  <input
                    className="settings-input"
                    placeholder={t("settings.skills.name")}
                    value={newSkill.name}
                    onChange={(e) => setNewSkill((s) => ({ ...s, name: e.target.value }))}
                  />
                  <input
                    className="settings-input"
                    placeholder={t("settings.skills.desc")}
                    value={newSkill.description}
                    onChange={(e) => setNewSkill((s) => ({ ...s, description: e.target.value }))}
                  />
                  <textarea
                    className="settings-input agent-prompt"
                    placeholder={t("settings.skills.body")}
                    value={newSkill.body}
                    onChange={(e) => setNewSkill((s) => ({ ...s, body: e.target.value }))}
                  />
                  <button
                    className="settings-btn"
                    disabled={!newSkill.name.trim() || !newSkill.body.trim()}
                    onClick={() => void createSkill()}
                  >
                    {t("settings.skills.create")}
                  </button>
                </div>
              </>
            )}

            {p.tab === "memory" && (
              <>
                <p className="hint">{t("settings.memoryDesc")}</p>
                {memories.map((m) => (
                  <Row key={`${m.scope}:${m.name}`} title={m.name} desc={m.description}>
                    <div className="seg-inline">
                      <span className="badge muted">{m.scope}</span>
                      <span className="badge muted">{m.type}</span>
                      <button className="icon sm" title={t("settings.remove")} onClick={() => void delMemory(m.name)}>
                        <IconClose />
                      </button>
                    </div>
                  </Row>
                ))}
                {memories.length === 0 ? <p className="hint">{t("settings.memory.empty")}</p> : null}
                <h4 className="sub eyebrow">{t("settings.memory.new")}</h4>
                <MemoryAdd onAdd={addMemory} t={t} />
              </>
            )}

            {p.tab === "behavior" && (
              <>
                <Row
                  title={t("settings.temperature")}
                  desc={t("settings.temperature.desc", { v: p.temperature.toFixed(2) })}
                >
                  <div className="slider-ctl">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={p.temperature}
                      onChange={(e) => p.setTemperature(Number(e.target.value))}
                    />
                    <span className="slider-val">{p.temperature.toFixed(2)}</span>
                  </div>
                </Row>
                <Row title={t("settings.maxSteps")} desc={t("settings.maxSteps.desc")}>
                  <div className="stepper">
                    <button onClick={() => p.setMaxSteps(Math.max(1, p.maxSteps - 1))}>−</button>
                    <span>{p.maxSteps}</span>
                    <button onClick={() => p.setMaxSteps(Math.min(100, p.maxSteps + 1))}>+</button>
                  </div>
                </Row>
                <h4 className="sub eyebrow">{t("settings.tokens")}</h4>
                <Row title={t("settings.maxToolOutput")} desc={t("settings.maxToolOutput.desc")}>
                  <div className="stepper">
                    <button
                      onClick={() =>
                        void patchConfig({ context: { maxToolOutputChars: Math.max(1000, (cfg?.context?.maxToolOutputChars ?? 8000) - 1000) } })
                      }
                    >
                      −
                    </button>
                    <span>{((cfg?.context?.maxToolOutputChars ?? 8000) / 1000).toFixed(0)}k</span>
                    <button
                      onClick={() =>
                        void patchConfig({ context: { maxToolOutputChars: Math.min(40000, (cfg?.context?.maxToolOutputChars ?? 8000) + 1000) } })
                      }
                    >
                      +
                    </button>
                  </div>
                </Row>
                <Row title={t("settings.keepRecentTools")} desc={t("settings.keepRecentTools.desc")}>
                  <div className="stepper">
                    <button
                      onClick={() =>
                        void patchConfig({ context: { keepRecentToolResults: Math.max(1, (cfg?.context?.keepRecentToolResults ?? 6) - 1) } })
                      }
                    >
                      −
                    </button>
                    <span>{cfg?.context?.keepRecentToolResults ?? 6}</span>
                    <button
                      onClick={() =>
                        void patchConfig({ context: { keepRecentToolResults: Math.min(30, (cfg?.context?.keepRecentToolResults ?? 6) + 1) } })
                      }
                    >
                      +
                    </button>
                  </div>
                </Row>
                <p className="hint">{t("settings.behavior.hint")}</p>
              </>
            )}

            {p.tab === "about" && (
              <>
                <Row title={t("settings.about.title")} desc={t("settings.about.desc")}>
                  <span className="muted">v0.1.0</span>
                </Row>
                <Row title={t("settings.workspace")} desc={p.cwd ?? "—"}>
                  <button className="settings-btn" onClick={p.chooseFolder}>{t("settings.change")}</button>
                </Row>
                <Row title={t("settings.server")} desc={`localhost:${p.port}`}>
                  <span className="badge ok">{t("settings.connected")}</span>
                </Row>
              </>
            )}
           </div>
          </div>
        </div>
      </div>

      {connectFor &&
        (() => {
          const pa = providerAuth.find((x) => x.provider === connectFor);
          const methods = pa?.methods ?? [{ id: "api-key", label: "API key", available: true }];
          const draft = keyDrafts[connectFor] ?? "";
          return (
            <div className="settings" style={{ zIndex: 60 }} onClick={() => setConnectFor(null)}>
              <div
                className="settings-card"
                style={{ maxWidth: 440, width: "90%", minHeight: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
                  <h3 style={{ margin: 0 }}>Connect {pa?.label ?? connectFor}</h3>
                  <button className="settings-btn" onClick={() => setConnectFor(null)}>✕</button>
                </div>
                <div style={{ padding: "6px 20px 20px" }}>
                  <p className="hint" style={{ marginTop: 6 }}>Choose how to sign in to {pa?.label ?? connectFor}.</p>
                  {methods.map((m) => (
                    <div key={m.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0" }}>
                      <div className="srow-title">
                        {m.label}
                        {!m.available && (
                          <span className="badge muted" style={{ marginLeft: 8 }}>coming soon</span>
                        )}
                        {m.id === "oauth-browser" && m.available && (
                          <span className="badge muted" style={{ marginLeft: 8 }}>experimental</span>
                        )}
                      </div>
                      {m.id === "oauth-browser" && m.available ? (
                        connectFor === "openai" ? (
                        <div className="provider-key" style={{ marginTop: 8, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                          {m.hint && <p className="hint" style={{ margin: 0 }}>{m.hint}</p>}
                          {!chatgptCode ? (
                            <button
                              className="settings-btn"
                              disabled={chatgptBusy}
                              onClick={async () => {
                                setChatgptBusy(true);
                                setChatgptStatus(null);
                                try {
                                  const r = await fetch(`${httpBase}/auth/chatgpt/start`, { method: "POST" }).then(
                                    (x) => x.json() as Promise<{ verificationUri?: string; userCode?: string; error?: string }>,
                                  );
                                  if (r.verificationUri && r.userCode) {
                                    setChatgptCode({ userCode: r.userCode, url: r.verificationUri });
                                    window.open(r.verificationUri, "_blank", "noopener,noreferrer");
                                  } else {
                                    setChatgptStatus(r.error ?? "Couldn't start sign-in.");
                                  }
                                } catch {
                                  setChatgptStatus("Couldn't reach the server. Try again.");
                                }
                                setChatgptBusy(false);
                              }}
                            >
                              {chatgptBusy ? t("settings.saving") : "Open sign-in"}
                            </button>
                          ) : null}
                          {!chatgptCode && chatgptStatus && chatgptStatus !== "pending" && chatgptStatus !== "connected" ? (
                            <div className="srow-desc" style={{ color: "var(--bad)" }}>{chatgptStatus}</div>
                          ) : null}
                          {chatgptCode ? (
                            <>
                              <div className="srow-desc">On the OpenAI page, enter this code:</div>
                              <div style={{ fontFamily: "var(--mono)", fontSize: 18, letterSpacing: "0.12em", color: "var(--accent)" }}>{chatgptCode.userCode}</div>
                              <a href={chatgptCode.url} target="_blank" rel="noreferrer noopener">Reopen sign-in page</a>
                              {chatgptStatus === "connected" ? (
                                <div className="srow-desc" style={{ color: "var(--ok)" }}>✓ Connected</div>
                              ) : chatgptStatus === "failed" ? (
                                <div className="srow-desc" style={{ color: "var(--bad)" }}>Sign-in failed. Try again.</div>
                              ) : (
                                <div className="srow-desc muted">Waiting for you to approve on OpenAI…</div>
                              )}
                            </>
                          ) : null}
                        </div>
                        ) : (
                        <div className="provider-key" style={{ marginTop: 8, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                          {m.hint && <p className="hint" style={{ margin: 0 }}>{m.hint}</p>}
                          {!claudeUrl ? (
                            <button
                              className="settings-btn"
                              disabled={claudeBusy}
                              onClick={async () => {
                                setClaudeBusy(true);
                                setClaudeResult(null);
                                try {
                                  const r = await fetch(`${httpBase}/auth/claude/start`, { method: "POST" }).then(
                                    (x) => x.json() as Promise<{ url: string }>,
                                  );
                                  setClaudeUrl(r.url);
                                  window.open(r.url, "_blank", "noopener,noreferrer");
                                } catch {
                                  setClaudeResult("Couldn't reach the server. Try again.");
                                }
                                setClaudeBusy(false);
                              }}
                            >
                              {claudeBusy ? t("settings.saving") : "Open sign-in"}
                            </button>
                          ) : (
                            <>
                              <a href={claudeUrl} target="_blank" rel="noreferrer noopener">
                                Reopen sign-in page
                              </a>
                              <div className="provider-key" style={{ gap: 8 }}>
                                <input
                                  type="text"
                                  className="settings-input"
                                  placeholder="Paste the code here"
                                  value={claudeCode}
                                  onChange={(e) => setClaudeCode(e.target.value)}
                                />
                                <button
                                  className="settings-btn"
                                  disabled={!claudeCode.trim() || claudeBusy}
                                  onClick={async () => {
                                    setClaudeBusy(true);
                                    setClaudeResult(null);
                                    try {
                                      const r = await fetch(`${httpBase}/auth/claude/complete`, {
                                        method: "POST",
                                        headers: { "content-type": "application/json" },
                                        body: JSON.stringify({ code: claudeCode.trim() }),
                                      }).then((x) => x.json() as Promise<{ ok: boolean; error?: string }>);
                                      if (r.ok) {
                                        setClaudeResult("ok");
                                        setClaudeCode("");
                                        loadProviderAuth();
                                        p.refreshStatus();
                                      } else {
                                        setClaudeResult(r.error ?? "Sign-in failed.");
                                      }
                                    } catch {
                                      setClaudeResult("Couldn't reach the server. Try again.");
                                    }
                                    setClaudeBusy(false);
                                  }}
                                >
                                  {claudeBusy ? t("settings.saving") : "Connect"}
                                </button>
                              </div>
                              {claudeResult === "ok" ? (
                                <div className="srow-desc" style={{ color: "var(--ok)" }}>✓ Connected</div>
                              ) : claudeResult ? (
                                <div className="srow-desc" style={{ color: "var(--bad)" }}>{claudeResult}</div>
                              ) : null}
                            </>
                          )}
                        </div>
                        )
                      ) : m.id === "api-key" && m.available ? (
                        <div className="provider-key" style={{ marginTop: 8 }}>
                          <input
                            type="password"
                            className="settings-input"
                            placeholder={cfg?.providers?.[connectFor]?.hasKey ? "••••••••" : t("settings.apiKey")}
                            value={draft}
                            onChange={(e) => setKeyDrafts((d) => ({ ...d, [connectFor]: e.target.value }))}
                          />
                          <button
                            className="settings-btn"
                            disabled={!draft.trim() || savingKey === connectFor}
                            onClick={async () => {
                              setSavingKey(connectFor);
                              await patchConfig({ providers: { [connectFor]: { apiKey: draft.trim() } } });
                              setKeyDrafts((d) => ({ ...d, [connectFor]: "" }));
                              setSavingKey(null);
                              loadProviderAuth();
                              p.refreshStatus();
                              void testProvider(connectFor);
                              setConnectFor(null);
                            }}
                          >
                            {savingKey === connectFor ? t("settings.saving") : t("settings.save")}
                          </button>
                        </div>
                      ) : m.hint ? (
                        <p className="hint" style={{ margin: "4px 0 0" }}>{m.hint}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
