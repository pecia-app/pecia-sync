import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { zipSync, strToU8 } from "fflate";
import { archivePath, parseEpub, renderChapter } from "./epub";
import { parsePosition, readerFormat } from "./reader-position";
import { readerContents } from "./reader-contents";

const dom = new JSDOM();
Object.assign(globalThis, { DOMParser:dom.window.DOMParser });
const chapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A chapter</title></head><body><h1>A chapter</h1><p onclick="alert(1)">Safe text <a href="https://example.com">link</a></p><script>alert(1)</script><iframe src="https://example.com"/><img src="https://example.com/tracker.png"/><style>body{display:none}</style><img src="picture.png" alt="Local image"/><svg onload="alert(1)"/></body></html>`;
function fixture(extra: Record<string,string> = {}) {
  return zipSync(Object.fromEntries(Object.entries({
    "META-INF/container.xml": '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    "OPS/book.opf": '<package><metadata><title>Fixture book</title><creator>Test Author</creator></metadata><manifest><item id="one" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>',
    "OPS/chapter.xhtml":chapter,
    "OPS/picture.png":"fixture",
    ...extra,
  }).map(([key,value]) => [key,strToU8(value)])));
}
test("EPUB resolves its spine and metadata", () => {
  const book = parseEpub(fixture());
  assert.equal(book.title, "Fixture book");
  assert.equal(book.author, "Test Author");
  assert.deepEqual(book.chapters, [{path:"OPS/chapter.xhtml",label:"A chapter"}]);
});
test("KFX generated titles never appear as chapter names", () => {
  const bytes = fixture({"OPS/chapter.xhtml": chapter.replace("<title>A chapter</title>", "<title>cWP</title>")});
  assert.equal(parseEpub(bytes).chapters[0]?.label, "A chapter");
  assert.equal(parseEpub(bytes, { generatedTitles: true }).chapters[0]?.label, "A chapter");
  const untitled = parseEpub(fixture({"OPS/chapter.xhtml": '<html><head><title>c18J</title></head><body><p>Front matter</p></body></html>'}), { generatedTitles: true });
  assert.equal(untitled.chapters[0]?.label, "1");
  assert.deepEqual(readerContents(untitled, "Capítulo"), [{section:0,label:"Capítulo 1"}]);
  assert.deepEqual(readerContents({chapters:[...untitled.chapters, ...parseEpub(bytes).chapters]}, "Capítulo"), [{section:1,label:"A chapter"}]);
  assert.equal(renderChapter(untitled, 0, dom.window.document).textContent, "Front matter");
});
test("EPUB sanitization retains text but no executable attributes or network URLs", () => {
  const book = parseEpub(fixture());
  const wrapper = dom.window.document.createElement("div");
  wrapper.append(renderChapter(book, 0, dom.window.document));
  assert.match(wrapper.textContent!, /Safe text link/);
  assert.equal(wrapper.querySelector("script,iframe,style,svg,a,[onclick],[onload]"), null);
  assert.equal(wrapper.querySelectorAll("img").length, 1);
  assert.match(wrapper.querySelector("img")!.src, /^data:image\/png;base64,/);
  assert.doesNotMatch(wrapper.innerHTML, /https:|alert/);
});
test("converter HTML5 declaration parses and renders with sanitization intact", () => {
  const book = parseEpub(fixture({"OPS/chapter.xhtml": `<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n${chapter}`}));
  const wrapper = dom.window.document.createElement("div");
  wrapper.append(renderChapter(book, 0, dom.window.document));
  assert.equal(book.chapters[0]?.label, "A chapter");
  assert.match(wrapper.textContent!, /Safe text link/);
  assert.equal(wrapper.querySelector("script,iframe,style,svg,a,[onclick],[onload]"), null);
  assert.doesNotMatch(wrapper.innerHTML, /https:|alert/);
});
test("EPUB rejects encryption, external DTDs and entity declarations", () => {
  assert.throws(() => parseEpub(fixture({"META-INF/encryption.xml":"<encryption/>"})), /encrypted/);
  for (const declaration of [
    '<!DOCTYPE html SYSTEM "https://example.com/evil.dtd">',
    '<!DOCTYPE html PUBLIC "test" "file:///etc/passwd">',
    '<!DOCTYPE html [<!ENTITY secret SYSTEM "file:///etc/passwd">]>',
    '<!DOCTYPE html><!ENTITY secret "value">',
    '<!DOCTYPE html><!DOCTYPE html>',
  ]) {
    assert.throws(() => parseEpub(fixture({"OPS/chapter.xhtml": declaration + chapter})), /invalid/);
  }
});
test("archive resolution blocks external URLs, encoded traversal and absolute paths", () => {
  assert.equal(archivePath("OPS/chapter.xhtml", "../images/a.png"), "images/a.png");
  for (const path of ["../../escape", "https://example.com", "//example.com/a", "/file", "%2e%2e/%2e%2e/secret", "file:%2fetc", "bad%ZZ"]) {
    assert.throws(() => archivePath("OPS/chapter.xhtml", path), /invalid/);
  }
});
test("missing spine content fails closed", () => {
  assert.throws(() => parseEpub(fixture({"OPS/book.opf":"<package/>"})), /invalid/);
});
test("local position validation never changes device progress", () => {
  assert.deepEqual(parsePosition('{"section":2,"offset":0.5}', 4), {section:2,offset:0.5});
  for (const value of ['bad','null','{"section":99,"offset":0}','{"section":1,"offset":2}']) {
    assert.deepEqual(parsePosition(value, 4), {section:0,offset:0});
  }
  assert.equal(readerFormat("a.PDF"), "pdf");
  assert.equal(readerFormat("a.epub"), "epub");
  assert.equal(readerFormat("a.kfx"), "kfx");
});
