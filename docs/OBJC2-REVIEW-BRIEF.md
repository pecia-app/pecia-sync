# objc2 licensing review brief

Prepared 17 October 2026. For qualified review, not legal clearance.
Source baseline: main `9b5b3cba7077af309abd447bcdf2aa65a8487c2f`.

## Summary and review stage

We intend to ship Pecia Sync under GPL-3.0-or-later, with matching source.
The open question concerns Apple-header-derived bindings: source redistribution
and compiled macOS distribution must be assessed separately from OS libraries.
We elect MIT wherever alternatives are offered. We need scoped conclusions,
supporting authority and any required remediation—not blanket release approval.
**Preliminary review only:** questions 1, 2b and 4 are blocked pending the fixed
Xcode/SDK/agreement evidence below. Questions 2a and 3 can be addressed now;
questions 5 and 6 invite conditional design and threshold assessments.

## Revision reconciliation

The inspected binary and `otool -L` results are from audit merge snapshot
`d30bac28afb6b254259a070e0ae21b6f84647750`. Comparing that snapshot with baseline
`9b5b3cba7077af309abd447bcdf2aa65a8487c2f` shows changes only to the installer-audit
workflow, its collector script and documentation—not `src/`, `src-tauri/`,
`experiments/kfx/`, package.json or package-lock.json. Both native Cargo.lock files
are the same Git blob `c4e19ff8fba4eafc4ad60bf3c60759eece5ce215`.

The `cargo tree` inspection was run locally on the PR branch with those same
application sources/manifests/lockfiles (also checked against local changes),
not inside the historical CI job. Thus the inputs reconcile, but this is not
a claim that the dependency-tree command and binary inspection ran in the same
environment or prove identical compiler feature selection. A final candidate
must record both in its own build evidence.

## Proposed distribution

Pecia Sync is a Rust/Tauri desktop ebook reader. The intended combined-app
distribution is GPL-3.0-or-later, with component notices preserved and matching
source alongside downloadable installers. The source candidate vendors the full
locked Cargo graph, including Apple-target crates even when built on Linux.
No Apple SDK is deliberately copied by the source-bundle script. This last
statement is a script observation, not an exhaustive archive certification.

## Separate the OS libraries from the binding source

[GPLv3 section 1](https://www.gnu.org/licenses/gpl-3.0.html#section1) excludes
qualifying System Libraries from Corresponding Source. The inspected macOS
executable dynamically references AppKit, Foundation, WebKit and IOKit at Apple
system paths; libdispatch's OS implementation should be assessed separately
from the Rust dispatch2 wrapper (it was not a separate `otool -L` entry).
These OS components are strong candidates for the exclusion; ask the reviewer
to confirm application of the definition to this build. We do not propose
shipping Apple's OS framework implementations or their source.

That GPL exclusion does not itself grant rights to Apple-derived material or
automatically classify the vendored Rust crates as System Libraries. The
distinct question is whether the generated binding declarations (names,
signatures, constants, and any additional copied expression) are protected
derivatives of SDK headers and subject to applicable SDK terms. Distinguish
copyright scope, contractual terms, and redistribution of source versus binaries.

## Candidate platform-scoped remediation (not implemented)

Instead of one all-target source archive, we can investigate per-target source
bundles containing all source/build inputs needed for each conveyed binary.
Apple-only framework code may not be needed for Linux or Windows. A tool such
as [cargo-vendor-filterer](https://github.com/coreos/cargo-vendor-filterer) is a
candidate, not an approved command or proof of removal: it may retain manifest
stubs, and feature, build-host, build-dependency and lockfile resolution matter.

Validate target-specific offline rebuilds and inspect the entire resulting
archive, including our own code and upstream source archives, for remaining
Apple-derived content. Only then could this reduce the binding question's scope
to the macOS distribution. It does not cure any source already distributed.

AppImage's bundled WebKitGTK, GTK and other native-library obligations are
**outside this objc2 brief**, tracked in [INSTALLER-AUDIT.md](INSTALLER-AUDIT.md).
AppImage remains in the overall release scope.

## Why these dependencies are present

`cargo tree --locked --manifest-path src-tauri/Cargo.toml --target
aarch64-apple-darwin -i objc2@0.6.4` shows multiple paths:

- Pecia → Tauri 2.12.1 → tauri-runtime-wry 2.12.1 → wry 0.57.0 / tao 0.37.1 → objc2.
- Pecia → rfd 0.17.2 (file dialogs) → objc2 / block2 / dispatch2.
- Pecia → sysinfo 0.39.6 → objc2-io-kit / objc2-core-foundation.

Consequently, removing one dialog dependency would not remove this family.
The all-target inventory is broader than the linked macOS graph; do not assume
every inventoried Apple framework crate is included in the executable.

Running `cargo tree --locked --manifest-path src-tauri/Cargo.toml --target
aarch64-apple-darwin -e normal --prefix none` identifies these **six of the 15
framework crates**, all at 0.3.2: objc2-app-kit, objc2-core-foundation,
objc2-foundation, objc2-io-kit, objc2-quartz-core and objc2-web-kit.
The other nine framework crates are not in that normal-dependency graph.
This is the candidate binary-side dependency subset, not a symbol-level linked
code inventory: feature differences, build dependencies and link-time removal
still need consideration. The current all-target source archive retains the
broader 15-crate set, so its source-side assessment remains broader.

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

## Verified license options and our election

All 20 pinned per-crate Cargo.toml files were retrieved on 17 October 2026;
`license.workspace = true` entries were resolved against the root Cargo.toml
at the same commit. Paths are recorded in `release/notice-supplements.json`.

- MIT only: objc2 0.6.4, block2 0.6.2, objc2-encode 4.1.0, and
  **objc2-foundation 0.3.2**. Foundation's comment about future contributions
  does not change this release's declared license.
- Zlib OR Apache-2.0 OR MIT: dispatch2 0.3.1, objc2-exception-helper 0.1.1,
  and the other 14 framework crates at 0.3.2.
- **Pecia elects MIT for these alternatives.** This does not relicense upstream
  code or answer the independent Apple-header question. Preserve upstream
  copyright notices and the applicable full MIT terms; Pecia's own MIT notice
  is not a replacement for third-party attribution.

The permissive options are compatible with GPLv3; Apache-2.0's incompatibility
with GPLv2-only is not the distribution policy here. If the election changes
to Apache-2.0, inspect applicable upstream NOTICE material as well as license
texts and preserve required attribution. MIT election is not permission to
delete notices governing independently licensed nested material. NOTICE review
has not been certified complete by the manifest check.

### Objective-C exception helper

At revision `8d214f5477365ffcbcbb7de058c86ed9a518efb7`,
[src/try_catch.m](https://github.com/madsmtm/objc2/blob/8d214f5477365ffcbcbb7de058c86ed9a518efb7/crates/objc2-exception-helper/src/try_catch.m)
matches the published 0.1.1 crate bytes (SHA-256
`c5a6bd80b3229422849c4036d9d0d4ca4a8bae62b58e05c0c4941e07ad679db1`).
Its opening comment explains that it deliberately includes no headers; it
declares objc_retain and implements an Objective-C try/catch wrapper. It has
**no file-level copyright/SPDX/license header** and no conflicting license
statement was observed. Attribution therefore relies on the crate/workspace's
declared Zlib OR Apache-2.0 OR MIT scope, with MIT elected—not an independently
confirmed per-file grant. Include this fact in question 3's attribution review.
The published build.rs uses `cc::Build` with `-xobjective-c` and
`-fobjc-exceptions` to compile this file into a static helper library.

## Build environment: facts to supply, not questions for counsel

The inspected candidate is audit snapshot
`d30bac28afb6b254259a070e0ae21b6f84647750`, not a final release.
[macOS job 117331655585](https://github.com/pecia-app/pecia-sync/actions/runs/39010439200/job/117331655585)
records GitHub-hosted `macos-26-arm64`, image `20261013.0424.1`, macOS 26.6.2
build 25G83. The selected Xcode/Command Line Tools version, SDK version and
agreement were **not captured** by that audit. Installed-image defaults are not
proof of the selected tools or the agreement accepted by the relevant party.

Before requesting a candidate-specific conclusion, engineering must supply
`xcode-select -p`, `xcodebuild -version`, `xcrun --sdk macosx --show-sdk-version`,
SDK build version/path, runner image identity, and the matching agreement text
and hash. The maintainer must identify the relevant acceptance/contract context
for the hosted build; we cannot assert that the maintainer accepted an agreement
on that runner. Do not substitute this Mac's local agreement or Apple's current
web PDF for missing historical evidence.

## Jurisdiction and installation questions

The maintainer is in Spain; ask the reviewer to state which jurisdictions and
distribution/contract assumptions the assessment covers. Relevant authorities
to consider, not automatic safe harbors:

- [Directive 2009/24/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32009L0024),
  particularly Articles 1(2), 5(3) and 6: expression, observation/testing and
  conditional interoperability provisions.
- [SAS Institute v WPL, C-406/10](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:62010CJ0406):
  functionality/language/file-format distinctions; not blanket permission to
  copy implementation or protected documentation.
- [Google v Oracle](https://www.supremecourt.gov/opinions/20pdf/18-956_d18f.pdf):
  fact-specific US fair-use analysis which assumed copyrightability for its
  analysis, not a holding that all API declarations lack copyright.

The current macOS packaging configuration uses ad-hoc signing (`-`), not a
required proprietary signing key, and no notarization step is configured.
The intended modified-build route should remain available without our identity.
Verify and document it on the supported OS versions, including Gatekeeper
behavior; don't claim signing/notarization is categorically irrelevant.
First assess GPLv3 section 6's **User Product and conveyance/transaction
thresholds**, including whether the software is conveyed in, with or specifically
for use in a User Product as part of the relevant transfer of possession/use.
Only if that duty applies, assess whether supplied Installation Information
satisfies it. The modified-build and quarantine/override route must be tested
on each claimed supported macOS version; no such test is certified by this brief.

## Questions for the reviewer

Sequencing: **1, 2b and 4 are deferred** until engineering supplies the missing
candidate-specific toolchain/agreement evidence. Answer **2a and 3 now**, and
**5 and 6 conditionally** as described below; this is not release approval.

1. For these exact revisions, what permissions/conditions apply separately to
   shipping compiled macOS binaries and redistributing vendored binding source?
2. Assess the OS implementations and binding source separately:

   - **2a — answer now:** Based on the inspected binary's `otool -L` evidence,
     confirm whether AppKit, Foundation, WebKit and IOKit qualify for the GPLv3
     System Library exclusion. State the scope and any additional facts needed.
   - **2b — deferred:** Assess copyright/contract restrictions on binding source
     against the fixed Xcode/SDK/agreement evidence engineering must provide.

3. Under our MIT election, are complete terms and attribution sufficient and
   correctly preserved? Identify any independently applicable NOTICE obligations.
4. Is the planned distribution acceptable, conditionally acceptable with named
   remediation, or not acceptable? Does the answer differ by source vs binary?
5. Would validated target-scoped source bundles permit a different conclusion
   for non-macOS distribution? State jurisdictions, assumptions and validation
   required before relying on that remediation.
6. For the planned macOS distribution and modified-build/ad-hoc-signing route,
   does the User Product/conveyance threshold trigger Installation Information
   duties? If so, specify the required information and validation. Reserve final
   sufficiency conclusions pending supported-OS testing and candidate evidence.

## Decision record to obtain

Reviewer/date; exact source and SDK/toolchain scope; authoritative supporting
material; separate source/binary conclusions; required changes; residual
limitations. A maintainer's generic approval or passing CI is not a substitute
for the unresolved assessment. No upstream issue or external request has been
sent as part of preparing this brief.
