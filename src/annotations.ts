import "./annotations.css";
import { invoke } from "@tauri-apps/api/core";
import { parseClippings, clippingsMarkdown, type Clipping, type ImportResult } from "./lib/clippings";
const HISTORY = "pecia-clippings-seen-v1";
let entries: Clipping[] = [], fresh = new Set<string>(), result: ImportResult | null = null;
let busy = false, message = "", language: "es" | "en" = "es";
let deviceBusy = false;
let preview: Clipping[] | null = null;
let carouselIndex=0;
type DatabaseImport = { highlights:number;notes:number;pending:number;previews?:{title:string;text:string;start:number;end:number}[] };
export function setAnnotationDeviceBusy(value:boolean) { deviceBusy=value; renderAnnotationsPanel(language); }
const words = {
  es: { title:"Subrayados y notas", import:"Importar My Clippings.txt", view:"Ver subrayados", intro:"Selecciona documents/My Clippings.txt en tu Kindle o una copia local. Inglés y español; Kobo y acceso MTP directo aún no disponibles.", privacy:"El texto solo se conserva durante esta sesión. Guardamos huellas digitales locales para detectar novedades; no se incluyen notas en el CSV ni se modifica el Kindle.", back:"Cerrar", search:"Buscar libro, autor o texto", all:"Todos los libros", onlyNew:"Solo nuevos", export:"Exportar selección Markdown", clear:"Borrar historial local", highlight:"Subrayado", note:"Nota", new:"Nuevo", more:"Mostrar más", empty:"No hay entradas que coincidan.", cancel:"Importación cancelada; no se han cambiado los datos.", error:"No se pudo importar. Selecciona un My Clippings.txt UTF-8 de hasta 20 MB.", none:"No se encontraron subrayados o notas compatibles. Se mantienen los datos anteriores.", saved:"Markdown guardado.", saveCancel:"Guardado cancelado.", saveError:"No se pudo guardar el Markdown.", storage:"No se pudo guardar el historial local; las novedades no se recordarán al reiniciar.", history:"Historial de exportaciones de Kindle: puede contener entradas eliminadas o antiguas. Las notas se muestran por separado; no inferimos a qué subrayado pertenecen.", cleared:"Datos de sesión e historial local borrados. El archivo original no cambia." },
  en: { title:"Highlights & notes", import:"Import My Clippings.txt", view:"View highlights", intro:"Select documents/My Clippings.txt on your Kindle or a local copy. English and Spanish; Kobo and direct MTP access are not available yet.", privacy:"Text stays in memory for this session. Local fingerprints detect new entries; notes are not included in CSV exports and the Kindle is never changed.", back:"Close", search:"Search book, author or text", all:"All books", onlyNew:"New only", export:"Export selection as Markdown", clear:"Clear local history", highlight:"Highlight", note:"Note", new:"New", more:"Show more", empty:"No matching entries.", cancel:"Import cancelled; existing data is unchanged.", error:"Could not import. Select a UTF-8 My Clippings.txt file up to 20 MB.", none:"No supported highlights or notes found. Previous data is unchanged.", saved:"Markdown saved.", saveCancel:"Save cancelled.", saveError:"Could not save Markdown.", storage:"Could not save local history; new-entry detection will not survive a restart.", history:"Kindle export history: it may contain deleted or older entries. Notes are shown separately; we do not guess which highlight they belong to.", cleared:"Session data and local history cleared. The source file is unchanged." },
};
function el<K extends keyof HTMLElementTagNameMap>(tag:K,text="",className=""):HTMLElementTagNameMap[K] {
  const node=document.createElement(tag); node.textContent=text; node.className=className; return node;
}
function button(text:string,action:()=>void) { const b=el("button",text); b.type="button"; b.addEventListener("click",action); return b; }
function summary() {
  const notes=entries.filter(e=>e.kind==="note").length;
  return language==="es" ? `${entries.length-notes} subrayados · ${notes} notas · ${fresh.size} nuevos` : `${entries.length-notes} highlights · ${notes} notes · ${fresh.size} new`;
}
export function renderAnnotationsPanel(next:"es"|"en") {
  language=next;
  const t=words[language], panel=document.querySelector<HTMLElement>("#annotations"); if(!panel) return;
  const shown=preview??entries, populated=shown.length>0;
  panel.classList.toggle("has-clippings",populated);
  panel.replaceChildren(el("h2",t.title),el("p",result?summary():(language==="es"?"Busca subrayados y notas en tu Kindle o importa un archivo My Clippings.txt.":"Find highlights and notes on your Kindle or import a My Clippings.txt file."),"muted"));
  const actions=el("div","","annotation-actions");
  if(populated) {
    panel.replaceChildren(el("h2",t.title));
    const carousel=el("section","","clipping-carousel"); carousel.setAttribute("aria-label",t.title); carousel.setAttribute("aria-roledescription",language==="es"?"carrusel":"carousel");
    const book=el("strong","","clipping-book"),author=el("small","","clipping-author"),quote=el("blockquote","","clipping-quote");
    const count=el("span");count.setAttribute("aria-live","polite");count.setAttribute("aria-atomic","true");
    const prev=button("‹",()=>move(-1)),next=button("›",()=>move(1));
    prev.setAttribute("aria-label",language==="es"?"Subrayado anterior":"Previous clipping");next.setAttribute("aria-label",language==="es"?"Subrayado siguiente":"Next clipping");
    const all=button(language==="es"?"Ver todos los subrayados":"View all highlights",openAnnotations);all.className="primary";all.disabled=busy;
    const nav=el("div","","clipping-navigation");nav.append(prev,count,next,all);
    function move(delta:number){carouselIndex=(carouselIndex+delta+shown.length)%shown.length;draw();}
    function draw(){
      carouselIndex=Math.min(carouselIndex,shown.length-1);const item=shown[carouselIndex]!;
      book.textContent=item.title;book.title=item.title;author.textContent=item.author;author.hidden=!item.author;
      quote.textContent=item.text;count.textContent=`${carouselIndex+1} / ${shown.length}`;
      prev.disabled=next.disabled=shown.length<2||busy;
    }
    carousel.append(book,author,quote,nav);draw();panel.append(carousel);
    if(preview) panel.append(el("small",language==="es"?"Vista previa experimental":"Experimental preview","clipping-experimental"));
  }
  const load=button(busy?(language==="es"?"Importando…":"Importing…"):(language==="es"?"Importar desde Kindle":"Import from Kindle"),()=>void importFile(true)); load.disabled=busy||deviceBusy; load.className="primary";
  const file=button(language==="es"?"Importar archivo…":"Import file…",()=>void importFile(false)); file.disabled=busy||deviceBusy;
  if(populated){load.className="";if(!busy)load.textContent=language==="es"?"Actualizar desde Kindle":"Refresh from Kindle";}
  const view=button(preview?(language==="es"?"Revisar textos":"Review passages"):t.view,openAnnotations); view.disabled=busy; view.hidden=!(preview?.length||entries.length);
  actions.append(load,file);if(!populated)actions.append(view); panel.append(actions);
  const privacy=button(language==="es"?"Privacidad e historial":"Privacy & history",openAnnotations); privacy.className="annotation-privacy"; privacy.disabled=busy; panel.append(privacy);
  if(populated) {
    const title=panel.querySelector("h2")!;
    const header=el("div","","clipping-heading"),tools=el("div","","clipping-tools");
    const paths=["M20 7v5h-5 M20 12a8 8 0 1 0-2 5 M20 7l-3-3","M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 11v7 M9 15l3 3 3-3","M12 8h.01 M11 12h1v5h1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"];
    [load,file,privacy].forEach((control,index)=>{
      const label=control.textContent??"";control.setAttribute("aria-label",label);control.title=label;control.className="clipping-tool";
      const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.7");svg.setAttribute("stroke-linecap","round");svg.setAttribute("stroke-linejoin","round");
      const path=document.createElementNS(svg.namespaceURI,"path");path.setAttribute("d",paths[index]!);svg.append(path);control.replaceChildren(svg);tools.append(control);
    });
    header.append(title,tools);panel.prepend(header);actions.remove();
  }
  const status=el("p",message,"annotation-status"); status.setAttribute("role","status"); if(!populated||message)panel.append(status);
  const metric=document.querySelector(".device-metric:last-child strong"); if(metric) metric.textContent=result?String(entries.length):"—";
  const metricLabel=document.querySelector(".device-metric:last-child small"); if(metricLabel) metricLabel.textContent=result?(language==="es"?"Importados localmente":"Imported locally"):(language==="es"?"Sin importar":"Not imported");
}
async function importFile(fromDevice:boolean) {
  if(busy||deviceBusy) return; busy=true; const previousMessage=message; renderAnnotationsPanel(language);
  const scan=document.querySelector<HTMLButtonElement>("#device-check");
  const wasDisabled=scan?.disabled; if(scan) scan.disabled=true;
  try {
    const source=await invoke<string|DatabaseImport|null>(fromDevice?"import_kindle_clippings":"open_clippings_file");
    if(source===null) {message=previousMessage; return;}
    if(typeof source!=="string") {
      if(source.previews?.length) {
        preview=source.previews.map((p,i)=>({id:`preview-${i}`,book:p.title,title:p.title,author:"",kind:"highlight",text:p.text,location:`KFX ${p.start}–${p.end}`,page:"",added:""}));
        message=language==="es"?`${preview.length} textos recuperados · ${source.highlights+source.notes-preview.length} sin recuperar. Revisa los límites en tu Kindle.`:`${preview.length} passages recovered · ${source.highlights+source.notes-preview.length} unavailable. Check boundaries on your Kindle.`;
        carouselIndex=0;
        if(source.highlights+source.notes===preview.length)message="";
        return; // Preview only: do not replace imports or write fingerprints.
      }
      preview=null;
      message=language==="es"
        ? `${source.highlights} ${source.highlights===1?"subrayado encontrado":"subrayados encontrados"}${source.notes?` · ${source.notes} ${source.notes===1?"nota":"notas"}`:""}. Esta versión aún no puede recuperar su texto.`
        : `${source.highlights} ${source.highlights===1?"highlight":"highlights"} found${source.notes?` · ${source.notes} ${source.notes===1?"note":"notes"}`:""}. This version cannot recover their text yet.`;
      if(source.pending) message+=language==="es" ? " Hay cambios pendientes; el recuento puede variar." : "Pending changes may affect this count.";
      return; // Preserve existing text and fingerprints; metadata isn't an import.
    }
    const parsed=await parseClippings(source);
    if(!parsed.entries.length) {message=words[language].none; return;}
    preview=null;
    let previous=new Set<string>(), storageFailed=false;
    try {
      const saved=JSON.parse(localStorage.getItem(HISTORY) ?? "[]");
      if(Array.isArray(saved) && saved.length<=50000) previous=new Set(saved.filter((v:unknown)=>typeof v==="string" && /^[a-f0-9]{64}$/.test(v)));
    } catch {storageFailed=true;}
    entries=parsed.entries; result=parsed; fresh=new Set(entries.filter(e=>!previous.has(e.id)).map(e=>e.id));
    carouselIndex=0;
    try {localStorage.setItem(HISTORY,JSON.stringify(entries.map(e=>e.id)));} catch {storageFailed=true;}
    message=language==="es" ? `${parsed.duplicates} duplicados omitidos · ${parsed.bookmarks} marcadores omitidos · ${parsed.skipped} entradas no compatibles.` : `${parsed.duplicates} duplicates skipped · ${parsed.bookmarks} bookmarks skipped · ${parsed.skipped} unsupported entries.`;
    if(storageFailed) message+=" "+words[language].storage;
  } catch(error) {
    const code=String(error);
    if(code==="database-snapshot" || code==="database-schema") {
      message=language==="es" ? "Se encontró la base de datos, pero no se puede leer de forma fiable. No se han cambiado los datos." : "Annotation database found, but it cannot be read reliably. Existing data is unchanged.";
      return;
    }
    message=fromDevice ? (language==="es" ? ({"not-found":"No se encontró My Clippings.txt. Prueba Importar archivo…", "no-device":"Conecta un Kindle por USB para importar.","ambiguous":"Hay varios Kindle o archivos. Conecta solo uno o importa un archivo.","busy":"El lector está ocupado. Espera a que termine el escaneo.","too-large":"El archivo supera el límite de 20 MB."}[code] ?? "No se pudo leer el Kindle. Cierra otras apps MTP y vuelve a intentarlo.") : ({"not-found":"My Clippings.txt was not found. Try Import file…", "no-device":"Connect a Kindle over USB to import.","ambiguous":"Multiple Kindles or files found. Connect only one or import a file.","busy":"The reader is busy. Wait for scanning to finish.","too-large":"The file exceeds the 20 MB limit."}[code] ?? "Could not read the Kindle. Close other MTP apps and retry.")) : words[language].error;
  }
  finally {busy=false; if(scan) scan.disabled=wasDisabled??false; renderAnnotationsPanel(language);}
}
function openAnnotations() {
  const shown=preview??entries, experimental=preview!==null;
  const t=words[language], dialog=el("dialog","","annotations-dialog"); dialog.setAttribute("aria-label",t.title);
  const heading=el("header"), close=button(t.back,()=>dialog.close()); heading.append(el("h2",t.title),close);
  const history=button(t.clear,()=>{
    try {localStorage.removeItem(HISTORY);} catch {status.textContent=t.storage;return;}
    entries=[];preview=null;fresh.clear();result=null;message=t.cleared;renderAnnotationsPanel(language);dialog.close();
  });
  const search=el("input"); search.type="search"; search.placeholder=t.search; search.setAttribute("aria-label",t.search);
  const books=el("select"); books.setAttribute("aria-label",t.all); const all=el("option",t.all); all.value=""; books.append(all);
  for(const book of new Set(shown.map(e=>e.book))) {const option=el("option",book); option.value=book; books.append(option);}
  const freshOnly=el("input"); freshOnly.type="checkbox";
  freshOnly.disabled=experimental;
  const freshLabel=el("label"); freshLabel.append(freshOnly,document.createTextNode(t.onlyNew));
  const filters=el("div","","annotation-filters"); filters.append(search,books,freshLabel);
  const list=el("div","","annotation-list"); list.tabIndex=0;
  const status=el("p","","annotation-status"); status.setAttribute("role","status");
  let limit=100, filtered:Clipping[]=[];
  const more=button(t.more,()=>{limit+=100; render();});
  const save=button(t.export,()=>{
    if (!experimental) openMarkdownExport(shown, filtered);
  });
  function render() {
    const query=search.value.trim().toLocaleLowerCase();
    filtered=shown.filter(e=>(!books.value || e.book===books.value) && (!freshOnly.checked || fresh.has(e.id)) && `${e.book}\n${e.text}`.toLocaleLowerCase().includes(query));
    list.replaceChildren(); const groups=new Map<string,Clipping[]>();
    for(const entry of filtered.slice(0,limit)) {const group=groups.get(entry.book)??[]; group.push(entry); groups.set(entry.book,group);}
    for(const [book,items] of groups) {
      const section=el("section"); section.append(el("h3",book));
      for(const item of items) {
        const card=el("article","","annotation-card");
        const passage=item.kind==="highlight" ? el("blockquote",item.text,"clipping-quote") : el("p",item.text);
        card.append(el("small",`${item.kind==="note"?t.note:t.highlight}${fresh.has(item.id)?" · "+t.new:""}`),passage,el("small",[item.location && `Loc. ${item.location}`,item.page && `${language==="es"?"Pág.":"Page"} ${item.page}`,item.added].filter(Boolean).join(" · ")));
        section.append(card);
      }
      list.append(section);
    }
    if(!filtered.length) list.append(el("p",t.empty));
    more.hidden=filtered.length<=limit; save.disabled=experimental||!shown.length;
    count.textContent=`${Math.min(limit,filtered.length)} / ${filtered.length}`;
  }
  const count=el("span"), footer=el("footer"); footer.append(count,more,history,save);
  const previewNotice=experimental ? el("p",language==="es"?"Vista previa experimental · Compara el inicio y el final con tu Kindle. No se ha guardado ni exportado ningún texto.":"Experimental preview · Compare the beginning and end with your Kindle. No text has been saved or exported.","muted annotation-preview-notice") : null;
  for(const control of [search,books,freshOnly]) control.addEventListener("input",()=>{limit=100;render();});
  dialog.append(heading,el("p",(language==="es"?"Importación desde Kindle por USB/MTP o desde un archivo local. Inglés y español. Kobo aún no disponible. ":"Import from Kindle over USB/MTP or from a local file. English and Spanish. Kobo is not supported yet. ")+t.history,"muted"),filters,list,el("p",t.privacy,"muted"),status,footer);
  if(previewNotice) heading.after(previewNotice);
  dialog.addEventListener("close",()=>dialog.remove(),{once:true}); document.body.append(dialog); render(); dialog.showModal(); search.focus();
}

function openMarkdownExport(all: readonly Clipping[], filtered: readonly Clipping[]) {
  const t=words[language], es=language==="es";
  const dialog=el("dialog","","annotations-dialog markdown-export-dialog");
  const title=es?"Exportar Markdown":"Export Markdown";
  dialog.setAttribute("aria-label",title);
  const close=button(t.back,()=>dialog.close());
  const header=el("header"); header.append(el("h2",title),close);
  const scope=el("select"); scope.setAttribute("aria-label",es?"Contenido del documento":"Document scope");
  for (const [value,label] of [["filtered",es?"Resultados filtrados":"Current filtered results"],["all",es?"Todos los subrayados y notas":"All highlights and notes"]]) {
    const option=el("option",label); option.value=value!; scope.append(option);
  }
  const count=el("p","","muted");
  const preview=el("textarea"); preview.readOnly=true;
  preview.setAttribute("aria-label",es?"Vista previa Markdown":"Markdown preview");
  const status=el("p","","annotation-status"); status.setAttribute("role","status");
  let contents="", saving=false;
  const save=button(es?"Guardar Markdown…":"Save Markdown…",()=>void (async()=>{
    if(saving || !contents)return;
    saving=true; save.disabled=true; scope.disabled=true; close.disabled=true;
    try {
      const saved=await invoke<boolean>("save_annotations",{contents});
      status.textContent=saved?t.saved:t.saveCancel;
    } catch {status.textContent=t.saveError;}
    finally {saving=false; scope.disabled=false; close.disabled=false; save.disabled=!contents;}
  })());
  save.classList.add("primary");
  function render() {
    const selected=scope.value==="all"?all:filtered;
    contents=selected.length?clippingsMarkdown(selected,language):"";
    preview.value=contents;
    const books=new Set(selected.map(entry=>entry.book)).size;
    count.textContent=es
      ? `${selected.length} ${selected.length===1?"entrada":"entradas"} · ${books} ${books===1?"libro":"libros"} · Un archivo .md`
      : `${selected.length} ${selected.length===1?"entry":"entries"} · ${books} ${books===1?"book":"books"} · One .md file`;
    save.disabled=!selected.length; status.textContent="";
  }
  scope.addEventListener("change",render);
  dialog.addEventListener("cancel",event=>{if(saving)event.preventDefault();});
  dialog.addEventListener("close",()=>dialog.remove(),{once:true});
  const footer=el("footer"); footer.append(save);
  dialog.append(header,el("p",es?"Revisa tus notas personales antes de compartir. Solo se guarda al elegir un destino; no se envía ningún texto.":"Review personal notes before sharing. Nothing is saved until you choose a destination; no text is uploaded.","muted"),scope,count,preview,status,footer);
  document.body.append(dialog);render();dialog.showModal();scope.focus();
}
