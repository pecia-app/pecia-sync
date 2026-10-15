# Pecia KFX prototype (not shipped)

Standalone GPL-3.0-or-later evaluation crate using boko at revision
`b148716498fdac70134555293a7405913988256a`, with default features disabled.
The development application now depends on this crate for experimental previews.
Existing MIT source notices remain in place. Before distributing the integrated
application, review GPL compliance, dependency notices, and corresponding-source
delivery. This is not a determination that process separation avoids obligations.

Run `cargo test --manifest-path experiments/kfx/Cargo.toml` from the repository.
The first build downloads dependencies; decoding itself has no network access.

Implemented: bounded single-CONT container inspection and explicit Ion entity
decoding through boko; checked offset arithmetic, index alignment, duplicate and
overlap rejection, and refusal of encrypted/unsupported compressed entities.
Tests generate synthetic containers in memory, including Unicode text.
No personal books, annotations, accounts, or device identifiers are fixtures.

The resolver now supports explicit $265 maps and section-based $265/$609 maps,
inline and referenced text, Unicode scalar offsets, and inclusive ranges across
adjacent text fragments. Unsupported gaps, nonzero element offsets, duplicate
maps, ambiguous element IDs, and text-length mismatches fail closed.

A read-only physical MTP probe on 15 October 2026 resolved three synced highlight
ranges to 133, 115, and 170 characters. Text stayed in memory and was not logged
or saved. Exact endpoints still require visual comparison with the Kindle;
this is not yet a claim of complete annotation fidelity or general compatibility.

Not implemented: multipart assembly, nonzero element offsets, full annotation
schema validation and edit reconciliation. Development MTP/UI integration is now
available for experimental previews; no updated release has been published.
Do not use Book-to-EPUB conversion as a substitute for preserving native KFX
positions: decoded rendering order is not necessarily the annotation offset space.

Next gate: verify the experimental preview against the Kindle, including
inclusive/exclusive endpoints, and complete the release licensing review.
No raw text should be logged or saved without an explicit export.

Section-map layout reference: John Howell's GPLv3 kfxlib,
https://github.com/kluyg/calibre-kfx-input/blob/master/kfxlib/yj_position_location.py.
The experiment remains GPL-3.0-or-later; the reference is not vendored.

Upstream: https://github.com/zacharydenton/boko
Its low-level KFX modules are explicitly unstable; keep the revision pinned.
