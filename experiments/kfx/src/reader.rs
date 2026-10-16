//! In-memory KFX-to-EPUB bridge. The frontend must still sanitize the EPUB.
use crate::{entities, Error};
use std::io::{self, Cursor, Seek, SeekFrom, Write};
const LIMIT:u64=80*1024*1024;
struct Bounded { cursor:Cursor<Vec<u8>>, exceeded:bool }
impl Write for Bounded {
    fn write(&mut self,bytes:&[u8])->io::Result<usize>{
        if self.cursor.position().checked_add(bytes.len() as u64).is_none_or(|n|n>LIMIT){
            self.exceeded=true;return Err(io::Error::other("output limit"));
        }
        self.cursor.write(bytes)
    }
    fn flush(&mut self)->io::Result<()>{Ok(())}
}
impl Seek for Bounded {
    fn seek(&mut self,pos:SeekFrom)->io::Result<u64>{
        let old=self.cursor.position();let next=self.cursor.seek(pos)?;
        if next>LIMIT{self.cursor.set_position(old);self.exceeded=true;return Err(io::Error::other("output limit"));}Ok(next)
    }
}
pub fn to_epub(bytes:&[u8])->Result<Vec<u8>,Error>{
    entities(bytes)?; // Reject encrypted/compressed entities before conversion.
    let book=boko::Book::from_bytes(bytes,boko::Format::Kfx).map_err(|_|Error::Unsupported)?;
    if book.spine().is_empty() || book.spine().len()>2000{return Err(Error::Unsupported);}
    let mut total=0usize;
    for entry in book.spine(){
        let chapter=book.load_chapter(entry.id).map_err(|_|Error::Unsupported)?;
        total=total.checked_add(chapter.text_buffer().len()).ok_or(Error::TooLarge)?;
        if total>LIMIT as usize{return Err(Error::TooLarge);}
    }
    let mut out=Bounded{cursor:Cursor::new(Vec::new()),exceeded:false};
    if book.export(boko::Format::Epub,&mut out).is_err(){return Err(if out.exceeded{Error::TooLarge}else{Error::Unsupported});}
    Ok(out.cursor.into_inner())
}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn synthetic_epub_kfx_epub_preserves_chapters_and_text(){
        let mut zip=zip::ZipWriter::new(Cursor::new(Vec::new()));
        let entries=[
            ("mimetype","application/epub+zip"),
            ("META-INF/container.xml",r#"<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>"#),
            ("book.opf",r#"<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">synthetic</dc:identifier><dc:title>Synthetic KFX reader</dc:title><dc:language>en</dc:language></metadata><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>"#),
            ("a.xhtml",r#"<html xmlns="http://www.w3.org/1999/xhtml"><head><title>First</title></head><body><h1>First</h1><p>Original synthetic café passage.</p></body></html>"#),
            ("b.xhtml",r#"<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Second</title></head><body><h1>Second</h1><p>Another original synthetic passage.</p></body></html>"#),
        ];
        for(name,text)in entries{zip.start_file(name,zip::write::SimpleFileOptions::default()).unwrap();zip.write_all(text.as_bytes()).unwrap();}
        let input=zip.finish().unwrap().into_inner();
        let book=boko::Book::from_bytes(&input,boko::Format::Epub).unwrap();
        let mut kfx=Cursor::new(Vec::new());book.export(boko::Format::Kfx,&mut kfx).unwrap();
        let output=to_epub(kfx.get_ref()).unwrap();
        let decoded=boko::Book::from_bytes(&output,boko::Format::Epub).unwrap();
        assert_eq!(decoded.metadata().title,"Synthetic KFX reader");
        assert!(decoded.spine().len()>=2);
        let text=decoded.spine().iter().map(|s|decoded.load_chapter(s.id).unwrap().text_buffer().to_owned()).collect::<Vec<_>>().join("\n");
        assert!(text.contains("Original synthetic café passage."));assert!(text.contains("Another original synthetic passage."));
    }
    #[test]fn rejects_encrypted_and_invalid(){assert_eq!(to_epub(b"\xeaDRMION\xee").unwrap_err(),Error::Encrypted);assert!(to_epub(b"garbage").is_err());}
    #[test]fn output_is_bounded(){let mut out=Bounded{cursor:Cursor::new(Vec::new()),exceeded:false};out.seek(SeekFrom::Start(LIMIT)).unwrap();assert!(out.write(b"x").is_err());assert!(out.exceeded);assert!(out.cursor.get_ref().is_empty());}
}
