import type { Config } from "../config/config";

const API = "https://api.github.com";

export interface GistFile {
  content: string;
}

export interface Gist {
  id: string;
  html_url: string;
  description: string | null;
  public: boolean;
  updated_at: string;
  files: Record<string, { filename: string; content?: string; raw_url?: string; truncated?: boolean }>;
}

export interface GitHubUser {
  login: string;
  name?: string | null;
  html_url?: string;
}

export interface GistComment {
  id: number;
  body: string;
  created_at: string;
  user: { login: string } | null;
}

export function gitHubToken(config?: Config, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return config?.github?.token || env.GITHUB_TOKEN || undefined;
}

export class GitHubError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export class GitHubClient {
  constructor(private readonly token: string) {}

  static fromConfig(config?: Config, env: NodeJS.ProcessEnv = process.env): GitHubClient {
    const token = gitHubToken(config, env);
    if (!token) {
      throw new GitHubError(
        401,
        "No GitHub token — run /login (or add one in Settings). It needs the `gist` scope.",
      );
    }
    return new GitHubClient(token);
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/vnd.github+json",
        "user-agent": "termcoder",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new GitHubError(res.status, `GitHub API ${res.status}: ${detail.slice(0, 200)}`);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }

  whoami(): Promise<GitHubUser> {
    return this.req<GitHubUser>("/user");
  }

  createGist(opts: { files: Record<string, GistFile>; description?: string; public?: boolean }): Promise<Gist> {
    return this.req<Gist>("/gists", {
      method: "POST",
      body: JSON.stringify({
        description: opts.description ?? "",
        public: opts.public ?? false,
        files: opts.files,
      }),
    });
  }

  updateGist(id: string, files: Record<string, GistFile | null>): Promise<Gist> {
    return this.req<Gist>(`/gists/${id}`, { method: "PATCH", body: JSON.stringify({ files }) });
  }

  getGist(id: string): Promise<Gist> {
    return this.req<Gist>(`/gists/${id}`);
  }

  deleteGist(id: string): Promise<void> {
    return this.req<void>(`/gists/${id}`, { method: "DELETE" });
  }

  listGists(): Promise<Gist[]> {
    return this.req<Gist[]>("/gists?per_page=100");
  }

  createGistComment(gistId: string, body: string): Promise<GistComment> {
    return this.req<GistComment>(`/gists/${gistId}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  }

  listGistComments(gistId: string): Promise<GistComment[]> {
    return this.req<GistComment[]>(`/gists/${gistId}/comments?per_page=100`);
  }

  async gistFileContent(gist: Gist, filename: string): Promise<string | undefined> {
    const f = gist.files[filename];
    if (!f) return undefined;
    if (typeof f.content === "string" && !f.truncated) return f.content;
    if (f.raw_url) {
      const res = await fetch(f.raw_url, { headers: { "user-agent": "termcoder" } });
      if (res.ok) return await res.text();
    }
    return f.content;
  }

  async getRepoFile(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const data = await this.req<{ content?: string; encoding?: string }>(
      `/repos/${owner}/${repo}/contents/${encodeURI(path)}${q}`,
    );
    if (data.content && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf8");
    }
    return data.content ?? "";
  }

  listRepoDir(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<Array<{ name: string; path: string; type: string }>> {
    const q = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return this.req(`/repos/${owner}/${repo}/contents/${encodeURI(path)}${q}`);
  }
}

export function parseGistId(ref: string): string {
  const m = ref.match(/gist\.github\.com\/(?:[^/]+\/)?([0-9a-fA-F]+)/);
  if (m) return m[1]!;
  return (ref.trim().split(/[/?#]/).filter(Boolean).pop() ?? ref).trim();
}
