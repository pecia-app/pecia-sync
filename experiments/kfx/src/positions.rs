//! Conservative resolver for explicit $265 position maps and $259 text elements.
//! Unknown spans remain gaps; never infer offsets from rendered HTML.
use crate::{Error, entities};
use boko::kfx::ion::IonValue;
use std::collections::HashMap;

pub struct TextMap {
    spans: Vec<(u64, u64, Option<String>)>,
}
fn number(v: &IonValue, key: u64) -> Result<u64, Error> {
    v.get(key)
        .and_then(IonValue::as_int)
        .and_then(|n| u64::try_from(n).ok())
        .ok_or(Error::Unsupported)
}
fn symbol(v: &IonValue) -> Option<u64> {
    v.as_symbol()
}

// Section map layout documented by kfxlib's yj_position_location.py (GPLv3,
// John Howell). Only zero-offset elements are accepted in this first adapter.
fn section_entries(map: &IonValue, fragments: &[(u32, IonValue)]) -> Result<Vec<IonValue>, Error> {
    let sections = map
        .get(181)
        .and_then(IonValue::as_list)
        .ok_or(Error::Unsupported)?;
    let mut output = Vec::new();
    let mut book_end = 0u64;
    for section in sections {
        let name = section
            .get(174)
            .and_then(symbol)
            .ok_or(Error::Unsupported)?;
        let base = number(section, 184)?;
        let length = number(section, 144)?;
        if base != book_end {
            return Err(Error::Invalid);
        }
        let matches: Vec<_> = fragments
            .iter()
            .filter(|(k, v)| *k == 609 && v.get(174).and_then(symbol) == Some(name))
            .collect();
        if matches.len() != 1 {
            return Err(Error::Unsupported);
        }
        let rows = matches[0]
            .1
            .get(181)
            .and_then(IonValue::as_list)
            .ok_or(Error::Unsupported)?;
        let mut pos = 0u64;
        let mut previous_id = 0u64;
        for (index, row) in rows.iter().enumerate() {
            let unsigned = |v: &IonValue| {
                v.as_int()
                    .and_then(|n| u64::try_from(n).ok())
                    .ok_or(Error::Unsupported)
            };
            let (delta, id, offset) = if let Some(list) = row.as_list() {
                if !(2..=3).contains(&list.len()) {
                    return Err(Error::Unsupported);
                }
                (
                    unsigned(&list[0])?,
                    unsigned(&list[1])?,
                    if list.len() == 3 {
                        unsigned(&list[2])?
                    } else {
                        0
                    },
                )
            } else if let Some(n) = row.as_int() {
                (
                    u64::try_from(n).map_err(|_| Error::Invalid)?,
                    previous_id.checked_add(1).ok_or(Error::Invalid)?,
                    0,
                )
            } else {
                (
                    number(row, 184)?,
                    number(row, 185)?,
                    row.get(143).map(unsigned).transpose()?.unwrap_or(0),
                )
            };
            if offset != 0 {
                return Err(Error::Unsupported);
            }
            pos = pos.checked_add(delta).ok_or(Error::Invalid)?;
            if pos > length {
                return Err(Error::Invalid);
            }
            if index + 1 == rows.len() {
                if id != 0 || pos != length {
                    return Err(Error::Invalid);
                }
            } else {
                if id == 0 {
                    return Err(Error::Invalid);
                }
                let absolute = base.checked_add(pos).ok_or(Error::Invalid)?;
                output.push(IonValue::Struct(vec![
                    (
                        185,
                        IonValue::Int(i64::try_from(id).map_err(|_| Error::Invalid)?),
                    ),
                    (
                        184,
                        IonValue::Int(i64::try_from(absolute).map_err(|_| Error::Invalid)?),
                    ),
                ]));
            }
            previous_id = id;
            if output.len() > 20000 {
                return Err(Error::TooLarge);
            }
        }
        if rows.len() < 2 {
            return Err(Error::Invalid);
        }
        book_end = base.checked_add(length).ok_or(Error::Invalid)?;
    }
    output.push(IonValue::Struct(vec![
        (185, IonValue::Int(0)),
        (
            184,
            IonValue::Int(i64::try_from(book_end).map_err(|_| Error::Invalid)?),
        ),
    ]));
    Ok(output)
}

impl TextMap {
    pub fn from_container(bytes: &[u8]) -> Result<Self, Error> {
        let decoded = entities(bytes)?
            .into_iter()
            .filter(|e| matches!(e.kind, 145 | 259 | 265 | 609))
            .map(|e| Ok((e.kind, e.decode()?)))
            .collect::<Result<Vec<_>, Error>>()?;
        Self::from_fragments(&decoded)
    }
    fn from_fragments(fragments: &[(u32, IonValue)]) -> Result<Self, Error> {
        let maps: Vec<_> = fragments.iter().filter(|(kind, _)| *kind == 265).collect();
        if maps.len() != 1 {
            return Err(Error::Unsupported);
        }
        let normalized;
        let entries = if let Some(entries) = maps[0].1.as_list() {
            entries
        } else {
            normalized = section_entries(&maps[0].1, fragments)?;
            &normalized
        };
        if entries.len() < 2 || entries.len() > 20000 {
            return Err(Error::Unsupported);
        }
        let mut chunks = HashMap::new();
        for (_, v) in fragments.iter().filter(|(kind, _)| *kind == 145) {
            let name = v.get(4).and_then(symbol).ok_or(Error::Unsupported)?;
            let list = v
                .get(146)
                .and_then(IonValue::as_list)
                .ok_or(Error::Unsupported)?;
            if chunks.insert(name, list).is_some() {
                return Err(Error::Invalid);
            }
        }
        let mut texts = HashMap::new();
        let mut budget = 100000usize;
        fn walk(
            v: &IonValue,
            chunks: &HashMap<u64, &[IonValue]>,
            texts: &mut HashMap<u64, String>,
            budget: &mut usize,
            depth: usize,
        ) -> Result<(), Error> {
            if depth > 64 || *budget == 0 {
                return Err(Error::TooLarge);
            }
            *budget -= 1;
            if v.get(159).and_then(symbol) == Some(269) {
                let id = number(v, 155)?;
                if let Some(content) = v.get(145) {
                    let text = if let Some(text) = content.as_string() {
                        Some(text)
                    } else {
                        let name = content.get(4).and_then(symbol).ok_or(Error::Unsupported)?;
                        let index =
                            usize::try_from(number(content, 403)?).map_err(|_| Error::Invalid)?;
                        chunks
                            .get(&name)
                            .and_then(|c| c.get(index))
                            .and_then(IonValue::as_string)
                    }
                    .ok_or(Error::Unsupported)?;
                    if texts.insert(id, text.to_owned()).is_some() {
                        return Err(Error::Invalid);
                    }
                }
            }
            if let Some(children) = v.get(146).and_then(IonValue::as_list) {
                for child in children {
                    walk(child, chunks, texts, budget, depth + 1)?;
                }
            }
            Ok(())
        }
        for (_, v) in fragments.iter().filter(|(kind, _)| *kind == 259) {
            walk(v, &chunks, &mut texts, &mut budget, 0)?;
        }
        let last = entries.last().ok_or(Error::Invalid)?;
        if number(last, 185)? != 0 {
            return Err(Error::Unsupported);
        }
        let mut spans = Vec::new();
        let mut seen = std::collections::HashSet::new();
        for pair in entries.windows(2) {
            let id = number(&pair[0], 185)?;
            let start = number(&pair[0], 184)?;
            let end = number(&pair[1], 184)?;
            if id == 0 || start >= end || !seen.insert(id) {
                return Err(Error::Unsupported);
            }
            let text = texts
                .remove(&id)
                .filter(|s| s.chars().count() as u64 == end - start);
            spans.push((start, end, text));
        }
        Ok(Self { spans })
    }
    /// Native Unicode-scalar offsets, with an explicitly inclusive endpoint.
    /// Annotation-schema validation must precede calling this API.
    pub fn extract_inclusive(&self, start: u64, end: u64) -> Result<String, Error> {
        if start > end {
            return Err(Error::Invalid);
        }
        let limit = end.checked_add(1).ok_or(Error::Invalid)?;
        if limit - start > 100000 {
            return Err(Error::TooLarge);
        }
        let mut cursor = start;
        let mut out = String::new();
        for (a, b, text) in &self.spans {
            if *b <= cursor {
                continue;
            }
            if cursor == limit {
                break;
            }
            if *a > cursor {
                return Err(Error::Unsupported);
            }
            let text = text.as_ref().ok_or(Error::Unsupported)?;
            let stop = limit.min(*b);
            out.extend(
                text.chars()
                    .skip((cursor - a) as usize)
                    .take((stop - cursor) as usize),
            );
            cursor = stop;
        }
        if cursor != limit {
            return Err(Error::Unsupported);
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn row(id: i64, pos: i64) -> IonValue {
        IonValue::Struct(vec![(185, IonValue::Int(id)), (184, IonValue::Int(pos))])
    }
    fn fixture() -> Vec<(u32, IonValue)> {
        let text = |id, content| {
            IonValue::Struct(vec![
                (155, IonValue::Int(id)),
                (159, IonValue::Symbol(269)),
                (145, content),
            ])
        };
        vec![
            (
                265,
                IonValue::List(vec![row(1, 0), row(2, 3), row(3, 6), row(0, 7)]),
            ),
            (
                145,
                IonValue::Struct(vec![
                    (4, IonValue::Symbol(1000)),
                    (146, IonValue::List(vec![IonValue::String("βé!".into())])),
                ]),
            ),
            (
                259,
                IonValue::Struct(vec![(
                    146,
                    IonValue::List(vec![
                        text(1, IonValue::String("A😀B".into())),
                        text(
                            2,
                            IonValue::Struct(vec![
                                (4, IonValue::Symbol(1000)),
                                (403, IonValue::Int(0)),
                            ]),
                        ),
                    ]),
                )]),
            ),
        ]
    }
    #[test]
    fn resolves_unicode_and_cross_fragment_ranges() {
        let map = TextMap::from_fragments(&fixture()).unwrap();
        assert_eq!(map.extract_inclusive(1, 1).unwrap(), "😀");
        assert_eq!(map.extract_inclusive(1, 4).unwrap(), "😀Bβé");
        assert_eq!(map.extract_inclusive(5, 5).unwrap(), "!");
    }
    #[test]
    fn refuses_gaps_out_of_bounds_and_bad_endpoints() {
        let map = TextMap::from_fragments(&fixture()).unwrap();
        for (a, b) in [(5, 6), (7, 7), (1, 0), (0, u64::MAX)] {
            assert!(map.extract_inclusive(a, b).is_err());
        }
    }
    #[test]
    fn refuses_missing_or_ambiguous_maps() {
        let mut f = fixture();
        f.push(f[0].clone());
        assert!(TextMap::from_fragments(&f).is_err());
        f.retain(|(k, _)| *k != 265);
        assert!(TextMap::from_fragments(&f).is_err());
    }
    #[test]
    fn resolves_section_delta_maps_and_rejects_offsets() {
        let mut f = fixture();
        f[0].1 = IonValue::Struct(vec![(
            181,
            IonValue::List(vec![IonValue::Struct(vec![
                (174, IonValue::Symbol(2000)),
                (184, IonValue::Int(0)),
                (144, IonValue::Int(7)),
            ])]),
        )]);
        let rows = vec![
            IonValue::List(vec![IonValue::Int(0), IonValue::Int(1)]),
            IonValue::Int(3),
            IonValue::Int(3),
            IonValue::List(vec![IonValue::Int(1), IonValue::Int(0)]),
        ];
        f.push((
            609,
            IonValue::Struct(vec![
                (174, IonValue::Symbol(2000)),
                (181, IonValue::List(rows)),
            ]),
        ));
        assert_eq!(
            TextMap::from_fragments(&f)
                .unwrap()
                .extract_inclusive(1, 4)
                .unwrap(),
            "😀Bβé"
        );
        let mut duplicate = f.clone();
        duplicate.push(f.last().unwrap().clone());
        assert!(TextMap::from_fragments(&duplicate).is_err());
        if let IonValue::Struct(fields) = &mut f.last_mut().unwrap().1 {
            fields[1].1 = IonValue::List(vec![
                IonValue::List(vec![IonValue::Int(0), IonValue::Int(1), IonValue::Int(1)]),
                IonValue::List(vec![IonValue::Int(7), IonValue::Int(0)]),
            ]);
        }
        assert!(TextMap::from_fragments(&f).is_err());
    }
}
