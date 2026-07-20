import { describe, expect, it } from "vitest";
import { EventQueue } from "./event-queue";

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("EventQueue", () => {
  it("drains items pushed before close", async () => {
    const q = new EventQueue<number>();
    q.push(1);
    q.push(2);
    q.close();
    expect(await collect(q.drain())).toEqual([1, 2]);
  });

  it("delivers items pushed after draining starts", async () => {
    const q = new EventQueue<number>();
    const p = collect(q.drain());
    q.push(10);
    await Promise.resolve();
    q.push(20);
    q.close();
    expect(await p).toEqual([10, 20]);
  });

  it("ends immediately when closed empty", async () => {
    const q = new EventQueue<number>();
    q.close();
    expect(await collect(q.drain())).toEqual([]);
  });
});
