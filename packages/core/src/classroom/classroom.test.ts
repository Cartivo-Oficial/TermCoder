import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addAssignment,
  createClassroom,
  fetchClassroom,
  gradeSubmission,
  joinClassroom,
  listGrades,
  listRoster,
  listSubmissions,
  loadClassrooms,
  submitAssignment,
} from "./classroom";
import type { Gist, GitHubClient } from "../github/github";

function backend() {
  const gists: Record<string, { files: Record<string, string>; comments: Array<{ id: number; body: string; created_at: string; user: { login: string } }> }> = {};
  let n = 0;
  const toGist = (id: string): Gist => ({
    id,
    html_url: `https://gist.github.com/${id}`,
    description: "",
    public: false,
    updated_at: "",
    files: Object.fromEntries(Object.entries(gists[id]!.files).map(([k, v]) => [k, { filename: k, content: v }])),
  });
  function client(login: string): GitHubClient {
    return {
      async whoami() {
        return { login };
      },
      async createGist({ files }: { files: Record<string, { content: string }> }) {
        const id = `g${++n}`;
        gists[id] = { files: {}, comments: [] };
        for (const [k, v] of Object.entries(files)) gists[id]!.files[k] = v.content;
        return toGist(id);
      },
      async updateGist(id: string, files: Record<string, { content: string }>) {
        for (const [k, v] of Object.entries(files)) if (v) gists[id]!.files[k] = v.content;
        return toGist(id);
      },
      async getGist(id: string) {
        return toGist(id);
      },
      async gistFileContent(g: Gist, name: string) {
        return g.files[name]?.content;
      },
      async createGistComment(id: string, body: string) {
        const c = { id: gists[id]!.comments.length + 1, body, created_at: "2026-01-01T00:00:00Z", user: { login } };
        gists[id]!.comments.push(c);
        return c;
      },
      async listGistComments(id: string) {
        return gists[id]!.comments;
      },
    } as unknown as GitHubClient;
  }
  return { client };
}

describe("classroom", () => {
  let cfg: string;
  let env: NodeJS.ProcessEnv;
  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), "tc-class-"));
    env = { XDG_CONFIG_HOME: cfg };
  });
  afterEach(() => rmSync(cfg, { recursive: true, force: true }));

  it("runs a full class lifecycle across teacher and student", async () => {
    const be = backend();
    const teacher = be.client("teacher");
    const student = be.client("student");

    const cls = await createClassroom("Math 101", teacher, { env });
    expect(cls.role).toBe("teacher");
    expect(loadClassrooms(env)).toHaveLength(1);
    const a = await addAssignment(cls.code, { title: "Fractions worksheet", due: "Friday" }, teacher);

    const fetched = await fetchClassroom(cls.code, teacher);
    expect(fetched.name).toBe("Math 101");
    expect(fetched.assignments).toHaveLength(1);
    expect(fetched.assignments[0]!.title).toBe("Fractions worksheet");

    const joined = await joinClassroom(cls.code, student, { cwd: cfg, env });
    expect(joined.classroom.name).toBe("Math 101");
    expect(loadClassrooms(env).some((c) => c.role === "student")).toBe(true);

    const roster = await listRoster(cls.code, teacher);
    expect(roster.map((r) => r.user)).toContain("student");

    await submitAssignment(cls.code, { assignmentId: a.id, link: "https://viewer/x", note: "done!" }, student);
    const subs = await listSubmissions(cls.code, teacher);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ user: "student", assignmentId: a.id, link: "https://viewer/x", note: "done!" });

    expect(await listSubmissions(cls.code, teacher, "other")).toHaveLength(0);
  });

  it("records a grade with feedback and keeps only the latest per student", async () => {
    const be = backend();
    const teacher = be.client("teacher");
    const cls = await createClassroom("Bio 101", teacher, { env });
    const a = await addAssignment(cls.code, { title: "Cell essay" }, teacher);

    await gradeSubmission(cls.code, { assignmentId: a.id, user: "@student", grade: "B", feedback: "solid" }, teacher);
    let grades = await listGrades(cls.code, teacher);
    expect(grades).toHaveLength(1);
    expect(grades[0]).toMatchObject({ user: "student", assignmentId: a.id, grade: "B", feedback: "solid" });

    await gradeSubmission(cls.code, { assignmentId: a.id, user: "student", grade: "A" }, teacher);
    grades = await listGrades(cls.code, teacher);
    expect(grades).toHaveLength(1);
    expect(grades[0]).toMatchObject({ grade: "A" });
    expect(grades[0]!.feedback).toBeUndefined();

    expect(await listGrades(cls.code, teacher, "other")).toHaveLength(0);
  });
});
