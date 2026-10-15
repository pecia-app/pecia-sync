import assert from "node:assert/strict";
import { test } from "node:test";
import { kindleBook, progressLabel } from "./progress";
import { toSyncCsv } from "./csv";

test("only exact filenames receive dated observations; missing stays unknown", () => {
  const name = "Example - Writer_EXAMPLE123.kfx";
  const books = { [name]: { progress: 0.09, observedAt: "2026-10-15T07:29:44.000Z" } };
  const book = kindleBook(name, books)!;
  assert.equal(book.progress, 0.09);
  assert.equal(book.lastRead, undefined);
  assert.match(toSyncCsv([book]), /Pecia Sync Progress Observed At/);
  assert.match(toSyncCsv([book]), /2026-10-15T07:29:44.000Z/);
  assert.equal(kindleBook("Other - Writer_OTHER12345.kfx", books)!.progress, undefined);
  assert.equal(progressLabel({ ...book, progress: null }, "en"), "Progress unavailable");
});

test("zero is known and invalid observations are ignored", () => {
  const name = "Example - Writer_EXAMPLE123.kfx";
  assert.equal(kindleBook(name, { [name]: { progress: 0, observedAt: "2026-10-15T07:29:44Z" } })!.progress, 0);
  assert.equal(kindleBook(name, { [name]: { progress: 1.1, observedAt: "bad" } })!.progress, undefined);
  assert.match(toSyncCsv([{ title: "Unknown", author: "Writer", source: "kindle", progress: null }]), /Unknown,Writer,,,,,,,,kindle/);
});
