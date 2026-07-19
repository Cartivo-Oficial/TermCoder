import { describe, expect, it } from "vitest";
import { apiHost } from "./host";

describe("apiHost", () => {
  it("defaults to loopback", () => {
    expect(apiHost({})).toBe("127.0.0.1");
  });

  it("honors an explicit HOST override", () => {
    expect(apiHost({ HOST: "0.0.0.0" })).toBe("0.0.0.0");
  });

  it("treats an empty HOST as unset", () => {
    expect(apiHost({ HOST: "" })).toBe("127.0.0.1");
  });
});
