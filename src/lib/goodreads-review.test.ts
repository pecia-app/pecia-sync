import assert from "node:assert/strict";
import test from "node:test";
import { reviewForGoodreads } from "./goodreads-review";

test("makes safe Goodreads matching corrections while retaining originals", () => {
  const result = reviewForGoodreads({ title: "Clean Coder, The", author: "Robert.Louis Stevenson", source: "kindle" });
  assert.equal(result.book.title, "The Clean Coder");
  assert.equal(result.book.author, "Robert Louis Stevenson");
  assert.deepEqual(result.original, { title: "Clean Coder, The", author: "Robert.Louis Stevenson" });
});

test("flags a row without an author for review", () => {
  assert.equal(reviewForGoodreads({ title: "Oxford Spanish English Dictionary", author: "", source: "kindle" }).needsReview, true);
});

test("preserves periods in author initials", () => {
  assert.equal(reviewForGoodreads({ title: "A Game of Thrones", author: "George R.R. Martin", source: "kindle" }).book.author, "George R.R. Martin");
});
