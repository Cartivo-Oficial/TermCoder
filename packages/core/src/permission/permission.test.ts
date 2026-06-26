import { describe, expect, it, vi } from "vitest";
import { PermissionManager, type PermissionDecision } from "./permission";

const baseConfig = { bash: "ask", write: "ask", edit: "ask", mcp: "ask" } as const;

function req(kind: "bash" | "write" | "edit" | "mcp" = "write") {
  return { toolName: kind, kind, title: `do ${kind}` };
}

describe("PermissionManager", () => {
  it("auto-allows when configured to allow, without asking", async () => {
    const asker = vi.fn();
    const pm = new PermissionManager({ ...baseConfig, write: "allow" }, asker);
    expect(await pm.check(req("write"))).toBe(true);
    expect(asker).not.toHaveBeenCalled();
  });

  it("auto-denies when configured to deny, without asking", async () => {
    const asker = vi.fn();
    const pm = new PermissionManager({ ...baseConfig, bash: "deny" }, asker);
    expect(await pm.check(req("bash"))).toBe(false);
    expect(asker).not.toHaveBeenCalled();
  });

  it("asks when mode is 'ask' and honours allow/deny", async () => {
    const asker = vi.fn(async () => "allow" as PermissionDecision);
    const pm = new PermissionManager(baseConfig, asker);
    expect(await pm.check(req("edit"))).toBe(true);
    expect(asker).toHaveBeenCalledOnce();

    asker.mockResolvedValueOnce("deny");
    expect(await pm.check(req("edit"))).toBe(false);
  });

  it("remembers 'allow-always' per kind for the session", async () => {
    const asker = vi.fn(async () => "allow-always" as PermissionDecision);
    const pm = new PermissionManager(baseConfig, asker);

    expect(await pm.check(req("write"))).toBe(true);
    expect(await pm.check(req("write"))).toBe(true);
    // Asked only once; the second call used the remembered decision.
    expect(asker).toHaveBeenCalledOnce();
  });
});
