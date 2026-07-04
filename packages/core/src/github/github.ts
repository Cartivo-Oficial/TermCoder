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

/** The GitHub token from config (or the GITHUB_TOKEN env), if any. */
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

/**
 * A thin GitHub REST client for the features that use GitHub as a backend:
 * publishing/reading gists (sessions, packs, synced settings) and reading
 * public repo files (installing a pack straight from a repo). All calls carry
 * a personal-access token that needs at least the `gist` scope.
 */
export class GitHubClient {
  constructor(private readonly token: string) {}

  /** Build a client from config/env, or throw a friendly error if no token. */
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

  /** Validate the token and return the authenticated user. */
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

  /** Update a gist. Pass `null` for a filename to delete that file. */
  updateGist(id: string, files: Record<string, GistFile | null>): Promise<Gist> {
    return this.req<Gist>(`/gists/${id}`, { method: "PATCH", body: JSON.stringify({ files }) });
  }

  getGist(id: string): Promise<Gist> {
    return this.req<Gist>(`/gists/${id}`);
  }

  deleteGist(id: string): Promise<void> {
    return this.req<void>(`/gists/${id}`, { method: "DELETE" });
  }

  /** The authenticated user's gists (newest first, up to 100). */
  listGists(): Promise<Gist[]> {
    return this.req<Gist[]>("/gists?per_page=100");
  }

  /** Post a comment on a gist (used for classroom joins & submissions). */
  createGistComment(gistId: string, body: string): Promise<GistComment> {
    return this.req<GistComment>(`/gists/${gistId}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  }

  /** All comments on a gist (up to 100). */
  listGistComments(gistId: string): Promise<GistComment[]> {
    return this.req<GistComment[]>(`/gists/${gistId}/comments?per_page=100`);
  }

  /** A gist file's text, fetching the raw URL when the inline content is truncated. */
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

  /** Read a file's text from a repo (used to install a pack straight from a repo). */
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

  /** List a directory in a repo. */
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

/** Extract a gist id from a bare id or any gist URL. */
export function parseGistId(ref: string): string {
  const m = ref.match(/gist\.github\.com\/(?:[^/]+\/)?([0-9a-fA-F]+)/);
  if (m) return m[1]!;
  return (ref.trim().split(/[/?#]/).filter(Boolean).pop() ?? ref).trim();
}
