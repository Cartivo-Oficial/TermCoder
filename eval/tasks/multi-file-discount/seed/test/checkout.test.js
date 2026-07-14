import assert from "node:assert";
import { total } from "../src/checkout.js";

assert.equal(total([50, 200], 10), 225);
assert.equal(total([80], 25), 60);
assert.equal(total([120], 0), 120);

console.log("all tests passed");
