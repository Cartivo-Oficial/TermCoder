import assert from "node:assert";
import { slugify } from "../src/slugify.js";

assert.equal(slugify("Hello World"), "hello-world");
assert.equal(slugify("  Trim  Me  "), "trim-me");
assert.equal(slugify("Special!@# Chars"), "special-chars");
assert.equal(slugify("already-slug"), "already-slug");
assert.equal(slugify("Multiple   Spaces"), "multiple-spaces");

console.log("all tests passed");
