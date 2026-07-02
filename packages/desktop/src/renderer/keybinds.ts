// Configurable keyboard shortcuts. Each action has a stable id and a default
// combo; the user can override any of them (persisted in config.keybinds). A
// combo is a "+"-joined string of modifiers and one key, e.g. "mod+k",
// "mod+shift+n". "mod" means Ctrl on Windows/Linux and ⌘ on macOS.

export interface KeybindAction {
  id: string;
  /** i18n key for the human label. */
  labelKey: string;
  default: string;
}

export const KEYBIND_ACTIONS: KeybindAction[] = [
  { id: "commandPalette", labelKey: "keybind.commandPalette", default: "mod+k" },
  { id: "newSession", labelKey: "keybind.newSession", default: "mod+n" },
  { id: "toggleSessions", labelKey: "keybind.toggleSessions", default: "mod+b" },
  { id: "toggleFiles", labelKey: "keybind.toggleFiles", default: "mod+j" },
  { id: "openFolder", labelKey: "keybind.openFolder", default: "mod+o" },
];

const IS_MAC =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform || "");

const MODIFIER_KEYS = new Set(["control", "shift", "alt", "meta", "os", "altgraph"]);

/** Resolve the effective combo for an action, honouring user overrides. */
export function comboFor(
  keybinds: Record<string, string> | undefined,
  action: KeybindAction,
): string {
  const v = keybinds?.[action.id];
  return v && v.trim() ? v.trim() : action.default;
}

function normalizeKey(key: string): string {
  const k = key.toLowerCase();
  if (k === " ") return "space";
  if (k === "esc") return "escape";
  return k;
}

/** Whether a keyboard event matches a combo string. */
export function matchCombo(e: KeyboardEvent, combo: string): boolean {
  const tokens = combo.toLowerCase().split("+").map((t) => t.trim()).filter(Boolean);
  const needMod = tokens.includes("mod");
  const needCtrl = tokens.includes("ctrl") || tokens.includes("control");
  const needMeta = tokens.includes("meta") || tokens.includes("cmd") || tokens.includes("⌘");
  const needShift = tokens.includes("shift");
  const needAlt = tokens.includes("alt") || tokens.includes("option");
  const key = tokens.find(
    (t) => !["mod", "ctrl", "control", "meta", "cmd", "⌘", "shift", "alt", "option"].includes(t),
  );
  if (!key) return false;
  if (normalizeKey(e.key) !== key) return false;
  if (e.shiftKey !== needShift) return false;
  if (e.altKey !== needAlt) return false;
  if (needMod) {
    if (!(e.ctrlKey || e.metaKey)) return false;
  } else {
    if (needCtrl !== e.ctrlKey) return false;
    if (needMeta !== e.metaKey) return false;
  }
  return true;
}

/**
 * Build a canonical combo string from a keydown event, for the recorder UI.
 * Returns "" for a bare modifier press (so the user can hold then pick a key).
 */
export function comboFromEvent(e: KeyboardEvent): string {
  if (MODIFIER_KEYS.has(e.key.toLowerCase())) return "";
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(normalizeKey(e.key));
  return parts.join("+");
}

/** Human-readable rendering of a combo, e.g. "Ctrl + K" (or "⌘ + K" on macOS). */
export function formatCombo(combo: string): string {
  return combo
    .split("+")
    .map((t) => {
      const k = t.trim().toLowerCase();
      if (k === "mod") return IS_MAC ? "⌘" : "Ctrl";
      if (k === "ctrl" || k === "control") return "Ctrl";
      if (k === "meta" || k === "cmd") return "⌘";
      if (k === "shift") return "Shift";
      if (k === "alt" || k === "option") return IS_MAC ? "⌥" : "Alt";
      if (k === "space") return "Space";
      if (k.length === 1) return k.toUpperCase();
      return k.charAt(0).toUpperCase() + k.slice(1);
    })
    .join(" + ");
}
