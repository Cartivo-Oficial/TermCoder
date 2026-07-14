# Desktop send-message animation — "rise & settle"

## Goal

Make sending a message in the desktop chat feel smooth and elegant. Today a new
message just fades and slides 6px in 180ms (`msgIn`) — it appears rather than
arrives, with no felt connection between the composer and the thread. Refine the
message-entry motion into a calm, native "rise & settle" glide, and add light
tactile feedback on the send button.

Character chosen (from a live demo of three options): **A — rise & settle** —
the calmest, most native option, a refinement of the existing motion. Not the
more expressive "travels up from the composer" or "unfold" variants.

## Scope

In scope:

1. Message-entry animation — a new `msgRise` keyframe applied to user and
   assistant messages.
2. Tool cards and notices — a quicker, quieter fade (not the full rise), so an
   agent turn firing many tool calls doesn't turn into a wall of motion.
3. Send-button tactile feedback — a subtle press on click.

Out of scope (deferred, may revisit):

- A "thinking…" placeholder line in the thread. The busy state already shows the
  composer glow plus the status bar; adding a thread element is a separate change.
- Staggered/cascading entry across a loaded transcript.

## Design

### Message entry — `msgRise`

```css
@keyframes msgRise {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to   { opacity: 1; transform: none; }
}
```

- Duration ~360ms, easing `cubic-bezier(0.22, 1, 0.36, 1)` (soft ease-out, no
  overshoot — overshoot would read as "playful", which we explicitly rejected).
- Applied to the user bubble on send and the assistant reply on arrival, so both
  sides share one motion language.

### Tool cards / notices — quick fade

Tool cards (`.msg` wrapping a `ToolCard`) and notices keep a short fade only
(reuse the existing `fadeIn`, ~140–160ms, no transform). Rationale: during an
agentic run many tool cards mount in quick succession; a 360ms rise on each reads
as busy. A brief fade keeps them calm.

Because messages render as `.msg <role>` (`user` / `assistant` / `notice` /
`tool`), target by role: the rise goes on `.msg.user` and `.msg.assistant`; the
quick fade on `.msg.notice` and `.msg.tool`. (`.msg` no longer carries the
animation by itself.)

### Send-button feedback

The send button gets a subtle press via `:active { transform: scale(0.94); }`
with a ~140ms ease on `transform`. No new state or JS — CSS only.

## Accessibility

No special handling needed. Reduce-motion is already global: both
`:root[data-motion="off"] *` (the in-app toggle) and
`@media (prefers-reduced-motion: reduce)` force `animation-duration: 0s` and
`transition-duration: 0s` on everything, so every animation here collapses to an
instant appear. Verify by toggling the setting.

## Transcript-load behaviour

Messages use `key={i}`, so opening a session mounts all messages at once and they
animate together (same start time) rather than cascading. At 360ms this is a
single soft collective settle, which is acceptable and even pleasant. No change
needed; noted so it isn't mistaken for a bug.

## Files

- `packages/desktop/src/renderer/styles.css` — add `msgRise`; retarget `.msg`
  animation to `.msg.user` / `.msg.assistant` (rise) and `.msg.notice` /
  `.msg.tool` (quick fade); add send-button `:active`.

Expected to be CSS-only. No `App.tsx` change unless a class hook proves
necessary (the role classes already exist).

## Testing

- Build the web bundle, drive it in a browser: send a message and confirm the
  user bubble rises and settles smoothly; confirm the assistant reply uses the
  same motion; confirm tool cards fade quickly rather than rise.
- Toggle reduce-motion on and confirm messages appear instantly (no transform,
  no fade duration).
