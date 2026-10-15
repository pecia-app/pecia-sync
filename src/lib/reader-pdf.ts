import type { PDFPageProxy } from "pdfjs-dist";

// WKWebView versions without ReadableStream async iteration still support readers.
export async function pdfPageText(page: Pick<PDFPageProxy, "streamTextContent">): Promise<string> {
  const reader = page.streamTextContent().getReader();
  const chunks: string[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value.items.map((item: { str?: string }) => item.str ?? "").join(" "));
    }
    return chunks.join(" ");
  } finally { reader.releaseLock(); }
}

export function pdfFitWidth(clientWidth: number, paddingLeft: number, paddingRight: number): number {
  return Math.max(1, Math.min(1100, Math.floor(clientWidth - paddingLeft - paddingRight)));
}
