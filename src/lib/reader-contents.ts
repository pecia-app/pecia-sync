import type { Epub } from "./epub";

export function readerContents(book: Pick<Epub, "chapters" | "toc">, fallback: string) {
  const named = book.chapters.flatMap((chapter, section) =>
    chapter.label.trim() && !/^\d+$/.test(chapter.label.trim()) ? [{section,label:chapter.label.trim()}] : []);
  if (book.toc?.length) return book.toc;
  if (named.length) return named;
  return book.chapters.map((_,section) => ({section,label:`${fallback} ${section + 1}`}));
}
