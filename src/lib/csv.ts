export type SyncHighlight = { text: string; note?: string | null; location?: string; createdAt?: string };
export type SyncBook = { title: string; author: string; isbn?: string; progress?: number; lastRead?: string; source: "kindle" | "kobo"; deviceId?: string; highlights?: SyncHighlight[] };
const headers = ["Title", "Author", "ISBN", "ISBN13", "Date Read", "Bookshelves", "Exclusive Shelf", "Pecia Sync Progress", "Pecia Sync Last Read", "Pecia Sync Source", "Pecia Sync Device ID", "Pecia Sync Highlights"];
const escape = (value: string) => /[\",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const shelfFor = (progress: number | undefined) => progress === undefined ? "" : progress <= 0 ? "to-read" : progress >= 1 ? "read" : "currently-reading";
const digits = (isbn: string | undefined) => isbn?.replace(/[^0-9X]/gi, "") ?? "";
export function toSyncCsv(books: readonly SyncBook[]): string { const rows = books.map((book) => { const shelf = shelfFor(book.progress); const isbn = digits(book.isbn); return [book.title, book.author, isbn.length === 13 ? "" : isbn, isbn.length === 13 ? isbn : "", book.progress === 1 ? book.lastRead ?? "" : "", shelf, shelf, book.progress?.toString() ?? "", book.lastRead ?? "", book.source, book.deviceId ?? "", book.highlights?.length ? JSON.stringify(book.highlights) : ""].map(escape).join(","); }); return `${headers.join(",")}\r\n${rows.join("\r\n")}\r\n`; }
/**
 * Converts the human-readable portion of a Kindle MTP filename into a review
 * candidate. The opaque suffix is intentionally discarded: it is not a title
 * and is never written to the export.
 */
export function bookFromKindleFilename(filename: string): SyncBook | null {
  const withoutExtension = filename.replace(/\.(azw|azw3|azw4|kfx|mobi)$/i, "");
  const withoutOpaqueSuffix = withoutExtension.replace(/_[A-Z0-9]{10,}$/i, "");
  const separator = withoutOpaqueSuffix.indexOf(" - ");
  if (separator < 1) return null;

  const title = withoutOpaqueSuffix.slice(0, separator).trim().replace(/_\s*/g, ": ");
  const author = withoutOpaqueSuffix.slice(separator + 3).trim().replace(/_\s*/g, ", ");
  return title && author ? { title, author, source: "kindle" } : null;
}
