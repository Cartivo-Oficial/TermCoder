import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { getTheme } from "../theme";
import type { ViewItem } from "../types";
import { Transcript } from "./Transcript";
import { PermissionModal } from "./PermissionModal";

const theme = getTheme("default");

describe("Transcript", () => {
  it("renders user, assistant, and completed tool items", () => {
    const items: ViewItem[] = [
      { kind: "user", text: "create a file" },
      { kind: "assistant", text: "On it." },
      {
        kind: "tool",
        id: "t1",
        name: "write",
        title: "Create hello.txt",
        status: "done",
        output: "Created hello.txt",
      },
    ];
    const { lastFrame } = render(<Transcript theme={theme} items={items} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("create a file");
    expect(frame).toContain("On it.");
    expect(frame).toContain("write");
    expect(frame).toContain("Create hello.txt");
    expect(frame).toContain("✓");
  });

  it("shows an error item", () => {
    const { lastFrame } = render(
      <Transcript theme={theme} items={[{ kind: "error", text: "boom" }]} />,
    );
    expect(lastFrame()).toContain("boom");
  });
});

describe("PermissionModal", () => {
  it("renders the request and resolves on the 'a' key", async () => {
    const onDecision = vi.fn();
    const { stdin, lastFrame } = render(
      <PermissionModal
        theme={theme}
        request={{ toolName: "write", kind: "write", title: "Create x.ts" }}
        onDecision={onDecision}
      />,
    );
    expect(lastFrame()).toContain("Create x.ts");

    await new Promise((r) => setTimeout(r, 30));
    stdin.write("a");
    await new Promise((r) => setTimeout(r, 30));
    expect(onDecision).toHaveBeenCalledWith("allow");
  });

  it("resolves allow-always on 'A'", async () => {
    const onDecision = vi.fn();
    const { stdin } = render(
      <PermissionModal
        theme={theme}
        request={{ toolName: "bash", kind: "bash", title: "Run ls" }}
        onDecision={onDecision}
      />,
    );
    await new Promise((r) => setTimeout(r, 30));
    stdin.write("A");
    await new Promise((r) => setTimeout(r, 30));
    expect(onDecision).toHaveBeenCalledWith("allow-always");
  });
});
