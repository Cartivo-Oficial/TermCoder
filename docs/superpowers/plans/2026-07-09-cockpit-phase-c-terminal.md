# Cockpit Phase C — Terminal tab (PTY + xterm.js) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the desktop app a real interactive Terminal tab so the user can run any CLI — notably `claude` (Claude Code) — inside termcoder, with a one-click launcher for the CLIs found on their PATH.

**Architecture:** The Electron main process owns one pseudo-terminal per window (`@lydell/node-pty`, lazily loaded and fail-graceful). The renderer draws it with `@xterm/xterm` + `@xterm/addon-fit`, talking over four IPC channels (`pty:start`, `pty:input`, `pty:resize`, `pty:data`/`pty:exit`). The center column gains a slim tab bar (Chat | Terminal); the terminal is an absolutely-positioned pane inside `.center` so the existing chat JSX is untouched and the PTY survives tab switches. All PATH/env/shell decisions live in a pure, unit-tested module with no Electron or native imports.

**Tech Stack:** TypeScript, Electron 33 (ABI `modules 130`), React 18, `@lydell/node-pty@1.1.0`, `@xterm/xterm@6.0.0`, `@xterm/addon-fit@0.11.0`, Vitest.

## Global Constraints

- **Comment-free code** (user rule, repo-wide strip already done).
- **Tokens only, no cost.** Never render a `$` figure.
- Ember tokens + `--mono` chrome are the visual base; new labels get i18n **en/pt/es** (other langs fall back to en via `t()`).
- Node ≥ 20, ESM sources, tests colocated, `noUncheckedIndexedAccess` on — index access needs guards.
- **Never edit files via PowerShell `Get-Content`/`Set-Content`** — it mojibakes the accented i18n strings. Use the Write/Edit tools.
- Desktop has no renderer unit tests; renderer verification is `npx tsc --noEmit` + `pnpm --filter @termcoder/desktop build` + a live launch. **Pure main-process helpers DO get Vitest tests** (the root `vitest.config.ts` `include` glob `packages/*/src/**/*.{test,spec}.{ts,tsx}` already picks up `packages/desktop/src/**`).
- Launch the app with the Electron quirk stripped: `env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev`.
- **No version bump, no push** — this ships inside a later bundle. Suite is currently 288 green.

## Deviations from the spec (§7 of `2026-07-06-desktop-cockpit-design.md`)

The spec assumed `node-pty` would need `@electron/rebuild` and a working native toolchain on every release runner. **That cost is gone.** `@lydell/node-pty` ships per-platform prebuilt binaries that are **N-API** addons (`napi_register` present in `conpty.node`), so they are ABI-stable across Node and Electron. Verified live on this machine: loaded under Electron 33's ABI (`process.versions.modules === "130"`) and completed a real PowerShell PTY write/read roundtrip with **zero rebuild**.

Consequences: no `@electron/rebuild`, no per-runner toolchain, no "ship Phase C behind a flag". What remains is a **pnpm packaging** concern (Task 5): pnpm keeps the platform binary as a *sibling* of `@lydell/node-pty` inside `.pnpm/`, so it must be declared as a direct `optionalDependency` of `@termcoder/desktop` for `node_modules/@lydell/**` to capture it.

Also: the spec's "center tab bar (Chat / Editor / Terminal)" ships here as **Chat | Terminal only**. The Editor already exists in this codebase as the `.viewer` overlay modal (`App.tsx:207`), which post-dates the spec; adding a third tab would duplicate it. Phase B can reconcile them.

## File Structure

| File | Responsibility |
|---|---|
| `packages/desktop/src/main/shell.ts` **(new)** | Pure: default shell, sanitized child env, PATH resolution, quick-tool detection. No Electron, no native imports. |
| `packages/desktop/src/main/shell.test.ts` **(new)** | Vitest for the above. |
| `packages/desktop/src/main/pty.ts` **(new)** | Lazy `@lydell/node-pty` load, one PTY per `webContents`, IPC registration, disposal. |
| `packages/desktop/src/main/index.ts` | Calls `registerPtyIpc()`; kills PTYs on window close. |
| `packages/desktop/src/preload/index.ts` | Exposes `window.api.pty`. |
| `packages/desktop/src/renderer/TerminalPane.tsx` **(new)** | xterm host: fit, theme sync, exit/restart, unavailable state, quick-launch chips. |
| `packages/desktop/src/renderer/App.tsx` | Center tab bar, mounts `TerminalPane`, `toggleTerminal` keybind. |
| `packages/desktop/src/renderer/keybinds.ts` | Adds the `toggleTerminal` action. |
| `packages/desktop/src/renderer/styles.css` | `.center-tabs`, `.term-pane`, `.term-bar`. |
| `packages/desktop/src/renderer/i18n.ts` | `tab.*`, `term.*`, `keybind.toggleTerminal` for en/pt/es. |
| `packages/desktop/package.json` | Deps, optionalDeps (6 platform binaries), `files`, `asarUnpack`. |
| `packages/desktop/electron.vite.config.ts` | Marks `@lydell/node-pty` external so the `.node` resolves at runtime. |
| `pnpm-workspace.yaml` | `supportedArchitectures` so CI fetches all 6 binaries for cross-arch builds. |

---

### Task 1: Pure shell / env / PATH helpers

**Files:**
- Create: `packages/desktop/src/main/shell.ts`
- Test: `packages/desktop/src/main/shell.test.ts`

**Interfaces:**
- Produces:
  - `interface ShellSpec { file: string; args: string[] }`
  - `defaultShell(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): ShellSpec`
  - `terminalEnv(env: NodeJS.ProcessEnv): Record<string, string>`
  - `resolveOnPath(name: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform, exists?: (p: string) => boolean): string | null`
  - `interface QuickTool { id: string; label: string; command: string }`
  - `detectQuickTools(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, exists?: (p: string) => boolean): QuickTool[]`

**Why `exists` is injected:** so the tests are deterministic and never touch the real filesystem or the real PATH. Same reason `platform` is a parameter rather than `process.platform` — CI runs these tests on ubuntu, and the Windows branches must still be exercised.

- [ ] **Step 1: Write the failing tests.** Create `packages/desktop/src/main/shell.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defaultShell, detectQuickTools, resolveOnPath, terminalEnv } from "./shell";

const fake = (present: string[]) => (p: string) => present.includes(p.replace(/\\/g, "/"));

describe("defaultShell", () => {
  it("uses ComSpec on windows", () => {
    expect(defaultShell("win32", { ComSpec: "C:\\Windows\\System32\\cmd.exe" })).toEqual({
      file: "C:\\Windows\\System32\\cmd.exe",
      args: [],
    });
  });

  it("falls back to cmd.exe when ComSpec is unset", () => {
    expect(defaultShell("win32", {})).toEqual({ file: "cmd.exe", args: [] });
  });

  it("uses a login shell on unix", () => {
    expect(defaultShell("darwin", { SHELL: "/bin/zsh" })).toEqual({ file: "/bin/zsh", args: ["-l"] });
    expect(defaultShell("linux", {})).toEqual({ file: "/bin/bash", args: ["-l"] });
  });
});

describe("terminalEnv", () => {
  it("strips electron vars that break child processes", () => {
    const out = terminalEnv({ ELECTRON_RUN_AS_NODE: "1", ELECTRON_NO_ATTACH_CONSOLE: "1", HOME: "/home/x" });
    expect(out.ELECTRON_RUN_AS_NODE).toBeUndefined();
    expect(out.ELECTRON_NO_ATTACH_CONSOLE).toBeUndefined();
    expect(out.HOME).toBe("/home/x");
  });

  it("advertises a color terminal", () => {
    const out = terminalEnv({ TERM: "dumb" });
    expect(out.TERM).toBe("xterm-256color");
    expect(out.COLORTERM).toBe("truecolor");
  });

  it("drops undefined values", () => {
    const out = terminalEnv({ A: undefined, B: "b" });
    expect("A" in out).toBe(false);
    expect(out.B).toBe("b");
  });
});

describe("resolveOnPath", () => {
  it("finds a windows executable via PATHEXT", () => {
    const env = { Path: "C:\\bin;C:\\other", PATHEXT: ".COM;.EXE;.CMD" };
    const hit = resolveOnPath("claude", env, "win32", fake(["C:/bin/claude.EXE"]));
    expect(hit).toBe("C:\\bin\\claude.EXE");
  });

  it("does not match an extensionless file on windows", () => {
    const env = { Path: "C:\\bin", PATHEXT: ".EXE" };
    expect(resolveOnPath("claude", env, "win32", fake(["C:/bin/claude"]))).toBeNull();
  });

  it("finds an extensionless binary on unix", () => {
    const env = { PATH: "/usr/bin:/usr/local/bin" };
    expect(resolveOnPath("claude", env, "linux", fake(["/usr/local/bin/claude"]))).toBe("/usr/local/bin/claude");
  });

  it("returns null when absent, and when PATH is empty", () => {
    expect(resolveOnPath("nope", { PATH: "/usr/bin" }, "linux", fake([]))).toBeNull();
    expect(resolveOnPath("nope", {}, "linux", fake(["/usr/bin/nope"]))).toBeNull();
  });
});

describe("detectQuickTools", () => {
  it("returns only the CLIs present on PATH, claude first", () => {
    const tools = detectQuickTools({ PATH: "/usr/bin" }, "linux", fake(["/usr/bin/claude", "/usr/bin/term"]));
    expect(tools.map((t) => t.id)).toEqual(["claude", "termcoder"]);
    expect(tools[0]).toEqual({ id: "claude", label: "Claude Code", command: "claude" });
  });

  it("returns an empty list when nothing is installed", () => {
    expect(detectQuickTools({ PATH: "/usr/bin" }, "linux", fake([]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**

```bash
npx vitest run packages/desktop/src/main/shell.test.ts
```
Expected: `Failed to resolve import "./shell"` / cannot find module.

- [ ] **Step 3: Implement.** Create `packages/desktop/src/main/shell.ts`:

```ts
import { existsSync } from "node:fs";
import { posix, win32 } from "node:path";

export interface ShellSpec {
  file: string;
  args: string[];
}

export interface QuickTool {
  id: string;
  label: string;
  command: string;
}

const STRIP_ENV = new Set([
  "ELECTRON_RUN_AS_NODE",
  "ELECTRON_NO_ATTACH_CONSOLE",
  "ELECTRON_NO_ASAR",
  "NODE_OPTIONS",
  "GDK_PIXBUF_MODULE_FILE",
  "GDK_PIXBUF_MODULEDIR",
]);

const CANDIDATES: Array<{ id: string; label: string; bin: string; command: string }> = [
  { id: "claude", label: "Claude Code", bin: "claude", command: "claude" },
  { id: "termcoder", label: "termcoder", bin: "term", command: "term" },
  { id: "codex", label: "Codex", bin: "codex", command: "codex" },
  { id: "gemini", label: "Gemini CLI", bin: "gemini", command: "gemini" },
];

export function defaultShell(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): ShellSpec {
  if (platform === "win32") return { file: env.ComSpec ?? "cmd.exe", args: [] };
  return { file: env.SHELL ?? "/bin/bash", args: ["-l"] };
}

export function terminalEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || STRIP_ENV.has(key)) continue;
    out[key] = value;
  }
  out.TERM = "xterm-256color";
  out.COLORTERM = "truecolor";
  return out;
}

export function resolveOnPath(
  name: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): string | null {
  const windows = platform === "win32";
  const path = env.PATH ?? env.Path ?? "";
  const dirs = path.split(windows ? ";" : ":").filter(Boolean);
  const exts = windows
    ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];
  const join = windows ? win32.join : posix.join;
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      if (exists(candidate)) return candidate;
    }
  }
  return null;
}

export function detectQuickTools(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  exists: (path: string) => boolean = existsSync,
): QuickTool[] {
  return CANDIDATES.filter((c) => resolveOnPath(c.bin, env, platform, exists) !== null).map(
    ({ id, label, command }) => ({ id, label, command }),
  );
}
```

Note the test's `fake()` normalizes `\` to `/`, so `win32.join("C:\\bin", "claude.EXE")` → `C:\bin\claude.EXE` → compared as `C:/bin/claude.EXE`. That is why the expected return value keeps backslashes.

- [ ] **Step 4: Run — expect PASS.**

```bash
npx vitest run packages/desktop/src/main/shell.test.ts
```
Expected: 12 passing.

- [ ] **Step 5: Typecheck and commit.**

```bash
cd packages/desktop && npx tsc --noEmit && cd ../..
git add packages/desktop/src/main/shell.ts packages/desktop/src/main/shell.test.ts
git commit -m "feat(desktop): pure shell, env and PATH helpers for the terminal"
```

---

### Task 2: PTY bridge in the main process

**Files:**
- Create: `packages/desktop/src/main/pty.ts`
- Modify: `packages/desktop/src/main/index.ts` (import + register + dispose)
- Modify: `packages/desktop/electron.vite.config.ts` (external)
- Modify: `packages/desktop/package.json` (add `@lydell/node-pty` dependency)

**Interfaces:**
- Consumes: `defaultShell`, `terminalEnv`, `detectQuickTools` from Task 1.
- Produces: `registerPtyIpc(): void` and `disposePty(webContentsId: number): void`, plus these IPC contracts consumed by Task 3's preload:
  - `invoke("pty:available")` → `{ ok: boolean; error?: string }`
  - `invoke("pty:tools")` → `QuickTool[]`
  - `invoke("pty:start", { cwd, cols, rows })` → `{ ok: true; pid: number } | { ok: false; error: string }`
  - `send("pty:input", data: string)`
  - `send("pty:resize", cols: number, rows: number)`
  - `send("pty:kill")`
  - main → renderer: `"pty:data"` `(data: string)`, `"pty:exit"` `(exitCode: number)`

- [ ] **Step 1: Add the dependency.**

```bash
pnpm --filter @termcoder/desktop add @lydell/node-pty@1.1.0
```

- [ ] **Step 2: Mark it external so the `.node` binary is not bundled.** In `packages/desktop/electron.vite.config.ts`, change the `main.build.rollupOptions.external` array:

```ts
        external: ["bufferutil", "utf-8-validate", "@lydell/node-pty"],
```

- [ ] **Step 3: Implement the bridge.** Create `packages/desktop/src/main/pty.ts`:

```ts
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { app, BrowserWindow, ipcMain } from "electron";
import { defaultShell, detectQuickTools, terminalEnv, type QuickTool } from "./shell";

interface Pty {
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(cb: (data: string) => void): void;
  onExit(cb: (event: { exitCode: number }) => void): void;
}

interface PtyModule {
  spawn(
    file: string,
    args: string[],
    options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> },
  ): Pty;
}

const requireNative = createRequire(__filename);
const sessions = new Map<number, Pty>();

let cached: PtyModule | null = null;
let loadError = "";

function loadPty(): PtyModule | null {
  if (cached || loadError) return cached;
  try {
    cached = requireNative("@lydell/node-pty") as PtyModule;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  return cached;
}

function safeCwd(cwd: string | null | undefined): string {
  if (cwd && existsSync(cwd)) return cwd;
  return app.getPath("home");
}

export function disposePty(webContentsId: number): void {
  const pty = sessions.get(webContentsId);
  if (!pty) return;
  sessions.delete(webContentsId);
  try {
    pty.kill();
  } catch {
  }
}

export function registerPtyIpc(): void {
  ipcMain.handle("pty:available", () => {
    const mod = loadPty();
    return mod ? { ok: true } : { ok: false, error: loadError };
  });

  ipcMain.handle("pty:tools", (): QuickTool[] => detectQuickTools(process.env, process.platform));

  ipcMain.handle(
    "pty:start",
    (event, options: { cwd: string | null; cols: number; rows: number }) => {
      const mod = loadPty();
      if (!mod) return { ok: false as const, error: loadError };
      const id = event.sender.id;
      disposePty(id);
      const shell = defaultShell(process.platform, process.env);
      try {
        const pty = mod.spawn(shell.file, shell.args, {
          name: "xterm-256color",
          cols: Math.max(2, options.cols),
          rows: Math.max(1, options.rows),
          cwd: safeCwd(options.cwd),
          env: terminalEnv(process.env),
        });
        sessions.set(id, pty);
        pty.onData((data) => {
          if (sessions.get(id) === pty) event.sender.send("pty:data", data);
        });
        pty.onExit(({ exitCode }) => {
          if (sessions.get(id) === pty) sessions.delete(id);
          if (!event.sender.isDestroyed()) event.sender.send("pty:exit", exitCode);
        });
        return { ok: true as const, pid: pty.pid };
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.on("pty:input", (event, data: string) => sessions.get(event.sender.id)?.write(data));

  ipcMain.on("pty:resize", (event, cols: number, rows: number) => {
    try {
      sessions.get(event.sender.id)?.resize(Math.max(2, cols), Math.max(1, rows));
    } catch {
    }
  });

  ipcMain.on("pty:kill", (event) => disposePty(event.sender.id));

  app.on("browser-window-created", (_e, win: BrowserWindow) => {
    const id = win.webContents.id;
    win.on("closed", () => disposePty(id));
  });
}
```

`createRequire(__filename)` is correct here: electron-vite emits the main process as **CJS** (verified — `out/main/index.js` starts with `"use strict"` and uses `require`), so `__filename` exists at runtime and resolution starts from `out/main/`.

- [ ] **Step 4: Register it.** In `packages/desktop/src/main/index.ts`, add the import next to the other local imports:

```ts
import { registerPtyIpc } from "./pty";
```

and call it inside `app.whenReady().then(async () => {` — immediately before `await startServer();`:

```ts
  registerPtyIpc();
```

- [ ] **Step 5: Verify the native module in a REAL Electron main process.** This is the step that catches the two Windows hazards the ABI test could not: node-pty's `worker_threads` conout socket, and its `child_process.fork` of `conpty_console_list_agent`. Write `<scratchpad>/pty-smoke.cjs`:

```js
const { app } = require("electron");
const path = require("path");
const desktop = path.join(process.env.REPO, "packages", "desktop");
const pty = require(path.join(desktop, "node_modules", "@lydell", "node-pty"));

app.whenReady().then(() => {
  const win32 = process.platform === "win32";
  const p = pty.spawn(win32 ? "cmd.exe" : "/bin/bash", [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: { ...process.env, TERM: "xterm-256color" },
  });
  let out = "";
  p.onData((d) => { out += d; });
  p.write("echo SMOKE_OK\r");
  setTimeout(() => {
    console.log("RESULT", JSON.stringify({ pid: p.pid, sawEcho: out.includes("SMOKE_OK") }));
    try { p.kill(); } catch {}
    app.exit(0);
  }, 5000);
});
```

Run it against the real Electron binary (NOT `ELECTRON_RUN_AS_NODE`, which would bypass the very code paths under test):

```bash
REPO="$PWD" node_modules/.pnpm/electron@33.4.11/node_modules/electron/dist/electron.exe <scratchpad>/pty-smoke.cjs
```
Expected: a line `RESULT {"pid":<n>,"sawEcho":true}`. If `sawEcho` is false, do not proceed — the renderer will show a blank terminal and you will debug the wrong layer.

- [ ] **Step 6: Typecheck, build, commit.**

```bash
cd packages/desktop && npx tsc --noEmit && cd ../..
pnpm --filter @termcoder/desktop build
git add packages/desktop/src/main/pty.ts packages/desktop/src/main/index.ts packages/desktop/electron.vite.config.ts packages/desktop/package.json pnpm-lock.yaml
git commit -m "feat(desktop): pty bridge in the main process"
```

---

### Task 3: Preload API + the xterm pane

**Files:**
- Modify: `packages/desktop/src/preload/index.ts`
- Create: `packages/desktop/src/renderer/TerminalPane.tsx`
- Modify: `packages/desktop/package.json` (add `@xterm/xterm`, `@xterm/addon-fit`)

**Interfaces:**
- Consumes: the IPC contracts from Task 2.
- Produces: `window.api.pty` and
  `<TerminalPane cwd={string | null} hidden={boolean} themeKey={string} />` — self-contained; owns its xterm instance, its fit addon, and the PTY lifecycle. `themeKey` is an opaque string that changes whenever the app's colors change; the pane re-reads the CSS variables when it does.

- [ ] **Step 1: Add the renderer dependencies.**

```bash
pnpm --filter @termcoder/desktop add @xterm/xterm@6.0.0 @xterm/addon-fit@0.11.0
```

- [ ] **Step 2: Expose the bridge.** In `packages/desktop/src/preload/index.ts`, add this property to the `exposeInMainWorld("api", { ... })` object (after `setGlobalShortcut`). Listener registrations must return an unsubscribe function — a `contextBridge` object cannot hand `ipcRenderer` itself to the renderer.

```ts
  pty: {
    available: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("pty:available"),
    tools: (): Promise<Array<{ id: string; label: string; command: string }>> =>
      ipcRenderer.invoke("pty:tools"),
    start: (options: { cwd: string | null; cols: number; rows: number }): Promise<
      { ok: true; pid: number } | { ok: false; error: string }
    > => ipcRenderer.invoke("pty:start", options),
    write: (data: string) => ipcRenderer.send("pty:input", data),
    resize: (cols: number, rows: number) => ipcRenderer.send("pty:resize", cols, rows),
    kill: () => ipcRenderer.send("pty:kill"),
    onData: (cb: (data: string) => void) => {
      const handler = (_e: unknown, data: string) => cb(data);
      ipcRenderer.on("pty:data", handler);
      return () => ipcRenderer.off("pty:data", handler);
    },
    onExit: (cb: (code: number) => void) => {
      const handler = (_e: unknown, code: number) => cb(code);
      ipcRenderer.on("pty:exit", handler);
      return () => ipcRenderer.off("pty:exit", handler);
    },
  },
```

- [ ] **Step 3: Build the pane.** Create `packages/desktop/src/renderer/TerminalPane.tsx`:

```tsx
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
  const fg = v("--text", "#ECEAE6");
  const accent = v("--accent", "#FF7A45");
  return {
    background: v("--bg", "#0C0B0A"),
    foreground: fg,
    cursor: accent,
    cursorAccent: v("--bg", "#0C0B0A"),
    selectionBackground: v("--elev2", "#232019"),
  };
}

export function TerminalPane({
  cwd,
  hidden,
  themeKey,
}: {
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

    const term = new Terminal({
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--mono").trim() || "monospace",
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

    const offData = api.onData((data) => term.write(data));
    const offExit = api.onExit((code) => {
      setExited(code);
      startedRef.current = false;
      term.write(`\r\n\x1b[2m${t("term.exited", { code: String(code) })}\x1b[0m\r\n`);
    });
    const disposeInput = term.onData((data) => api.write(data));

    return () => {
      offData();
      offExit();
      disposeInput.dispose();
      api.kill();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      startedRef.current = false;
    };
  }, [error, t]);

  useEffect(() => {
    if (hidden || error) return;
    const term = termRef.current;
    const fit = fitRef.current;
    const api = window.api?.pty;
    if (!term || !fit || !api) return;

    fit.fit();
    if (!startedRef.current) {
      startedRef.current = true;
      void api.start({ cwd, cols: term.cols, rows: term.rows }).then((r) => {
        if (!r.ok) {
          startedRef.current = false;
          setError(r.error);
        } else {
          setExited(null);
          term.focus();
        }
      });
    } else {
      api.resize(term.cols, term.rows);
      term.focus();
    }
  }, [hidden, cwd, error]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || error) return;
    const observer = new ResizeObserver(() => {
      if (hidden) return;
      const term = termRef.current;
      const fit = fitRef.current;
      if (!term || !fit) return;
      fit.fit();
      window.api?.pty?.resize(term.cols, term.rows);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [hidden, error]);

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
    const r = await api.start({ cwd, cols: term.cols, rows: term.rows });
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
    window.api?.pty?.write(`${command}\r`);
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
```

**Two deliberate effect-dependency choices — do not "fix" them:**
- The start/fit effect depends on `[hidden, cwd, error]` and **not** on `exited`. With `exited` in the list, the effect would re-run the moment the shell exits, see `startedRef.current === false`, and instantly respawn — making the Restart chip unreachable and turning `exit` into an infinite loop.
- `restart()` returns `Promise<boolean>` and `run()` awaits it. Writing `claude\r` into a PTY that has not finished spawning sends the keystrokes nowhere.

- [ ] **Step 4: Type `window.api.pty`.** The `declare global { interface Window { api?: {...} } }` block lives at `packages/desktop/src/renderer/App.tsx:36-62`. Add this member after `setGlobalShortcut` (line 59), inside the `api?:` object type:

```ts
      pty: {
        available: () => Promise<{ ok: boolean; error?: string }>;
        tools: () => Promise<Array<{ id: string; label: string; command: string }>>;
        start: (options: { cwd: string | null; cols: number; rows: number }) => Promise<
          { ok: true; pid: number } | { ok: false; error: string }
        >;
        write: (data: string) => void;
        resize: (cols: number, rows: number) => void;
        kill: () => void;
        onData: (cb: (data: string) => void) => () => void;
        onExit: (cb: (code: number) => void) => () => void;
      };
```

A `declare global` in a module augments the whole program, so `TerminalPane.tsx` sees it without importing anything from `App.tsx`.

Note `TerminalPane` reads `window.api?.pty` — the optional chain matters. The renderer is also built for the web (`vite.web.config.ts`), where `window.api` is undefined; the pane then renders its "unavailable" state instead of throwing.

- [ ] **Step 5: Typecheck.**

```bash
cd packages/desktop && npx tsc --noEmit
```
Expected: clean. (`@xterm/xterm@6` has no `exports` map, so the deep `css/xterm.css` import resolves; Vite handles the CSS.)

- [ ] **Step 6: Commit.**

```bash
git add packages/desktop/src/preload/index.ts packages/desktop/src/renderer/TerminalPane.tsx packages/desktop/package.json pnpm-lock.yaml
git commit -m "feat(desktop): xterm terminal pane + preload pty bridge"
```

---

### Task 4: Center tab bar, keybind, styles, i18n

**Files:**
- Modify: `packages/desktop/src/renderer/App.tsx`
- Modify: `packages/desktop/src/renderer/keybinds.ts`
- Modify: `packages/desktop/src/renderer/styles.css`
- Modify: `packages/desktop/src/renderer/i18n.ts`

**Interfaces:**
- Consumes: `<TerminalPane cwd hidden />` from Task 3; the App's existing `cwd` state (`App.tsx:293`) and `keybinds` config.
- Produces: a `centerTab` state (`"chat" | "terminal"`) and a `toggleTerminal` keybind action.

The terminal is an **absolutely-positioned overlay inside `.center`** (which is already `position: relative`, `styles.css:223`). This keeps the ~200 lines of existing chat JSX untouched — no re-indent, no flex regressions — and the PTY keeps running while you are on the Chat tab.

- [ ] **Step 1: Add the keybind action.** In `packages/desktop/src/renderer/keybinds.ts`, append to `KEYBIND_ACTIONS`:

```ts
  { id: "toggleTerminal", labelKey: "keybind.toggleTerminal", default: "mod+`" },
```

(`matchCombo` tokenizes on `+`, and the backtick is not a modifier name, so it lands in `key` and compares against `normalizeKey(e.key)` — `` "`" ``. No change needed to `keybinds.ts` beyond the entry. The Settings → Shortcuts tab renders every `KEYBIND_ACTIONS` entry automatically, so it becomes rebindable for free.)

- [ ] **Step 2: Add i18n keys.** In `packages/desktop/src/renderer/i18n.ts`, add to the `en` dict (before its closing `};` at ~line 342):

```ts
  "tab.chat": "Chat",
  "tab.terminal": "Terminal",
  "term.unavailable": "Terminal unavailable on this build.",
  "term.exited": "Process exited ({code})",
  "term.restart": "Restart",
  "keybind.toggleTerminal": "Toggle terminal",
```

to the `pt` dict (before its closing `};` at ~line 651):

```ts
  "tab.chat": "Chat",
  "tab.terminal": "Terminal",
  "term.unavailable": "Terminal indisponível nesta versão.",
  "term.exited": "Processo encerrado ({code})",
  "term.restart": "Reiniciar",
  "keybind.toggleTerminal": "Alternar terminal",
```

and to the `es` dict (before its closing `};` at ~line 960):

```ts
  "tab.chat": "Chat",
  "tab.terminal": "Terminal",
  "term.unavailable": "Terminal no disponible en esta versión.",
  "term.exited": "Proceso terminado ({code})",
  "term.restart": "Reiniciar",
  "keybind.toggleTerminal": "Alternar terminal",
```

**Write these with the Write/Edit tool, never PowerShell** — `indisponível`/`versión` will mojibake otherwise.

- [ ] **Step 3: Wire the App.** In `packages/desktop/src/renderer/App.tsx`:

Import the pane next to the other renderer imports:

```tsx
import { TerminalPane } from "./TerminalPane";
```

Add state next to the other `useState` calls (near `const [cwd, setCwd] = useState<string | null>(null);`, line 293):

```tsx
  const [centerTab, setCenterTab] = useState<"chat" | "terminal">("chat");
  const [termMounted, setTermMounted] = useState(false);
```

`termMounted` exists so the PTY is not spawned until the user actually opens the tab, and is never unmounted afterwards — that is what preserves the scrollback and the running process across tab switches.

Add a helper right after those:

```tsx
  const showTerminal = () => {
    setTermMounted(true);
    setCenterTab((tab) => (tab === "terminal" ? "chat" : "terminal"));
  };
```

In the global key handler (`useEffect` at line 560), add a branch before the final `else if (e.key === "Escape")`:

```tsx
      } else if (matchCombo(e, bind("toggleTerminal"))) {
        e.preventDefault();
        showTerminal();
```

Inside `<main className="center">` (line 1479), insert the tab bar as the **first child**, before `<div className="chat-head">`:

```tsx
          <div className="center-tabs">
            <button
              className={centerTab === "chat" ? "active" : ""}
              onClick={() => setCenterTab("chat")}
            >
              {t("tab.chat")}
            </button>
            <button
              className={centerTab === "terminal" ? "active" : ""}
              onClick={() => { setTermMounted(true); setCenterTab("terminal"); }}
            >
              {t("tab.terminal")}
            </button>
          </div>
```

and add the pane as the **last child** of `<main className="center">`, just before its closing `</main>`:

```tsx
          {termMounted ? (
            <TerminalPane
              cwd={cwd}
              hidden={centerTab !== "terminal"}
              themeKey={`${theme}:${colorTheme}:${accent}`}
            />
          ) : null}
```

`theme` (line 310), `colorTheme` (line 313) and `accent` are existing App state; concatenating them gives a string that changes on any palette change, which is what makes `TerminalPane` re-read `--bg`/`--text`/`--accent`.

Add the command-palette entry alongside the other commands (in the array that ends at line 1392):

```tsx
    { id: "terminal", label: t("tab.terminal"), hint: t("palette.hint.command"), run: () => { setTermMounted(true); setCenterTab("terminal"); } },
```

- [ ] **Step 4: Styles.** Append to `packages/desktop/src/renderer/styles.css`:

```css
.center-tabs { display: flex; gap: 2px; padding: 6px 10px 0; flex-shrink: 0; }
.center-tabs button { font-family: var(--mono); font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); background: none; border: none; border-radius: 7px; padding: 5px 10px; cursor: pointer; }
.center-tabs button:hover { color: var(--text); background: var(--elev); }
.center-tabs button.active { color: var(--text); background: var(--elev2); box-shadow: inset 0 -2px 0 var(--accent); }
.term-pane { position: absolute; inset: 34px 0 0 0; display: flex; flex-direction: column; background: var(--bg); z-index: 5; }
.term-pane.hidden { display: none; }
.term-bar { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.term-chip { font-family: var(--mono); font-size: 11px; color: var(--muted); background: var(--elev); border: 1px solid var(--border); border-radius: 7px; padding: 4px 9px; cursor: pointer; }
.term-chip:hover { color: var(--text); border-color: var(--accent); }
.term-chip.restart { color: var(--accent); border-color: var(--accent); }
.term-spacer { flex: 1; }
.term-host { flex: 1; min-height: 0; padding: 6px 4px 4px 10px; }
.term-host .xterm { height: 100%; }
.term-error { padding: 18px; color: var(--muted); font-size: 12.5px; display: flex; flex-direction: column; gap: 8px; }
.term-error pre { font-family: var(--mono); font-size: 11px; color: var(--faint); white-space: pre-wrap; }
```

`--faint` (`#5C5850`) is defined at `styles.css:10`. The `.term-pane` `inset: 34px 0 0 0` clears the `.center-tabs` strip (5px + 5px padding + ~24px button box); if the tab bar's measured height differs, match it rather than guessing.

- [ ] **Step 5: Typecheck + build.**

```bash
cd packages/desktop && npx tsc --noEmit && cd ../..
pnpm --filter @termcoder/desktop build
```

- [ ] **Step 6: Live launch and drive it.**

```bash
env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop dev
```
Run in the background. Confirm, in order:
1. The center shows `CHAT | TERMINAL` tabs; Chat is unchanged.
2. Clicking **Terminal** opens a shell prompt in the project cwd, and typing `echo hi` echoes `hi`.
3. A **Claude Code** chip appears in the terminal bar (this machine has `claude.exe` on PATH); clicking it launches the Claude Code TUI *inside the app*.
4. Resizing the window reflows the shell (run `tput cols` / `echo %COLUMNS%`).
5. Ctrl+` toggles the tab; switching to Chat and back keeps the scrollback and the running process.
6. Toggling the light (`paper`) theme keeps the terminal readable.
7. `exit` prints "Process exited (0)" and the **Restart** chip works.

- [ ] **Step 7: Commit.**

```bash
git add packages/desktop/src/renderer/App.tsx packages/desktop/src/renderer/keybinds.ts packages/desktop/src/renderer/styles.css packages/desktop/src/renderer/i18n.ts
git commit -m "feat(desktop): terminal tab with claude code quick-launch"
```

---

### Task 5: Packaging the native binary + full verification + docs

**Files:**
- Modify: `packages/desktop/package.json` (`optionalDependencies`, `build.files`, `build.asarUnpack`)
- Modify: `pnpm-workspace.yaml` (`supportedArchitectures`)
- Modify: `docs/configuration.md` (a "Terminal" section)

**Interfaces:**
- Consumes: everything above. Produces: a packaged app whose Terminal tab works.

**The pnpm trap:** `packages/desktop/node_modules/@lydell/node-pty` is a symlink into `node_modules/.pnpm/@lydell+node-pty@1.1.0/node_modules/@lydell/`, and the platform binary (`@lydell/node-pty-win32-x64`) lives *beside it in there* — **not** in `packages/desktop/node_modules/@lydell/`. `requireBinary.js` resolves it with a dynamic `require("@lydell/node-pty-" + process.platform + "-" + process.arch)`. The current `build.files` is `["out/**"]`, which excludes `node_modules` entirely, so a packaged app would throw at `loadPty()` and fall into the "unavailable" state. Declaring the six platform packages as direct `optionalDependencies` of `@termcoder/desktop` makes pnpm materialise them under `packages/desktop/node_modules/@lydell/`. pnpm skips the ones whose `os`/`cpu` do not match the host, which is exactly the desired behaviour.

**Two traps found while executing this task — the obvious approach does not work:**

1. **`asarUnpack` is unusable in this repo.** Adding any `asarUnpack` pattern makes electron-builder 25 run `getRelativePath(file, appDir)` over every file destined for the asar, and that function throws on anything outside `packages/desktop/`. Under pnpm every dependency is a symlink into the root `node_modules/.pnpm/`, so it fails immediately: `packages/core/dist/index.js must be under packages/desktop/`. This is not specific to `@termcoder/core` — `react` and friends resolve out-of-tree too. Do not try to fix it by excluding workspace packages.

2. **`extraResources` copies pnpm symlinks without dereferencing them.** Pointing `extraResources` straight at `node_modules/@lydell` produces seven *dangling junctions* in `resources/pty/node_modules/@lydell/`, each targeting a `release/win-unpacked/node_modules/.pnpm/…` path that does not exist. `ls` lists them, so the mistake looks like success until something tries to read a file.

The working shape: a `stage:pty` prepack script copies the packages into `build/pty/` with `dereference: true` (and drops `*.pdb`, which is 10.5 MB of the 11 MB Windows payload), `extraResources` ships that staged directory, and `loadPty()` requires it by absolute path when `app.isPackaged`. The asar is left completely alone.

- [ ] **Step 1: Declare the platform binaries.** In `packages/desktop/package.json`, add a top-level `optionalDependencies` block (sibling of `dependencies`):

```json
  "optionalDependencies": {
    "@lydell/node-pty-darwin-arm64": "1.1.0",
    "@lydell/node-pty-darwin-x64": "1.1.0",
    "@lydell/node-pty-linux-arm64": "1.1.0",
    "@lydell/node-pty-linux-x64": "1.1.0",
    "@lydell/node-pty-win32-arm64": "1.1.0",
    "@lydell/node-pty-win32-x64": "1.1.0"
  },
```

- [ ] **Step 2: Stage real files.** `build.files` stays `["out/**"]`. Create `packages/desktop/scripts/stage-pty.mjs` that copies `node_modules/@lydell/*` into `build/pty/node_modules/@lydell/` with `dereference: true` and a `filter` dropping `*.pdb`, then add `"stage:pty": "node scripts/stage-pty.mjs"` and prefix the three `package*` scripts with `pnpm stage:pty &&`. Add this `extraResources` entry beside the icons:

```json
      {
        "from": "build/pty/node_modules/@lydell",
        "to": "pty/node_modules/@lydell"
      }
```

The `to` path matters. Node resolves the dynamic `require("@lydell/node-pty-win32-x64/conpty.node")` by walking parent directories of `resources/pty/node_modules/@lydell/node-pty/`, appending `node_modules` to each prefix whose last segment is not already `node_modules`. That walk reaches `resources/pty/node_modules/` — so the sibling binary is found. Flattening this to `resources/pty/@lydell/` would break it.

The files must be real, not linked: node-pty loads a `.node` binary, spawns `worker/conoutSocketWorker.js` in a `worker_threads.Worker`, and `child_process.fork`s `conpty_console_list_agent.js` on Windows.

Add `packages/desktop/build/pty/` to the root `.gitignore`.

- [ ] **Step 2b: Resolve it at runtime.** In `packages/desktop/src/main/pty.ts`, `loadPty()` must require the staged copy once packaged:

```ts
function ptyEntry(): string {
  if (!app.isPackaged) return "@lydell/node-pty";
  return join(process.resourcesPath, "pty", "node_modules", "@lydell", "node-pty");
}
```

- [ ] **Step 3: Make cross-arch release builds fetch every binary.** In `pnpm-workspace.yaml`, append:

```yaml
supportedArchitectures:
  os:
    - win32
    - darwin
    - linux
  cpu:
    - x64
    - arm64
```

Without this, `release.yml`'s x64 runners never download the arm64 binary, and the arm64 installers ship a terminal that reports "unavailable". Re-run `pnpm install` after editing.

- [ ] **Step 4: Verify the packaged app.** Build an unpacked directory, then confirm the files are **real** — `ls` alone will happily list dangling junctions:

```bash
env -u ELECTRON_RUN_AS_NODE pnpm --filter @termcoder/desktop package:dir
ls -la packages/desktop/release/win-unpacked/resources/pty/node_modules/@lydell/node-pty-win32-x64/
```
Expected: `conpty.node` and `conpty_console_list.node` with real byte counts, no `.pdb`. If you see `<JUNCTION>` entries or `cannot access`, the dereference failed.

Then exercise the real `require` chain from the packaged app's own Electron binary — this proves the resolution walk finds the sibling platform package at its new location:

```bash
cd packages/desktop/release/win-unpacked
ELECTRON_RUN_AS_NODE=1 ./termcoder.exe -e "
const path=require('path');
const pty=require(path.join(process.cwd(),'resources','pty','node_modules','@lydell','node-pty'));
const p=pty.spawn('cmd.exe',[],{name:'xterm-256color',cols:80,rows:24,cwd:process.cwd(),env:process.env});
let out=''; p.onData(d=>{out+=d}); p.write('echo PACKAGED_OK\r');
setTimeout(()=>{console.log('PACKAGED_RESULT',JSON.stringify({sawEcho:out.includes('PACKAGED_OK')}));p.kill();process.exit(0)},4000);
"
```
Expected: `PACKAGED_RESULT {"sawEcho":true}`. (Task 2's smoke test already covered the real-Electron-main runtime; this one covers the packaged *location*. Together they cover both risks.)

- [ ] **Step 5: Full suite.**

```bash
pnpm -r typecheck
npx vitest run
git status
```
Expected: typecheck clean, **303 tests green** (291 existing + 12 from Task 1), and `git status` shows only Phase-C files.

- [ ] **Step 6: Document it.** Add to `docs/configuration.md`, after the "Autonomous mode" section:

```markdown
## Terminal

The desktop app embeds a real terminal (Chat | Terminal tabs in the center column, or `Ctrl`+`` ` ``). It runs your default shell — `ComSpec` on Windows, `$SHELL -l` elsewhere — in the project folder, so anything you can run in a terminal you can run here, including other coding CLIs.

termcoder scans your `PATH` on startup and shows a one-click chip for each CLI it finds: **Claude Code** (`claude`), **termcoder** (`term`), **Codex** (`codex`), and **Gemini CLI** (`gemini`). Clicking a chip types the command into the shell.

The terminal keeps running while you are on the Chat tab. `Restart` respawns the shell after it exits. If your platform's prebuilt PTY binary is missing, the tab says so instead of failing silently — the rest of the app is unaffected.
```

- [ ] **Step 7: Commit.**

```bash
git add packages/desktop/package.json pnpm-workspace.yaml pnpm-lock.yaml docs/configuration.md
git commit -m "build(desktop): package the pty binary; document the terminal"
```

---

## Follow-ups (not this plan)

- **Run-toolkit** (spec §5.7): test/build/lint chips derived from `package.json` scripts + `detectVerifyCommand`, writing into this PTY. Deferred because it belongs to the dashboard, which now lives inside `SidePanel`, not the right column the spec assumed.
- **Phase B reconciliation:** the spec's Editor tab vs. the existing `.viewer` overlay modal. Pick one.
- **Multiple terminals / split panes.** `sessions` is already a `Map` keyed by `webContents.id`; widening it to a composite key is the natural extension.
