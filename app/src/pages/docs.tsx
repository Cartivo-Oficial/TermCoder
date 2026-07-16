import { Nav } from "@/components/site/nav";
import { Footer } from "@/components/site/footer";
import { Dither } from "@/components/dither";
import {
  A, B, C, Cm, H3, Kw, Li, List, Note, Ol, P, Pm, Pre, Section, Sidebar, Table, Tr,
  useScrollSpy, type NavGroup,
} from "@/components/docs";

const NAV: NavGroup[] = [
  {
    group: "Getting started",
    items: [
      ["getting-started", "Overview"],
      ["install", "Install"],
      ["first-run", "First run"],
      ["quickstart", "Quickstart"],
    ],
  },
  {
    group: "Using TermCoder",
    items: [
      ["how-it-works", "How it works"],
      ["commands", "Command reference"],
      ["modes", "Build and Plan modes"],
      ["mentions", "Files and sub-agents"],
    ],
  },
  {
    group: "Models",
    items: [
      ["models", "Models and providers"],
      ["keys", "Connecting a key"],
      ["local", "Running locally"],
    ],
  },
  {
    group: "Extending",
    items: [
      ["agents", "Custom agents"],
      ["skills", "Skills"],
      ["study", "Study mode"],
    ],
  },
  {
    group: "Do more",
    items: [
      ["autonomous", "Autonomous mode"],
      ["sync", "Sync, share, packs"],
      ["classrooms", "Classrooms"],
      ["web", "Run in the browser"],
    ],
  },
  {
    group: "Reference",
    items: [
      ["config", "Configuration"],
      ["terminal", "Terminal"],
      ["subscription", "Subscription login"],
      ["shortcuts", "Keyboard shortcuts"],
      ["sdk", "SDK and server"],
      ["troubleshooting", "Troubleshooting"],
    ],
  },
];

const IDS = NAV.flatMap((g) => g.items.map(([id]) => id));

const COMMANDS: [string, React.ReactNode][] = [
  ["/help", "Show all commands and keyboard shortcuts."],
  ["/setup", "Guided model setup — connect a provider or pick a local model."],
  ["/upgrade", "Connect a free Gemini key in two steps for faster, stronger answers."],
  ["/key", <><C>/key &lt;provider&gt; &lt;key&gt;</C> — save an API key for a provider.</>],
  ["/model", "Open the model picker (search, favorites, connect a provider)."],
  ["/background", <><C>/background &lt;goal&gt;</C> — work unattended until the tests pass.</>],
  ["/agent", "Switch the active agent for this session."],
  ["/agents", "List the agents available in this project."],
  ["/commands", "List custom project commands."],
  ["/skills", "List skills the agent can load on demand."],
  ["/tools", "Show the tools the current agent may use."],
  ["/auto", "Toggle auto-approval of permissions for this session."],
  ["/theme", "Change the color theme (saved for next time)."],
  ["/new", "Start a fresh session."],
  ["/sessions", "List past sessions in this project."],
  ["/resume", "Resume a previous session."],
  ["/retry", "Re-run the last prompt."],
  ["/suggest", "Suggest a useful follow-up for the current context."],
  ["/tokens", "Show token usage for the session."],
  ["/init", <>Create an <C>AGENTS.md</C> with project instructions.</>],
  ["/flashcards", <><C>/flashcards &lt;topic&gt;</C> — generate study cards into a deck.</>],
  ["/decks", "List your study decks, due counts, and streak."],
  ["/review", "Review the cards due today, one at a time."],
  ["/login", "Connect a GitHub token for sync, share, packs, and classrooms."],
  ["/sync", "Sync settings, drafts, and decks across machines."],
  ["/share", "Export the session as HTML you can share."],
  ["/publish", "Publish the session to a link anyone can open."],
  ["/import", <><C>/import &lt;link&gt;</C> — open a shared session.</>],
  ["/pack", "Publish, install, or list packs of agents, skills, and commands."],
  ["/class", "Create or join a classroom; manage assignments and submissions."],
  ["/clear", "Clear the screen."],
  ["/exit", "Quit termcoder."],
];

const SHORTCUTS: [string, string][] = [
  ["shift+tab", "Toggle Build / Plan mode."],
  ["ctrl+p", "Open the command palette."],
  ["/", "Open the command menu."],
  ["@", "Attach a file."],
  ["$", "Delegate to a sub-agent."],
  ["Esc", "Interrupt the current turn."],
  ["↑ / ↓", "Cycle through your previous prompts."],
  ["Ctrl+← / →", "Jump by word in the input."],
  ["\\ + Enter", "Insert a newline without sending."],
];

export default function Docs() {
  const active = useScrollSpy(IDS);

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="docs" />

      <div className="relative overflow-hidden border-b border-border">
        <Dither className="pointer-events-none absolute inset-0 h-full w-full opacity-60" side="top" tone="seam" band={0.32} />
        <div className="relative mx-auto max-w-6xl px-6 py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            <span className="text-primary">❯</span> docs
          </p>
          <h1 className="mt-4 font-display text-4xl font-light leading-[1] tracking-[-0.035em] text-foreground sm:text-5xl">
            Documentation
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Everything you need to install TermCoder, run it, and make it your own.
          </p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 py-12 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-[84px] max-h-[calc(100vh-104px)] overflow-y-auto pb-8">
            <Sidebar nav={NAV} active={active} />
          </div>
        </aside>

        <main className="min-w-0">
          <Section id="getting-started" title="Overview">
            <P>
              TermCoder is an open source AI coding agent that runs in your terminal. You describe a task in plain
              language; it reads the relevant files, proposes and applies edits, runs commands, and reports back —
              asking permission before anything that changes your machine.
            </P>
            <P>
              It ships one binary, <C>term</C>, and runs on a <B>free, keyless model out of the box</B> — nothing to
              sign up for or configure. Bring your own Anthropic, OpenAI, or Google Gemini key when you want more, or
              run a local model through Ollama. A second persona, <B>TermExplorer</B>, turns the same tool into a study
              assistant.
            </P>
          </Section>

          <Section id="install" title="Install">
            <P>
              You need <A href="https://nodejs.org">Node.js 18 or newer</A>. Install the CLI globally from npm:
            </P>
            <Pre>
              <Cm># Windows (PowerShell or CMD), macOS, or Linux</Cm>
              {"\nnpm install "}
              <Pm>-g</Pm>
              {" @termcoder/tui"}
            </Pre>
            <P>
              That adds two equivalent commands to your path — <C>term</C> and <C>termcoder</C>. Verify the install:
            </P>
            <Pre>
              {"term "}
              <Pm>--version</Pm>
            </Pre>
            <Note>
              <B>Desktop app.</B> Prefer a window? Download the installer from{" "}
              <A href="https://github.com/Cartivo-Oficial/TermCoder/releases">GitHub Releases</A>. It runs the same
              engine as the CLI, and bundles Node.
            </Note>
          </Section>

          <Section id="first-run" title="First run">
            <P>Open a terminal in a project folder and run:</P>
            <Pre>term</Pre>
            <P>Two things happen the first time:</P>
            <Ol>
              <li>
                <B>Trust prompt.</B> TermCoder asks whether you trust the current folder before it reads or runs
                anything in it. It remembers your answer per folder.
              </li>
              <li>
                <B>Nothing to set up.</B> TermCoder starts on the free, keyless model right away — just type. Want a
                faster or stronger model? Run <C>/upgrade</C> to connect a free Gemini key in two steps, <C>/setup</C>{" "}
                for the full guide, or pick a local Ollama model.
              </li>
            </Ol>
            <P>Type your request at the prompt and press Enter.</P>
          </Section>

          <Section id="quickstart" title="Quickstart">
            <P>A first session, end to end:</P>
            <Pre>
              <Cm># in your project folder</Cm>
              {"\nterm\n\n"}
              <Cm># connect a model (once)</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /setup\n\n"}
              <Cm># ask for a change — it reads, edits, and can run tests</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" add input validation to the signup form and run the tests\n\n"}
              <Cm># review the plan before it touches files</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /model            "}
              <Cm># switch models any time</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" shift+tab          "}
              <Cm># toggle Plan / Build mode</Cm>
            </Pre>
            <P>
              TermCoder shows each tool call as it happens, collapses long output, and prints a diff for every edit
              before applying it.
            </P>
          </Section>

          <Section id="how-it-works" title="How it works">
            <P>
              Each turn, the agent decides which tools to call to satisfy your request. The built-in tools let it read
              files, list and search the tree, write and edit files, run shell commands, and fetch the web.
            </P>
            <P>
              Anything that changes your machine — writing a file, running a command — goes through a{" "}
              <B>permission check</B> first. You can allow it once, allow it for the session, or deny it. Turn on{" "}
              <C>/auto</C> to auto-approve for the current session when you trust the task.
            </P>
            <P>
              Long tool output is collapsed in the transcript and trimmed from the model&apos;s context as the session
              grows, so a long conversation does not keep re-sending everything it has already read.
            </P>
          </Section>

          <Section id="commands" title="Command reference">
            <P>
              Type <C>/</C> at the prompt to open the command menu. The full set:
            </P>
            <Table head={["Command", "What it does"]}>
              {COMMANDS.map(([cmd, what]) => (
                <Tr key={cmd} k={cmd}>
                  {what}
                </Tr>
              ))}
            </Table>
          </Section>

          <Section id="modes" title="Build and Plan modes">
            <P>
              TermCoder has two modes. Toggle them with <C>shift+tab</C> — the current mode shows at the bottom of the
              screen.
            </P>
            <List>
              <Li>
                <B>Build</B> — the default. The agent can read, edit, write, and run commands (with your permission).
              </Li>
              <Li>
                <B>Plan</B> — read-only. The agent inspects the code and proposes an approach without changing any
                files. Use it to review a plan before committing to it, then switch to Build.
              </Li>
            </List>
          </Section>

          <Section id="mentions" title="Files and sub-agents">
            <P>Two characters give the agent extra context while you type:</P>
            <Table head={["Type", "Result"]}>
              <Tr k="@">A picker opens as you type a path; the file&apos;s contents go to the agent.</Tr>
              <Tr k="$">Hand the task to a specialist sub-agent (reviewer, tester, debugger, architect).</Tr>
            </Table>
            <P>
              Sub-agents run a focused sub-task with their own tools and report a summary back to the main session,
              which keeps the main context clean.
            </P>
          </Section>

          <Section id="models" title="Models and providers">
            <P>
              Open the picker with <C>/model</C>. It searches a live catalog of models and groups them:
            </P>
            <List>
              <Li>
                <B>Favorites</B> — models you have starred (<C>ctrl+f</C> in the picker).
              </Li>
              <Li>
                <B>TermCoder AI</B> — our own <C>termcoder/auto</C> and <C>termexplorer/auto</C>.
              </Li>
              <Li>
                <B>Cloud</B> — Anthropic, OpenAI, and Google models (need a key).
              </Li>
              <Li>
                <B>Local</B> — models served by Ollama on your machine.
              </Li>
            </List>
            <P>
              A filled dot means the model is ready to use; an open dot means it needs a key. You can also type a full{" "}
              <C>provider/model</C> id to add one that is not in the list.
            </P>
            <H3>termcoder/auto</H3>
            <P>
              The default. It routes each task by difficulty — a quick model for simple edits, a stronger one for harder
              work — and reviews its own changes before finishing. With no key it runs on the free, keyless model;
              connect a key and it routes to that automatically.
            </P>
            <H3>A reliable keyless tier</H3>
            <P>
              The free model is community-hosted and can get busy. When a request fails, TermCoder retries it and — if
              you have connected a key — falls back to it, so a hiccup does not kill your turn. Run <C>/upgrade</C> to
              connect a free Gemini key in two steps for faster, steadier answers.
            </P>
          </Section>

          <Section id="keys" title="Connecting a key">
            <P>
              The easiest path is <C>/setup</C>. To set a key directly:
            </P>
            <Pre>
              <Pm>❯</Pm>
              {" /key anthropic sk-ant-...\n"}
              <Pm>❯</Pm>
              {" /key openai sk-...\n"}
              <Pm>❯</Pm>
              {" /key google AIza..."}
            </Pre>
            <P>
              Keys are stored in your user config directory, not in the project. TermCoder also reads standard
              environment variables if they are set:
            </P>
            <Table head={["Provider", "Environment variable"]}>
              <Tr k="Anthropic">
                <C>ANTHROPIC_API_KEY</C>
              </Tr>
              <Tr k="OpenAI">
                <C>OPENAI_API_KEY</C>
              </Tr>
              <Tr k="Google Gemini">
                <C>GEMINI_API_KEY</C> or <C>GOOGLE_GENERATIVE_AI_API_KEY</C>
              </Tr>
            </Table>
          </Section>

          <Section id="local" title="Running locally">
            <P>
              To run without any provider key, install <A href="https://ollama.com">Ollama</A> and pull a model:
            </P>
            <Pre>
              <Cm># pull a capable local coding model</Cm>
              {"\nollama pull qwen2.5-coder\n\n"}
              <Cm># then pick it in TermCoder</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /model   "}
              <Cm># choose it under &quot;Local&quot;</Cm>
            </Pre>
            <P>TermCoder detects running Ollama models automatically and lists them in the picker.</P>
          </Section>

          <Section id="agents" title="Custom agents">
            <P>
              An agent is a named role with its own prompt, model, and tool permissions. Define one by adding a Markdown
              file with front matter to <C>.termcoder/agents/</C> in your project (or the same folder under your user
              config for a global agent):
            </P>
            <Pre>
              <Cm># .termcoder/agents/reviewer.md</Cm>
              {"\n"}
              <Pm>---</Pm>
              {"\n"}
              <Kw>description</Kw>
              {": Reviews changes, never edits\n"}
              <Kw>mode</Kw>
              {": subagent\n"}
              <Kw>model</Kw>
              {": anthropic/claude-sonnet-5\n"}
              <Kw>tools</Kw>
              {": [read, ls, grep, glob]\n"}
              <Pm>---</Pm>
              {"\nYou are a careful code reviewer. Point out correctness bugs and\nrisky changes. Do not modify files; describe what should change."}
            </Pre>
            <P>
              Switch to an agent with <C>/agent</C>, or hand it a sub-task with <C>$</C>. Restricting <C>tools</C> is
              enough to make an agent read-only.
            </P>
          </Section>

          <Section id="skills" title="Skills">
            <P>
              A skill is a reusable playbook the agent loads only when a task calls for it — a set of instructions, and
              optionally scripts or examples. Add skills under <C>.termcoder/skills/</C>:
            </P>
            <Pre>
              <Cm># .termcoder/skills/release/SKILL.md</Cm>
              {"\n"}
              <Pm>---</Pm>
              {"\n"}
              <Kw>name</Kw>
              {": release\n"}
              <Kw>description</Kw>
              {": Cut a release — bump version, tag, changelog\n"}
              <Pm>---</Pm>
              {"\nSteps to cut a release in this repo:\n1. Bump the version in package.json\n2. Update CHANGELOG.md\n3. Commit, tag, and push"}
            </Pre>
            <P>
              List available skills with <C>/skills</C>. The agent reads a skill&apos;s full instructions the moment it
              decides to use it, so idle skills cost nothing.
            </P>
          </Section>

          <Section id="study" title="Study mode">
            <P>
              TermCoder ships a sister persona for schoolwork. Open <C>/model</C> and pick <C>termexplorer/auto</C>. The
              tool switches from a coding agent to a patient tutor:
            </P>
            <List>
              <Li>Explains concepts step by step, in your language.</Li>
              <Li>Summarizes notes, articles, or a chapter into key points.</Li>
              <Li>Builds flashcards, practice quizzes, and study plans.</Li>
              <Li>Works through homework by showing the reasoning, not just the answer.</Li>
            </List>
            <P>No programming knowledge is needed — just ask.</P>
            <H3>Spaced repetition</H3>
            <P>
              Flashcards go into decks and come back on a spaced-repetition schedule, so you review each card right
              before you&apos;d forget it. Reviewing builds a daily streak.
            </P>
            <Pre>
              <Pm>❯</Pm>
              {" /flashcards the water cycle   "}
              <Cm># make cards, add to a deck</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /decks                         "}
              <Cm># decks, due counts, and streak</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /review                        "}
              <Cm># reveal each card, then grade it 0–5</Cm>
            </Pre>
            <P>
              In the desktop app the same decks live under the <B>Study</B> button.
            </P>
          </Section>

          <Section id="autonomous" title="Autonomous mode">
            <P>
              Hand TermCoder a goal and let it work unattended. It plans, edits, and runs your project&apos;s check,
              feeds any failure back into the next round, and keeps going until the check passes or it runs out of
              rounds.
            </P>
            <Pre>
              <Pm>❯</Pm>
              {" /background add input validation to the signup form and make the tests pass"}
            </Pre>
            <P>
              It auto-approves its own changes while it runs and checkpoints each round, so you can revert. TermCoder
              detects the check from your project — an npm <C>test</C>, <C>typecheck</C>, or <C>build</C> script,{" "}
              <C>go build</C>, <C>cargo check</C>, or <C>pytest</C>. In the desktop app, toggle the autonomous button in
              the composer and send your goal.
            </P>
          </Section>

          <Section id="sync" title="Sync, share, and packs">
            <P>
              TermCoder uses GitHub as its backend — no server to run. Connect a token once with <C>/login</C> (it needs
              the <B>gist</B> scope); it is stored in your user config, never in the project.
            </P>
            <Table head={["Command", "What it does"]}>
              <Tr k="/sync">
                Mirror your settings, drafts, and study decks to a private gist, and pull them on another machine. Last
                write wins.
              </Tr>
              <Tr k="/publish">Publish the current session; you get a link that opens in a hosted viewer.</Tr>
              <Tr k="/import">Open a shared session from its link into a fresh session.</Tr>
              <Tr k="/pack publish">Bundle this project&apos;s agents, skills, and commands into a pack.</Tr>
              <Tr k="/pack install">
                Install a pack from a gist or an <C>owner/repo</C> into your project.
              </Tr>
            </Table>
            <Note>
              <B>Secrets never sync.</B> API keys stay on your machine — sync and share use private gists and carry
              settings and content only, never your keys.
            </Note>
          </Section>

          <Section id="classrooms" title="Classrooms">
            <P>
              A classroom lets a teacher share packs and assignments with students, all through GitHub. A class is a
              private gist; joins, submissions, and the roster ride gist comments — async, with nothing to host.
            </P>
            <Pre>
              <Cm># teacher</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {' /class create "Algorithms 101"\n'}
              <Pm>❯</Pm>
              {' /class assign "Sorting exercise"\n\n'}
              <Cm># student</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /class join <link>        "}
              <Cm># installs the class&apos;s shared packs</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /class submit             "}
              <Cm># publishes your session and posts the link</Cm>
              {"\n\n"}
              <Cm># teacher</Cm>
              {"\n"}
              <Pm>❯</Pm>
              {" /class submissions        "}
              <Cm># see who submitted what</Cm>
            </Pre>
            <P>Joining installs the class&apos;s shared packs, so every student starts with the same agents and skills.</P>
          </Section>

          <Section id="web" title="Run in the browser">
            <P>
              The same engine runs three ways: the <C>term</C> CLI, the desktop app, and a browser. Start the local
              server and open the full interface in any browser on your network:
            </P>
            <Pre>
              <Cm># serve the web app from your machine</Cm>
              {"\ntermcoder-server\n"}
              <Cm># then open the printed http://localhost:PORT</Cm>
            </Pre>
            <P>
              Shared sessions also open on their own — a <C>/publish</C> link renders in a hosted viewer with nothing
              installed.
            </P>
          </Section>

          <Section id="config" title="Configuration">
            <P>
              Project settings live in <C>.termcoder/</C> in your repo. Personal settings and secrets live in your user
              config directory:
            </P>
            <Table head={["Location", "Holds"]}>
              <Tr k=".termcoder/agents/">Project agents.</Tr>
              <Tr k=".termcoder/commands/">Project commands.</Tr>
              <Tr k=".termcoder/skills/">Project skills.</Tr>
              <Tr k="AGENTS.md">
                Always-on project instructions (create with <C>/init</C>).
              </Tr>
              <Tr k="user config dir">API keys, theme, favorites, trusted folders, drafts.</Tr>
            </Table>
            <Note>
              <B>Secrets stay out of git.</B> Keys are written to your user config directory, never to the project. Keep{" "}
              <C>.termcoder/</C> in your <C>.gitignore</C> if it holds anything local.
            </Note>
            <P>
              Change the theme any time with <C>/theme</C>; your choice is saved for next time.
            </P>
          </Section>

          <Section id="terminal" title="Terminal">
            <P>
              The desktop app embeds a real terminal. Open it with the <B>Chat | Terminal</B> tabs at the top of the
              centre column, or press <C>Ctrl</C> + <C>{"`"}</C>. It runs your default shell in the project folder.
            </P>
            <P>
              TermCoder scans your <C>PATH</C> and shows a one-click chip for each coding CLI it finds: Claude Code,
              termcoder, Codex, and Gemini CLI. The shell keeps running while you are on the Chat tab.
            </P>
          </Section>

          <Section id="subscription" title="Subscription login">
            <P>Instead of an API key, you can sign in with a plan you already have.</P>
            <Pre>
              <Pm>/login-claude</Pm>
              {"   "}
              <Cm># Claude Pro or Max</Cm>
              {"\n"}
              <Pm>/login-chatgpt</Pm>
              {"  "}
              <Cm># ChatGPT Plus or Pro</Cm>
            </Pre>
            <Note>
              <B>Experimental.</B> These use the vendors&apos; own login flows. They can break when those flows change,
              and they are not covered by any support agreement.
            </Note>
          </Section>

          <Section id="shortcuts" title="Keyboard shortcuts">
            <Table head={["Key", "Action"]}>
              {SHORTCUTS.map(([k, v]) => (
                <Tr key={k} k={k}>
                  {v}
                </Tr>
              ))}
            </Table>
          </Section>

          <Section id="sdk" title="SDK and server">
            <P>
              TermCoder is a monorepo. The engine is headless and can be driven from your own code, and an HTTP +
              WebSocket server powers the desktop app.
            </P>
            <List>
              <Li>
                <C>@termcoder/core</C> — the agent engine: sessions, tools, permissions, providers.
              </Li>
              <Li>
                <C>@termcoder/server</C> — the HTTP + WebSocket API.
              </Li>
              <Li>
                <C>@termcoder/tui</C> — the terminal interface (the <C>term</C> binary).
              </Li>
            </List>
            <P>
              See the <A href="https://github.com/Cartivo-Oficial/TermCoder/tree/main/docs">docs folder on GitHub</A>{" "}
              for the SDK and server API reference.
            </P>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <H3>
              The <C>term</C> command isn&apos;t found
            </H3>
            <P>
              Make sure the install finished and that npm&apos;s global bin directory is on your PATH. Reopen the
              terminal after installing. Check with <C>npm root -g</C>.
            </P>
            <H3>It says a model needs a key</H3>
            <P>
              Run <C>/setup</C>, or set the provider&apos;s key with <C>/key</C>. To run without a key, use a local
              Ollama model (see <A href="#local">Running locally</A>).
            </P>
            <H3>An auth or quota error mid-task</H3>
            <P>
              The error line points you to <C>/setup</C>. Re-connect the provider or switch models with <C>/model</C>,
              then <C>/retry</C>.
            </P>
            <H3>
              Nothing happens when I run <C>term</C>
            </H3>
            <P>
              Confirm Node.js 18+ with <C>node --version</C>, then reinstall with <C>npm install -g @termcoder/tui</C>.
            </P>
            <Note>
              Still stuck? Open an issue on{" "}
              <A href="https://github.com/Cartivo-Oficial/TermCoder/issues">GitHub</A>.
            </Note>
          </Section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
