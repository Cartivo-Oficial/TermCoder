import { describe, expect, it, vi } from "vitest";
import {
  PermissionManager,
  resolvePermissionMode,
  type PermissionDecision,
} from "./permission";

const baseConfig = { bash: "ask", write: "ask", edit: "ask", mcp: "ask", network: "ask" } as const;

function req(
  kind: "bash" | "write" | "edit" | "mcp" | "network" = "write",
  target?: string,
) {
  return { toolName: kind, kind, title: `do ${kind}`, target };
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
    expect(asker).toHaveBeenCalledOnce();
  });

  it("auto-approve still auto-allows bash and write without asking", async () => {
    const asker = vi.fn();
    const pm = new PermissionManager(baseConfig, asker);
    pm.setAutoApprove(true);

    expect(await pm.check(req("bash"))).toBe(true);
    expect(await pm.check(req("write"))).toBe(true);
    expect(asker).not.toHaveBeenCalled();
  });

  it("auto-approve does not cover network: still consults the asker", async () => {
    const asker = vi.fn(async () => "allow" as PermissionDecision);
    const pm = new PermissionManager(baseConfig, asker);
    pm.setAutoApprove(true);

    expect(await pm.check(req("network"))).toBe(true);
    expect(asker).toHaveBeenCalledOnce();
  });

  it("auto-approve does not bypass a deny resolved for network", async () => {
    const asker = vi.fn(async () => "deny" as PermissionDecision);
    const pm = new PermissionManager({ ...baseConfig, network: "ask" }, asker);
    pm.setAutoApprove(true);

    expect(await pm.check(req("network"))).toBe(false);
    expect(asker).toHaveBeenCalledOnce();
  });
});

describe("resolvePermissionMode (glob rules)", () => {
  it("returns a plain string rule unconditionally", () => {
    expect(resolvePermissionMode("allow", "anything")).toBe("allow");
    expect(resolvePermissionMode("deny", undefined)).toBe("deny");
    expect(resolvePermissionMode(undefined, "x")).toBe("ask");
  });

  it("matches globs against the target, last match winning", () => {
    const rule = { "**": "allow", "**/*.env": "deny", "src/**": "allow" } as const;
    expect(resolvePermissionMode(rule, "src/index.ts")).toBe("allow");
    expect(resolvePermissionMode(rule, "config/.env")).toBe("deny");
    expect(resolvePermissionMode(rule, "README.md")).toBe("allow");
  });

  it("respects single-segment vs deep wildcards", () => {
    expect(resolvePermissionMode({ "src/*": "allow" }, "src/a.ts")).toBe("allow");
    expect(resolvePermissionMode({ "src/*": "allow" }, "src/nested/a.ts")).toBe("ask");
    expect(resolvePermissionMode({ "src/**": "allow" }, "src/nested/a.ts")).toBe("allow");
  });

  it("falls back to ask when nothing matches or target is missing", () => {
    expect(resolvePermissionMode({ "docs/**": "allow" }, "src/a.ts")).toBe("ask");
    expect(resolvePermissionMode({ "**": "allow" }, undefined)).toBe("ask");
  });
});

describe("PermissionManager with glob rules", () => {
  it("gates per-path using the request target", async () => {
    const asker = vi.fn(async () => "deny" as PermissionDecision);
    const pm = new PermissionManager(
      { ...baseConfig, edit: { "**": "ask", "src/**": "allow", "**/*.env": "deny" } },
      asker,
    );
    expect(await pm.check(req("edit", "src/app.ts"))).toBe(true); // allowed
    expect(await pm.check(req("edit", ".env"))).toBe(false); // denied
    expect(asker).not.toHaveBeenCalled(); // neither reached the prompt
    expect(await pm.check(req("edit", "notes.txt"))).toBe(false); // ask -> denied by asker
    expect(asker).toHaveBeenCalledOnce();
  });

  it("lets an agent's permission map override the global config", async () => {
    const asker = vi.fn();
    const pm = new PermissionManager({ ...baseConfig, write: "allow" }, asker);
    pm.setAgentPermission({ write: "deny" });
    expect(await pm.check(req("write", "src/app.ts"))).toBe(false);
    pm.setAgentPermission(undefined);
    expect(await pm.check(req("write", "src/app.ts"))).toBe(true);
    expect(asker).not.toHaveBeenCalled();
  });
});
