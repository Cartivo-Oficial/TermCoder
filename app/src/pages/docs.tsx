import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Prose } from "@/components/site/prose";
import { Eyebrow, Heading, Lead } from "@/components/site/section";
import { InlineLink } from "@/components/site/arrow-link";
import { DocTable, type DocRow } from "@/components/docs";

// One entry per <h2> below; the id is the kebab-case slug of the title and is
// repeated on the heading itself, so the sticky index needs no JavaScript.
const SECTIONS: { id: string; title: string }[] = [
  { id: "overview", title: "Overview" },
  { id: "install", title: "Install" },
  { id: "first-run", title: "First run" },
  { id: "quickstart", title: "Quickstart" },
  { id: "how-it-works", title: "How it works" },
  { id: "command-reference", title: "Command reference" },
  { id: "build-and-plan-modes", title: "Build and Plan modes" },
  { id: "files-and-sub-agents", title: "Files and sub-agents" },
  { id: "models-and-providers", title: "Models and providers" },
  { id: "connecting-a-key", title: "Connecting a key" },
  { id: "running-locally", title: "Running locally" },
  { id: "custom-agents", title: "Custom agents" },
  { id: "skills", title: "Skills" },
  { id: "study-mode", title: "Study mode" },
  { id: "autonomous-mode", title: "Autonomous mode" },
  { id: "sync-share-and-packs", title: "Sync, share and packs" },
  { id: "classrooms", title: "Classrooms" },
  { id: "run-in-the-browser", title: "Run in the browser" },
  { id: "configuration", title: "Configuration" },
  { id: "terminal", title: "Terminal" },
  { id: "subscription-login", title: "Subscription login" },
  { id: "keyboard-shortcuts", title: "Keyboard shortcuts" },
  { id: "sdk-and-server", title: "SDK and server" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

// Every row is TUI_COMMANDS in packages/tui/src/commands.ts, in its own order,
// signatures included. All 46 of them — the previous pass listed 32 and called
// it "the full set".
const COMMANDS: [string, string][] = [
  ["/help", "Show all commands."],
  ["/setup", "Set up a model, free options included."],
  ["/upgrade", "Connect something better — a free Gemini key, a subscription, or Ollama."],
  ["/connect [provider]", "Connect a provider by API key; with no argument it lists them."],
  ["/login-claude", "Sign in with a Claude Pro or Max subscription (experimental)."],
  ["/logout-claude", "Disconnect the Claude subscription login."],
  ["/login-chatgpt", "Sign in with a ChatGPT Plus or Pro subscription (experimental)."],
  ["/logout-chatgpt", "Disconnect the ChatGPT subscription login."],
  ["/key <provider> <key>", "Save an API key for a provider."],
  ["/new", "Start a new session."],
  ["/sessions", "List saved sessions."],
  ["/resume <id>", "Resume a saved session."],
  ["/model", "Open the model picker."],
  ["/agent [name]", "Show or switch the active agent."],
  ["/agents", "List available agents."],
  ["/commands", "List custom project commands."],
  ["/skills", "List available skills."],
  ["/theme [name]", "Show or set the colour theme; the choice is saved."],
  ["/tools", "List the tools the current agent may use."],
  ["/auto", "Toggle auto-approve — run tools without asking."],
  ["/retry", "Re-run your last message."],
  ["/background <goal>", "Work autonomously until the project's check passes."],
  ["/suggest", "Suggest a next step and drop it into the composer."],
  ["/flashcards <topic>", "Write study flashcards about a topic into a deck."],
  ["/decks", "List your decks with due counts, and your streak."],
  ["/review [deck]", "Review the cards due now, one at a time."],
  ["/remember [project] <text>", "Save a fact to memory; global unless you say project."],
  ["/memories", "List what termcoder remembers."],
  ["/forget <name>", "Delete a memory by name."],
  ["/recipes", "List saved recipes — dev workflows and study lessons."],
  ["/recipe <name>", "Run a saved recipe, executing its steps in order."],
  ["/connectors", "Browse the one-click MCP connector catalog."],
  ["/mcp [add <id> …]", "List MCP servers, or add one from the catalog."],
  ["/tokens", "Show token usage for this session."],
  ["/init", "Create an AGENTS.md in this project."],
  ["/share", "Export this session to an HTML file on disk."],
  ["/login [token]", "Connect GitHub for sync, share, packs and classrooms."],
  ["/logout", "Disconnect GitHub."],
  ["/sync", "Sync favorites, drafts, decks, review progress and settings."],
  ["/publish", "Publish this session as a private gist and get a viewer link."],
  ["/import <gist>", "Import a shared session from a gist id or URL."],
  ["/pack <publish|install|list> …", "Publish or install packs of agents, skills and commands."],
  ["/class <create|join|assign|submit> …", "Classrooms: shared packs, assignments, submissions."],
  ["/clear", "Clear the screen."],
  ["/exit", "Quit termcoder."],
];

// Straight from useInput in app.tsx, MultilineInput.tsx and Composer.tsx.
const SHORTCUTS: [string, string][] = [
  ["shift+tab", "Toggle Build and Plan mode."],
  ["ctrl+p", "Open the command palette."],
  ["/", "Open the command menu."],
  ["@", "Open the file picker."],
  ["$", "Hand the rest of the line to a sub-agent."],
  ["esc", "Interrupt the running turn."],
  ["↑ / ↓", "Step back through your previous prompts."],
  ["ctrl+← / →", "Jump by word in the input."],
  ["ctrl+a / ctrl+e", "Jump to the start or end of the input."],
  ["ctrl+u", "Delete everything before the cursor."],
  ["\\ then Enter", "Insert a newline instead of sending."],
];

// keyEnv for every keyed provider in packages/core/src/provider/registry.ts.
// Ollama needs no key and termcoderfree is keyless, so neither has a row.
const ENV_KEYS: [string, string][] = [
  ["anthropic", "ANTHROPIC_API_KEY"],
  ["openai", "OPENAI_API_KEY"],
  ["google", "GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY"],
  ["groq", "GROQ_API_KEY"],
  ["openrouter", "OPENROUTER_API_KEY"],
  ["mistral", "MISTRAL_API_KEY"],
  ["deepseek", "DEEPSEEK_API_KEY"],
  ["xai", "XAI_API_KEY"],
  ["together", "TOGETHER_API_KEY"],
  ["cerebras", "CEREBRAS_API_KEY"],
];

const TOOLS =
  "read · ls · glob · grep · write · edit · bash · webfetch · websearch · skill · memory · " +
  "recipe · repomap · symbols · task · diagnostics · run_code";

// Left column of every table on this page is a literal — a command, a path, an
// environment variable — so it is always <code>.
function mono(rows: [string, string][]): DocRow[] {
  return rows.map(([k, v]) => [<code key={k}>{k}</code>, v]);
}

// A muted line inside a <pre>. Prose owns the block; this is only the comment
// colour, at full strength — faded body text fails AA.
function Cm({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

export default function Docs() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="docs" />

      <section>
        <div className="mx-auto max-w-[1120px] px-6 pt-16 pb-2 sm:pt-24">
          <Eyebrow>Docs</Eyebrow>
          <Heading level={1}>Everything it does, and how.</Heading>
          <Lead>
            Install it, run it, and make it yours. Every command, flag and file path below is the one in the source —
            if the docs and the code disagree, the code is the bug report.
          </Lead>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1120px] gap-12 px-6 py-20 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] space-y-2 overflow-y-auto text-[14px]">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-muted-foreground transition-colors hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        <Prose>
          <h2 id="overview" className="scroll-mt-24">
            Overview
          </h2>
          <p>
            TermCoder is an open source AI coding agent that runs in your terminal. You describe a task in plain
            language; it reads the relevant files, proposes and applies edits, runs commands and reports back —
            asking permission before anything that changes your machine.
          </p>
          <p>
            One npm package installs two equivalent commands, <code>term</code> and <code>termcoder</code>, and it
            opens on a <strong>free, keyless model</strong> — nothing to sign up for or configure. Connect your own
            key to any of twelve providers when you want more, or point it at a local model through Ollama. A second
            persona, <code>termexplorer</code>, turns the same tool into a study tutor.
          </p>

          <h2 id="install" className="scroll-mt-24">
            Install
          </h2>
          <p>
            You need <InlineLink href="https://nodejs.org">Node 20 or newer</InlineLink>. Install the CLI globally
            from npm:
          </p>
          <pre>
            <Cm># Windows (PowerShell or CMD), macOS, or Linux</Cm>
            {"\nnpm install -g @termcoder/tui"}
          </pre>
          <p>
            That adds two equivalent commands to your PATH — <code>term</code> and <code>termcoder</code>. There is
            no <code>--version</code> flag; to confirm the binary resolves, run:
          </p>
          <pre>term --help</pre>
          <blockquote>
            <strong>Desktop app.</strong> Prefer a window? Download the installer from{" "}
            <InlineLink href="https://github.com/Cartivo-Oficial/TermCoder/releases">GitHub Releases</InlineLink>. It
            runs the same engine as the CLI and bundles Node, so it needs nothing installed first.
          </blockquote>

          <h2 id="first-run" className="scroll-mt-24">
            First run
          </h2>
          <p>Open a terminal in a project folder and run:</p>
          <pre>term</pre>
          <p>Two things happen the first time:</p>
          <ol>
            <li>
              <strong>Trust prompt.</strong> TermCoder asks whether you trust the current folder before it reads or
              runs anything in it. The answer is remembered in your user config, and it covers everything under that
              folder.
            </li>
            <li>
              <strong>Nothing to set up.</strong> It starts on the free, keyless model — just type. Want something
              faster? <code>/upgrade</code> walks you through a free Gemini key in two steps, <code>/setup</code> is
              the full guide, and <code>/model</code> picks a local Ollama model.
            </li>
          </ol>
          <p>Type your request at the prompt and press Enter.</p>

          <h2 id="quickstart" className="scroll-mt-24">
            Quickstart
          </h2>
          <p>A first session, end to end:</p>
          <pre>
            <Cm># in your project folder</Cm>
            {"\nterm\n\n"}
            <Cm># connect a model — optional, it already works without this</Cm>
            {"\n❯ /setup\n\n"}
            <Cm># ask for a change: it reads, edits, and can run your tests</Cm>
            {"\n❯ add input validation to the signup form and run the tests\n\n"}
            <Cm># steer it mid-flight</Cm>
            {"\n❯ /model              "}
            <Cm># switch models any time</Cm>
            {"\n❯ shift+tab           "}
            <Cm># toggle Plan and Build mode</Cm>
          </pre>
          <p>
            TermCoder shows each tool call as it happens, collapses long output, and prints a diff for every edit
            before applying it.
          </p>

          <h2 id="how-it-works" className="scroll-mt-24">
            How it works
          </h2>
          <p>
            Each turn, the agent decides which tools to call to satisfy your request. There are seventeen of them:{" "}
            <code>{TOOLS}</code>.
          </p>
          <p>
            Anything that changes your machine goes through a <strong>permission check</strong> first. There are five
            categories — <code>bash</code>, <code>write</code>, <code>edit</code>, <code>mcp</code> and{" "}
            <code>network</code> — and every one of them defaults to asking. Only six tools are gated by them:{" "}
            <code>bash</code>, <code>edit</code>, <code>write</code>, <code>webfetch</code>, <code>websearch</code>{" "}
            and <code>run_code</code>. Reading and searching run freely. You can allow a request once, allow it for
            the session, or deny it; <code>/auto</code> approves everything for the current session when you trust
            the task.
          </p>
          <p>
            Long tool output is collapsed in the transcript and trimmed from the model&apos;s context as the session
            grows, so a long conversation does not keep re-sending everything it has already read.
          </p>

          <h2 id="command-reference" className="scroll-mt-24">
            Command reference
          </h2>
          <p>
            Type <code>/</code> at the prompt to open the command menu. All forty-six of them:
          </p>
          <DocTable head={["Command", "What it does"]} rows={mono(COMMANDS)} />

          <h2 id="build-and-plan-modes" className="scroll-mt-24">
            Build and Plan modes
          </h2>
          <p>
            TermCoder has two modes. Toggle them with <code>shift+tab</code> — the current one shows at the bottom of
            the screen.
          </p>
          <ul>
            <li>
              <strong>Build</strong> — the default. The agent can read, edit, write and run commands, with your
              permission.
            </li>
            <li>
              <strong>Plan</strong> — read-only. Every mutating permission is denied outright, so the agent inspects
              the code and proposes an approach without touching a file. Review the plan, then switch to Build.
            </li>
          </ul>

          <h2 id="files-and-sub-agents" className="scroll-mt-24">
            Files and sub-agents
          </h2>
          <p>Two characters do something extra while you type:</p>
          <DocTable
            head={["Type", "Result"]}
            rows={[
              [
                <code key="at">@</code>,
                "A file picker opens as you type a path, with a six-line preview of the highlighted file. Accepting it inserts the path into your message — the contents are not attached; the agent reads the file itself if it needs to.",
              ],
              [
                <code key="dollar">$</code>,
                "Hands the rest of the line to the general sub-agent, which runs it as its own session and reports a summary back.",
              ],
            ]}
          />
          <p>
            The agent can also pick a specialist itself, through its <code>task</code> tool:{" "}
            <code>explore</code> and <code>scout</code> for read-only research, <code>reviewer</code> to critique a
            change, <code>architect</code> to design an approach, <code>tester</code> to write and run tests,{" "}
            <code>debugger</code> to root-cause a failure, and <code>general</code> for everything else. Each one
            works in a separate session, which keeps the main context clean.
          </p>

          <h2 id="models-and-providers" className="scroll-mt-24">
            Models and providers
          </h2>
          <p>
            Open the picker with <code>/model</code>. It lists a catalog refreshed from models.dev once a day, plus
            whatever Ollama is serving locally, grouped into Favorites, TermCoder AI (<code>termcoder/auto</code> and{" "}
            <code>termexplorer/auto</code>), Cloud (Anthropic, OpenAI and Google — these need a key) and Local.
          </p>
          <p>
            The dot in front of each row is its state: <code>●</code> ready, <code>◐</code> connected but not yet
            verified, <code>○</code> needs a key. <code>ctrl+f</code> stars a model into Favorites,{" "}
            <code>ctrl+a</code> starts connecting a provider, and typing a full <code>provider/model</code> id adds
            one that is not in the list.
          </p>
          <h3>termcoder/auto</h3>
          <p>
            The recommended default. It classifies each prompt and routes it — a quick model for simple edits, a
            stronger one for harder work — and, when the agent is allowed to change files, reviews its own diff once
            before finishing and fixes what the review finds. With no key it routes to the free, keyless model;
            connect a key and it routes there instead, without you doing anything.
          </p>
          <h3>The keyless tier</h3>
          <p>
            The free model is community-hosted, small and rate-limited when busy. When a request fails, TermCoder
            retries it and — if you have connected a key — falls back to that, so a hiccup does not kill your turn.{" "}
            <code>/upgrade</code> lists every way to move up, starting with a free Gemini key.
          </p>

          <h2 id="connecting-a-key" className="scroll-mt-24">
            Connecting a key
          </h2>
          <p>
            The guided path is <code>/setup</code>, or <code>/connect</code> to see the list. To set one directly:
          </p>
          <pre>
            {"❯ /key anthropic sk-ant-...\n❯ /key openai sk-...\n❯ /key google AIza..."}
          </pre>
          <p>
            <code>/key</code> takes any of the ten keyed providers below (<code>gemini</code> is accepted as an alias
            for <code>google</code>), saves the key, and immediately probes the provider to tell you whether it
            works. Keys are written to your user config directory —{" "}
            <code>~/.config/termcoder/config.json</code>, or under <code>$XDG_CONFIG_HOME</code> if you set it —
            never into the project. Standard environment variables are read too:
          </p>
          <DocTable head={["Provider", "Environment variable"]} rows={mono(ENV_KEYS)} />

          <h2 id="running-locally" className="scroll-mt-24">
            Running locally
          </h2>
          <p>
            To run with no provider key and nothing leaving your machine, install{" "}
            <InlineLink href="https://ollama.com">Ollama</InlineLink> and pull a model:
          </p>
          <pre>
            <Cm># pull a capable local coding model</Cm>
            {"\nollama pull qwen2.5-coder\n\n"}
            <Cm># then pick it in TermCoder</Cm>
            {"\n❯ /model              "}
            <Cm># choose it under Local</Cm>
          </pre>
          <p>
            TermCoder asks the running Ollama daemon what it has and lists those models in the picker, so anything
            you have pulled shows up without configuration.
          </p>

          <h2 id="custom-agents" className="scroll-mt-24">
            Custom agents
          </h2>
          <p>
            An agent is a named role with its own prompt, model, tools and permissions. Define one by adding a
            markdown file with front matter to <code>.termcoder/agents/</code> in your project — the file name is the
            agent name. The same folder under your user config,{" "}
            <code>~/.config/termcoder/agents/</code>, defines a global one; the project copy wins on a clash.
          </p>
          <pre>
            <Cm># .termcoder/agents/reviewer.md</Cm>
            {"\n---\ndescription: Reviews changes, never edits\nmode: subagent\nmodel: anthropic/claude-sonnet-5\ntools: [read, ls, grep, glob]\n---\nYou are a careful code reviewer. Point out correctness bugs and\nrisky changes. Do not modify files; describe what should change."}
          </pre>
          <p>
            The keys front matter understands are <code>description</code>, <code>mode</code> (
            <code>primary</code>, <code>subagent</code> or <code>all</code>), <code>model</code>, <code>tools</code>,{" "}
            <code>permission</code>, <code>temperature</code>, <code>steps</code> and <code>color</code>; the body
            below the front matter is the prompt. Switch to an agent with <code>/agent</code>, and list what a
            project has with <code>/agents</code>. Restricting <code>tools</code> is enough to make an agent
            read-only — a tool the list leaves out is never offered to the model.
          </p>

          <h2 id="skills" className="scroll-mt-24">
            Skills
          </h2>
          <p>
            A skill is a reusable playbook the agent loads only when a task calls for it. Each one is a single
            markdown file in <code>.termcoder/skills/</code>, with <code>name</code> and <code>description</code> in
            its front matter and the instructions below:
          </p>
          <pre>
            <Cm># .termcoder/skills/release.md</Cm>
            {"\n---\nname: release\ndescription: Cut a release — bump version, tag, changelog\n---\nSteps to cut a release in this repo:\n1. Bump the version in package.json\n2. Update CHANGELOG.md\n3. Commit, tag, and push"}
          </pre>
          <p>
            List what is available with <code>/skills</code>. Only each skill&apos;s name and one-line description
            sit in the prompt; the agent pulls the full instructions with the <code>skill</code> tool the moment it
            decides to use one, so idle skills cost almost nothing.
          </p>

          <h2 id="study-mode" className="scroll-mt-24">
            Study mode
          </h2>
          <p>
            TermCoder ships a sister persona for schoolwork. Open <code>/model</code> and pick{" "}
            <code>termexplorer/auto</code>. The system prompt changes from a coding agent to a patient tutor that:
          </p>
          <ul>
            <li>Explains step by step in plain language, in whatever language you write in.</li>
            <li>Summarises notes, texts or a whole topic into a structured outline.</li>
            <li>Builds study aids on request — flashcards, practice questions with answers, essay and mind-map
              outlines, revision schedules.</li>
            <li>Works through homework as reasoning and worked steps rather than an answer to paste.</li>
            <li>Searches the web and cites sources when facts matter.</li>
          </ul>
          <p>No programming knowledge is needed — just ask.</p>
          <h3>Spaced repetition</h3>
          <p>
            Flashcards go into decks and come back on a spaced-repetition schedule, so you see each card just before
            you would forget it. Reviewing on consecutive days builds a streak.
          </p>
          <pre>
            {"❯ /flashcards the water cycle   "}
            <Cm># writes cards into a deck named after the topic</Cm>
            {"\n❯ /decks                        "}
            <Cm># decks, due counts, and your streak</Cm>
            {"\n❯ /review                       "}
            <Cm># reveal each card, then grade it 0–5</Cm>
          </pre>
          <p>
            <code>/review</code> takes an optional deck name; with none it picks the first deck that has cards due.
            In the desktop app the same decks live under the Study button.
          </p>

          <h2 id="autonomous-mode" className="scroll-mt-24">
            Autonomous mode
          </h2>
          <p>
            Hand TermCoder a goal and let it work unattended. It edits, runs your project&apos;s check, feeds the
            failure back into the next round, and keeps going until the check passes — or until it has used all five
            rounds.
          </p>
          <pre>{"❯ /background add input validation to the signup form and make the tests pass"}</pre>
          <p>
            Auto-approve is switched on for the run and restored to whatever it was afterwards. The check is detected
            from your project: the first of <code>test</code>, <code>typecheck</code>, <code>build</code> or{" "}
            <code>lint</code> in <code>package.json</code>, run with pnpm, yarn or npm depending on which lockfile is
            there; otherwise <code>go build ./...</code> for a <code>go.mod</code>, <code>cargo check</code> for a{" "}
            <code>Cargo.toml</code>, or <code>python -m pytest -q</code> for a <code>pyproject.toml</code>. If it
            finds none of those it makes a single pass and stops. In the desktop app, toggle the autonomous button in
            the composer and send your goal.
          </p>
          <blockquote>
            <strong>One turn is checkpointed, not the whole run.</strong> Before each turn TermCoder records the
            files that turn is about to touch, and the next turn overwrites that record — so only the most recent
            turn can be undone. The desktop app&apos;s undo button restores it, and reverting consumes the
            checkpoint. The CLI has no revert command; for anything longer than one turn, use git.
          </blockquote>

          <h2 id="sync-share-and-packs" className="scroll-mt-24">
            Sync, share and packs
          </h2>
          <p>
            TermCoder uses GitHub as its backend — there is no server to run. Connect a token once with{" "}
            <code>/login</code>; it needs the <strong>gist</strong> scope and nothing else, and it is stored in your
            user config, never in the project.
          </p>
          <DocTable
            head={["Command", "What it does"]}
            rows={mono([
              [
                "/sync",
                "Mirror favorites, drafts, study decks, review progress and settings to one private gist, and pull them on another machine. Each store is whole-file: the newer copy wins. Settings merge key by key.",
              ],
              ["/share", "Write the session out as a self-contained HTML file on disk."],
              ["/publish", "Publish the session as a private gist; you get a link that opens in a hosted viewer."],
              ["/import <gist>", "Open a shared session, by gist id or URL, into a fresh session."],
              ["/pack publish [name]", "Bundle this project's .termcoder agents, skills and commands into a pack."],
              ["/pack install <ref> [--global]", "Install a pack from a gist or an owner/repo, into the project or your user config."],
            ])}
          />
          <blockquote>
            <strong>Secrets never sync.</strong> The settings store carries your theme, your model choice and your
            MCP connectors — the schema has no field for an API key, so there is nothing for a key to ride along in.
            Everything sync and share touch is a private gist in your own account.
          </blockquote>

          <h2 id="classrooms" className="scroll-mt-24">
            Classrooms
          </h2>
          <p>
            A classroom lets a teacher share packs and assignments with students, all through GitHub. A class is a
            private gist; joins, submissions and the roster ride on gist comments — asynchronous, with nothing to
            host.
          </p>
          <pre>
            <Cm># teacher</Cm>
            {"\n❯ /class create Algorithms 101   "}
            <Cm># prints a join code to hand out</Cm>
            {"\n❯ /class assign Sorting exercise\n❯ /class assignments             "}
            <Cm># the ids students submit against</Cm>
            {"\n\n"}
            <Cm># student</Cm>
            {"\n❯ /class join <code>             "}
            <Cm># installs the class's shared packs</Cm>
            {"\n❯ /class submit <assignment-id>  "}
            <Cm># publishes the session and posts the link</Cm>
            {"\n\n"}
            <Cm># teacher</Cm>
            {"\n❯ /class submissions             "}
            <Cm># who submitted what</Cm>
            {"\n❯ /class roster                  "}
            <Cm># who has joined</Cm>
          </pre>
          <p>
            Students join with the code the teacher&apos;s <code>/class create</code> prints, not a link, and{" "}
            <code>/class submit</code> takes the assignment id from <code>/class assignments</code>. Joining installs
            the class&apos;s shared packs, so every student starts with the same agents and skills. Only the creator
            can post assignments.
          </p>

          <h2 id="run-in-the-browser" className="scroll-mt-24">
            Run in the browser
          </h2>
          <p>
            The same engine runs three ways: the <code>term</code> CLI, the desktop app, and a browser. The server
            package ships a <code>termcoder-server</code> binary that serves the web interface and the HTTP and
            WebSocket API:
          </p>
          <pre>
            <Cm># serve the web app from your machine</Cm>
            {"\ntermcoder-server\n"}
            <Cm># → http://localhost:4096   (override with PORT)</Cm>
          </pre>
          <blockquote>
            <strong>It binds to 127.0.0.1 on purpose.</strong> The server has no authentication of any kind. Setting{" "}
            <code>HOST</code> to expose it on your network hands session control to anyone who can reach the port,
            and the server prints that warning itself on startup. Leave it on localhost unless you know exactly who
            is on the other side.
          </blockquote>
          <p>
            Shared sessions open on their own without any of this — a <code>/publish</code> link renders in a hosted
            viewer with nothing installed.
          </p>

          <h2 id="configuration" className="scroll-mt-24">
            Configuration
          </h2>
          <p>
            Project settings live in <code>.termcoder/</code> in your repo, and are found by walking up from the
            working directory. Personal settings and secrets live in your user config directory.
          </p>
          <DocTable
            head={["Location", "Holds"]}
            rows={mono([
              [".termcoder/config.json", "Project config — merged over your global config."],
              [".termcoder/agents/", "Project agents, one markdown file each."],
              [".termcoder/commands/", "Project slash commands."],
              [".termcoder/skills/", "Project skills, one markdown file each."],
              [".termcoder/recipes/", "Saved multi-step workflows."],
              [".termcoder/memory/", "Facts the agent keeps about this project."],
              [".termcoder/checkpoints/", "The last turn's file snapshot, per session."],
              ["AGENTS.md", "Always-on project instructions. Create one with /init."],
              ["~/.config/termcoder/", "Global config, API keys, favorites, trusted folders, drafts, decks."],
              ["~/.termcoder/sessions/", "Your saved sessions."],
            ])}
          />
          <blockquote>
            <strong>Secrets stay out of git.</strong> Keys are written to your user config directory, never to the
            project. Keep <code>.termcoder/</code> in your <code>.gitignore</code> if it holds anything local —
            checkpoints and memory both live there.
          </blockquote>
          <p>
            Two environment variables override config at launch: <code>TERMCODER_MODEL</code> and{" "}
            <code>TERMCODER_THEME</code>. Change the theme from inside the app with <code>/theme &lt;name&gt;</code>,
            and run <code>/theme</code> on its own to see the names; your choice is saved for next time.
          </p>

          <h2 id="terminal" className="scroll-mt-24">
            Terminal
          </h2>
          <p>
            The desktop app embeds a real terminal. Switch the centre column to it from the view menu in the tab bar,
            or press <code>Ctrl</code> + <code>{"`"}</code> (<code>Cmd</code> + <code>{"`"}</code> on macOS) to
            toggle between Chat and Terminal. It runs your default shell — <code>cmd.exe</code> on Windows, your{" "}
            <code>$SHELL</code> as a login shell everywhere else — in the project folder, and it keeps running while
            you are back on Chat.
          </p>
          <p>
            TermCoder scans your <code>PATH</code> and shows a one-click chip for each coding CLI it finds: Claude
            Code, termcoder, Codex and Gemini CLI.
          </p>

          <h2 id="subscription-login" className="scroll-mt-24">
            Subscription login
          </h2>
          <p>Instead of an API key, you can sign in with a plan you already pay for.</p>
          <pre>
            {"/login-claude     "}
            <Cm># Claude Pro or Max</Cm>
            {"\n/login-chatgpt    "}
            <Cm># ChatGPT Plus or Pro</Cm>
            {"\n/logout-claude    /logout-chatgpt"}
          </pre>
          <blockquote>
            <strong>Experimental.</strong> These drive the vendors&apos; own login flows. They can break when those
            flows change, and they are not covered by any support agreement.
          </blockquote>

          <h2 id="keyboard-shortcuts" className="scroll-mt-24">
            Keyboard shortcuts
          </h2>
          <DocTable head={["Key", "Action"]} rows={mono(SHORTCUTS)} />

          <h2 id="sdk-and-server" className="scroll-mt-24">
            SDK and server
          </h2>
          <p>
            TermCoder is a monorepo. The engine is headless and can be driven from your own code, and an HTTP and
            WebSocket server powers the desktop app and the browser interface.
          </p>
          <ul>
            <li>
              <code>@termcoder/core</code> — the agent engine: sessions, tools, permissions, providers, MCP and LSP.
            </li>
            <li>
              <code>@termcoder/server</code> — the HTTP and WebSocket API, and the{" "}
              <code>termcoder-server</code> binary.
            </li>
            <li>
              <code>@termcoder/tui</code> — the terminal interface, and the <code>term</code> and{" "}
              <code>termcoder</code> binaries.
            </li>
          </ul>
          <p>
            See the{" "}
            <InlineLink href="https://github.com/Cartivo-Oficial/TermCoder/tree/main/docs">
              docs folder on GitHub
            </InlineLink>{" "}
            for the SDK and server API reference.
          </p>

          <h2 id="troubleshooting" className="scroll-mt-24">
            Troubleshooting
          </h2>
          <h3>The term command is not found</h3>
          <p>
            Make sure the install finished and that npm&apos;s global bin directory is on your PATH. Reopen the
            terminal after installing. <code>npm root -g</code> prints where the global install went.
          </p>
          <h3>It says a model needs a key</h3>
          <p>
            Run <code>/setup</code>, or set the provider&apos;s key with <code>/key</code>. To run without any key,
            pick a local Ollama model — see <InlineLink href="#running-locally">Running locally</InlineLink>.
          </p>
          <h3>An auth or quota error mid-task</h3>
          <p>
            The error line points you at <code>/setup</code>. Re-connect the provider or switch with{" "}
            <code>/model</code>, then <code>/retry</code>.
          </p>
          <h3>Nothing happens when I run term</h3>
          <p>
            Confirm Node 20 or newer with <code>node --version</code>, then reinstall with{" "}
            <code>npm install -g @termcoder/tui</code>.
          </p>
          <blockquote>
            Still stuck? Open an issue on{" "}
            <InlineLink href="https://github.com/Cartivo-Oficial/TermCoder/issues">GitHub</InlineLink>.
          </blockquote>
        </Prose>
      </div>

      <Footer />
    </div>
  );
}
