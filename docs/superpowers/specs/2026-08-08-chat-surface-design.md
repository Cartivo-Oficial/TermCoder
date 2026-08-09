# The chat surface — design

**Goal:** an assistant reply opens with what it did, not with prose about what it did.

## What is wrong today

Our chat is a stack of text. When the agent edits nine files, runs the typechecker and the tests, and then explains itself, all of that arrives as paragraphs with tool cards interleaved. Everything the user actually wants to know first — which files moved, by how much, how long it took, whether the checks passed — is either buried in the prose or spread across cards they have to scroll back through.

The reference the user pointed at leads with a summary: the task's title, a total (`+531 −149`), the files touched with a count each, `Worked for 50s`, then `All checks pass (typecheck clean, 0 lint errors, fmt clean)` — and only then the explanation.

That is not decoration. It is the difference between reading a reply and auditing one.

## The correction that makes this possible now

An earlier analysis in this repository rejected copying that layout, on the grounds that its density exists to hold eight third-party agents while TermCoder *is* the agent. **That reasoning expired in 0.13.0**, which gave TermCoder exactly that capability. The objection is withdrawn; the density now has the same justification here that it has there.

## We already have the data

Nothing here needs new instrumentation. It needs us to stop discarding what already flows past:

| what the summary shows | where it comes from |
| --- | --- |
| files touched, and `+n −m` per file | the `patch` on a `tool-call` for `write` and `edit`. Every `PatchHunk` carries its `lines`, each prefixed `+`, `-` or a space. |
| the totals | the sum of the above |
| how long the turn took | the timestamps the renderer already has when it starts and finishes a turn |
| whether checks passed | `tool-result` for `bash`, which carries `isError` and the command that produced it |

The one gap: the renderer's `Message` type (`App.tsx:138`) is flat — `role`, `text`, `name`, `status`, `detail`, `images` — and drops the patch on the floor. It gains the patch and the target path, and nothing else.

## What gets built

**A pure summary.** `turnSummary(messages)` takes the tool messages of one assistant turn and returns `{ files: Array<{ path, added, removed }>, added, removed, seconds, checks: Array<{ command, ok }> }`. No React, no DOM — which is what lets it be tested in an environment that cannot open a window.

**A summary card** at the head of an assistant reply that did work. A reply that only talks does not get one — a card reading "0 files, 0s" is noise.

**Honest checks.** We report what a command did, not what we wish it meant. `isError` from the tool result is the truth we have; we do not parse output looking for the words "0 errors". A check is the command's own name and whether it exited clean. If that reads as thinner than the reference, it is thinner *and correct*, and parsing another tool's output for a green tick is exactly how a UI starts lying.

**The message itself, rebuilt.** The user's message, the assistant's, and the tool cards get a real hierarchy: a card with its own head and body rather than a run of text with dividers. This is where the finish pass's tokens and the `Panel` primitive finally do the job they were built for.

## What this is not

- **Not a copy of anyone's code.** Synara is MIT and could be lifted with its notice, but a chat surface is bound to its own data model; taking the standard and writing our own is both cleaner and less work here. Nothing is copied.
- Not the canvas, not the IDE, not the work panel's other tabs.
- Not a change to the composer's behaviour. Its look may follow the same tokens; what it does stays as it is.
- Not a parser of tool output. See "honest checks".
- Not a change to `Message`'s roles or to how messages are stored or replayed.

## How it is verified

- **`turnSummary` is a pure function and is tested as one**: a turn with no work, one with edits to three files, one where a check failed, one where a patch is missing because the tool did not produce one.
- The counts are checked against real `PatchHunk` data, not hand-written objects, so a change in how patches are produced fails here rather than in the UI.
- The style guard keeps the new surface on the scale.
- **A human looks at it.** Every visual surface in the last three projects shipped unseen, and this is the one the user looks at longest. The plan will name exactly what to check.
