import { describe, it, expect } from "vitest";
import { computeFit } from "./useZoomPan";

describe("computeFit", () => {
  it("scales content to fit with margin and centers it", () => {
    const f = computeFit({ w: 1000, h: 500 }, { w: 900, h: 900 });
    expect(f.scale).toBeCloseTo(0.81, 2);
    expect(f.tx).toBeCloseTo((900 - 1000 * f.scale) / 2, 2);
    expect(f.ty).toBeCloseTo((900 - 500 * f.scale) / 2, 2);
  });

  it("clamps scale to [0.25, 2]", () => {
    expect(computeFit({ w: 10, h: 10 }, { w: 900, h: 900 }).scale).toBe(2);
    expect(computeFit({ w: 100000, h: 100000 }, { w: 300, h: 300 }).scale).toBe(0.25);
  });

  it("guards zero-size content", () => {
    const f = computeFit({ w: 0, h: 0 }, { w: 400, h: 400 });
    expect(Number.isFinite(f.scale)).toBe(true);
    expect(f.scale).toBe(2);
  });
});
