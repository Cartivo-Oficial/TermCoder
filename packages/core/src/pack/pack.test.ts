import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPack, publishPack, readPack } from "./pack";
import type { Gist, GitHubClient } from "../github/github";

function fakeClient() {
  const store: Record<string, Record<string, string>> = {};
  let n = 0;
  const toGist = (id: string): Gist => ({
    id,
    html_url: `https://gist.github.com/${id}`,
    description: "",
    public: false,
    updated_at: "",
    files: Object.fromEntries(
      Object.entries(store[id] ?? {}).map(([k, v]) => [k, { filename: k, content: v }]),
    ),
  });
  return {
    async createGist({ files }: { files: Record<string, { content: string }> }) {
      const id = `g${++n}`;
      store[id] = {};
      for (const [k, v] of Object.entries(files)) store[id]![k] = v.content;
      return toGist(id);
    },
    async getGist(id: string) {
      return toGist(id);
    },
    async gistFileContent(g: Gist, filename: string) {
      return g.files[filename]?.content;
    },
  } as unknown as GitHubClient;
}

describe("packs", () => {
  let src: string;
  let dest: string;
  beforeEach(() => {
    src = mkdtempSync(join(tmpdir(), "tc-packsrc-"));
    dest = mkdtempSync(join(tmpdir(), "tc-packdst-"));
    mkdirSync(join(src, ".termcoder", "skills"), { recursive: true });
    mkdirSync(join(src, ".termcoder", "agents"), { recursive: true });
    writeFileSync(join(src, ".termcoder", "skills", "pr-review.md"), "---\nname: pr-review\ndescription: d\n---\nbody\n", "utf8");
    writeFileSync(join(src, ".termcoder", "agents", "reviewer.md"), "---\nmode: subagent\n---\nreview code\n", "utf8");
  });
  afterEach(() => {
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  });

  it("publishes a .termcoder dir and re-installs it elsewhere", async () => {
    const client = fakeClient();
    const url = await publishPack({ name: "study-kit", description: "for class" }, join(src, ".termcoder"), client);
    expect(url).toMatch(/gist\.github\.com/);

    const { manifest, written } = await installPack(url, client, { target: "project", cwd: dest });
    expect(manifest.name).toBe("study-kit");
    expect(written.sort()).toEqual([join("agents", "reviewer.md"), join("skills", "pr-review.md")].sort());

    const installed = readPack(join(dest, ".termcoder"));
    expect(installed.map((i) => `${i.kind}/${i.filename}`).sort()).toEqual(["agents/reviewer.md", "skills/pr-review.md"]);
    expect(installed.find((i) => i.filename === "pr-review.md")!.content).toContain("name: pr-review");
  });

  it("refuses to publish an empty .termcoder", async () => {
    const client = fakeClient();
    await expect(publishPack({ name: "x" }, join(dest, ".termcoder"), client)).rejects.toThrow();
  });
});
