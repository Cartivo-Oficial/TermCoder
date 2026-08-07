# Desktop vocabulary and workspace — design

**Goal:** the desktop stops looking unfinished, and stops wasting half its screen while the agent works.

Two moves, in one project because the second would otherwise invent a fifth visual language: the four primitives become usable and get adopted across the surfaces a user sees constantly, and a work panel appears beside the chat when — and only when — there is work to show.

## Why the primitives are dead code

`Btn`, `Row`, `Panel` and `Chip` were built with complete CSS, focus rings and tokens. Six consecutive sweep tasks examined their own controls against them and refused, each with a concrete reason, and **no file in the renderer imports from `./ui`**.

The refusals were right, and they came down to four things, each small:

- **`Row` and `Panel` render a `<div>`.** They cannot replace a `<button>` without dropping button semantics — keyboard activation, the implicit role, `disabled`. This blocked the clearest match in the app: after Task 8's sweep, `.settings-nav button` is declaration-for-declaration identical to `.u-row`.
- **`Btn` has no tone that fills with `var(--text)`.** It has `solid`, which fills with `var(--accent)`. In the default theme those look alike because the accent is near-white; on any coloured theme they diverge, which is exactly when it matters. The app's primary button (`.settings-btn.primary`, styles.css:733) fills with `--text`.
- **`Chip` always renders `<button aria-pressed>`.** The app's status pills are non-interactive `<span>`s. Announcing a `<span>` as a pressable button is worse than not using a primitive at all.
- **`Panel` cannot express a selected card.** `.session-card.active` marks selection with `inset 2px 0 0 var(--accent)` composed with `var(--sh-float)`; a two-value elevation prop has no way to say that.

So the fix is four small, named changes, not a redesign of the primitives:

| primitive | change |
| --- | --- |
| `Row` | an `as` prop (`div` default, `button`, `a`) — the rendered element changes, nothing else |
| `Panel` | an `as` prop, and a `selected` boolean that renders the inset accent rail |
| `Btn` | a `strong` tone that fills with `var(--text)`, beside the existing accent-filled `solid` |
| `Chip` | a non-interactive form: renders a `<span>` with no `aria-pressed` when it takes no `onClick` |

Everything a primitive replaces keeps its handlers, `disabled`, `title`, `aria-*`, `role`, `tabIndex` and `type`. A primitive that swallows one of those is a defect, not a simplification.

## Which surfaces get the vocabulary

The six a user is looking at essentially all the time, and the same six that already sit on the token scales — so this is finishing, not foundation: **chat and composer, the sessions list and rail, the terminal chrome, Settings, and the new work panel.**

The 254 selectors still on the style guard's allowlist are out of scope. They are named there precisely so this decision is visible rather than implied.

## The work panel

A new session opens as it does today: chat, centred, calm. The panel is absent, not empty — an empty panel taking half the screen is the same defect as the empty chat, mirrored.

**It opens when the session produces work,** and shows what that work is:

| what the agent did | what the panel shows |
| --- | --- |
| edited or wrote a file | the diff |
| ran a command | the terminal |
| started a sub-agent | the canvas |

**It follows the newest activity until the user touches it.** Selecting a tab pins the panel there: it stops following and stays where it was put. The pin lasts until the current turn ends — when the agent finishes and the session is idle, the next turn starts following again. Pinning is how you say "I am reading this", and a turn boundary is the natural place for that to expire; carrying a pin across turns would mean the panel silently stops working for the rest of the session. This is the difference between a panel that keeps up with the agent and one that jumps out from under the cursor.

**It does not close on its own once it has opened.** A command finishing is not a reason to take its output away — the moment you most want to read a diff is right after it lands. Within a session the panel opens once and stays, following or pinned; the user can close it by hand, and a new session starts without it. "Absent until there is work" is about the calm opening screen, not about a panel that flickers in and out as tools come and go.

The decision of which tab to show is a pure function of the same event stream the canvas already consumes (`SessionEventLike` in `canvas/runGraph.ts`: `tool-call`, `tool-result`, `subagent-start`, `subagent-end`, `done`) plus the pin state. It holds no React state of its own and touches no DOM, which is what makes it testable in an environment with no display.

## What the panel replaces, and what survives

`ViewSwitcher.tsx` (74 lines) and the `centerTab` state it drives (`App.tsx:403`) go away. Chat is no longer one of three mutually exclusive views: chat is the session, and terminal, canvas and diff become tabs of the panel beside it. `App.tsx:2371` and `:2376`, which hide the terminal deck and the canvas by comparing `centerTab`, are replaced by the panel's own visibility.

**The full IDE stays**, unchanged and reachable as its own mode. Editing a file is a different activity from watching an agent work, not a fourth way to see the same thing. `IDELayout.tsx` is not restructured here either — the finish pass tokenised it and deferred restructuring, and this project narrows that further: the IDE keeps its own layout, and only its shared controls pick up the primitives.

The inline review strip is untouched. It belongs to the editor, not to this panel.

## How this is verified, given nobody can look at it

This is the weak point and the design has to carry it: no one in the chain that produced the last six swept surfaces has seen the app running — the environment has no display and Electron exits without a window. So the design leans on checks that do not need eyes.

- **The panel's behaviour is a pure function, and is tested as one.** Given a sequence of session events, which tab; given a pin, that it holds; given idle, that following resumes; given no work, that the panel is absent. No DOM, no renderer.
- **Every converted control gets a behaviour test.** That it still renders the same element type, and still carries its handler, `disabled` and `aria-*`. The real regression when markup moves to a primitive is not visual — it is a button that became a `div` and left the keyboard.
- **The style guard already prevents the finish drifting back off the scale**, and it now reads every declaration rather than the first per line.
- **A human still has to look**, and the plan will say exactly what at: both themes, compact density, and the panel opening and closing while an agent actually works.

## Not in this project

- The 254 surfaces on the guard's allowlist.
- Restructuring `IDELayout.tsx`, or changing what the IDE does.
- Any palette, theme, `data-density` or `data-motion` change.
- Third-party agents, parallel orchestration, and the canvas's own visual redesign — those are projects 3, 4 and 5 in the agreed queue.
- Deleting `simple-icons`, the review strip, or anything else not named above.
