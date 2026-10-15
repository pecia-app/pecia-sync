import "./reader.css";
import { invoke } from "@tauri-apps/api/core";
import { parseEpub, renderChapter, type Epub } from "./lib/epub";
import { parsePosition, readerFormat } from "./lib/reader-position";
import { parseMobi } from "./lib/mobi";
import { readerContents } from "./lib/reader-contents";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { pdfPageText, pdfFitWidth } from "./lib/reader-pdf";

type Language = "es" | "en";
const labels = {
  es: { back:"Volver a biblioteca", contents:"Índice", pages:"Páginas", open:"Abrir libro", loading:"Abriendo el libro…", local:"Archivo local · Solo lectura", progress:"Lectura en este Mac", separate:"Tu progreso en Kindle no cambia", previous:"Anterior", next:"Siguiente", size:"Tamaño del texto", zoom:"Zoom", bookmark:"Guardar marcador", goBookmark:"Ir al marcador", saved:"Marcador guardado", text:"Texto accesible", page:"Página", chapter:"Capítulo", unavailable:"No se pudo abrir el archivo. Comprueba la conexión o selecciona una copia local.", unsupported:"Este formato no es compatible. Abre un EPUB, PDF, MOBI o AZW3 sin DRM.", encrypted:"Este EPUB tiene recursos cifrados y aún no es compatible. Selecciona una copia sin cifrar.", invalid:"El archivo está dañado o no es compatible.", "too-large":"El archivo supera el límite de tamaño (32 MB; contenido expandido: 80 MB).", ambiguous:"Hay varias coincidencias o demasiados archivos. Selecciona el libro con Abrir libro.", storage:"No se pudo guardar la posición localmente.", password:"Los PDF protegidos con contraseña aún no son compatibles.", failed:"No se pudo mostrar esta página o capítulo." },
  en: { back:"Back to library", contents:"Contents", pages:"Pages", open:"Open book", loading:"Opening book…", local:"Local file · Read-only", progress:"Reading on this Mac", separate:"Your Kindle progress does not change", previous:"Previous", next:"Next", size:"Text size", zoom:"Zoom", bookmark:"Save bookmark", goBookmark:"Go to bookmark", saved:"Bookmark saved", text:"Accessible text", page:"Page", chapter:"Chapter", unavailable:"Could not open the file. Check the connection or select a local copy.", unsupported:"This format is not supported. Open a DRM-free EPUB, PDF, MOBI or AZW3 copy.", encrypted:"This EPUB has encrypted resources and is not supported yet. Select an unencrypted copy.", invalid:"The file is damaged or is not supported.", "too-large":"The file exceeds the size limit (32 MB; expanded content: 80 MB).", ambiguous:"Multiple matches or too many files. Select the book with Open book.", storage:"Could not save your position locally.", password:"Password-protected PDFs are not supported yet.", failed:"Could not display this page or chapter." },
};
let active: Reader | null = null;
let opening = false;

export async function openReader(language: Language, filename?: string): Promise<void> {
  if (opening || active) return;
  const status = document.querySelector<HTMLElement>("#device-status")!;
  const t = labels[language];
  if (filename && !readerFormat(filename)) { status.textContent = t.unsupported; return; }
  opening = true;
  status.textContent = t.loading;
  try {
    const file = await invoke<{ name: string; bytes: number[] } | null>("open_reader_file", { filename: filename ?? null });
    if (!file) { status.textContent = ""; return; }
    const bytes = new Uint8Array(file.bytes);
    const reader = new Reader(language);
    active = reader;
    await reader.open(file.name, bytes);
    status.textContent = "";
  } catch (error) {
    active?.close(); active = null;
    const code = error instanceof Error ? error.message : String(error);
    status.textContent = code === "drm"
      ? language === "es" ? "Este libro está protegido con DRM. Pecia Sync no puede abrirlo ni eliminar su protección." : "This book is DRM-protected. Pecia Sync cannot open it or remove its protection."
      : t[code as keyof typeof t] || t.invalid;
    const dialog = document.createElement("dialog"); dialog.className = "reader-format-dialog";
    dialog.setAttribute("aria-label", language === "es" ? "No se pudo abrir el libro" : "Could not open book");
    const message = document.createElement("p"); message.textContent = status.textContent;
    const close = document.createElement("button"); close.textContent = language === "es" ? "Cerrar" : "Close";
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove(), {once:true});
    dialog.append(message,close); document.body.append(dialog); dialog.showModal(); close.focus();
  } finally { opening = false; }
}

class Reader {
  private t;
  private root = document.createElement("section");
  private viewport = document.createElement("div");
  private article = document.createElement("article");
  private navigation = document.createElement("nav");
  private notice = document.createElement("p");
  private count = document.createElement("span");
  private select = document.createElement("select");
  private previous: HTMLButtonElement;
  private next: HTMLButtonElement;
  private bookmarkButton: HTMLButtonElement;
  private bookmarkLink: HTMLButtonElement;
  private size = document.createElement("input");
  private pdfText = document.createElement("details");
  private pdfTextBody = document.createElement("p");
  private epub: Epub | null = null;
  private pdf: PDFDocumentProxy | null = null;
  private task: RenderTask | null = null;
  private pdfLoading: { destroy(): Promise<void> } | null = null;
  private section = 0;
  private sections = 0;
  private key = "";
  private serial = 0;
  private closed = false;
  private pendingOffset: number | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private focusBefore = document.activeElement as HTMLElement | null;
  private onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") this.close(); };
  private onResize = () => { if (this.pdf) void this.show(this.section, this.offset()); };
  constructor(language: Language) {
    this.t = labels[language];
    this.root.className = "reader-screen";
    this.root.setAttribute("aria-label", this.t.progress);
    const toolbar = document.createElement("header"); toolbar.className = "reader-toolbar";
    const back = this.button("← " + this.t.back, () => this.close());
    const title = document.createElement("div"); title.className = "reader-title"; title.id = "reader-title";
    const controls = document.createElement("div"); controls.className = "reader-controls";
    this.size.type = "range"; this.size.min = "16"; this.size.max = "28"; this.size.value = "20";
    this.size.setAttribute("aria-label", this.t.size);
    this.size.addEventListener("change", () => {
      const offset = this.offset();
      if (this.epub) { this.article.style.fontSize = this.size.value + "px"; this.restoreOffset(offset); }
      else void this.show(this.section, offset);
    });
    this.bookmarkButton = this.button("♡", () => {
      if (this.write("bookmark", { section:this.section, offset:this.offset() })) {
        this.notice.textContent = this.t.saved; this.bookmarkLink.hidden = false;
      }
    });
    this.bookmarkButton.setAttribute("aria-label", this.t.bookmark);
    controls.append(this.size, this.bookmarkButton); toolbar.append(back, title, controls);
    const layout = document.createElement("div"); layout.className = "reader-layout";
    const sidebar = document.createElement("aside"); sidebar.className = "reader-sidebar";
    const heading = document.createElement("h2"); heading.id = "reader-contents";
    this.navigation.setAttribute("aria-labelledby", heading.id);
    this.select.setAttribute("aria-label", this.t.contents);
    this.select.addEventListener("change", () => void this.show(Number(this.select.value)));
    this.bookmarkLink = this.button(this.t.goBookmark, () => {
      const mark = parsePosition(this.read("bookmark"), this.sections);
      void this.show(mark.section, mark.offset);
    });
    this.bookmarkLink.hidden = true;
    const local = document.createElement("small"); local.textContent = this.t.local; local.className = "reader-local";
    sidebar.append(heading, this.select, this.navigation, this.bookmarkLink, local);
    this.viewport.className = "reader-viewport"; this.viewport.tabIndex = 0;
    this.viewport.setAttribute("aria-label", this.t.progress);
    this.article.className = "reader-page";
    this.viewport.append(this.article);
    this.viewport.addEventListener("scroll", () => {
      if (this.pendingOffset != null) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.save(), 250);
    });
    const summary = document.createElement("summary"); summary.textContent = this.t.text;
    this.pdfText.append(summary, this.pdfTextBody); this.pdfText.className = "reader-pdf-text"; this.pdfText.hidden = true;
    this.viewport.append(this.pdfText);
    layout.append(sidebar, this.viewport);
    const footer = document.createElement("footer"); footer.className = "reader-footer";
    this.previous = this.button("‹", () => void this.show(this.section - 1)); this.previous.setAttribute("aria-label", this.t.previous);
    this.next = this.button("›", () => void this.show(this.section + 1)); this.next.setAttribute("aria-label", this.t.next);
    const progress = document.createElement("div");
    const separate = document.createElement("small"); separate.textContent = this.t.separate;
    progress.append(this.count, separate);
    this.notice.className = "reader-notice"; this.notice.setAttribute("role", "status");
    footer.append(this.previous, progress, this.next);
    this.root.append(toolbar, layout, this.notice, footer);
  }
  private button(text: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button"); button.type = "button"; button.textContent = text;
    button.addEventListener("click", action); return button;
  }
  async open(name: string, bytes: Uint8Array) {
    const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
    this.key = "pecia-reader-v1:" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,"0")).join("");
    let title = name, author = "";
    const format = readerFormat(name);
    if (format === "epub" || format === "mobi" || format === "azw3") {
      this.epub = format === "epub" ? parseEpub(bytes) : await parseMobi(bytes);
      title = this.epub.title; author = this.epub.author;
      this.sections = this.epub.chapters.length;
    } else if (format === "pdf") {
      const pdfjs = await import("pdfjs-dist");
      const { default: PdfWorker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?worker");
      pdfjs.GlobalWorkerOptions.workerPort ??= new PdfWorker();
      const loading = pdfjs.getDocument({
        data: bytes, enableXfa:false, useWasm:false, useWorkerFetch:false,
        disableFontFace:true, useSystemFonts:true, isOffscreenCanvasSupported:false,
        maxImageSize: 16_000_000,
      });
      this.pdfLoading = loading;
      try { this.pdf = await loading.promise; } catch (error) {
        if (error instanceof Error && error.name === "PasswordException") throw new Error("password");
        throw error;
      }
      this.sections = this.pdf.numPages;
      if (this.sections > 10000) throw new Error("too-large");
      this.size.min = "60"; this.size.max = "180"; this.size.value = "100"; this.size.step = "10"; this.size.setAttribute("aria-label", this.t.zoom);
      this.article.classList.add("reader-pdf-page");
      this.pdfText.hidden = false;
    } else throw new Error("unsupported");
    const heading = document.createElement("strong"); heading.textContent = title;
    const subtitle = document.createElement("small"); subtitle.textContent = [author, format.toUpperCase()].filter(Boolean).join(" · ");
    this.root.querySelector("#reader-title")!.append(heading, subtitle);
    this.root.querySelector("#reader-contents")!.textContent = this.epub ? this.t.contents : this.t.pages;
    for (let i = 0; i < this.sections; i++) {
      const rawLabel = this.epub?.chapters[i]?.label;
      const label = rawLabel && !/^\d+$/.test(rawLabel) ? rawLabel : `${this.epub ? this.t.chapter : this.t.page} ${i + 1}`;
      const option = document.createElement("option"); option.value = String(i); option.textContent = label; this.select.append(option);
      // Use the page selector for large PDFs rather than thousands of buttons.
      if (!this.epub && this.sections <= 100) {
        const button = this.button(label, () => void this.show(i)); button.dataset.section = String(i); this.navigation.append(button);
      }
    }
    if (this.epub) {
      for (const { section,label } of readerContents(this.epub,this.t.chapter)) {
        const button = this.button(label, () => void this.show(section));
        button.dataset.section = String(section); this.navigation.append(button);
      }
      this.root.classList.add("reader-with-contents");
    }
    this.bookmarkLink.hidden = this.read("bookmark") == null;
    document.querySelector<HTMLElement>(".shell")!.hidden = true;
    document.body.append(this.root);
    document.addEventListener("keydown", this.onEscape);
    window.addEventListener("resize", this.onResize);
    const position = parsePosition(this.read("position"), this.sections);
    await this.show(position.section, position.offset);
    this.root.querySelector<HTMLButtonElement>("button")?.focus();
  }
  private read(suffix: string): string | null {
    try { return localStorage.getItem(this.key + ":" + suffix); } catch { return null; }
  }
  private write(suffix: string, value: unknown): boolean {
    try { localStorage.setItem(this.key + ":" + suffix, JSON.stringify(value)); return true; }
    catch { this.notice.textContent = this.t.storage; return false; }
  }
  private offset() { return this.pendingOffset ?? this.viewport.scrollTop / Math.max(1, this.viewport.scrollHeight - this.viewport.clientHeight); }
  private restoreOffset(offset: number) {
    this.viewport.scrollTop = offset * Math.max(0, this.viewport.scrollHeight - this.viewport.clientHeight);
  }
  private save() {
    if (this.key && this.sections && !this.closed) this.write("position", { section:this.section, offset:Math.max(0, Math.min(1, this.offset())) });
  }
  private async show(section: number, offset = 0) {
    if (section < 0 || section >= this.sections || this.closed) return;
    clearTimeout(this.timer);
    const serial = ++this.serial;
    this.task?.cancel(); this.task = null;
    this.section = section; this.pendingOffset = offset;
    this.notice.textContent = "";
    this.previous.disabled = section === 0; this.next.disabled = section === this.sections - 1;
    this.select.value = String(section);
    this.navigation.querySelectorAll<HTMLButtonElement>("button").forEach(button => {
      if (button.dataset.section === String(section)) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    this.count.textContent = `${this.epub ? this.t.chapter : this.t.page} ${section + 1} / ${this.sections} · ${this.t.progress}`;
    this.article.replaceChildren(); this.pdfTextBody.textContent = "";
    this.article.setAttribute("aria-busy", "true");
    try {
      if (this.epub) {
        this.article.style.fontSize = this.size.value + "px";
        this.article.replaceChildren(renderChapter(this.epub, section));
        await Promise.all(Array.from(this.article.querySelectorAll("img")).map(image => image.decode().catch(() => {})));
      } else if (this.pdf) {
        const page = await this.pdf.getPage(section + 1);
        if (serial !== this.serial || this.closed) return;
        const base = page.getViewport({ scale: 1 });
        const padding = getComputedStyle(this.viewport);
        const width = pdfFitWidth(this.viewport.clientWidth, parseFloat(padding.paddingLeft), parseFloat(padding.paddingRight));
        const scale = width / base.width * Number(this.size.value) / 100;
        const viewport = page.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width * ratio); canvas.height = Math.ceil(viewport.height * ratio);
        if (canvas.width * canvas.height > 20_000_000) throw new Error("too-large");
        canvas.style.width = viewport.width + "px"; canvas.style.height = viewport.height + "px";
        canvas.setAttribute("aria-label", `${this.t.page} ${section + 1}`); canvas.setAttribute("role", "img");
        this.article.append(canvas);
        this.task = page.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio,0,0,ratio,0,0] });
        await this.task.promise;
        // Text extraction is supplementary: failure must not mark a rendered page
        // as broken or prevent its reading position from being saved.
        let text: string;
        try { text = await pdfPageText(page); }
        catch { text = this.t.text === "Texto accesible" ? "El texto accesible no está disponible para esta página." : "Accessible text is unavailable for this page."; }
        if (serial !== this.serial || this.closed) return;
        this.pdfTextBody.textContent = text;
      }
      if (serial !== this.serial || this.closed) return;
      this.restoreOffset(offset); this.pendingOffset = null; this.save();
    } catch (error) {
      if (serial !== this.serial || this.closed) return;
      this.pendingOffset = null;
      this.notice.textContent = error instanceof Error && error.message === "too-large" ? this.t["too-large"] : this.t.failed;
    } finally {
      if (serial === this.serial) this.article.removeAttribute("aria-busy");
    }
  }
  close() {
    if (this.closed) return;
    this.save(); this.closed = true; this.serial++; clearTimeout(this.timer);
    this.task?.cancel();
    void this.pdfLoading?.destroy();
    document.removeEventListener("keydown", this.onEscape);
    window.removeEventListener("resize", this.onResize);
    this.root.remove();
    const shell = document.querySelector<HTMLElement>(".shell"); if (shell) shell.hidden = false;
    this.focusBefore?.focus();
    active = null;
  }
}
