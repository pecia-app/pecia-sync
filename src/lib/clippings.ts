export type Clipping = { id: string; book: string; title: string; author: string; kind: "highlight" | "note"; text: string; location: string; page: string; added: string };
export type ImportResult = { entries: Clipping[]; duplicates: number; skipped: number; bookmarks: number };
export function clippingKey(entry: Omit<Clipping, "id">): string {
  return JSON.stringify([entry.book, entry.kind, entry.location, entry.page, entry.text, entry.location || entry.page ? "" : entry.added]);
}
export async function parseClippings(source: string): Promise<ImportResult> {
  if (new TextEncoder().encode(source).length > 20 * 1024 * 1024) throw Error("too-large");
  const blocks = source.replace(/^\uFEFF/, "").replace(/\r\n?/g,"\n").split(/^==========\s*$/m);
  if (blocks.length > 50001) throw Error("too-large");
  const result: ImportResult = {entries:[],duplicates:0,skipped:0,bookmarks:0};
  const seen = new Set<string>();
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.trim().split("\n");
    const book = lines[0]?.trim(), metadata = lines[1]?.trim() ?? "";
    if (!book || !metadata.startsWith("-")) { result.skipped++; continue; }
    // Classify only the first metadata field, never the body or book title.
    const type = metadata.split("|")[0].normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if (/\b(bookmark|marcador)\b/.test(type)) { result.bookmarks++; continue; }
    const kind = /\b(highlight|subrayado|resaltado)\b/.test(type) ? "highlight" : /\b(note|nota)\b/.test(type) ? "note" : null;
    const text = lines.slice(2).join("\n").trim();
    if (!kind || !text) { result.skipped++; continue; }
    const author = book.match(/^(.*)\s+\(([^()]*)\)$/);
    const location = metadata.match(/(?:Location|Loc\.|posici[oó]n|ubicaci[oó]n)\s*#?\s*(\d+(?:\s*[-–]\s*\d+)?)/i)?.[1]?.replace(/\s/g,"") ?? "";
    const page = metadata.match(/(?:page|p[aá]gina)\s+(\d+(?:\s*[-–]\s*\d+)?)/i)?.[1]?.replace(/\s/g,"") ?? "";
    const added = metadata.split("|").map(s=>s.trim()).find(s=>/^(Added on|A[nñ]adido el|Agregado el)/i.test(s)) ?? "";
    const entry: Omit<Clipping,"id"> = {book,title:author?.[1]?.trim() || book,author:author?.[2] || "",kind,text,location,page,added};
    const key = clippingKey(entry);
    if (seen.has(key)) { result.duplicates++; continue; }
    seen.add(key);
    const hash = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(key));
    result.entries.push({...entry,id:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,"0")).join("")});
  }
  return result;
}

// Escape source text rather than letting it create links, embeds, HTML or headings.
function markdown(text: string): string {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/([\\`*_{}\[\]()#!|~+\-])/g,"\\$1");
}
export function clippingsMarkdown(entries: readonly Clipping[], language: "es" | "en" = "en"): string {
  const t = language === "es"
    ? {title:"Subrayados y notas", source:"Importado de My Clippings.txt. Puede incluir entradas antiguas o eliminadas del Kindle.", author:"Autor", highlights:"Subrayados", notes:"Notas", location:"Posición", page:"Página"}
    : {title:"Highlights & notes", source:"Imported from My Clippings.txt. May include older entries or entries deleted from the Kindle.", author:"Author", highlights:"Highlights", notes:"Notes", location:"Location", page:"Page"};
  const groups = new Map<string,Clipping[]>();
  for (const entry of entries) { const group=groups.get(entry.book) ?? []; group.push(entry); groups.set(entry.book,group); }
  const output = [`# ${t.title}`, "", t.source, ""];
  for (const [book,items] of groups) {
    output.push(`## ${markdown(items[0]!.title || book)}`, "");
    if (items[0]!.author) output.push(`${t.author}: ${markdown(items[0]!.author)}`, "");
    for (const kind of ["highlight", "note"] as const) {
      const selected = items.filter(item => item.kind === kind);
      if (!selected.length) continue;
      output.push(`### ${kind === "highlight" ? t.highlights : t.notes}`, "");
      for (const item of selected) {
        const lines = markdown(item.text).split("\n");
        output.push(...(kind === "highlight" ? lines.map(line => "> " + line) : lines), "");
        const metadata = [item.location && `${t.location} ${item.location}`, item.page && `${t.page} ${item.page}`, item.added].filter(Boolean).join(" · ");
        if (metadata) output.push(markdown(metadata), "");
        output.push("---", "");
      }
    }
  }
  return output.join("\n");
}
