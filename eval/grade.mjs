import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function gradeChecks(cwd, checks = []) {
  const failures = [];
  for (const c of checks) {
    const path = join(cwd, c.file);
    if (!existsSync(path)) {
      failures.push(`${c.file}: missing`);
      continue;
    }
    const text = readFileSync(path, "utf8");
    if (c.contains && !text.includes(c.contains)) failures.push(`${c.file}: missing "${c.contains}"`);
    if (c.notContains && text.includes(c.notContains)) failures.push(`${c.file}: still contains "${c.notContains}"`);
    if (c.matches && !new RegExp(c.matches).test(text)) failures.push(`${c.file}: no match /${c.matches}/`);
    if (typeof c.minCount === "number" && c.of) {
      const n = text.split(c.of).length - 1;
      if (n < c.minCount) failures.push(`${c.file}: found ${n} of "${c.of}", need ${c.minCount}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

export function compareToBaseline(current, baseline) {
  const base = new Map((baseline?.summary ?? []).map((s) => [s.task, s]));
  const regressions = [];
  const improvements = [];
  for (const s of current.summary ?? []) {
    const b = base.get(s.task);
    if (!b) continue;
    const cur = s.passes / s.runs;
    const prev = b.passes / b.runs;
    if (cur < prev) regressions.push({ task: s.task, from: `${b.passes}/${b.runs}`, to: `${s.passes}/${s.runs}` });
    else if (cur > prev) improvements.push({ task: s.task, from: `${b.passes}/${b.runs}`, to: `${s.passes}/${s.runs}` });
  }
  return { regressions, improvements };
}
