# Experimental KFX preview — development only

Import from Kindle now falls back to the annotation database and reads matching
DRM-free KFX book content into memory when My Clippings.txt is absent. Discovery
and ordinary library scans do not read annotations or ebook content.

The existing highlights dialog displays experimental recovered text. Compare
its first and last words with the Kindle before trusting exact boundaries.
Preview text is not persisted, fingerprinted, or exportable. Previous clippings
imports are preserved in memory. Notes and unsupported records remain unavailable.
Any pending highlight/note edits suppress previews until reconciliation exists.
Only synced database records are considered; device-only records are not included.

Limits: 100 highlight records per database, 10 books per database, 80 MiB per
book, 160 MiB total book reads per database, bounded directory enumeration.
Single-container supported position maps only; unsupported, ambiguous, encrypted,
or mismatched content is not guessed. Physical-device preview still needs user
comparison; synthetic tests are not evidence of boundary fidelity.

## Licensing / release gate

This development build now links the GPL-3.0-or-later `pecia-kfx-prototype` crate
and its pinned GPL-3.0-or-later boko dependency. Do not describe or distribute
this combined executable as MIT-only. The existing MIT source notices remain
in place; the decoder license is in `experiments/kfx/LICENSE`.

Before release, complete a GPL-compatible distribution review: corresponding
source (including pinned dependencies and build instructions), license texts,
attributions, and installer/release documentation. No release is authorized by
this integration. Upstream: https://github.com/zacharydenton/boko at
`b148716498fdac70134555293a7405913988256a`.
