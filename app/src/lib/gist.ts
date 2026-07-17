const SYNC_PREFIX = "termcoder:sync";

export interface Envelope {
  updatedAt: number;
  data: unknown;
}

function headers(token: string) {
  return { authorization: "Bearer " + token, accept: "application/vnd.github+json" };
}

export async function findSyncGist(token: string): Promise<string | null> {
  const res = await fetch("https://api.github.com/gists?per_page=100", { headers: headers(token) });
  if (!res.ok) throw new Error("github_" + res.status);
  const gists = await res.json();
  if (!Array.isArray(gists)) return null;
  const hit = gists.find((g: { description?: string }) => (g.description || "").indexOf(SYNC_PREFIX) === 0);
  return hit ? hit.id : null;
}

export async function readStore(token: string, gistId: string, name: string): Promise<unknown | null> {
  const res = await fetch("https://api.github.com/gists/" + gistId, { headers: headers(token) });
  if (!res.ok) throw new Error("github_" + res.status);
  const gist = await res.json();
  const file = gist.files?.[name + ".json"];
  if (!file) return null;
  const raw = file.truncated && file.raw_url ? await (await fetch(file.raw_url)).text() : file.content;
  const envelope = JSON.parse(raw) as Envelope;
  return envelope.data;
}

export async function writeStore(token: string, gistId: string, name: string, data: unknown): Promise<void> {
  const envelope: Envelope = { updatedAt: Date.now(), data };
  const res = await fetch("https://api.github.com/gists/" + gistId, {
    method: "PATCH",
    headers: { ...headers(token), "content-type": "application/json" },
    body: JSON.stringify({ files: { [name + ".json"]: { content: JSON.stringify(envelope, null, 2) } } }),
  });
  if (!res.ok) throw new Error("github_" + res.status);
}

export interface OptimisticQueue<T> {
  get(): T;
  set(value: T): void;
}

export function createOptimisticQueue<T>(opts: {
  initial: T;
  write: (value: T) => Promise<void>;
  onChange: (value: T) => void;
}): OptimisticQueue<T> {
  let current = opts.initial;
  let accepted = opts.initial;
  let chain: Promise<void> = Promise.resolve();
  let queued = false;

  function run(): Promise<void> {
    queued = false;
    const snapshot = current;
    return opts
      .write(snapshot)
      .then(() => {
        accepted = snapshot;
      })
      .catch(() => {
        current = accepted;
        opts.onChange(accepted);
      });
  }

  return {
    get() {
      return current;
    },
    set(value: T) {
      current = value;
      opts.onChange(current);
      if (queued) return;
      queued = true;
      chain = chain.then(run);
    },
  };
}
