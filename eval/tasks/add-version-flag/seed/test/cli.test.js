import assert from "node:assert";
import { run } from "../src/cli.js";

assert.equal(run([]), "hello, world");
assert.equal(run(["ada"]), "hello, ada");
assert.equal(run(["--help"]), "usage: greet <name>");
assert.equal(run(["--version"]), "greet 1.2.0");

console.log("all tests passed");
