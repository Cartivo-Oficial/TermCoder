import { describe, it, expect } from "vitest";
import { gridColumns } from "./grid";

describe("gridColumns", () => {
  it("tiles by the square-root rule", () => {
    expect(gridColumns(1)).toBe(1);
    expect(gridColumns(2)).toBe(2);
    expect(gridColumns(3)).toBe(2);
    expect(gridColumns(4)).toBe(2);
    expect(gridColumns(5)).toBe(3);
    expect(gridColumns(6)).toBe(3);
    expect(gridColumns(9)).toBe(3);
    expect(gridColumns(10)).toBe(4);
  });

  it("never returns less than one column", () => {
    expect(gridColumns(0)).toBe(1);
    expect(gridColumns(-3)).toBe(1);
  });
});
