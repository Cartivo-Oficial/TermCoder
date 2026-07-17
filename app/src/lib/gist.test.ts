import { describe, expect, it, vi } from "vitest";
import { createOptimisticQueue } from "./gist";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("createOptimisticQueue", () => {
  it("does not lose a newer edit when an earlier in-flight write fails", async () => {
    const writes: string[][] = [];
    const deferreds: ReturnType<typeof deferred<void>>[] = [];
    const onChange = vi.fn();

    const write = (value: string[]) => {
      writes.push(value);
      const d = deferred<void>();
      deferreds.push(d);
      return d.promise;
    };

    const queue = createOptimisticQueue<string[]>({
      initial: [],
      write,
      onChange,
    });

    queue.set(["A"]);
    await flush();
    expect(writes).toEqual([["A"]]);

    queue.set(["A", "B"]);
    await flush();

    deferreds[0].reject(new Error("transient failure"));
    await flush();
    await flush();

    expect(queue.get()).toEqual(["A", "B"]);
    expect(onChange).not.toHaveBeenCalledWith([]);

    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes[writes.length - 1]).toEqual(["A", "B"]);

    deferreds[deferreds.length - 1].resolve();
    await flush();
    await flush();

    expect(onChange).toHaveBeenCalledWith(["A", "B"]);
  });

  it("reverts to accepted and notifies onChange for a plain single failed write", async () => {
    const deferreds: ReturnType<typeof deferred<void>>[] = [];
    const onChange = vi.fn();

    const write = () => {
      const d = deferred<void>();
      deferreds.push(d);
      return d.promise;
    };

    const queue = createOptimisticQueue<string[]>({
      initial: ["x"],
      write,
      onChange,
    });

    queue.set(["x", "y"]);
    await flush();
    expect(queue.get()).toEqual(["x", "y"]);

    deferreds[0].reject(new Error("fail"));
    await flush();
    await flush();

    expect(queue.get()).toEqual(["x"]);
    expect(onChange).toHaveBeenCalledWith(["x"]);
  });

  it("coalesces rapid successive sets so the last value wins as accepted", async () => {
    const writes: string[][] = [];
    const deferreds: ReturnType<typeof deferred<void>>[] = [];
    const onChange = vi.fn();

    const write = (value: string[]) => {
      writes.push(value);
      const d = deferred<void>();
      deferreds.push(d);
      return d.promise;
    };

    const queue = createOptimisticQueue<string[]>({
      initial: [],
      write,
      onChange,
    });

    queue.set(["a"]);
    queue.set(["a", "b"]);
    queue.set(["a", "b", "c"]);

    await flush();

    expect(writes.length).toBe(1);
    expect(writes[0]).toEqual(["a", "b", "c"]);

    deferreds[0].resolve();
    await flush();
    await flush();

    expect(queue.get()).toEqual(["a", "b", "c"]);
  });
});
