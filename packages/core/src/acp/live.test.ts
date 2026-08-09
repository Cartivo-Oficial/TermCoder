import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SessionEvent } from "../session/session";
import { discoverAgents } from "./registry";
import { runAgent } from "./run";

const installed = discoverAgents({ exists: existsSync });
const claude = installed.find((a) => a.id === "claude");

function envOutsideAnyClaudeSession(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) delete env[key];
  }
  env.ANTHROPIC_MODEL ??= "claude-sonnet-5";
  return env;
}

describe.skipIf(!claude)("a real run against Claude Code", () => {
  it("completes a turn and tells us what happened", async () => {
    const events: SessionEvent[] = [];
    await runAgent({
      spec: claude!,
      cwd: process.cwd(),
      prompt: "Reply with the single word: ready. Do not use any tools.",
      sourceId: "live",
      emit: (e) => events.push(e),
      askPermission: async () => "deny",
      env: envOutsideAnyClaudeSession(),
    });
    expect(events.at(-1)?.type).toBe("done");
    expect(events.some((e) => e.type === "text-delta")).toBe(true);
  }, 120_000);
});
