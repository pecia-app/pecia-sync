# objc2 licensing review brief

Prepared 17 October 2026. For qualified review, not legal clearance.
Source baseline: main `9b5b3cba7077af309abd447bcdf2aa65a8487c2f`.

## Proposed distribution

Pecia Sync is a Rust/Tauri desktop ebook reader. The intended combined-app
distribution is GPL-3.0-or-later, with component notices preserved and matching
source alongside downloadable installers. The source candidate vendors the full
locked Cargo graph, including Apple-target crates even when built on Linux.
No Apple SDK is deliberately copied by the source-bundle script. This last
statement is a script observation, not an exhaustive archive certification.

## Why these dependencies are present

`cargo tree --locked --manifest-path src-tauri/Cargo.toml --target
aarch64-apple-darwin -i objc2@0.6.4` shows multiple paths:

- Pecia → Tauri 2.12.1 → tauri-runtime-wry 2.12.1 → wry 0.57.0 / tao 0.37.1 → objc2.
- Pecia → rfd 0.17.2 (file dialogs) → objc2 / block2 / dispatch2.
- Pecia → sysinfo 0.39.6 → objc2-io-kit / objc2-core-foundation.

Consequently, removing one dialog dependency would not remove this family.
The all-target inventory is broader than the linked macOS graph; do not assume
every inventoried Apple framework crate is included in the executable.

## Exact upstream provenance

The 20 flagged records and individual notice hashes are in
`release/notice-supplements.json`. Grouped revisions:

| Packages | Version | Upstream commit |
| --- | --- | --- |
| objc2; dispatch2 | 0.6.4; 0.3.1 | `8852b424193ca41602281b3d7540d7c8ed51e49a` |
| block2 | 0.6.2 | `b4167b582b2f75f9a1be75495c41b765344fd03c` |
| objc2-encode; objc2-exception-helper | 4.1.0; 0.1.1 | `8d214f5477365ffcbcbb7de058c86ed9a518efb7` |
| 15 objc2 framework crates, including foundation, app-kit and web-kit | 0.3.2 | `7b1abfd750a2cacaea71d6a56ecfb83cb7de560b` |

The pinned [upstream licensing summary](https://github.com/madsmtm/objc2/blob/8852b424193ca41602281b3d7540d7c8ed51e49a/LICENSE.md)
describes permissive licensing choices but raises a separate uncertainty about
bindings derived from Apple SDKs. It reasons that use requires Xcode and agreement
to its license. That explanation is not a determination for Pecia's distribution.
The summary is preserved verbatim in our notice supplements; references to
standard licenses should also be reviewed for complete terms/attribution.

## Questions for the reviewer

1. For these exact revisions, what permissions/conditions apply separately to
   shipping compiled macOS binaries and redistributing vendored binding source?
2. Does the relevant Apple SDK/Xcode agreement impose conditions affecting the
   proposed source archive or recipient modification/rebuild rights? Identify
   the applicable agreement/version, rather than assuming the current web PDF
   matches the SDK used for a candidate build.
3. Which complete license texts and copyright notices must accompany the
   selected component licensing options? Is the collected upstream summary
   sufficient, or what exact additional material is required?
4. Is the planned distribution acceptable, conditionally acceptable with named
   remediation, or not acceptable? Does the answer differ by source vs binary?

## Decision record to obtain

Reviewer/date; exact source and SDK/toolchain scope; authoritative supporting
material; separate source/binary conclusions; required changes; residual
limitations. A maintainer's generic approval or passing CI is not a substitute
for the unresolved assessment. No upstream issue or external request has been
sent as part of preparing this brief.
