import assert from "node:assert";
import { loadTotals } from "../src/totals.js";

const fetchOne = async (id) => id * 10;
const total = await loadTotals(fetchOne, [1, 2, 3]);
assert.equal(total, 60);

const empty = await loadTotals(fetchOne, []);
assert.equal(empty, 0);

console.log("all tests passed");
