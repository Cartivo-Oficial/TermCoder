import { describe, it, expect } from "vitest";
import { gridColumns } from "./grid";
import {
  equalTracks,
  gridRowCount,
  resizeTracks,
  layoutStorageKey,
  parseLayout,
} from "./grid";

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

describe("equalTracks", () => {
  it("returns count equal fractions summing to 1", () => {
    expect(equalTracks(1)).toEqual([1]);
    const four = equalTracks(4);
    expect(four).toHaveLength(4);
    expect(four.every((f) => Math.abs(f - 0.25) < 1e-9)).toBe(true);
    expect(four.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("returns an empty array for non-positive counts", () => {
    expect(equalTracks(0)).toEqual([]);
    expect(equalTracks(-2)).toEqual([]);
  });
});

describe("gridRowCount", () => {
  it("matches ceil(count / gridColumns)", () => {
    expect(gridRowCount(1)).toBe(1);
    expect(gridRowCount(2)).toBe(1);
    expect(gridRowCount(3)).toBe(2);
    expect(gridRowCount(4)).toBe(2);
    expect(gridRowCount(5)).toBe(2);
    expect(gridRowCount(7)).toBe(3);
    expect(gridRowCount(0)).toBe(0);
  });
});

describe("resizeTracks", () => {
  it("moves the delta from one track to its neighbour, preserving the sum", () => {
    const out = resizeTracks([0.5, 0.5], 0, 0.1, 0.05);
    expect(out[0]).toBeCloseTo(0.6);
    expect(out[1]).toBeCloseTo(0.4);
    expect(out[0]! + out[1]!).toBeCloseTo(1);
  });
  it("clamps so neither track drops below minFraction", () => {
    const out = resizeTracks([0.5, 0.5], 0, 0.9, 0.1);
    expect(out[1]).toBeCloseTo(0.1);
    expect(out[0]).toBeCloseTo(0.9);
  });
  it("clamps a negative delta the same way", () => {
    const out = resizeTracks([0.5, 0.5], 0, -0.9, 0.1);
    expect(out[0]).toBeCloseTo(0.1);
    expect(out[1]).toBeCloseTo(0.9);
  });
  it("leaves other tracks untouched", () => {
    const out = resizeTracks([0.25, 0.25, 0.5], 0, 0.1, 0.05);
    expect(out[2]).toBeCloseTo(0.5);
  });
  it("returns a copy unchanged for an out-of-range boundary", () => {
    expect(resizeTracks([0.5, 0.5], 1, 0.1, 0.05)).toEqual([0.5, 0.5]);
    expect(resizeTracks([0.5, 0.5], -1, 0.1, 0.05)).toEqual([0.5, 0.5]);
  });
  it("makes no move when there is no room for either side", () => {
    expect(resizeTracks([0.1, 0.1], 0, 0.05, 0.1)).toEqual([0.1, 0.1]);
  });
});

describe("parseLayout", () => {
  it("falls back to equal tracks when raw is null", () => {
    const out = parseLayout(4, null);
    expect(out.cols).toHaveLength(2);
    expect(out.rows).toHaveLength(2);
  });
  it("returns stored fractions of the right shape", () => {
    const stored = JSON.stringify({ cols: [0.6, 0.4], rows: [0.7, 0.3] });
    expect(parseLayout(4, stored)).toEqual({ cols: [0.6, 0.4], rows: [0.7, 0.3] });
  });
  it("falls back when lengths do not match the count", () => {
    const stored = JSON.stringify({ cols: [1], rows: [1] });
    const out = parseLayout(4, stored);
    expect(out.cols).toHaveLength(2);
  });
  it("falls back on malformed or non-finite data", () => {
    expect(parseLayout(2, "not json").cols).toHaveLength(2);
    expect(parseLayout(2, JSON.stringify({ cols: [1, "x"], rows: [1] })).cols).toEqual(equalTracks(2));
    expect(parseLayout(2, JSON.stringify({ cols: [1, NaN], rows: [1] })).cols).toEqual(equalTracks(2));
  });
  it("uses the count-scoped storage key", () => {
    expect(layoutStorageKey(3)).toBe("tc-term-grid-3");
  });
});
