import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { bookFromKindleFilename, toSyncCsv, type SyncBook } from "./lib/csv";
import { reviewBooksForGoodreads, type ReviewBook } from "./lib/goodreads-review";

type ConnectedDevice = {
    manufacturer: string | null;
    product: string | null;
    connection: "mtp" | "usb-drive" | "kobo-usb";
  vendorId: number;
  productId: number;
};

type MetadataReview = {
  manufacturer: string;
  model: string;
  storageCount: number;
  objectCount: number;
  skippedObjectCount: number;
  bookNames: string[];
  books: SyncBook[];
};

type DiagnosticSnapshot = {
  appVersion: string;
  operatingSystem: string;
  architecture: string;
};

type Language = "es" | "en";

const copy = {
  es: {
    eyebrow: "Pecia Sync · beta sin conexión",
    title: "Tu e-reader, en tu biblioteca.",
    lede: "Un importador de solo lectura para Kindle y Kobo. Sin cuenta, conexión a internet, descargas ni cambios en tu dispositivo.",
    connectHeading: "Conecta un dispositivo",
    connectLede: "Cada paso es local y de solo lectura hasta que guardes un CSV de forma explícita.",
    flowLabel: "Pasos de importación de Kindle",
    find: "1 · Busca un e-reader",
    review: "2 · Revisa libros",
    save: "3 · Guarda el CSV",
    howHeading: "Cómo funciona",
    howFind: "Busca. Sync busca un Kindle o Kobo conectado a tu ordenador.",
    howReview: "Revisa. Lee los metadatos visibles del lector, nunca el contenido de un ebook.",
    howSave: "Guarda. Tú eliges dónde guardar un CSV compatible con Goodreads, listo para importar en Pecia.",
    kindleNote: "Nota sobre Kindle: los Kindles más recientes quizá no expongan el progreso ni los subrayados por USB. Sync deja esos campos vacíos en vez de inventarlos.",
    footer: "Pecia Sync es parte de Pecia · código abierto · sin actualizador · sin telemetría · sin acceso de red en segundo plano",
    checking: "Buscando un lector MTP de forma local. No se leerá ningún archivo.",
    noDevice: "No se ha encontrado un e-reader MTP. Déjalo conectado y desbloqueado e inténtalo de nuevo.",
    found: "Encontrado",
    foundNext: "La detección funciona; el siguiente paso es revisar los metadatos.",
    deviceUnavailable: "Pecia Sync no ha podido acceder al lector. Desconéctalo, vuelve a conectarlo e inténtalo de nuevo.",
    reviewing: "Abriendo una sesión de solo lectura. Pecia Sync no descargará ningún ebook.",
    noBooks: " No se han encontrado títulos de libros reconocibles en este dispositivo.",
    noContents: " No se ha leído el contenido de ningún archivo.",
    reviewUnavailable: "El Kindle está ocupado o no está disponible por MTP. Desconéctalo, vuelve a conectarlo y revisa los metadatos otra vez.",
    saveCancelled: "Guardado cancelado. No se ha escrito ningún archivo.",
    saved: "CSV de revisión de Kindle guardado localmente. Contiene títulos y autores obtenidos solo de metadatos; no había progreso ni contenido de archivos disponible.",
    saveFailed: "Pecia Sync no ha podido guardar el CSV de revisión de Kindle.",
    saveDialog: "Guardar CSV de Pecia Sync",
    support: "¿Necesitas ayuda?",
    supportFailed: "No se ha podido abrir tu aplicación de correo.",
    version: "Versión",
  },
  en: {
    eyebrow: "Pecia Sync · offline beta",
    title: "Your e-reader, in your library.",
    lede: "A read-only importer for Kindle and Kobo. No account, network connection, downloads or changes to your device.",
    connectHeading: "Connect a device",
    connectLede: "Each step is local and read-only until you explicitly save a CSV.",
    flowLabel: "Kindle import steps",
    find: "1 · Find e-reader",
    review: "2 · Review books",
    save: "3 · Save CSV",
    howHeading: "How it works",
    howFind: "Find. Sync checks for a connected Kindle or Kobo on your computer.",
    howReview: "Review. It reads the reader’s visible book metadata—never the contents of an ebook.",
    howSave: "Save. You choose where to save one Goodreads-compatible CSV, ready to import into Pecia.",
    kindleNote: "Kindle note: newer Kindles may not expose reading progress or highlights over USB. Sync leaves those fields empty rather than guessing.",
    footer: "Pecia Sync is part of Pecia · open source · no updater · no telemetry · no background network access",
    checking: "Looking only for an MTP device. No files are being read.",
    noDevice: "No MTP e-reader found. Keep it connected and unlocked, then try again.",
    found: "Found",
    foundNext: "Device discovery is working; reading metadata is the next step.",
    deviceUnavailable: "Pecia Sync could not claim the device. Disconnect it, reconnect it, and try again.",
    reviewing: "Opening a read-only session. Pecia Sync will not download any book files.",
    noBooks: " No recognizable book titles were exposed by this device.",
    noContents: " No file contents were read.",
    reviewUnavailable: "The Kindle is busy or unavailable to MTP. Disconnect it, reconnect it, then try the metadata review again.",
    saveCancelled: "Save cancelled. No file was written.",
    saved: "Kindle review CSV saved locally. It contains titles and authors derived from metadata only; no progress or file contents were available.",
    saveFailed: "Pecia Sync could not save the Kindle review CSV.",
    saveDialog: "Save Pecia Sync CSV",
    support: "Need help?",
    supportFailed: "Your email application could not be opened.",
    version: "Version",
  },
} as const;

let language: Language = "es";
let reviewedBooks: SyncBook[] = [];
let reviewBooks: ReviewBook[] = [];
let connectedDevices: ConnectedDevice[] = [];
let lastReview: MetadataReview | null = null;
const diagnosticEvents: string[] = [];

function t() { return copy[language]; }

function recordDiagnostic(event: string) {
  diagnosticEvents.push(`${new Date().toISOString()} — ${event}`);
  if (diagnosticEvents.length > 8) diagnosticEvents.shift();
}

function setLanguage(nextLanguage: Language) {
  language = nextLanguage;
  document.documentElement.lang = language;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n as keyof typeof copy.es;
    element.textContent = t()[key];
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel as keyof typeof copy.es;
    element.setAttribute("aria-label", t()[key]);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });
  document.querySelector<HTMLButtonElement>("#device-check")!.textContent = t().find;
  document.querySelector<HTMLButtonElement>("#metadata-review")!.textContent = t().review;
  document.querySelector<HTMLButtonElement>("#kindle-export")!.textContent = t().save;
  const status = document.querySelector<HTMLElement>("#device-status");
  if (status) status.textContent = "";
  if (lastReview) renderReviewResult(lastReview);
}

function hideReviewResult() {
  document.querySelector<HTMLElement>("#review-result")?.setAttribute("hidden", "");
}

function renderReviewResult(review: MetadataReview) {
  const result = document.querySelector<HTMLElement>("#review-result");
  const summary = document.querySelector<HTMLElement>("#review-summary");
  const preview = document.querySelector<HTMLElement>("#book-preview");
  const detail = document.querySelector<HTMLElement>("#review-detail");
  if (!result || !summary || !preview || !detail) return;

  const bookCount = reviewedBooks.length;
  const ready = reviewBooks.filter((entry) => !entry.needsReview).length;
  const flagged = reviewBooks.filter((entry) => entry.needsReview);
  const adjusted = reviewBooks.filter((entry) => entry.changes.length);
  summary.textContent = language === "es"
    ? `${bookCount} libros encontrados · ${ready} listos para exportar${flagged.length ? ` · ${flagged.length} necesitan revisión` : ""}`
    : `${bookCount} books found · ${ready} ready to export${flagged.length ? ` · ${flagged.length} need review` : ""}`;
  const previewItems = adjusted.slice(0, 2).map((entry) => {
    const item = document.createElement("li");
    item.textContent = `${entry.book.title} — ${entry.book.author} · ${language === "es" ? "ajustado automáticamente" : "adjusted automatically"}`;
    return item;
  });
  if (!previewItems.length) previewItems.push(Object.assign(document.createElement("li"), { textContent: language === "es" ? "Los títulos y autores están listos para exportar." : "Titles and authors are ready to export." }));
  preview.replaceChildren(...previewItems);
  const issuesButton = document.querySelector<HTMLButtonElement>("#review-issues");
  if (issuesButton) {
    issuesButton.hidden = !flagged.length;
    issuesButton.textContent = language === "es" ? `Ver y editar los ${flagged.length} que necesitan revisión` : `View and edit ${flagged.length} needing review`;
  }
  const metadata = language === "es"
    ? `${review.objectCount} elementos revisados · ${review.storageCount} almacenamiento · Solo metadatos`
    : `${review.objectCount} items reviewed · ${review.storageCount} storage area${review.storageCount === 1 ? "" : "s"} · Metadata only`;
  const skipped = review.skippedObjectCount
    ? language === "es" ? ` · ${review.skippedObjectCount} no disponible${review.skippedObjectCount === 1 ? "" : "s"}` : ` · ${review.skippedObjectCount} unavailable`
    : "";
  detail.textContent = `${metadata}${skipped}`;
  result.removeAttribute("hidden");
}

function renderIssueEditor() {
  const editor = document.querySelector<HTMLElement>("#review-editor");
  if (!editor) return;
  const flagged = reviewBooks.filter((entry) => entry.needsReview);
  editor.replaceChildren(...flagged.map((entry) => {
    const row = document.createElement("div"); row.className = "review-edit-row";
    const title = document.createElement("input"); title.value = entry.book.title; title.setAttribute("aria-label", language === "es" ? "Título" : "Title");
    const author = document.createElement("input"); author.value = entry.book.author; author.placeholder = language === "es" ? "Añade el autor" : "Add author"; author.setAttribute("aria-label", language === "es" ? "Autor" : "Author");
    const save = () => { entry.book.title = title.value.trim(); entry.book.author = author.value.trim(); entry.needsReview = !entry.book.author || entry.book.title.length < 2; reviewedBooks = reviewBooks.map((item) => item.book); renderReviewResult(lastReview!); if (!entry.needsReview) renderIssueEditor(); };
    title.addEventListener("input", save); author.addEventListener("input", save); row.append(title, author); return row;
  }));
  editor.hidden = false;
}

async function saveCsv(books: readonly SyncBook[], filename: string, status: HTMLElement, successMessage: string): Promise<boolean> {
  const saved = await invoke<boolean>("save_csv", { defaultFilename: filename, contents: toSyncCsv(books), dialogTitle: t().saveDialog });
  status.textContent = saved ? successMessage : t().saveCancelled;
  return saved;
}

async function checkConnectedDevice() {
  const button = document.querySelector<HTMLButtonElement>("#device-check");
  const status = document.querySelector<HTMLElement>("#device-status");
  if (!button || !status) return;

  button.disabled = true;
  button.textContent = language === "es" ? "Buscando localmente…" : "Checking locally…";
  status.textContent = t().checking;
  hideReviewResult();

  try {
    connectedDevices = await invoke<ConnectedDevice[]>("list_connected_devices");
    if (connectedDevices.length === 0) {
      recordDiagnostic("Device check: no e-reader found");
      status.textContent = t().noDevice;
      return;
    }
    const names = connectedDevices.map((device) => [device.manufacturer, device.product].filter(Boolean).join(" ") || "MTP device");
    status.textContent = `${t().found} ${names.join(", ")}. ${t().foundNext}`;
    recordDiagnostic(`Device check: ${connectedDevices.length} e-reader(s) found via ${connectedDevices.map((device) => device.connection).join(", ")}`);
    button.dataset.complete = "true";
    document.querySelector<HTMLElement>("#metadata-review")?.removeAttribute("hidden");
  } catch {
    recordDiagnostic("Device check: unavailable");
    status.textContent = t().deviceUnavailable;
  } finally {
    button.disabled = false;
    button.textContent = t().find;
  }
}

async function reviewVisibleMetadata() {
  const button = document.querySelector<HTMLButtonElement>("#metadata-review");
  const status = document.querySelector<HTMLElement>("#device-status");
  if (!button || !status) return;

  button.disabled = true;
  button.textContent = language === "es" ? "Revisando metadatos…" : "Reviewing metadata locally…";
  status.textContent = t().reviewing;
  try {
    const connection = connectedDevices.find((device) => device.connection === "kobo-usb")?.connection
      ?? connectedDevices.find((device) => device.connection === "usb-drive")?.connection
      ?? "mtp";
    const review = await invoke<MetadataReview>("review_visible_metadata", { connection });
    const books = review.books.length
      ? review.books
      : review.bookNames.map(bookFromKindleFilename).filter((book): book is SyncBook => book !== null);
    reviewBooks = reviewBooksForGoodreads(books);
    reviewedBooks = reviewBooks.map((entry) => entry.book);
    lastReview = review;
    recordDiagnostic(`Metadata review: ${reviewedBooks.length} book record(s), ${review.storageCount} storage area(s)`);
    status.textContent = reviewedBooks.length ? "" : t().noBooks;
    renderReviewResult(review);
    button.dataset.complete = "true";
    if (reviewedBooks.length) document.querySelector<HTMLElement>("#kindle-export")?.removeAttribute("hidden");
  } catch {
    recordDiagnostic("Metadata review: unavailable");
    status.textContent = t().reviewUnavailable;
  } finally {
    button.disabled = false;
    button.textContent = t().review;
  }
}

async function downloadKindleReview() {
  if (!reviewedBooks.length) return;
  const button = document.querySelector<HTMLButtonElement>("#kindle-export");
  const status = document.querySelector<HTMLElement>("#device-status");
  if (!status || !button) return;
  try {
    const source = reviewedBooks[0]?.source ?? "ereader";
    if (await saveCsv(reviewedBooks, `pecia-sync-${source}-review.csv`, status, t().saved)) {
      recordDiagnostic(`CSV save: completed for ${reviewedBooks.length} book record(s)`);
      button.dataset.complete = "true";
    }
  } catch {
    recordDiagnostic("CSV save: failed");
    status.textContent = t().saveFailed;
  }
}

async function contactSupport(event: MouseEvent) {
  event.preventDefault();
  const status = document.querySelector<HTMLElement>("#device-status");
  try {
    const snapshot = await invoke<DiagnosticSnapshot>("diagnostic_snapshot");
    const body = [
      "Hola,",
      "",
      "Necesito ayuda con Pecia Sync.",
      "",
      "Datos de diagnóstico (generados localmente al pulsar el enlace):",
      `- Versión: ${snapshot.appVersion}`,
      `- Sistema: ${snapshot.operatingSystem} (${snapshot.architecture})`,
      "- Eventos de esta sesión:",
      ...(diagnosticEvents.length ? diagnosticEvents.map((event) => `  - ${event}`) : ["  - Ninguno todavía"]),
      "",
      "No se han incluido títulos de libros, archivos, bases de datos, cuentas ni identificadores del dispositivo.",
    ].join("\n");
    await openUrl(`mailto:hola@pecia.app?subject=${encodeURIComponent("Pecia Sync — soporte")}&body=${encodeURIComponent(body)}`);
  } catch {
    if (status) status.textContent = t().supportFailed;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  setLanguage("es");
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.language as Language));
  });
  document.querySelector("#device-check")?.addEventListener("click", checkConnectedDevice);
  document.querySelector("#metadata-review")?.addEventListener("click", reviewVisibleMetadata);
  document.querySelector("#kindle-export")?.addEventListener("click", downloadKindleReview);
  document.querySelector("#review-issues")?.addEventListener("click", renderIssueEditor);
  document.querySelector<HTMLAnchorElement>("#support-email")?.addEventListener("click", contactSupport);
  document.querySelector<HTMLAnchorElement>("#pecia-link")?.addEventListener("click", async (event: MouseEvent) => {
    event.preventDefault();
    const link = event.currentTarget;
    if (link instanceof HTMLAnchorElement) await openUrl(link.href);
  });
  invoke<DiagnosticSnapshot>("diagnostic_snapshot").then((snapshot) => {
    const version = document.querySelector<HTMLElement>("#app-version");
    if (version) version.textContent = `${t().version} ${snapshot.appVersion}`;
  }).catch(() => {});
});
