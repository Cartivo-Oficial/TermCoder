import { describe, it, expect } from "vitest";
import { ToolRegistry } from "./index";

describe("run_code registration", () => {
  it("run_code is in the default registry", () => {
    const reg = new ToolRegistry();
    expect(reg.get("run_code")).toBeDefined();
    expect(reg.get("read")).toBeDefined();
  });

  it("run_code is surfaced in the model tool set", () => {
    const reg = new ToolRegistry();
    const set = reg.toToolSet();
    expect(set.run_code).toBeDefined();
  });
});
