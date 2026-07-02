---
name: add-tests
description: Add focused unit tests for a function or module the user names
---
Add unit tests for the code the user points you at.

1. Read the target file and identify its public surface (exported functions,
   classes, edge-case branches). Look at an existing test file nearby first to
   match the framework, imports, naming, and assertion style — do NOT introduce
   a new test framework.
2. Cover the important cases: the happy path, boundary values, empty/invalid
   input, and any error branches. Prefer several small, named tests over one big
   one. Keep each test independent (no shared mutable state).
3. Put the tests in the project's conventional location (e.g. a sibling
   `*.test.ts`) and run the suite to confirm they pass. Fix real bugs you find
   in the code rather than writing tests that assert wrong behavior.
4. Report what you covered and any cases you deliberately left out and why.
