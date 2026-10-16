export type ReaderPosition = { section: number; offset: number };
export function parsePosition(value: string | null, sections: number): ReaderPosition {
  try {
    const item = JSON.parse(value || "null");
    if (item && Number.isInteger(item.section) && item.section >= 0 && item.section < sections
      && Number.isFinite(item.offset) && item.offset >= 0 && item.offset <= 1) return item;
  } catch { /* Invalid local state starts at the beginning. */ }
  return { section: 0, offset: 0 };
}
export function readerFormat(filename: string): "epub" | "pdf" | "mobi" | "azw3" | "kfx" | null {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension === "epub" || extension === "pdf" || extension === "mobi" || extension === "azw3" || extension === "kfx" ? extension : null;
}
