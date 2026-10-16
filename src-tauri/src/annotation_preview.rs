//! Experimental passages, kept in memory and never logged or cached.
use super::*;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(serde::Serialize)]
pub struct Passage { title: String, text: String, start: u64, end: u64 }

fn ranges(bytes: &[u8]) -> Result<BTreeMap<String,Vec<(u64,u64)>>,String> {
    // Caller has already validated the SQLite snapshot and pending-edit count.
    let read = || -> Result<_,Box<dyn std::error::Error>> {
        let mut db=rusqlite::Connection::open_in_memory()?;
        db.deserialize_read_exact(rusqlite::MAIN_DB,bytes,bytes.len(),true)?;
        db.execute_batch("PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;")?;
        let mut stmt=db.prepare("SELECT serialized_payload FROM server_view WHERE dataset=1 LIMIT 101")?;
        let mut result=BTreeMap::<String,Vec<(u64,u64)>>::new();
        for (i,row) in stmt.query_map([],|r|r.get::<_,String>(0))?.enumerate() {
            if i>=100 {return Err("preview limit".into());}
            let p:Value=serde_json::from_str(&row?)?;
            let Some(id)=p["book_data"]["asin"].as_str().filter(|id|id.len()>=10 && id.len()<=64 && id.bytes().all(|b|b.is_ascii_alphanumeric())) else {continue;};
            let (Some(start),Some(end))=(p["start_position"]["shortPosition"].as_u64(),p["end_position"]["shortPosition"].as_u64()) else {continue;};
            if start>end || end-start>=100000 {continue;}
            result.entry(id.into()).or_default().push((start,end));
        }
        Ok(result)
    };
    read().map_err(|_|"database-schema".into())
}

pub async fn recover(storage:&Storage, bytes:&[u8])->Result<Vec<Passage>,String>{
    let groups=ranges(bytes)?;
    if groups.len()>10 {return Err("too-large".into());}
    let roots=super::find_objects(storage,None,"documents",true).await?;
    if roots.len()!=1 {return Ok(Vec::new());}
    let mut queue=vec![(roots[0].handle,0)];let mut books=Vec::new();let mut count=0;
    while let Some((parent,depth))=queue.pop(){
        let mut listing=storage.list_objects_stream(Some(parent)).await.map_err(|_|"unavailable")?;
        while let Some(item)=listing.next().await {
            count+=1;if count>20000 {return Err("too-large".into());}
            match item.map_err(|_|"unavailable")? {
                ListingItem::Object(o) if o.is_folder()=>{
                    if depth>=16 {return Err("too-large".into());}
                    queue.push((o.handle,depth+1));
                },
                ListingItem::Object(o) if o.filename.to_ascii_lowercase().ends_with(".kfx")=>books.push(o),
                ListingItem::Object(_)=>{}, ListingItem::Skipped(_)=>return Err("unavailable".into()),
            }
        }
    }
    let mut output=Vec::new();let mut total=0u64;
    for (id,ranges) in groups {
        let candidates:Vec<_>=books.iter().filter(|b|b.filename.contains(&format!("_{id}"))).collect();
        if candidates.len()!=1 {continue;}
        let file=candidates[0];
        if file.size>80*1024*1024 {continue;}
        total+=file.size;if total>160*1024*1024{return Err("too-large".into());}
        let content=storage.read_range(file.handle,0,file.size as u32).await.map_err(|_|"unavailable")?;
        if content.len() as u64!=file.size{return Err("unavailable".into());}
        let Ok(map)=pecia_kfx_prototype::positions::TextMap::from_container(&content) else {continue;};
        let title=file.filename.split(&format!("_{id}")).next().unwrap_or("Kindle book").to_owned();
        for(start,end) in ranges {
            if let Ok(text)=map.extract_inclusive(start,end) {
                output.push(Passage{title:title.clone(),text,start,end});
            }
        }
    }
    Ok(output)
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn parses_only_bounded_valid_ranges(){
        let db=rusqlite::Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE server_view(dataset INTEGER,serialized_payload TEXT)").unwrap();
        for payload in [r#"{"book_data":{"asin":"TESTBOOK01"},"start_position":{"shortPosition":1},"end_position":{"shortPosition":4}}"#,r#"{"book_data":{"asin":"../escape"}}"#] {
            db.execute("INSERT INTO server_view VALUES(1,?1)",[payload]).unwrap();
        }
        let data=db.serialize(rusqlite::MAIN_DB).unwrap();
        let got=ranges(&data).unwrap();assert_eq!(got.len(),1);assert_eq!(got["TESTBOOK01"],vec![(1,4)]);
    }
}
