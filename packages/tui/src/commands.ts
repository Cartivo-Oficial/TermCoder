export interface TuiCommand {
  name: string;
  arg?: string;
  desc: string;
}

export const TUI_COMMANDS: TuiCommand[] = [
  { name: "help", desc: "Show all commands" },
  { name: "setup", desc: "Set up a model (free options available)" },
  { name: "upgrade", desc: "Connect a better model (free Gemini key) for much better answers" },
  { name: "connect", arg: "[provider]", desc: "Connect a provider (API key now; subscription login soon)" },
  { name: "login-claude", desc: "Sign in with a Claude Pro/Max subscription (experimental)" },
  { name: "logout-claude", desc: "Disconnect the Claude subscription login" },
  { name: "login-chatgpt", desc: "Sign in with a ChatGPT Plus/Pro subscription (experimental)" },
  { name: "logout-chatgpt", desc: "Disconnect the ChatGPT subscription login" },
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
  { name: "remember", arg: "[project] <text>", desc: "Save a fact to memory (default: your global preference)" },
  { name: "memories", desc: "List what termcoder remembers" },
  { name: "forget", arg: "<name>", desc: "Delete a memory by name" },
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

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

export function helpText(): string {
  const width = Math.max(...TUI_COMMANDS.map((c) => c.name.length + (c.arg ? c.arg.length + 1 : 0)));
  const lines = TUI_COMMANDS.map((c) => {
    const sig = c.arg ? `${c.name} ${c.arg}` : c.name;
    return `  /${sig.padEnd(width + 1)} ${c.desc}`;
  });
  return ["Commands:", ...lines, "", "↑/↓ navigate · tab complete · esc interrupt a running turn"].join("\n");
}
