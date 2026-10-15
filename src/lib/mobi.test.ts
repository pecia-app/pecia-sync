import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { parseMobi, validateMobi, mobiDocument } from "./mobi";
import { renderChapter } from "./epub";
const dom = new JSDOM();
Object.assign(globalThis, { document:dom.window.document, DOMParser:dom.window.DOMParser, XMLSerializer:dom.window.XMLSerializer });

export function mobiFixture(encryption = 0): Uint8Array {
  const text = new TextEncoder().encode('<html><body><h1>First chapter</h1><p>Original synthetic fixture text.</p><script>alert(1)</script><mbp:pagebreak/><h1>Second chapter</h1><p>Another page.</p></body></html>');
  const start = 96, headerSize = 300;
  const bytes = new Uint8Array(start + headerSize + text.length);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => bytes.set(new TextEncoder().encode(value),offset);
  write(60,"BOOKMOBI"); view.setUint16(76,2);
  view.setUint32(78,start); view.setUint32(86,start + headerSize);
  view.setUint16(start,1); view.setUint32(start + 4,text.length);
  view.setUint16(start + 8,1); view.setUint16(start + 10,4096); view.setUint16(start + 12,encryption);
  write(start + 16,"MOBI"); view.setUint32(start + 20,248);
  view.setUint32(start + 24,2); view.setUint32(start + 28,65001); view.setUint32(start + 36,6);
  view.setUint32(start + 84,264); view.setUint32(start + 88,12);
  view.setUint32(start + 108,2); view.setUint32(start + 244,0xffffffff);
  write(start + 264,"Fixture book"); bytes.set(text,start + headerSize);
  return bytes;
}
test("self-contained MOBI parser loads synthetic text through the inert renderer", async () => {
  const book = await parseMobi(mobiFixture());
  assert.equal(book.title,"Fixture book");
  assert.equal(book.chapters.length,2);
  const wrapper = dom.window.document.createElement("div");
  wrapper.append(renderChapter(book,0,dom.window.document));
  assert.match(wrapper.textContent!,/Original synthetic fixture text/);
  assert.equal(wrapper.querySelector("script"),null);
});
test("MOBI encryption is rejected before parsing", async () => {
  assert.throws(() => validateMobi(mobiFixture(2)),/drm/);
  await assert.rejects(parseMobi(mobiFixture(1)),/drm/);
});
test("MOBI corrupt record bounds are rejected", () => {
  const bytes = mobiFixture();
  new DataView(bytes.buffer).setUint32(86,bytes.length + 1);
  assert.throws(() => validateMobi(bytes),/invalid/);
  assert.throws(() => validateMobi(new Uint8Array(100)),/invalid/);
});
test("KF8 raw documents tolerate HTML that is not well-formed XHTML", () => {
  const doc = mobiDocument("<html><body><h1>Fixture</h1><p>A line<br>Another line</body></html>", "application/xhtml+xml");
  assert.equal(doc.querySelector("parsererror"),null);
  assert.match(doc.body.textContent!, /A lineAnother line/);
});
test("encryption in a later hybrid MOBI header is rejected", () => {
  const original = mobiFixture();
  const bytes = new Uint8Array(original.length + 300);
  bytes.set(original);
  const view = new DataView(bytes.buffer);
  const start = view.getUint32(86);
  bytes.set(new TextEncoder().encode("MOBI"),start + 16);
  view.setUint16(start + 12,2);
  assert.throws(() => validateMobi(bytes),/drm/);
});
