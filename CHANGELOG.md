# Changelog

## 0.8.2

**The keyless model can use its tools again.** GPT-OSS sometimes names a tool
`bash<|channel|>commentary` — a stray token from its own format leaking into the
name — so the call matched nothing and the model gave up with the job half done.
We now strip that, and a new eval measured the effect: a one-line bug-fix task
that failed every time before now passes every time.

**A nudge when the free tier actually hurts.** The free model is a fine way to
start, but it is small and gets busy. Now, once per session and only while you
are on it, a hint appears at the moment the limit bites — after a rate-limit or a
slow turn — showing how to connect a better model. `/upgrade` and `/connect` also
stopped calling subscription login "coming soon"; it has been here since 0.8.0.

## 0.8.1

**The keyless model can finally use tools.** `termcoderfree/auto` is the default for
anyone without an API key. On every follow-up request — once tool results were in the
history — the upstream endpoint sent a tool-call continuation with a bumped `index` and
no `id`, and the AI SDK rejected the stream. The free model could chat, but it could
never edit a file or run a command. If you tried termcoder without a key before now,
that is why it did nothing. Fixed in `provider/keyless-stream.ts`.

**A real terminal, inside the desktop app.** New `Chat | Terminal` tabs in the centre
column (or `Ctrl`+`` ` ``). It runs your default shell in the project folder, and shows a
one-click chip for each coding CLI it finds on your `PATH` — Claude Code, Codex, Gemini
CLI, termcoder. The shell keeps running while you are on the Chat tab.

**The real brand mark** now appears in the app's rail, hero, and welcome screen.

**A rebuilt website.** One stylesheet instead of four private copies, the real brand
mark, and a hero that replays a session genuinely recorded with the keyless model
rather than a mockup of one.

## 0.8.0 — "O Motor" (The Engine)

The biggest release since 1.0 of the roadmap: termcoder now remembers you, finds
the right files on its own, talks to every major provider without hanging, lets
you sign in with a Claude or ChatGPT subscription instead of an API key, and the
desktop app has been rebuilt from the shell up.

### The engine — every provider, no hangs, truthful readiness

A provider registry covering 12 backends (Anthropic, OpenAI, Google, Groq,
OpenRouter, Mistral, DeepSeek, xAI, Together, Cerebras, Ollama, Pollinations),
all reachable through one OpenAI-compatible path. A stream that stops producing
tokens is now aborted after an idle timeout instead of hanging forever, and the
router skips providers it has seen fail. `/key` probes the key with a real
one-token request, so the model picker's ● means "this works", not "a string is
set" — the old picker lied.

### Memory — it remembers across sessions

The agent can write and recall durable notes: `.termcoder/memory/*.md` for facts
the team shares through git, plus a private user store. Only names and
descriptions enter the prompt; bodies load on demand, so recall costs almost no
context. `/remember`, `/memories`, `/forget`, a `memory` tool, and a Memory tab
in desktop settings. A secret guard refuses to store anything that looks like a
credential.

### Retrieval — the right files, automatically

BM25-lite lexical ranking over the project (no embeddings, no new dependencies,
no index server) injects *pointers* — file paths and symbol locations, not file
bodies — into coding turns. Cheap enough to run every turn, and it keeps the
model from re-reading the repo to find where something lives.

### Subscription login (experimental)

Sign in with a **Claude Pro/Max** or **ChatGPT Plus/Pro** subscription instead of
paying per token. PKCE for Claude, device-code for ChatGPT; tokens refresh
automatically and are stored in the gitignored config, never synced. Available
from `/login-claude` in the CLI and the Connect modal in the desktop app.

These flows reuse the vendors' own client credentials the way their official
CLIs do. That is a gray area in their terms — especially OpenAI's — so both are
marked experimental and fail gracefully back to the keyless free model.

### Desktop — the Command Deck

The app was rebuilt around a 48px icon rail: sessions, files, study and agents
are one click from anywhere. The chat is a centered, immersive column with a
floating composer that absorbed the old status bar; tool calls are collapsible
cards; files, study and agents slide over the chat instead of stealing a third
of the window. Everything sits on a three-layer surface system (glass panels,
floating overlays, a depth-gradient background) that all nine color themes and
the light theme derive from automatically. The light theme finally gets the
brand's orange accent instead of a gray one.

### Also

- Session token usage is persisted and shown per session.
- `target="_blank"` links open in the system browser, not inside the app.
- The whole codebase is comment-free by project convention.
