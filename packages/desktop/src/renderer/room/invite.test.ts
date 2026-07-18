import { describe, it, expect } from "vitest";
import { inviteLinks } from "./invite";

describe("inviteLinks", () => {
  it("builds one ?room= link per address, never ?session=", () => {
    const links = inviteLinks({ addresses: ["192.168.0.103", "172.26.64.1"], port: 55934, joinToken: "abc-DEF_123" });
    expect(links).toEqual([
      "http://192.168.0.103:55934?room=abc-DEF_123",
      "http://172.26.64.1:55934?room=abc-DEF_123",
    ]);
    for (const l of links) expect(l).not.toContain("session=");
  });

  it("uses https when secure", () => {
    expect(inviteLinks({ addresses: ["h"], port: 1, joinToken: "t", secure: true })[0]).toBe("https://h:1?room=t");
  });

  it("returns nothing with no addresses or no token", () => {
    expect(inviteLinks({ addresses: [], port: 1, joinToken: "t" })).toEqual([]);
    expect(inviteLinks({ addresses: ["h"], port: 1, joinToken: "" })).toEqual([]);
  });
});
