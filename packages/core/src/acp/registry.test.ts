import { describe, expect, it } from "vitest";
import { discoverAgents, KNOWN_AGENTS } from "./registry";

const PATH = ["/usr/bin", "/home/u/.local/bin"].join(":");

describe("finding the agents on this machine", () => {
  it("finds nothing when nothing is installed, and does not throw", () => {
    expect(discoverAgents({ path: PATH, exists: () => false })).toEqual([]);
  });

  it("finds the ones that are on the path", () => {
    const found = discoverAgents({
      path: PATH,
      exists: (file) => file.includes("claude") || file.includes("codex"),
    });
    expect(found.map((a) => a.id).sort()).toEqual(["claude", "codex"]);
  });

  it("knows how to launch each one it knows about", () => {
    for (const spec of KNOWN_AGENTS) {
      expect(spec.requires).toBeTruthy();
      expect(spec.command).toBeTruthy();
      expect(Array.isArray(spec.args)).toBe(true);
      expect(spec.label).toBeTruthy();
    }
  });

  it("looks for the CLI the user installed, not for the adapter it launches", () => {
    const found = discoverAgents({
      path: PATH,
      exists: (file) => file.includes("claude"),
    });
    expect(found.map((a) => a.id)).toEqual(["claude"]);
    expect(found[0]?.command).toBe("npx");
    expect(found[0]?.args).toContain("@agentclientprotocol/claude-agent-acp");
  });

  it("takes a user's own agent, and lets it override a known one", () => {
    const extra = [
      { id: "claude", label: "My build", requires: "claude", command: "/opt/claude-acp", args: [] },
    ];
    const found = discoverAgents({ path: PATH, exists: () => true, extra });
    const claude = found.find((a) => a.id === "claude");
    expect(claude?.command).toBe("/opt/claude-acp");
    expect(found.filter((a) => a.id === "claude")).toHaveLength(1);
  });
});
