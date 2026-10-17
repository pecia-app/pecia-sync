# Distribution licensing

The combined Pecia Sync desktop application is distributed under
**GPL-3.0-or-later**. Existing MIT permissions for Pecia-authored components are
preserved in `LICENSES/MIT.txt`; this is not an attempt to relicense third-party
code or revoke earlier releases. This policy covers this desktop repository,
not the separate Pecia website or user documents exported by the application.

Full GPL terms are in `LICENSES/GPL-3.0-or-later.txt`. The application is supplied
without warranty. Recipient rights to copy, modify and redistribute must not
be restricted by installer terms or release copy.

## Dependencies and notices

- `pecia-kfx-prototype` and pinned boko commit
  `b148716498fdac70134555293a7405913988256a`: GPL-3.0-or-later.
- Foliate-js: MIT; PDF.js: Apache-2.0; fflate: MIT.
- Tauri and other Rust/frontend dependencies keep their original licenses.
- The Rust graph contains MPL-2.0 components (including cssparser, selectors,
  dtoa-short and option-ext). Preserve their notices and corresponding source;
  do not describe them as having been relicensed.

`npm run licenses:generate` inventories the locked Rust graph and installed
locked npm packages and collects their license/notice files. This deliberately
includes build-only and platform-specific dependencies when present; inventory
membership does not assert that every package is linked into every installer.
Missing metadata or missing notice files is flagged for review, not silently
treated as permission. An SPDX identifier alone is not a complete legal audit.

Version-specific supplements in `release/notice-supplements.json` preserve
upstream notices omitted by some published packages. Each copied text has an
immutable provenance record and a checked SHA-256. Source files named
`copying.rs` are not notices. Upstream legal concerns remain explicit warnings.

Generated notices are bundled as native resources, alongside the GPL, MIT and
licensing guide. They are build artifacts, not hand-maintained source files.
Review nested assets and bundled native libraries too: package metadata may not
describe every font, image, WASM module, binary or embedded C library.

## Corresponding source

The intended distribution route is GPLv3 section 6(d): provide free access to
matching source beside the installers on the same release page. An upstream
link or GitHub's automatic repository ZIP is not our source-delivery mechanism.

`node scripts/source-bundle.mjs` requires a clean checkout and writes a source
**candidate** containing the exact tracked revision, Cargo-vendored dependencies,
installed npm packages, notices, lockfiles and build instructions. It is not
automatically a complete Corresponding Source determination. In particular,
published npm distributions may contain generated/minified output rather than
the preferred form for modification. Audit PDF.js and other generated packages
and supply matching upstream source/build material where required. The candidate
now includes checked upstream archives for all direct frontend dependencies via
`release/preferred-source.json`; `node scripts/preferred-source.mjs --offline`
verifies cached copies without a download. Audit native
libraries embedded in installers, especially AppImages, separately.

Before approval, rebuild the application from the candidate on all claimed
platforms, document toolchain/system-library prerequisites and any justified
System Library exclusions, verify the exact dependency revisions and notices,
and confirm users can build/install modified versions. Signing credentials are
not included. Do not assert bit-for-bit reproducibility without testing it.

The source includes a Cargo vendor configuration. From its `project/` directory,
with Node 22, Rust stable and the platform prerequisites in CONTRIBUTING.md:

```sh
npm test
npm run build
cargo test --locked --offline --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

The installed npm tree is host-specific: cross-platform rebuilds may need the
other platform's locked tool packages. Account for those in the final source
review. Merely running the command above on the packaging host is insufficient.

After creating a candidate, run `node scripts/verify-source.mjs` to verify the
archive checksum, extract it to a fresh temporary directory, verify source
archives/notices, and run frontend tests/build plus native tests with Cargo
offline. It refuses absolute npm executable symlinks on POSIX. The source-audit
CI workflow runs this on all three desktop platforms and records evidence;
it is not proof of bit-for-bit installer reproducibility or legal clearance.

## Fail-closed release gate

The Linux packaging job also collects exact Ubuntu source packages for verified
AppDir library mappings and creates `pecia-sync-native-source-<revision>.tar.gz`.
Its reports, package descriptors, patches and original archives are revalidated
before packaging; `INSTALLER.json` binds it to the actual AppImage checksum.
It is attached alongside the application source with its own checksum manifest.
This supplement is not coverage for AppRun, the outer runtime or unresolved
nested assets. Those findings still require resolution before approval.

`release/licensing-review.json` binds review to dependency/configuration hashes.
It remains pending until evidence for **notices**, **preferred source**,
**platform rebuilds** and **bundled native libraries** has been recorded and
approved. A changed lockfile, dependency declaration or packaging configuration
invalidates approval. The release workflow validates the gate before packaging
and again before publication; source creation and upload must both succeed.
Do not flip approval flags simply to get a release out.

This is an engineering compliance process, not legal certification. Paid counsel
is not required by this internal checklist. The maintainer may record a reasoned,
scoped assessment using primary license terms, upstream clarification and the
engineering evidence. Document assumptions, uncertainty and conditions; merely
accepting a risk or changing an approval flag does not establish permission or
satisfy a missing source/notice obligation. Seek specialist advice if needed.

References: [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html),
[GNU GPL FAQ](https://www.gnu.org/licenses/gpl-faq.html),
[MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).
