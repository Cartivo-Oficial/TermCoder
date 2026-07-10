import assert from "node:assert";
import { sum } from "../src/sum.js";

assert.equal(sum(2, 3), 5);
assert.equal(sum(0, 0), 0);
assert.equal(sum(-4, 9), 5);
assert.equal(sum(10, 15), 25);

console.log("all tests passed");
