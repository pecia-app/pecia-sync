declare module "foliate-js/mobi.js" {
  export type TocItem = { label?: string; href?: string; subitems?: TocItem[] };
  export type MobiBook = {
    metadata: { title?: string; author?: string[] };
    sections: { linear?: string; createDocument?: () => Promise<Document>; size?: number }[];
    mobi: { loadResource(index: number): Promise<ArrayBuffer> };
    parser: Pick<DOMParser, "parseFromString">;
    toc?: TocItem[];
    resolveHref(href: string): { index: number } | undefined | Promise<{ index: number } | undefined>;
    destroy(): void;
  };
  export class MOBI {
    constructor(options: { unzlib: (data: Uint8Array) => Uint8Array });
    open(file: Blob): Promise<MobiBook>;
  }
}
