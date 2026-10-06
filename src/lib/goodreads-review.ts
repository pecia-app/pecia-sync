import type { SyncBook } from "./csv";

export type ReviewBook = {
  book: SyncBook;
  original: Pick<SyncBook, "title" | "author">;
  changes: string[];
  needsReview: boolean;
};

const moveTrailingArticle = (title: string) => title.replace(/^(.*),\s*(The|An|A)$/i, "$2 $1");

function cleanAuthor(author: string): string {
  const spaced = author.trim().replace(/([\p{Ll}])\.([\p{Lu}])/gu, "$1 $2").replace(/\s+/g, " ");
  const inverted = spaced.match(/^([^,]+),\s+([^,]+)$/);
  return inverted ? `${inverted[2]} ${inverted[1]}` : spaced;
}

export function reviewForGoodreads(book: SyncBook): ReviewBook {
  const original = { title: book.title, author: book.author };
  const title = moveTrailingArticle(book.title.trim().replace(/\s+/g, " "));
  const author = cleanAuthor(book.author);
  const changes: string[] = [];
  if (title !== original.title) changes.push("title");
  if (author !== original.author) changes.push("author");
  return { book: { ...book, title, author }, original, changes, needsReview: !author || title.length < 2 };
}

export function reviewBooksForGoodreads(books: readonly SyncBook[]): ReviewBook[] {
  return books.map(reviewForGoodreads);
}
