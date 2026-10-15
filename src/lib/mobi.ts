import { MOBI, type TocItem } from "foliate-js/mobi.js";
import { strToU8 } from "fflate";
import type { Epub } from "./epub";
const LIMIT = 80 * 1024 * 1024;
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/** Validate record bounds and reject encryption in both parts of hybrid books. */
export function validateMobi(bytes: Uint8Array): void {
  if (bytes.length < 86 || decode(bytes.subarray(60,68)) !== "BOOKMOBI") throw new Error("invalid");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(76);
  if (!count || count > 20000 || 78 + count * 8 > bytes.length) throw new Error("invalid");
  let previous = 78 + count * 8 - 1;
  for (let i = 0; i < count; i++) {
    const start = view.getUint32(78 + i * 8);
    const end = i + 1 < count ? view.getUint32(78 + (i + 1) * 8) : bytes.length;
    if (start <= previous || end <= start || end > bytes.length) throw new Error("invalid");
    previous = start;
    if (decode(bytes.subarray(start + 16,start + 20)) !== "MOBI") {
      if (i === 0) throw new Error("invalid");
      continue;
    }
    if (end - start < 264) throw new Error("invalid");
    if (view.getUint16(start + 12) !== 0) throw new Error("drm");
    if (view.getUint32(start + 4) > LIMIT || view.getUint16(start + 8) > 16000) throw new Error("too-large");
  }
}

function rasterType(data: Uint8Array): string | null {
  if (data[0] === 0x89 && decode(data.subarray(1,4)) === "PNG") return "png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  if (/^GIF8[79]a/.test(decode(data.subarray(0,6)))) return "gif";
  if (decode(data.subarray(0,4)) === "RIFF" && decode(data.subarray(8,12)) === "WEBP") return "webp";
  return null;
}

export function mobiDocument(source: string, type: DOMParserSupportedType): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, type);
  return type === "application/xhtml+xml" && (doc.querySelector("parsererror") || !doc.body)
    ? parser.parseFromString(source, "text/html") : doc;
}

/** Use raw parsed documents, never Foliate's HTML/CSS blob-URL loader.
 * All output still passes through the existing strict renderChapter allowlist. */
export async function parseMobi(bytes: Uint8Array): Promise<Epub> {
  validateMobi(bytes);
  const parser = new MOBI({ unzlib: () => { throw new Error("unsupported-font"); } });
  const book = await parser.open(new Blob([bytes.slice().buffer]));
  // KF8 sometimes contains HTML that is not well-formed XHTML. Foliate's
  // full renderer has this fallback; its raw createDocument API does not.
  book.parser = { parseFromString: mobiDocument };
  try {
    const sections = book.sections.filter(section => section.linear !== "no" && section.createDocument);
    if (!sections.length || sections.length > 2000) throw new Error("invalid");
    const files: Record<string, Uint8Array> = {};
    const chapters: Epub["chapters"] = [];
    const images = new Map<number, string | null>();
    let total = 0;
    for (const section of sections) {
      const doc = await section.createDocument!();
      if (doc.querySelector("parsererror") || !doc.body) throw new Error("invalid");
      for (const image of Array.from(doc.querySelectorAll("img"))) {
        const recindex = image.getAttribute("recindex");
        const embed = image.getAttribute("src")?.match(/^kindle:embed:([0-9A-V]+)(?:\?mime=[^\s]*)?$/i);
        const index = recindex && /^\d+$/.test(recindex) ? Number(recindex) - 1
          : embed ? parseInt(embed[1]!,32) - 1 : -1;
        image.removeAttribute("src");
        if (!Number.isInteger(index) || index < 0 || index > 20000) continue;
        if (!images.has(index)) {
          images.set(index,null);
          try {
            const data = new Uint8Array(await book.mobi.loadResource(index));
            const type = rasterType(data);
            if (type && data.length <= 4 * 1024 * 1024) {
              const path = `image-${index}.${type}`;
              total += data.length;
              if (total > LIMIT) throw new Error("too-large");
              files[path] = data; images.set(index,path);
            }
          } catch (error) { if (error instanceof Error && error.message === "too-large") throw error; }
        }
        const path = images.get(index);
        if (path) image.setAttribute("src",path);
      }
      const path = `section-${chapters.length}.xhtml`;
      const data = strToU8(new XMLSerializer().serializeToString(doc.documentElement));
      total += data.length;
      if (total > LIMIT || data.length > 16 * 1024 * 1024) throw new Error("too-large");
      files[path] = data;
      const label = doc.querySelector("h1,h2,h3,title")?.textContent?.trim().slice(0,160) || String(chapters.length + 1);
      chapters.push({path,label});
    }
    const toc: NonNullable<Epub["toc"]> = [];
    const seen = new Set<number>();
    async function collect(items: TocItem[], depth = 0) {
      if (depth > 20 || toc.length >= 2000) return;
      for (const item of items) {
        const label = item.label?.replace(/\s+/g," ").trim();
        if (label && item.href) {
          try {
            const target = await book.resolveHref(item.href);
            const section = target ? sections.indexOf(book.sections[target.index]!) : -1;
            // The current reader navigates sections, not inline TOC anchors.
            // Keep one named destination per section; never duplicate jumps.
            if (section >= 0 && !seen.has(section)) {
              toc.push({section,label}); seen.add(section);
              chapters[section]!.label = label;
            }
          } catch { /* Broken contents links do not prevent reading. */ }
        }
        if (item.subitems) await collect(item.subitems,depth + 1);
      }
    }
    await collect(book.toc || []);
    return { title:book.metadata.title || "MOBI", author:book.metadata.author?.join(", ") || "", chapters, files, toc };
  } finally { book.destroy(); }
}
