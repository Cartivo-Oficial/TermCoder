import assert from "node:assert";
import { answer, double } from "../src/answer.js";

assert.equal(answer, 42);
assert.equal(double(21), 42);

console.log("all tests passed");
