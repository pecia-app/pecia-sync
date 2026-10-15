import { test } from "node:test";
import assert from "node:assert/strict";
import { pdfPageText, pdfFitWidth } from "./reader-pdf";

test("PDF text works without ReadableStream async iteration and releases the reader", async () => {
  let released = false;
  let index = 0;
  const page = { streamTextContent: () => ({ getReader: () => ({
    read: async () => index++ === 0 ? {done:false,value:{items:[{str:"Synthetic text"},{type:"beginMarkedContent"}]}} : {done:true},
    releaseLock: () => { released = true; },
  }) }) };
  assert.equal(await pdfPageText(page as unknown as Parameters<typeof pdfPageText>[0]), "Synthetic text ");
  assert.equal(released, true);
});

test("PDF text releases its lock on extraction failure", async () => {
  let released = false;
  const page = { streamTextContent: () => ({ getReader: () => ({
    read: async () => { throw new Error("extraction failed"); },
    releaseLock: () => { released = true; },
  }) }) };
  await assert.rejects(pdfPageText(page as unknown as Parameters<typeof pdfPageText>[0]), /extraction failed/);
  assert.equal(released, true);
});

test("PDF fit uses actual padding without forcing overflow in narrow windows", () => {
  assert.equal(pdfFitWidth(970,40,40),890);
  assert.equal(pdfFitWidth(600,22,22),556);
  assert.equal(pdfFitWidth(240,18,18),204);
  assert.equal(pdfFitWidth(2000,40,40),1100);
});
