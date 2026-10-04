import assert from "node:assert/strict";
import test from "node:test";
import { toSyncCsv } from "./csv";
test("writes Goodreads shelves and Pecia Sync extension columns", () => { const csv = toSyncCsv([{ title:"A book", author:"An author", isbn:"9788417860797", progress:.43, lastRead:"2026-10-04", source:"kobo" }]); assert.match(csv, /Title,Author,ISBN,ISBN13,Date Read,Bookshelves,Exclusive Shelf,Pecia Sync Progress/); assert.match(csv, /A book,An author,,9788417860797,,currently-reading,currently-reading,0.43,2026-10-04,kobo/); });
test("quotes opt-in highlights as one RFC 4180 cell", () => { const csv = toSyncCsv([{ title:"A", author:"B", progress:1, source:"kindle", highlights:[{ text:"A comma, a quote: \" and a newline\n", note:"mine" }] }]); assert.match(csv, /Pecia Sync Highlights/); assert.ok(csv.includes('""note"":""mine""')); });
