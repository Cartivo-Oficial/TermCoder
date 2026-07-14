import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareToBaseline, gradeChecks } from "./grade.mjs";

const dir = mkdtempSync(join(tmpdir(), "tc-grade-"));
writeFileSync(join(dir, "a.js"), "export const x = 1;\nassert(x);\nassert(x === 1);\n");

let r = gradeChecks(dir, [{ file: "a.js", contains: "export const x" }]);
assert.equal(r.pass, true, "contains should pass");

r = gradeChecks(dir, [{ file: "a.js", contains: "not here" }]);
assert.equal(r.pass, false, "missing contains should fail");

r = gradeChecks(dir, [{ file: "a.js", notContains: "TODO" }]);
assert.equal(r.pass, true, "notContains absent should pass");

r = gradeChecks(dir, [{ file: "a.js", notContains: "export" }]);
assert.equal(r.pass, false, "notContains present should fail");

r = gradeChecks(dir, [{ file: "a.js", matches: "const\\s+x\\s*=" }]);
assert.equal(r.pass, true, "regex match should pass");

r = gradeChecks(dir, [{ file: "a.js", minCount: 2, of: "assert" }]);
assert.equal(r.pass, true, "minCount met should pass");

r = gradeChecks(dir, [{ file: "a.js", minCount: 5, of: "assert" }]);
assert.equal(r.pass, false, "minCount unmet should fail");

r = gradeChecks(dir, [{ file: "missing.js", contains: "x" }]);
assert.equal(r.pass, false, "missing file should fail");

const cur = { summary: [{ task: "a", passes: 2, runs: 3 }, { task: "b", passes: 3, runs: 3 }, { task: "c", passes: 1, runs: 1 }] };
const base = { summary: [{ task: "a", passes: 3, runs: 3 }, { task: "b", passes: 1, runs: 3 }, { task: "c", passes: 1, runs: 1 }] };
const cmp = compareToBaseline(cur, base);
assert.deepEqual(cmp.regressions.map((x) => x.task), ["a"], "a regressed");
assert.deepEqual(cmp.improvements.map((x) => x.task), ["b"], "b improved");

rmSync(dir, { recursive: true, force: true });
console.log("grade.test.mjs: all assertions passed");
