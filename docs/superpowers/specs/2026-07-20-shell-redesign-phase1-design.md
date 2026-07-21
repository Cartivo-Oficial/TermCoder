# Desktop shell redesign — Phase 1 (visual language + Home) design

base: 91a5ab3 (post v0.11.2)
status: design (awaiting user review)

## Vision and decomposition

The user wants the desktop reworked toward the calm, minimal feel of opencode's redesign — but as **TermCoder's own identity**, not a clone. Reference mockup (approved): a near-chromeless home with a faded wordmark behind a centered composer, inline model/effort pickers, a quiet project·branch line, recent sessions, and Terminal/Canvas/Commands as **quiet on-demand chips** rather than stamped tabs.

Too large for one spec. Phases:
- **Phase 1 (this spec) — visual language + Home.** The calm home/empty state and the chrome-reduction + spacing philosophy that underpins everything else.
- **Phase 2 — session tabs.** Browser-style tabs for multiple sessions.
- **Phase 3 — features as options.** Rework the always-visible center tabs (chat/terminal/canvas) into on-demand views.
- **Phase 4 — settings + native menu polish.**

## What Phase 1 does NOT change (honor what exists)

The desktop already has a mature theme system — do not replace it:
- Token palette in `styles.css` `:root` (`--bg #0C0B0A` warm near-black, `--accent #FF7A45` ember, `--elev`, `--border`, `--text`, `--muted`, `--faint`, radius/transition/ease tokens).
- Light/dark via `data-theme`, plus multiple color themes (`COLOR_THEMES`/`THEME_VARS`, `tc-colortheme`), density (`data-density`), and motion (`data-motion`) modifiers.

So Phase 1 is **not** a recolor — the accent is already user-themeable and good. Phase 1 is about **layout, chrome, and breathing room**: the new Home, and applying the calmer spacing philosophy. Every new surface reads its colors from the existing tokens (never hardcodes the ember), so it works across all themes automatically.

## The Home (the centerpiece)

Today the empty session renders `<Hero>` inside `.transcript > .transcript-inner > .empty` (`App.tsx:1957-1971`), with the composer pinned at the bottom of `.center`. Phase 1 replaces that empty state with a **HomeView**: a calm, vertically-centered composition shown when the active session has no messages (`messages.length === 0`). It contains, top to bottom:

1. **Ghost wordmark** — a large, low-opacity "TermCoder" wordmark sitting behind the composer (color from `--text` at very low alpha, plus a faint ember tint on part of it). Purely atmospheric: `pointer-events: none`, `user-select: none`.
2. **The composer, centered.** Reuse the *existing* composer (model chip, effort/agent chip, attach, send) — do not rebuild it. On the Home it is visually centered rather than pinned to the bottom. When the first message is sent (transcript non-empty), the layout reverts to the normal transcript-scroll + bottom-composer with no change to the composer's behavior.
3. **Project · branch line** — the existing project/branch affordance, quiet and centered.
4. **Quiet feature chips** — Terminal · Canvas · Commands (⌘K), rendered as low-emphasis chips that only light up on hover. This previews the Phase 3 "features as options" direction on the Home specifically; it does not yet rework the in-session center tabs.
5. **Recent sessions** — a compact list of recent sessions (name, model·turns, relative time), each a click to open. Reads from the sessions the app already loads.

### Layout mechanism

Add a `home` state class to `.center` (or a wrapping element) active only when `messages.length === 0`. In that state, the center becomes a vertically-centered flex column that groups wordmark + composer + chips + recent, so the composer sits mid-screen. In the non-empty state the current layout (transcript scroll + bottom composer) is unchanged. The composer is the same DOM/React element in both — only its container's layout differs — so none of its behavior, refs, or handlers change.

### Chrome reduction on the Home

On the Home, collapse the left rail / sessions panel and side panels so the composition is genuinely centered and calm (they remain reachable — a hover/click affordance — but are not stamped across the empty screen). In-session, the existing chrome behavior is unchanged in Phase 1 (Phase 3 addresses in-session chrome). The exact "how the rail is reachable from the Home" is a plan detail; the intent is: empty Home = calm and centered, not the current full IDE frame.

## Visual refinement (spacing, not color)

- Introduce/confirm a small set of spacing rhythm values and apply them so the Home and its neighbors breathe (generous vertical gaps, a comfortable max content width ~660px for the composer group, ~660px for recent).
- The ghost wordmark and the quiet-chip pattern are the two new visual motifs; everything else derives from existing tokens.
- Respect `data-motion="off"` and `prefers-reduced-motion` for any Home entrance animation (keep it minimal — a soft fade at most).

## Componentization (chip away at the monolith)

`App.tsx` is ~2449 lines. Phase 1 extracts the Home into its own component `HomeView.tsx` (props: the composer element or a render slot, recent sessions, handlers to open a session / open a view / open commands). This keeps `App.tsx` from growing and gives the Home a testable-ish boundary. The composer itself is **not** extracted in Phase 1 (high-risk; deferred) — the Home receives it as a child/slot so it stays defined where it is.

## Data flow

`App` owns session/messages/model state as today → renders either `HomeView` (empty) or the transcript (non-empty) in `.center` → both share the one composer instance. `HomeView` gets: `recentSessions` (already loaded), `onOpenSession`, `onOpenView("terminal"|"canvas")`, `onOpenCommands`, and the composer as a slot. No server or session-protocol changes.

## Testing

- Mostly presentational; no new pure logic worth a unit test beyond any small helper (e.g. a relative-time formatter, if added — unit-test that).
- Manual gate (driven in the running app, screenshots): open the app to an empty session → the clean Home shows (wordmark, centered composer, quiet chips, recent sessions); type and send → layout reverts to transcript + bottom composer with the composer behaving exactly as before; recent-session click opens it; feature chips open terminal/canvas/commands; verify light and dark themes and at least one alternate color theme (to confirm nothing hardcoded the ember); verify `data-motion="off"`.

## Out of scope (logged — later phases)

- Session tabs (Phase 2).
- Reworking the in-session center tabs (chat/terminal/canvas) into on-demand views (Phase 3) — Phase 1 only previews the quiet-chip pattern on the Home.
- Settings redesign + native menu bar (Phase 4).
- Extracting the composer into its own component (deferred; high-risk).
- Any change to the color palette or theme system.
