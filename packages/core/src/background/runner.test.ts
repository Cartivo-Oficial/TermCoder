import { describe, expect, it } from "vitest";
import { runAutonomous, runVerify, type AutonomousEvent, type AutonomousSession } from "./runner";

/** A fake session that just streams a short reply; records each instruction. */
function fakeSession(prompts: string[] = []): AutonomousSession {
  return {
    record: { cwd: process.cwd() },
    async *prompt(text: string) {
      prompts.push(text);
      yield { type: "text-delta", text: "working…" };
      yield { type: "done" };
    },
  };
}

async function collect(gen: AsyncGenerator<AutonomousEvent>): Promise<AutonomousEvent[]> {
  const out: AutonomousEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe("runAutonomous", () => {
  it("finishes in one round when there is no verify command", async () => {
    const prompts: string[] = [];
    const events = await collect(runAutonomous({ session: fakeSession(prompts), goal: "do the thing" }));
    expect(prompts).toEqual(["do the thing"]);
    expect(events.at(-1)).toEqual({ type: "finished", status: "done", rounds: 1 });
  });

  it("stops as soon as the verify command passes", async () => {
    const prompts: string[] = [];
    const events = await collect(
      runAutonomous({ session: fakeSession(prompts), goal: "fix it", verifyCommand: "exit 0" }),
    );
    expect(prompts).toHaveLength(1);
    expect(events.some((e) => e.type === "verify" && e.ok)).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "finished", status: "verified" });
  });

  it("keeps trying (feeding back the failure) until the round budget runs out", async () => {
    const prompts: string[] = [];
    const events = await collect(
      runAutonomous({ session: fakeSession(prompts), goal: "make tests pass", verifyCommand: "exit 1", maxRounds: 3 }),
    );
    expect(prompts).toHaveLength(3);
    // Rounds after the first are driven by the failure feedback.
    expect(prompts[1]).toContain("failed");
    expect(events.at(-1)).toMatchObject({ type: "finished", status: "maxed", rounds: 3 });
  });

  it("stops when the model errors", async () => {
    const session: AutonomousSession = {
      record: { cwd: process.cwd() },
      async *prompt() {
        yield { type: "error", error: "boom" };
      },
    };
    const events = await collect(runAutonomous({ session, goal: "x", verifyCommand: "exit 0" }));
    expect(events.at(-1)).toMatchObject({ type: "finished", status: "error" });
  });
});

describe("runVerify", () => {
  it("reports success and failure by exit code", async () => {
    expect((await runVerify("exit 0", process.cwd())).ok).toBe(true);
    expect((await runVerify("exit 1", process.cwd())).ok).toBe(false);
  });
});
