#!/usr/bin/env node
// termcoder GitHub Action runner.
//
// Reads the triggering GitHub event, runs a headless termcoder turn in the
// checked-out repo, and posts the result back as an issue/PR comment. Optionally
// commits and pushes the changes it made.
//
// Env it expects (the Action wires these up):
//   GITHUB_TOKEN       - token with `issues:write` / `contents:write`
//   GITHUB_EVENT_PATH  - path to the event payload JSON (set by Actions)
//   GITHUB_REPOSITORY  - "owner/repo"
//   TC_TRIGGER         - phrase that activates the bot (default "/termcoder")
//   TC_MODEL           - model id (default "termcoder/auto")
//   TC_APPLY           - "true" to let it edit files and push a commit
//   TC_TASK            - an explicit task (overrides the comment/issue body)

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  loadConfig,
  SessionStore,
  ToolRegistry,
  builtinTools,
  PermissionManager,
  Session,
} from "@termcoder/core";

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const trigger = process.env.TC_TRIGGER || "/termcoder";
const apply = process.env.TC_APPLY === "true";
const cwd = process.cwd();

if (!token || !repo) {
  console.error("Missing GITHUB_TOKEN or GITHUB_REPOSITORY.");
  process.exit(1);
}

const event = process.env.GITHUB_EVENT_PATH
  ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
  : {};

/** Work out the issue/PR number and the text that triggered us. */
function resolveTask() {
  if (process.env.TC_TASK) {
    const number = event.issue?.number ?? event.pull_request?.number;
    return { number, task: process.env.TC_TASK };
  }
  // issue_comment / pull_request_review_comment
  const comment = event.comment?.body;
  if (comment && comment.includes(trigger)) {
    return {
      number: event.issue?.number ?? event.pull_request?.number,
      task: comment.slice(comment.indexOf(trigger) + trigger.length).trim(),
    };
  }
  // issues opened/edited
  if (event.issue?.body && event.issue.body.includes(trigger)) {
    const body = event.issue.body;
    return {
      number: event.issue.number,
      task: body.slice(body.indexOf(trigger) + trigger.length).trim(),
    };
  }
  return { number: undefined, task: "" };
}

async function postComment(number, body) {
  if (!number) {
    console.log("No issue/PR number to comment on; printing result:\n" + body);
    return;
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "termcoder-action",
    },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) console.error(`Failed to post comment: ${res.status} ${await res.text()}`);
}

function gitChangedFiles() {
  const out = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" });
  return out.split("\n").filter((l) => l.trim()).length;
}

function commitAndPush(number) {
  execFileSync("git", ["config", "user.name", "termcoder[bot]"], { cwd });
  execFileSync("git", ["config", "user.email", "termcoder-bot@users.noreply.github.com"], { cwd });
  execFileSync("git", ["add", "-A"], { cwd });
  execFileSync("git", ["commit", "-m", `termcoder: address #${number ?? ""}`.trim()], { cwd });
  execFileSync("git", ["push"], { cwd });
}

async function main() {
  const { number, task } = resolveTask();
  if (!task) {
    console.log(`No "${trigger}" trigger in this event — nothing to do.`);
    return;
  }

  const config = loadConfig({ cwd });
  if (process.env.TC_MODEL) config.model = process.env.TC_MODEL;
  const store = new SessionStore();
  const registry = new ToolRegistry(builtinTools);
  // In CI there's no human to prompt; auto-approve when applying, otherwise the
  // read-only "plan" agent can't mutate anyway.
  const permission = new PermissionManager(config.permission, async () => "allow");

  const session = Session.create(
    { store, registry, config, permission },
    { cwd, agent: apply ? "build" : "plan" },
  );

  const prompt = apply
    ? task
    : `${task}\n\n(You are running in CI as a reviewer: investigate and answer. Do not claim to have changed files.)`;

  let text = "";
  for await (const ev of session.prompt(prompt)) {
    if (ev.type === "text-delta") text += ev.text;
    if (ev.type === "error") text += `\n\n**Error:** ${ev.error}`;
  }

  let footer = "\n\n<sub>🤖 termcoder</sub>";
  if (apply && gitChangedFiles() > 0) {
    try {
      commitAndPush(number);
      footer = "\n\n<sub>🤖 termcoder — pushed a commit with the changes.</sub>";
    } catch (err) {
      footer = `\n\n<sub>🤖 termcoder — couldn't push: ${String(err).slice(0, 200)}</sub>`;
    }
  }

  await postComment(number, (text.trim() || "_(no output)_") + footer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
