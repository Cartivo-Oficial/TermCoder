import { describe, expect, it } from "vitest";
import { enqueue, resolveItem, resolveAll, findByTarget, type ReviewQueue } from "./queue";

const empty: ReviewQueue = { items: [] };
const a = { id: "1", title: "Overwrite a.ts", kind: "write", target: "src/a.ts" };
const b = { id: "2", title: "Edit b.ts", kind: "edit", target: "src/b.ts" };

describe("review queue", () => {
  it("appends in arrival order", () => {
    const q = enqueue(enqueue(empty, a), b);
    expect(q.items.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("ignores an id already queued", () => {
    const q = enqueue(enqueue(empty, a), { ...a, title: "outro" });
    expect(q.items).toHaveLength(1);
    expect(q.items[0]!.title).toBe("Overwrite a.ts");
  });

  it("does not mutate the queue it is given", () => {
    const start = enqueue(empty, a);
    enqueue(start, b);
    expect(start.items).toHaveLength(1);
  });

  it("resolveItem removes only that id", () => {
    const q = resolveItem(enqueue(enqueue(empty, a), b), "1");
    expect(q.items.map((i) => i.id)).toEqual(["2"]);
  });

  it("resolveAll empties the queue and returns every id in order", () => {
    const { next, ids } = resolveAll(enqueue(enqueue(empty, a), b));
    expect(ids).toEqual(["1", "2"]);
    expect(next.items).toEqual([]);
  });

  it("findByTarget matches a path and returns undefined otherwise", () => {
    const q = enqueue(enqueue(empty, a), b);
    expect(findByTarget(q, "src/b.ts")?.id).toBe("2");
    expect(findByTarget(q, "src/z.ts")).toBeUndefined();
  });
});
