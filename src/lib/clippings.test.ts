import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClippings, clippingsMarkdown } from "./clippings";
const entry=(metadata:string,text:string,book="A Synthetic Book (Demo Author)")=>`${book}\n- ${metadata}\n\n${text}\n==========\n`;
test("imports English and Spanish UTF-8 clippings with BOM, CRLF, multiline text and raw dates",async()=>{
 const input=entry("Your Highlight on page 12 | Location 34-35 | Added on Friday, January 17, 2020","One line\nAnother line")+entry("Tu nota en la posición 36 | Añadido el jueves, 15 de octubre de 2026","Mi nota");
 const result=await parseClippings("\uFEFF"+input.replace(/\n/g,"\r\n"));
 assert.equal(result.entries.length,2); assert.equal(result.entries[0].title,"A Synthetic Book");
 assert.equal(result.entries[0].author,"Demo Author"); assert.equal(result.entries[0].page,"12"); assert.equal(result.entries[0].location,"34-35");
 assert.equal(result.entries[0].text,"One line\nAnother line"); assert.equal(result.entries[1].kind,"note");
 assert.match(result.entries[1].added,/Añadido el/);
});
test("deduplicates exact content at the same position, preserves edits and separate notes",async()=>{
 const a=entry("Your Highlight at location 1 | Added on today","Original");
 const result=await parseClippings(a+a+entry("Your Highlight at location 1 | Added on tomorrow","Original")+entry("Your Note at location 1","Original")+entry("Your Highlight at location 1","Edited"));
 assert.equal(result.duplicates,2); assert.equal(result.entries.length,3);
 assert.equal(new Set(result.entries.map(e=>e.id)).size,3);
 assert.equal((await parseClippings(a)).entries[0].id,result.entries[0].id);
});
test("counts bookmarks and malformed or unsupported entries rather than guessing",async()=>{
 const result=await parseClippings(entry("Your Bookmark at location 1","")+entry("Unknown type at location 1","Highlight in body is not metadata")+"Broken\n==========\n"+entry("Your Note at location 2",""));
 assert.equal(result.bookmarks,1); assert.equal(result.skipped,3); assert.equal(result.entries.length,0);
});
test("keeps unknown authors, missing locations and distinct books separate",async()=>{
 const result=await parseClippings(entry("Your Note | Added on Monday","Text","No author")+entry("Your Note | Added on Tuesday","Text","No author")+entry("Tu subrayado en la página 2 | Posición 3–4","Texto","Other Book (Writer)"));
 assert.equal(result.entries.length,3); assert.equal(result.entries[0].author,""); assert.equal(result.entries[2].location,"3–4");
});
test("Markdown escapes HTML, links, embeds and multiline injected headings",async()=>{
 const result=await parseClippings(entry("Your Note at location 1","<script>alert(1)</script>\n![image](https://example.com)\n# heading","[[Book]] (Author)"));
 const md=clippingsMarkdown(result.entries);
 assert.ok(!md.includes("<script>")); assert.ok(!md.includes("![image]")); assert.ok(!md.includes("\n# heading"));
 assert.match(md,/### Note/); assert.match(md,/Location 1/);
});
test("readable Markdown groups books with authors, quotes and separate notes",async()=>{
 const result=await parseClippings(entry("Your Note at location 2","My thought")+entry("Your Highlight at location 1","First line\nSecond line")+entry("Your Highlight","Another quote","Second book"));
 const md=clippingsMarkdown(result.entries);
 assert.match(md,/## A Synthetic Book\n\nAuthor: Demo Author/);
 assert.match(md,/### Highlights\n\n> First line\n> Second line/);
 assert.match(md,/### Notes\n\nMy thought/);
 assert.ok(!md.includes('> My thought'));
 assert.ok(md.indexOf('### Highlights')<md.indexOf('### Notes'));
 assert.match(md,/## Second book/);
 const es=clippingsMarkdown(result.entries,"es");
 assert.match(es,/# Subrayados y notas/);assert.match(es,/Autor: Demo Author/);assert.match(es,/Posición 2/);
});
test("rejects oversized sources and excessive entry counts",async()=>{
 await assert.rejects(parseClippings("x".repeat(20*1024*1024+1)),/too-large/);
 await assert.rejects(parseClippings("==========\n".repeat(50002)),/too-large/);
});
