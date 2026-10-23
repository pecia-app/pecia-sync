# KFX reader — development

Explicitly opening a `.kfx` file now supports a bounded subset of DRM-free,
single-container KFX. Sources are the native file picker, mounted Kindle
documents, or an exact selected filename over MTP. No automatic book downloads,
device writes, or saved converted copies. MTP shares the scan/import device lock,
requires a unique device and filename, and closes the connection before decoding.

Boko converts the book to EPUB in memory. The existing EPUB parser applies its
expanded-content limits and the reader's strict rendering allowlist; source HTML,
scripts and external resources are never rendered directly. The original KFX
bytes determine the local reading-position key, not the converted archive.

Limits: 32 MiB source, 80 MiB converted output, at most 2,000 spine sections,
and existing EPUB limits (including 80 MiB expanded content). Conversion may
normalize publisher formatting. Full fidelity, multipart KFX, compressed entity
variants, encrypted content, and every image/layout feature are not promised.
The standalone container preflight rejects encrypted and unsupported entities.

Validation: synthetic EPUB → KFX → EPUB round trip preserves title, two chapters
and Unicode text; invalid/encrypted inputs and bounded writes are tested.
On 16 October 2026, the user confirmed native macOS reading of a selected KFX
book and the corrected contents labels. This is limited manual evidence, not
validation of every device, firmware, layout or KFX variant. No private book
content or screenshots are included in the repository.
Frontend regressions cover the converter's inert HTML5 declaration, continued
DTD/entity rejection, sanitized rendering, and heading-first contents labels.
Generated KFX document titles are ignored: unnamed sections remain accessible
through next/previous navigation, without exposing internal IDs in the index.
Highlight extraction tests do not establish full-reader compatibility.

This shares the GPL-3.0-or-later dependency and release gate documented in
KFX-INTEGRATION.md. The current 0.2.0 candidate includes this code; it is not approved for
distribution until that review and final maintainer approval are complete.
