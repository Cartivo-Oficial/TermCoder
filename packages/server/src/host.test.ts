import { describe, expect, it } from "vitest";
import { apiHost, isLanHost } from "./host";

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

describe("isLanHost", () => {
  it("treats 127.0.0.1 as not LAN-exposed", () => {
    expect(isLanHost("127.0.0.1")).toBe(false);
  });

  it("treats localhost as not LAN-exposed", () => {
    expect(isLanHost("localhost")).toBe(false);
  });

  it("treats ::1 as not LAN-exposed", () => {
    expect(isLanHost("::1")).toBe(false);
  });

  it("treats an empty host as not LAN-exposed", () => {
    expect(isLanHost("")).toBe(false);
  });

  it("treats 0.0.0.0 as LAN-exposed", () => {
    expect(isLanHost("0.0.0.0")).toBe(true);
  });

  it("treats 192.168.1.5 as LAN-exposed", () => {
    expect(isLanHost("192.168.1.5")).toBe(true);
  });
});
