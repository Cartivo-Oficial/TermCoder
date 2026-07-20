export class EventQueue<T> {
  private items: T[] = [];
  private waiters: Array<(r: IteratorResult<T>) => void> = [];
  private done = false;

  push(item: T): void {
    if (this.done) return;
    const w = this.waiters.shift();
    if (w) w({ value: item, done: false });
    else this.items.push(item);
  }

  close(): void {
    if (this.done) return;
    this.done = true;
    while (this.waiters.length) this.waiters.shift()!({ value: undefined as never, done: true });
  }

  async *drain(): AsyncGenerator<T> {
    while (true) {
      if (this.items.length) {
        yield this.items.shift()!;
        continue;
      }
      if (this.done) return;
      const next = await new Promise<IteratorResult<T>>((r) => this.waiters.push(r));
      if (next.done) return;
      yield next.value;
    }
  }
}
