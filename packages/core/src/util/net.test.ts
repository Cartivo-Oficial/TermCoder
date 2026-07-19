import { describe, expect, it } from "vitest";
import { assertFetchAllowed, isBlockedHost } from "./net";

describe("isBlockedHost", () => {
  it.each([
    "127.0.0.1",
    "127.5.5.5",
    "0.0.0.0",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "fe80::1",
  ])("blocks %s", (ip) => {
    expect(isBlockedHost(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "172.32.0.1",
    "172.15.0.1",
    "93.184.216.34",
  ])("allows %s", (ip) => {
    expect(isBlockedHost(ip)).toBe(false);
  });
});

describe("assertFetchAllowed", () => {
  it("rejects a non-http(s) protocol", async () => {
    await expect(assertFetchAllowed("file:///etc/passwd")).rejects.toThrow();
  });

  it("rejects ftp URLs", async () => {
    await expect(assertFetchAllowed("ftp://example.com")).rejects.toThrow();
  });

  it("rejects a literal loopback address without DNS", async () => {
    await expect(assertFetchAllowed("http://127.0.0.1:4096/sessions")).rejects.toThrow(
      /private or loopback/,
    );
  });

  it("rejects a bracketed IPv6 loopback address", async () => {
    await expect(assertFetchAllowed("http://[::1]/")).rejects.toThrow(/private or loopback/);
  });

  it("rejects the link-local metadata address", async () => {
    await expect(assertFetchAllowed("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      /private or loopback/,
    );
  });
});
