import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GitHubClient, parseGistId } from "../github/github";
import { installPack } from "../pack/pack";
import { configFile } from "../util/paths";


const MANIFEST = "classroom.json";
const DESC_PREFIX = "termcoder-classroom: ";

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  due?: string;
  createdAt: number;
}

export interface Classroom {
  name: string;
  createdBy: string;
  packs: string[];
  assignments: Assignment[];
}

export interface JoinedClass {
  code: string; // the class gist id
  name: string;
  role: "teacher" | "student";
}

export interface Submission {
  user: string;
  assignmentId: string;
  link: string;
  note?: string;
  at: string;
}

export interface Grade {
  user: string;
  assignmentId: string;
  grade: string;
  feedback?: string;
  at: string;
}


function storeFile(env: NodeJS.ProcessEnv): string {
  return configFile("classrooms.json", env);
}

export function loadClassrooms(env: NodeJS.ProcessEnv = process.env): JoinedClass[] {
  try {
    const f = storeFile(env);
    if (!existsSync(f)) return [];
    const data = JSON.parse(readFileSync(f, "utf8")) as unknown;
    return Array.isArray(data) ? (data as JoinedClass[]) : [];
  } catch {
    return [];
  }
}

export function rememberClass(c: JoinedClass, env: NodeJS.ProcessEnv = process.env): void {
  const list = loadClassrooms(env).filter((x) => x.code !== c.code);
  list.push(c);
  const f = storeFile(env);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(list, null, 2), "utf8");
}


export async function fetchClassroom(code: string, client: GitHubClient): Promise<Classroom> {
  const gist = await client.getGist(parseGistId(code));
  const raw = await client.gistFileContent(gist, MANIFEST);
  if (!raw) throw new Error("That code isn't a termcoder classroom.");
  return JSON.parse(raw) as Classroom;
}

export async function createClassroom(
  name: string,
  client: GitHubClient,
  opts: { packs?: string[]; env?: NodeJS.ProcessEnv } = {},
): Promise<JoinedClass> {
  const manifest: Classroom = {
    name,
    createdBy: (await client.whoami()).login,
    packs: opts.packs ?? [],
    assignments: [],
  };
  const gist = await client.createGist({
    description: `${DESC_PREFIX}${name}`,
    public: false,
    files: { [MANIFEST]: { content: JSON.stringify(manifest, null, 2) } },
  });
  const joined: JoinedClass = { code: gist.id, name, role: "teacher" };
  rememberClass(joined, opts.env);
  return joined;
}

export async function joinClassroom(
  code: string,
  client: GitHubClient,
  opts: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<{ classroom: Classroom; installed: string[] }> {
  const id = parseGistId(code);
  const classroom = await fetchClassroom(id, client);
  const installed: string[] = [];
  for (const pack of classroom.packs) {
    try {
      const r = await installPack(pack, client, { target: "project", cwd: opts.cwd, env: opts.env });
      installed.push(...r.written);
    } catch {
    }
  }
  rememberClass({ code: id, name: classroom.name, role: "student" }, opts.env);
  try {
    await client.createGistComment(id, `[joined] ${(await client.whoami()).login}`);
  } catch {
  }
  return { classroom, installed };
}

export async function addAssignment(
  code: string,
  a: { title: string; description?: string; due?: string },
  client: GitHubClient,
): Promise<Assignment> {
  const id = parseGistId(code);
  const classroom = await fetchClassroom(id, client);
  const assignment: Assignment = {
    id: randomUUID().slice(0, 8),
    title: a.title,
    description: a.description,
    due: a.due,
    createdAt: Date.now(),
  };
  classroom.assignments.push(assignment);
  await client.updateGist(id, { [MANIFEST]: { content: JSON.stringify(classroom, null, 2) } });
  return assignment;
}

export async function submitAssignment(
  code: string,
  opts: { assignmentId: string; link: string; note?: string },
  client: GitHubClient,
): Promise<void> {
  const id = parseGistId(code);
  const user = (await client.whoami()).login;
  const body =
    `[submission] a=${opts.assignmentId} by @${user}: ${opts.link}` + (opts.note ? ` — ${opts.note}` : "");
  await client.createGistComment(id, body);
}

export async function listSubmissions(
  code: string,
  client: GitHubClient,
  assignmentId?: string,
): Promise<Submission[]> {
  const comments = await client.listGistComments(parseGistId(code));
  const out: Submission[] = [];
  for (const c of comments) {
    const m = c.body.match(/^\[submission\] a=(\S+) by @(\S+): (\S+)(?: — (.*))?$/);
    if (m && (!assignmentId || m[1] === assignmentId)) {
      out.push({ assignmentId: m[1]!, user: m[2]!, link: m[3]!, note: m[4], at: c.created_at });
    }
  }
  return out;
}

export async function listRoster(code: string, client: GitHubClient): Promise<Array<{ user: string; at: string }>> {
  const comments = await client.listGistComments(parseGistId(code));
  return comments
    .filter((c) => c.body.startsWith("[joined]"))
    .map((c) => ({ user: c.body.replace("[joined]", "").trim(), at: c.created_at }));
}

export async function gradeSubmission(
  code: string,
  opts: { assignmentId: string; user: string; grade: string; feedback?: string },
  client: GitHubClient,
): Promise<void> {
  const id = parseGistId(code);
  const user = opts.user.replace(/^@/, "");
  const body =
    `[grade] a=${opts.assignmentId} for @${user}: ${opts.grade}` + (opts.feedback ? ` — ${opts.feedback}` : "");
  await client.createGistComment(id, body);
}

export async function listGrades(
  code: string,
  client: GitHubClient,
  assignmentId?: string,
): Promise<Grade[]> {
  const comments = await client.listGistComments(parseGistId(code));
  const latest = new Map<string, Grade>();
  for (const c of comments) {
    const m = c.body.match(/^\[grade\] a=(\S+) for @(\S+): (.+?)(?: — (.*))?$/);
    if (m && (!assignmentId || m[1] === assignmentId)) {
      latest.set(`${m[1]}::${m[2]}`, {
        assignmentId: m[1]!,
        user: m[2]!,
        grade: m[3]!,
        feedback: m[4],
        at: c.created_at,
      });
    }
  }
  return [...latest.values()];
}
