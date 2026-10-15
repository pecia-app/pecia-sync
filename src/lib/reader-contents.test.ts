import { test } from "node:test";
import assert from "node:assert/strict";
import { readerContents } from "./reader-contents";
test("contents omit unnamed raw sections without changing reading order", () => {
  const chapters = ["1","Preface","3","Introduction"].map(label => ({path:label,label}));
  assert.deepEqual(readerContents({chapters},"Section"),[{section:1,label:"Preface"},{section:3,label:"Introduction"}]);
});
test("publisher contents take priority; unnamed books still have usable navigation", () => {
  const chapters = [{path:"a",label:"1"}];
  const toc = [{section:0,label:"The first chapter"}];
  assert.deepEqual(readerContents({chapters,toc},"Section"),toc);
  assert.deepEqual(readerContents({chapters},"Section"),[{section:0,label:"Section 1"}]);
});
