# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities.

Report privately through GitHub: on the repository's **Security** tab, choose
**Report a vulnerability** to open a private advisory. Include:

- what the vulnerability is and where (package, file, or endpoint),
- steps to reproduce, and
- the impact you think it has.

We aim to acknowledge a report within a few days and to keep you updated as we
work on a fix. Once a fix ships, we're happy to credit you unless you prefer to
stay anonymous.

## Scope

TermCoder runs on your own machine and connects to the model providers and
GitHub with credentials you supply. Areas we especially care about:

- the local server (`@termcoder/server`) and its HTTP/WebSocket surface,
- how credentials, tokens, and license keys are stored and handled,
- the license verification path,
- anything that could execute code or write files outside the permission system.

## Supported versions

Fixes land on `main` and ship in the next release. Please test against the latest
release before reporting.

## Handling secrets

Never paste API keys, tokens, or license private keys into an issue, a PR, or a
discussion. If a secret is ever exposed, rotate it immediately.
