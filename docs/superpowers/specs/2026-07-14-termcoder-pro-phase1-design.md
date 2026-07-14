# termcoder Pro — Phase 1 (MVP monetization)

## Context and decisions

termcoder is pivoting from "100% free" to an **open-core** model: the solo
coding agent stays free and open source; hosting collaboration (live rooms and
classrooms) becomes a paid **termcoder Pro** feature.

Decisions locked with the user (2026-07-14):

- **Tier shape:** Pro for Teams & Classrooms.
- **Paywall boundary:** *the host pays, joining is always free.* Creating/hosting
  a live room or a classroom requires Pro; connecting to someone else's room or
  submitting to a class is free and unlimited. This protects the student growth
  engine and charges the party with a budget (teacher / team lead / school).
- **License mechanism:** signed **offline** license keys (Ed25519), verified in
  the app against an embedded public key. No server, no infra.
- **Payment:** the user sets up Gumroad / Lemon Squeezy (auto-delivers the key on
  purchase). We build validation, gating, the activation UI, and a key generator
  for manual issuance in the meantime.
- **Open-core honesty:** the client-side gate is bypassable by a determined user
  recompiling the OSS build. Accepted — the target payer (teacher/school/team)
  values legitimacy, support, and not maintaining a fork. This is how GitLab,
  Sentry, etc. monetize.
- **Naming:** "termcoder Pro".
- **Out of scope for Phase 1:** package renames / `apps` vs `packages` moves
  (they would break the published `@termcoder/*` npm packages, CI, and release).

Phase 1 is the MVP that makes money flow over features that already exist (rooms
+ A/V, classrooms). Phases 2 (teacher dashboard, grading, cross-device sync) and
3 (OSS-polish + site rewrite + side-by-side terminals) are separate specs.

## Goal

Ship a working paywall: a host with a valid Pro key can host rooms/classrooms; a
host without one is cleanly blocked and shown how to upgrade. Joining is never
gated.

## Design

### License module — `packages/core/src/license/license.ts`

- Key format: `<base64url(payloadJSON)>.<base64url(signature)>`.
- Payload: `{ email: string, tier: "pro", issued: number, expires?: number, name?: string }`.
- `verifyLicenseKey(key: string, publicKeyPem?: string): LicenseInfo` — splits on
  `.`, verifies the Ed25519 signature over the payload bytes with
  `crypto.verify(null, payloadBytes, publicKey, sig)`, parses the JSON, checks
  `expires` against now. Returns `{ active, tier, email, expires?, reason? }`.
  Any malformed/tampered/expired key returns `{ active: false, reason }` — never
  throws.
- The **public key** is embedded as a PEM constant (`PRO_PUBLIC_KEY`). The
  private key is never in the repo.
- `licenseStatus(config)` reads the stored key (`config.license` in global
  config.json, or `~/.config/termcoder/license.json`) and returns its
  `LicenseInfo`; absent key → `{ active: false }`.
- `saveLicenseKey(key, env)` stores it after a successful verify; refuses to
  store an invalid key.
- Uses only Node `crypto` (Ed25519) — no new dependency.

### Key tooling — `packages/core/scripts/`

- `gen-keypair.mjs` — run once; writes `pro-private.pem` (git-ignored, user keeps
  safe) and prints the public PEM to paste into `PRO_PUBLIC_KEY`.
- `gen-license.mjs` — `node gen-license.mjs --email x@y.com [--expires 2027-01-01] [--name "..."]`;
  reads the private key from `TERMCODER_LICENSE_KEY_PATH` (or `./pro-private.pem`),
  signs a payload, prints the license key. This is how the user issues keys until
  Gumroad automation is wired.
- `.gitignore` gains `pro-private.pem` and `*.license.pem`.

### Gating — host actions require Pro

Enforced in `@termcoder/server` (which runs on the host's machine inside the
desktop app), reading `licenseStatus(ctx.config)`:

- **Live rooms:** in `handleSocket`, a socket may always connect as participant
  #1 (the host working solo) and may always **join** an already-hosted room. A
  socket that would make the host's own room exceed one participant is rejected
  with a `room-locked` message ("The host needs termcoder Pro to host a room.")
  unless the host is licensed. Concretely: when `room.sockets.size >= 1` and the
  new joiner is on the host instance and the host is unlicensed, refuse the extra
  join. (Joining a *remote* host's room hits that host's server, which enforces
  its own license — so a licensed teacher's class admits unlimited free students.)
- **Classrooms:** `POST` create-classroom and add-assignment routes return `402`
  with a friendly body when unlicensed; join/submit/list stay open.
- New `GET /license` (status for the UI) and `POST /license` (activate a key →
  `saveLicenseKey`, returns the new status; 400 on invalid).

### Desktop UI

- Settings gains a **termcoder Pro** section: current status (Free, or Pro with
  email + expiry), a paste-a-key field with **Activate**, and a **Get Pro** link
  to the pricing page. Wires to `GET/POST /license`.
- When a free user triggers a gated action (host a room / create a class), show
  an upgrade prompt linking to the pricing page instead of a raw error.
- i18n en/pt/es for the new strings.

### Website — `website/pricing.html`

- Free vs Pro comparison (Free: full solo agent + join any room/class; Pro: host
  rooms, run classrooms, teacher tools, cross-device sync). Price + a **Get Pro**
  button pointing to the payment link (placeholder until the user provides it).
- Follows the site guardrails (`tools/verify.mjs`: no inline `<style>`, links
  `style.css`, no emoji, no pinned version, subscription→experimental). Add a
  Pricing nav link across pages; cache-bust bump.

## Testing

- `license.test.ts`: gen a keypair in-test, sign a payload, verify a valid key
  passes; tampered payload, wrong signature, and expired key each fail with
  `active: false`; malformed strings never throw.
- Key-generator round-trip: `gen-license` output verifies against the matching
  public key.
- Server gating tests: guest join rejected / createClassroom 402 without a
  license; both allowed once a license is activated (inject a test keypair via a
  `publicKeyPem` override so tests don't depend on the embedded key).
- `verify.mjs` passes with the new pricing page.

## What we build vs what the user does

- **We build:** license module, key generator + keypair script, server gating +
  `/license` routes, desktop Pro settings + upgrade prompts, pricing page, tests.
- **The user does:** run `gen-keypair` once and keep `pro-private.pem` safe; set
  up Gumroad/Lemon Squeezy and paste its purchase link into the pricing page;
  issue keys with `gen-license` until Gumroad automation is added; decide the
  price; formalize the open-core license terms.

## Risks

- Client-side gate is bypassable on an OSS build (accepted; open-core).
- The private key must never be committed — the generator reads it from disk/env;
  `.gitignore` covers it; `PRO_PUBLIC_KEY` is the only embedded half.
- Gating rooms must not break the solo experience or free joining — the tests
  above pin both directions.
