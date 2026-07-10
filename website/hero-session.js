window.HERO_SESSION = {
  "recorded": "2026-07-10",
  "model": "termcoderfree/auto",
  "cwd": "~/my-project",
  "prompt": "add a --version flag that prints the version from package.json, then run the tests",
  "trimmedFrom": 19,
  "lines": [
    {
      "kind": "prompt",
      "text": "add a --version flag that prints the version from package.json, then run the tests"
    },
    {
      "kind": "tool",
      "text": "read cli.js"
    },
    {
      "kind": "tool",
      "text": "read package.json"
    },
    {
      "kind": "tool",
      "text": "edit cli.js"
    },
    {
      "kind": "tool",
      "text": "npm test"
    },
    {
      "kind": "text",
      "text": "Added a `--version` flag that reads the package’s name and version from `package.json` and outputs them. The CLI now returns something like `greet 1.2.0` when called with `--version`. All tests pass successfully."
    }
  ]
};
