import { bookFromKindleFilename, type SyncBook } from "./csv";

export type ProgressObservation = { progress: number; observedAt: string };

export function kindleBook(name: string, observations: Record<string, ProgressObservation>): SyncBook | null {
  const book = bookFromKindleFilename(name);
  if (!book) return null;
  const observation = observations[name];
  if (observation && Number.isFinite(observation.progress) && observation.progress >= 0 && observation.progress <= 1 && Number.isFinite(Date.parse(observation.observedAt))) {
    book.progress = observation.progress;
    book.progressObservedAt = observation.observedAt;
  }
  return book;
}

export function progressLabel(book: SyncBook, language: "en" | "es"): string {
  if (book.progress == null) return language === "es" ? "Progreso no disponible" : "Progress unavailable";
  const percent = Math.round(book.progress * 100);
  const value = `${percent}%`;
  if (!book.progressObservedAt) return value;
  const date = new Date(book.progressObservedAt).toLocaleString(language === "es" ? "es-ES" : "en-GB");
  return language === "es" ? `${value} registrado por el lector · ${date}` : `${value} recorded by device · ${date}`;
}
