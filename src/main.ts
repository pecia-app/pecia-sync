import "./styles.css";
import "./laptop.css";
import "./reader.css";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toSyncCsv, type SyncBook } from "./lib/csv";
import { reviewBooksForGoodreads, type ReviewBook } from "./lib/goodreads-review";
import { kindleBook, progressLabel, type ProgressObservation } from "./lib/progress";
import { readerFormat } from "./lib/reader-position";

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
  kindleProgress?: Record<string, ProgressObservation>;
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
    overview: "Vista general", booksNav: "Libros", annotationsNav: "Subrayados", yourReader: "Tu lector", notConnected: "Sin conectar", localOnly: "Local. Privado. Solo lectura.", notImported: "Sin importar", booksHeading: "En tu lector", readOnly: "Solo lectura", search: "Buscar título o autor", filters: "Filtrar libros", allBooks: "Todos", withProgress: "Con progreso", unavailable: "Sin datos", emptyTitle: "Tu biblioteca empieza aquí", emptyBody: "Conecta tu Kindle o Kobo por USB y busca el lector para revisar sus libros.", noMatches: "No hay libros que coincidan.", missingNotice: "Sin datos no significa sin leer. El progreso refleja la última observación disponible, no una lectura en directo.", annotationsHeading: "Subrayados y notas", soon: "Próximamente", annotationsEmpty: "Tus ideas, en un solo lugar.", annotationsBody: "La importación de subrayados aún no está conectada. Esta versión revisa libros y el progreso disponible.", annotationsPrivacy: "No se han leído ni exportado tus notas.", readyHeading: "Haz espacio para tu próxima lectura.", readyBody: "Guarda el CSV e impórtalo en tu biblioteca de Pecia. Tú decides qué compartir.", openPecia: "Abrir Pecia ↗",
    title: "Tu lector, de un vistazo.",
    lede: "Tu biblioteca, sin conexión y de solo lectura. El contenido de un libro solo se lee cuando eliges abrirlo.",
    connectHeading: "Conecta un dispositivo",
    connectLede: "Cada paso es local y de solo lectura hasta que guardes un CSV de forma explícita.",
    flowLabel: "Pasos de importación de Kindle",
    find: "Escanear lector",
    refresh: "Actualizar",
    scanning: "Escaneando…",
    review: "Revisar libros",
    save: "Exportar CSV",
    howHeading: "Cómo funciona",
    howFind: "Busca. Sync busca un Kindle o Kobo conectado a tu ordenador.",
    howReview: "Revisa. Lee los metadatos visibles del lector, nunca el contenido de un ebook.",
    howSave: "Guarda. Tú eliges dónde guardar un CSV compatible con Goodreads, listo para importar en Pecia.",
    kindleNote: "Nota sobre Kindle: los Kindles más recientes quizá no expongan el progreso ni los subrayados por USB. Sync deja esos campos vacíos en vez de inventarlos.",
    footer: "Pecia Sync es parte de Pecia · código abierto · sin actualizador · sin telemetría · sin acceso de red en segundo plano",
    checking: "Buscando un lector conectado por USB de forma local.",
    noDevice: "No se ha encontrado un lector. Déjalo conectado y desbloqueado e inténtalo de nuevo.",
    found: "Encontrado",
    foundNext: "La detección funciona; el siguiente paso es revisar los metadatos.",
    deviceUnavailable: "Pecia Sync no ha podido acceder al lector. Desconéctalo, vuelve a conectarlo e inténtalo de nuevo.",
    reviewing: "Abriendo una sesión de solo lectura. Pecia Sync no descargará ningún ebook.",
    noBooks: " No se han encontrado títulos de libros reconocibles en este dispositivo.",
    noContents: " No se ha leído el contenido de ningún archivo.",
    reviewUnavailable: "El lector está ocupado o no está disponible. Desconéctalo, vuelve a conectarlo y revisa los metadatos otra vez.",
    saveCancelled: "Guardado cancelado. No se ha escrito ningún archivo.",
    saved: "CSV guardado con los metadatos disponibles y la fecha de las observaciones de progreso.",
    saveFailed: "Pecia Sync no ha podido guardar el CSV de revisión de Kindle.",
    saveDialog: "Guardar CSV de Pecia Sync",
    support: "¿Necesitas ayuda?",
    supportFailed: "No se ha podido abrir tu aplicación de correo.",
    version: "Versión",
  },
  en: {
    eyebrow: "Pecia Sync · offline beta",
    overview: "Overview", booksNav: "Books", annotationsNav: "Highlights", yourReader: "Your reader", notConnected: "Not connected", localOnly: "Local. Private. Read-only.", notImported: "Not imported", booksHeading: "On your reader", readOnly: "Read-only", search: "Search title or author", filters: "Filter books", allBooks: "All books", withProgress: "With progress", unavailable: "Unavailable", emptyTitle: "Your library starts here", emptyBody: "Connect your Kindle or Kobo by USB, then find your reader to review its books.", noMatches: "No matching books.", missingNotice: "Missing data does not mean unread. Progress reflects the latest available observation, not a live reading.", annotationsHeading: "Highlights & notes", soon: "Coming soon", annotationsEmpty: "Your ideas, in one place.", annotationsBody: "Highlight importing is not connected yet. This version reviews books and available reading progress.", annotationsPrivacy: "Your notes have not been read or exported.", readyHeading: "Make room for your next read.", readyBody: "Save the CSV and import it into your Pecia library. You decide what to share.", openPecia: "Open Pecia ↗",
    title: "Your reader, at a glance.",
    lede: "Your library, offline and read-only. Book contents are read only when you choose to open them.",
    connectHeading: "Connect a device",
    connectLede: "Each step is local and read-only until you explicitly save a CSV.",
    flowLabel: "Kindle import steps",
    find: "Scan reader",
    refresh: "Refresh",
    scanning: "Scanning…",
    review: "Review books",
    save: "Export CSV",
    howHeading: "How it works",
    howFind: "Find. Sync checks for a connected Kindle or Kobo on your computer.",
    howReview: "Review. It reads the reader’s visible book metadata—never the contents of an ebook.",
    howSave: "Save. You choose where to save one Goodreads-compatible CSV, ready to import into Pecia.",
    kindleNote: "Kindle note: newer Kindles may not expose reading progress or highlights over USB. Sync leaves those fields empty rather than guessing.",
    footer: "Pecia Sync is part of Pecia · open source · no updater · no telemetry · no background network access",
    checking: "Looking locally for a USB-connected reader.",
    noDevice: "No e-reader found. Keep it connected and unlocked, then try again.",
    found: "Found",
    foundNext: "Device discovery is working; reading metadata is the next step.",
    deviceUnavailable: "Pecia Sync could not claim the device. Disconnect it, reconnect it, and try again.",
    reviewing: "Opening a read-only session. Pecia Sync will not download any book files.",
    noBooks: " No recognizable book titles were exposed by this device.",
    noContents: " No file contents were read.",
    reviewUnavailable: "The reader is busy or unavailable. Disconnect it, reconnect it, then try the metadata review again.",
    saveCancelled: "Save cancelled. No file was written.",
    saved: "CSV saved with available metadata and progress observation times.",
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
let activeFilter = "all";
let scanTime: Date | null = null;
let scanning = false;
const bookFiles = new WeakMap<SyncBook, string>();

function explainReaderFormat(book: SyncBook, filename?: string) {
  const dialog = document.createElement("dialog");
  dialog.className = "reader-format-dialog";
  dialog.setAttribute("aria-labelledby", "reader-format-title");
  const heading = document.createElement("h2"); heading.id = "reader-format-title";
  heading.textContent = book.title;
  const message = document.createElement("p");
  const format = filename?.split(".").pop()?.toUpperCase();
  message.textContent = filename && !readerFormat(filename)
    ? language === "es"
      ? `Este archivo es ${format}. El lector de Pecia Sync solo admite EPUB, PDF, MOBI y AZW3 sin DRM. Si tienes una copia compatible, puedes seleccionarla aquí.`
      : `This file is ${format}. Pecia Sync’s reader supports only DRM-free EPUB, PDF, MOBI and AZW3. If you have a compatible copy, you can select it here.`
    : language === "es"
      ? "No podemos abrir este archivo directamente desde esta conexión. Puedes seleccionar una copia EPUB, PDF, MOBI o AZW3 local."
      : "This file cannot be opened directly over this connection. You can select a local EPUB, PDF, MOBI or AZW3 copy.";
  const actions = document.createElement("div"); actions.className = "actions";
  const cancel = document.createElement("button"); cancel.textContent = language === "es" ? "Cerrar" : "Close";
  cancel.addEventListener("click", () => dialog.close());
  const choose = document.createElement("button"); choose.className = "primary";
  choose.textContent = language === "es" ? "Abrir libro" : "Open book";
  choose.addEventListener("click", () => { dialog.close(); void launchReader(); });
  actions.append(cancel, choose); dialog.append(heading, message, actions);
  dialog.addEventListener("close", () => dialog.remove(), { once:true });
  document.body.append(dialog); dialog.showModal(); choose.focus();
}

async function launchReader(filename?: string) {
  if (scanning) return;
  const { openReader } = await import("./reader");
  await openReader(language, filename);
}
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
  document.querySelector<HTMLButtonElement>("#device-check")!.textContent = scanning ? t().scanning : lastReview ? t().refresh : t().find;
  document.querySelector<HTMLButtonElement>("#kindle-export")!.textContent = t().save;
  const status = document.querySelector<HTMLElement>("#device-status");
  if (status) status.textContent = "";
  document.querySelector<HTMLInputElement>("#book-search")!.placeholder = t().search;
  const openFile = document.querySelector<HTMLButtonElement>("#open-reader-file");
  if (openFile) openFile.textContent = language === "es" ? "Abrir libro" : "Open book";
  const hint = document.querySelector<HTMLElement>("#reader-hint");
  if (hint) hint.textContent = language === "es"
    ? "Doble clic o Intro para leer EPUB, PDF, MOBI o AZW3. Solo se abre el contenido al elegir un libro."
    : "Double-click or press Enter to read EPUB, PDF, MOBI or AZW3. Content is opened only when you choose a book.";
  updateDevicePanel();
  if (lastReview) renderReviewResult(lastReview);
}

function updateDevicePanel() {
  const device = connectedDevices.find((item) => item.connection === "kobo-usb")
    ?? connectedDevices.find((item) => item.connection === "usb-drive") ?? connectedDevices[0];
  const name = device ? [device.manufacturer, device.product].filter(Boolean).join(" ") || "E-reader" : t().notConnected;
  document.querySelector("#reader-name")!.textContent = name;
  document.querySelector("#device-title")!.textContent = device ? name : t().connectHeading;
  document.querySelector("#device-connection")!.textContent = device ? `USB · ${device.connection === "mtp" ? "MTP" : language === "es" ? "Disco" : "Drive"} · ${t().readOnly}` : t().connectLede;
  document.querySelector("#book-count")!.textContent = lastReview ? String(reviewedBooks.length) : "—";
  document.querySelector("#scan-time")!.textContent = scanTime ? `${language === "es" ? "Última revisión" : "Last scan"} · ${scanTime.toLocaleString(language === "es" ? "es-ES" : "en-GB")}` : "";
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
  summary.textContent = language === "es"
    ? `${bookCount} libros encontrados · ${ready} listos para exportar${flagged.length ? ` · ${flagged.length} necesitan revisión` : ""}`
    : `${bookCount} books found · ${ready} ready to export${flagged.length ? ` · ${flagged.length} need review` : ""}`;
  const query = document.querySelector<HTMLInputElement>("#book-search")!.value.trim().toLocaleLowerCase();
  const visibleBooks = reviewBooks.filter(({book}) =>
    (!query || `${book.title} ${book.author}`.toLocaleLowerCase().includes(query))
    && (activeFilter === "all" || (activeFilter === "known" ? book.progress != null : book.progress == null)));
  const previewItems = visibleBooks.map((entry) => {
    const item = document.createElement("li");
    item.className = "book-row";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", language === "es" ? `Abrir ${entry.book.title}` : `Open ${entry.book.title}`);
    const open = () => {
      const filename = bookFiles.get(entry.book);
      if (filename) {
        if (!readerFormat(filename)) {
          explainReaderFormat(entry.book, filename);
          return;
        }
        if (connectedDevices.some(device => device.connection === "usb-drive")) { void launchReader(filename); return; }
      }
      explainReaderFormat(entry.book, filename);
    };
    item.addEventListener("dblclick", open);
    item.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    const cover = document.createElement("span"); cover.className = "book-cover"; cover.textContent = entry.book.title.slice(0, 1); cover.setAttribute("aria-hidden", "true");
    const info = document.createElement("div"); info.className = "book-info";
    const title = document.createElement("span"); title.className = "book-title"; title.textContent = entry.book.title;
    const author = document.createElement("span"); author.className = "book-author"; author.textContent = entry.book.author || (language === "es" ? "Autor desconocido" : "Unknown author");
    info.append(title, author);
    const progress = document.createElement("div"); progress.className = "book-progress";
    if (entry.book.progress != null) {
      const percent = document.createElement("strong"); percent.textContent = `${Math.round(entry.book.progress * 100)}%`;
      const track = document.createElement("span"); track.className = "progress-track"; track.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span"); fill.style.width = `${Math.max(0, Math.min(100, entry.book.progress * 100))}%`; track.append(fill);
      progress.append(percent, track);
    }
    const observation = document.createElement("span"); observation.textContent = progressLabel(entry.book, language); progress.append(observation);
    item.append(cover, info, progress);
    return item;
  });
  preview.replaceChildren(...previewItems);
  document.querySelector<HTMLElement>("#no-matches")!.hidden = visibleBooks.length > 0;
  document.querySelector<HTMLElement>("#books-empty")!.hidden = true;
  updateDevicePanel();
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
  const progressNote = language === "es"
    ? " El progreso de Kindle procede de observaciones temporales: puede faltar o diferir del porcentaje en pantalla. Sin datos no significa sin leer."
    : " Kindle progress comes from temporary observations: it may be missing or differ from the screen percentage. Missing data does not mean unread.";
  detail.textContent = `${metadata}${skipped}${reviewedBooks.some((book) => book.source === "kindle") ? progressNote : ""}`;
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
    title.addEventListener("change", save); author.addEventListener("change", save); row.append(title, author); return row;
  }));
  editor.hidden = false;
}

async function saveCsv(books: readonly SyncBook[], filename: string, status: HTMLElement, successMessage: string): Promise<boolean> {
  const saved = await invoke<boolean>("save_csv", { defaultFilename: filename, contents: toSyncCsv(books), dialogTitle: t().saveDialog });
  status.textContent = saved ? successMessage : t().saveCancelled;
  return saved;
}

async function checkConnectedDevice() {
  if (scanning) return;
  const button = document.querySelector<HTMLButtonElement>("#device-check");
  const status = document.querySelector<HTMLElement>("#device-status");
  if (!button || !status) return;

  scanning = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = t().scanning;
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((item) => { item.disabled = true; });
  status.textContent = t().checking;
  hideReviewResult();
  reviewedBooks = []; reviewBooks = []; lastReview = null; scanTime = null; connectedDevices = [];
  document.querySelector<HTMLButtonElement>("#kindle-export")!.disabled = true;
  document.querySelector<HTMLElement>("#review-editor")!.hidden = true;
  document.querySelector<HTMLElement>("#books-empty")!.hidden = false;
  updateDevicePanel();

  try {
    connectedDevices = await invoke<ConnectedDevice[]>("list_connected_devices");
    if (connectedDevices.length === 0) {
      recordDiagnostic("Device check: no e-reader found");
      status.textContent = t().noDevice;
      return;
    }
    recordDiagnostic(`Device check: ${connectedDevices.length} e-reader(s) found via ${connectedDevices.map((device) => device.connection).join(", ")}`);
    button.dataset.complete = "true";
    updateDevicePanel();
    await reviewVisibleMetadata();
  } catch {
    recordDiagnostic("Device check: unavailable");
    status.textContent = t().deviceUnavailable;
  } finally {
    scanning = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = lastReview ? t().refresh : t().find;
    document.querySelector<HTMLButtonElement>("#kindle-export")!.disabled = !reviewedBooks.length;
    document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((item) => { item.disabled = false; });
  }
}

async function reviewVisibleMetadata() {
  const status = document.querySelector<HTMLElement>("#device-status");
  if (!status) return;
  status.textContent = t().reviewing;
  try {
    const connection = connectedDevices.find((device) => device.connection === "kobo-usb")?.connection
      ?? connectedDevices.find((device) => device.connection === "usb-drive")?.connection
      ?? "mtp";
    const review = await invoke<MetadataReview>("review_visible_metadata", { connection });
    const candidates = review.books.length
      ? review.books.map(book => ({ book, filename: undefined as string | undefined }))
      : review.bookNames.map(filename => ({
        filename,
        book: kindleBook(filename, review.kindleProgress ?? {}) ??
          (readerFormat(filename) ? { title:filename.replace(/\.(epub|pdf)$/i, ""), author:"", source:"kindle" as const } : null),
      })).filter((entry): entry is { filename:string; book:SyncBook } => entry.book !== null);
    reviewBooks = reviewBooksForGoodreads(candidates.map(entry => entry.book));
    reviewBooks.forEach((entry, index) => { if (candidates[index]?.filename) bookFiles.set(entry.book, candidates[index]!.filename!); });
    reviewedBooks = reviewBooks.map((entry) => entry.book);
    lastReview = review;
    scanTime = new Date();
    recordDiagnostic(`Metadata review: ${reviewedBooks.length} book record(s), ${review.storageCount} storage area(s)`);
    status.textContent = reviewedBooks.length ? "" : t().noBooks;
    renderReviewResult(review);
  } catch {
    recordDiagnostic("Metadata review: unavailable");
    status.textContent = t().reviewUnavailable;
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
  const openFile = document.createElement("button");
  openFile.id = "open-reader-file"; openFile.className = "reader-open-file";
  openFile.addEventListener("click", () => void launchReader());
  document.querySelector("#books .panel-heading")!.append(openFile);
  const hint = document.createElement("p"); hint.id = "reader-hint"; hint.className = "reader-hint";
  document.querySelector("#books .filters")!.after(hint);
  setLanguage("es");
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.language as Language));
  });
  document.querySelector("#device-check")?.addEventListener("click", checkConnectedDevice);
  document.querySelector("#kindle-export")?.addEventListener("click", downloadKindleReview);
  document.querySelector("#review-issues")?.addEventListener("click", renderIssueEditor);
  document.querySelector("#book-search")?.addEventListener("input", () => { if (lastReview) renderReviewResult(lastReview); });
  document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter!;
      document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      if (lastReview) renderReviewResult(lastReview);
    });
  });
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
