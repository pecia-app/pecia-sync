// Reproducible documentation captures. No native bridge, devices or real books.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { zipSync, strToU8 } from "fflate";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "docs/screenshots");
const paragraphs = [
  "This is an original demonstration text written for Pecia Sync. It is not an excerpt from a published book.",
  "The morning began quietly. A notebook lay open beside the window, waiting for a few words about the day ahead.",
  "Reading can be a small pause: a place to follow an idea, return to a sentence, or simply enjoy the shape of a story.",
  "In this sample library, every title and author is fictional. The screenshots demonstrate the interface without exposing a personal reading history.",
  "Use the contents on the left to change sections. The controls above adjust the text size, and the bookmark button remembers a place on this computer.",
  "Your reader remains untouched. This local position is separate from any progress reported by a connected device.",
];
const files = {
  "META-INF/container.xml": '<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>',
  "book.opf": '<package><metadata><title>A Quiet Morning</title><creator>Pecia Demo</creator></metadata><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>',
  "one.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>A Quiet Morning</title></head><body><h1>A Quiet Morning</h1>' + paragraphs.map(text => "<p>" + text + "</p>").join("") + "</body></html>",
  "two.xhtml": '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>The Next Chapter</title></head><body><h1>The Next Chapter</h1><p>A second, entirely fictional section for navigation testing.</p></body></html>',
};
const bytes = Array.from(zipSync(Object.fromEntries(Object.entries(files).map(([path,text]) => [path,strToU8(text)]))));
const names = ["A Quiet Morning - Pecia Demo.epub","The Garden Notebook - Elena Example.mobi","A Map of Small Things - Alex Sample.azw3","Notes from the Coast - Marina Demo.epub","The Paper Observatory - Jules Example.pdf"];
const server = await createServer({ root, configFile:false, server:{host:"127.0.0.1",port:1422,strictPort:true}, logLevel:"error" });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({channel:process.env.SCREENSHOT_BROWSER || "chrome"});
  const context = await browser.newContext({viewport:{width:1200,height:760},deviceScaleFactor:1,locale:"en-GB",timezoneId:"UTC",reducedMotion:"reduce"});
  await context.route("**/*", route => {
    const url = route.request().url();
    return url.startsWith("http://127.0.0.1:1422/") || url.startsWith("data:") || url.startsWith("blob:")
      ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({time:new Date("2026-10-15T10:00:00Z")});
  await page.addInitScript(({bytes,names}) => {
    window.__TAURI_INTERNALS__ = { invoke:async command => {
      if (command === "diagnostic_snapshot") return {appVersion:"0.1.2",operatingSystem:"demo",architecture:"demo"};
      if (command === "list_connected_devices") return [{manufacturer:"Demo",product:"Kindle",connection:"usb-drive",vendorId:0,productId:0}];
      if (command === "review_visible_metadata") return {manufacturer:"Demo",model:"Kindle",storageCount:1,objectCount:5,skippedObjectCount:0,bookNames:names,books:[],kindleProgress:{
        [names[0]]:{progress:.24,observedAt:"2026-10-15T09:30:00Z"},
        [names[2]]:{progress:.62,observedAt:"2026-10-15T09:30:00Z"},
      }};
      if (command === "open_reader_file") return {name:names[0],bytes};
      throw new Error("Unexpected demo command: " + command);
    }};
  },{bytes,names});
  await page.goto("http://127.0.0.1:1422/");
  await page.locator('[data-language="en"]').click();
  await page.locator("#device-check").click();
  await page.locator(".book-row").first().waitFor();
  await mkdir(output,{recursive:true});
  await page.screenshot({path:resolve(output,"dashboard.png")});
  await page.locator(".book-row").first().dblclick();
  await page.locator(".reader-page h1").waitFor();
  await page.locator('.reader-page[aria-busy="true"]').waitFor({state:"detached"});
  await page.screenshot({path:resolve(output,"reader.png")});
  await page.getByRole("button",{name:"Next",exact:true}).click();
  await page.getByRole("heading",{name:"The Next Chapter",exact:true}).waitFor();
  await page.getByRole("button",{name:"Back to library",exact:false}).click();
  await page.locator(".book-row").first().waitFor();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Saved dashboard.png and reader.png; synthetic reader navigation passed.");
} finally {
  await browser?.close();
  await server.close();
}
