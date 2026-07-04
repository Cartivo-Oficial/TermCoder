/** A slash-command's metadata, used by the menu, autocomplete, and /help. */
export interface TuiCommand {
  name: string;
  /** Argument hint shown in the menu, e.g. "<id>". */
  arg?: string;
  desc: string;
}

/** The built-in slash commands, in menu order. */
export const TUI_COMMANDS: TuiCommand[] = [
  { name: "help", desc: "Show all commands" },
  { name: "setup", desc: "Set up a model (free options available)" },
  { name: "upgrade", desc: "Connect a better model (free Gemini key) for much better answers" },
  { name: "connect", arg: "[provider]", desc: "Connect a provider (API key now; subscription login soon)" },
  { name: "key", arg: "<provider> <key>", desc: "Save an API key (google/anthropic/openai)" },
  { name: "new", desc: "Start a new session" },
  { name: "sessions", desc: "List saved sessions" },
  { name: "resume", arg: "<id>", desc: "Resume a saved session" },
  { name: "model", desc: "Choose a model (interactive picker)" },
  { name: "agent", arg: "[name]", desc: "Show or switch the active agent" },
  { name: "agents", desc: "List available agents" },
  { name: "commands", desc: "List custom project commands" },
  { name: "skills", desc: "List available skills" },
  { name: "theme", arg: "[name]", desc: "Show or set the color theme" },
  { name: "tools", desc: "List available tools" },
  { name: "auto", desc: "Toggle auto-approve (run tools without asking)" },
  { name: "retry", desc: "Re-run your last message" },
  { name: "background", arg: "<goal>", desc: "Work autonomously until tests/build pass" },
  { name: "suggest", desc: "Suggest a next step (fills the composer)" },
  { name: "flashcards", arg: "<topic>", desc: "Make study flashcards about a topic" },
  { name: "decks", desc: "List your flashcard decks (and what's due)" },
  { name: "review", arg: "[deck]", desc: "Review due flashcards (spaced repetition)" },
  { name: "tokens", desc: "Show token usage for this session" },
  { name: "init", desc: "Create an AGENTS.md in this project" },
  { name: "share", desc: "Export this session to an HTML file" },
  { name: "login", arg: "[token]", desc: "Connect GitHub (sync, share, packs)" },
  { name: "logout", desc: "Disconnect GitHub" },
  { name: "sync", desc: "Sync favorites & drafts via GitHub" },
  { name: "publish", desc: "Publish this session as a GitHub gist" },
  { name: "import", arg: "<gist>", desc: "Import a shared session from a gist" },
  { name: "pack", arg: "<publish|install|list> …", desc: "Share/install agent+skill packs" },
  { name: "class", arg: "<create|join|assign|submit> …", desc: "Classrooms: share packs, assignments, submissions" },
  { name: "clear", desc: "Clear the screen" },
  { name: "exit", desc: "Quit termcoder" },
];

/**
 * Rank commands for the given partial input (the text after "/"). Prefix
 * matches rank above substring matches; both above subsequence ("fuzzy")
 * matches. An empty query returns all commands in declared order.
 */
export function matchCommands(query: string): TuiCommand[] {
  const q = query.toLowerCase();
  if (!q) return TUI_COMMANDS;
  const scored: Array<{ c: TuiCommand; score: number }> = [];
  for (const c of TUI_COMMANDS) {
    const name = c.name.toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (isSubsequence(q, name)) score = 1;
    if (score >= 0) scored.push({ c, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.c.name.length - b.c.name.length)
    .map((s) => s.c);
}

/** Whether every char of `needle` appears in `haystack` in order. */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

/** The `/help` body, rendered from the command registry. */
export function helpText(): string {
  const width = Math.max(...TUI_COMMANDS.map((c) => c.name.length + (c.arg ? c.arg.length + 1 : 0)));
  const lines = TUI_COMMANDS.map((c) => {
    const sig = c.arg ? `${c.name} ${c.arg}` : c.name;
    return `  /${sig.padEnd(width + 1)} ${c.desc}`;
  });
  return ["Commands:", ...lines, "", "↑/↓ navigate · tab complete · esc interrupt a running turn"].join("\n");
}
