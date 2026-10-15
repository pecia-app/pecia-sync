import { unzipSync, strFromU8 } from "fflate";

export type Chapter = { path: string; label: string };
export type Epub = { title: string; author: string; chapters: Chapter[]; files: Record<string, Uint8Array>; toc?: { section: number; label: string }[] };
const MAX_TOTAL = 80 * 1024 * 1024;

/** Resolve only relative archive entries, never URLs or paths escaping the ZIP. */
export function archivePath(base: string, reference: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(reference.split("#")[0]!); } catch { throw new Error("invalid"); }
  if (/^[a-z][a-z0-9+.-]*:|^[\/\\]|[\\\u0000]/i.test(decoded)) throw new Error("invalid");
  const parts = base.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (part === "..") { if (!parts.length) throw new Error("invalid"); parts.pop(); }
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function xml(value: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(value)) throw new Error("invalid");
  const result = new DOMParser().parseFromString(value, "application/xml");
  if (result.querySelector("parsererror")) throw new Error("invalid");
  return result;
}
function elements(doc: Document | Element, tag: string): Element[] {
  return Array.from(doc.getElementsByTagNameNS("*", tag));
}

export function parseEpub(bytes: Uint8Array): Epub {
  let total = 0, count = 0;
  const files = unzipSync(bytes, { filter: (file) => {
    if (++count > 5000 || file.originalSize > 16 * 1024 * 1024 || (total += file.originalSize) > MAX_TOTAL) throw new Error("too-large");
    if (file.name === "META-INF/encryption.xml") throw new Error("encrypted");
    return /\.(xml|opf|ncx|xhtml|html|htm|png|jpe?g|gif|webp)$/i.test(file.name);
  } });
  const read = (path: string) => {
    if (!files[path]) throw new Error("invalid");
    return xml(strFromU8(files[path]));
  };
  const container = read("META-INF/container.xml");
  const packagePath = elements(container, "rootfile")[0]?.getAttribute("full-path");
  if (!packagePath) throw new Error("invalid");
  const opfPath = archivePath("", packagePath);
  const opf = read(opfPath);
  const manifest = new Map(elements(opf, "item").map((item) => [item.getAttribute("id"), item]));
  const chapters = elements(opf, "itemref").filter(item => item.getAttribute("linear") !== "no").map((item, index) => {
    const target = manifest.get(item.getAttribute("idref"));
    const href = target?.getAttribute("href");
    if (!href || !/^(application\/xhtml\+xml|text\/html)$/.test(target?.getAttribute("media-type") ?? "")) throw new Error("invalid");
    const path = archivePath(opfPath, href);
    const doc = read(path);
    const heading = doc.querySelector("h1,h2,title")?.textContent?.trim();
    return { path, label: heading || String(index + 1) };
  });
  if (!chapters.length || chapters.length > 2000) throw new Error("invalid");
  return {
    title: elements(opf, "title")[0]?.textContent?.trim() || "EPUB",
    author: elements(opf, "creator")[0]?.textContent?.trim() || "",
    chapters, files,
  };
}

const allowed = new Set("p div section article h1 h2 h3 h4 h5 h6 span em strong b i u s small sup sub blockquote pre code ul ol li br hr table thead tbody tfoot tr td th caption figure figcaption dl dt dd a".split(" "));
const blocked = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "svg", "math", "link", "meta", "base", "audio", "video"]);

/** Rebuild inert content from a strict tag allowlist. Never insert book HTML,
 * styles, URLs, event handlers, or scripts into the application document. */
export function renderChapter(book: Epub, index: number, owner: Document = document): DocumentFragment {
  const chapter = book.chapters[index];
  if (!chapter) throw new Error("invalid");
  const parsed = xml(strFromU8(book.files[chapter.path]!));
  const root = elements(parsed, "body")[0];
  if (!root) throw new Error("invalid");
  const fragment = owner.createDocumentFragment();
  function copy(node: Node, parent: Node) {
    if (node.nodeType === 3) { parent.appendChild(owner.createTextNode(node.textContent || "")); return; }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const tag = element.localName.toLowerCase();
    if (blocked.has(tag)) return;
    if (tag === "img") {
      try {
        const path = archivePath(chapter.path, element.getAttribute("src") || "");
        const data = book.files[path];
        const ext = path.split(".").pop()?.toLowerCase();
        const mime = ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp"} as Record<string,string>)[ext || ""];
        if (data && mime && data.length <= 4 * 1024 * 1024) {
          const image = owner.createElement("img");
          let binary = "";
          for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
          image.src = `data:${mime};base64,${btoa(binary)}`;
          image.alt = element.getAttribute("alt") || "";
          parent.appendChild(image);
        }
      } catch { /* External/missing images are intentionally not loaded. */ }
      return;
    }
    const target = allowed.has(tag) ? owner.createElement(tag === "a" ? "span" : tag) : owner.createDocumentFragment();
    for (const child of Array.from(node.childNodes)) copy(child, target);
    parent.appendChild(target);
  }
  for (const child of Array.from(root.childNodes)) copy(child, fragment);
  return fragment;
}
