# objc2 reviewer handoff

Prepared 17 October 2026. Draft for the maintainer to send; not sent and not
legal clearance. No release approval or agreement acceptance is recorded here.

## Suggested message

Subject: Scoped open-source licensing review — Pecia Sync / objc2 bindings

We intend to distribute Pecia Sync, a Rust/Tauri ebook reader, under
GPL-3.0-or-later for macOS, Windows and Linux (including AppImage), together with
matching source. The maintainer is based in Spain.

Please review the attached objc2 brief and evidence. The specific unresolved
question is redistribution of Apple-header-derived Rust bindings, separately
as vendored source and compiled macOS code. We elect MIT wherever the reviewed
crates offer alternatives. Please distinguish Apple's OS implementations from
the binding source and assess the System Library question separately.

Please answer questions 1, 2a, 2b, 3, 4, 5 and 6 in the brief, identifying:

- The exact revisions, toolchain/agreement and jurisdictions assessed.
- Separate source and binary conclusions, supporting authority and assumptions.
- Required changes, missing facts and any conditions on distribution.
- Whether the Installation Information threshold applies to our distribution;
  if applicable, what evidence/instructions are required.

We captured the installed Xcode agreement and toolchain from the hosted build.
This does not establish who accepted terms on that runner or the SDK used by
upstream to generate the bindings. Please identify any contract/acceptance facts
you need rather than assuming them. We are requesting a scoped assessment, not
blanket approval of future releases or of unrelated AppImage obligations.

## Attachments to assemble privately

1. [Full review brief](OBJC2-REVIEW-BRIEF.md), preserving its revision-specific
   evidence and six numbered questions.
2. `release/notice-supplements.json` and the referenced objc2 notice texts under
   `LICENSES/third-party/`; these identify the exact upstream crate revisions.
3. Captured `License.rtf`, `License.pdf`, `LicenseInfo.plist` and
   `macos-toolchain-before.json` from the local ignored folder
   `build/review-packet/xcode-26.6/`. Verify the hashes against the brief before
   sending. Do not publish these agreement copies in the repository.
4. The macOS linkage/dependency evidence referenced in the brief. Keep older
   evidence labelled with its original revision; do not relabel it as a current
   release build. Retain CI artifacts before their 14-day expiry.

Engineering baseline at preparation: `7027a96f5549fb885f156f4245efd9ec4da5b74e`.
Both Cargo lockfiles are unchanged from the brief's `9b5b3cb` baseline. This
reconciles dependency versions only, not compiler features, binaries or SDKs.
The final candidate still needs its own artifact/source evidence.

## Maintainer information to supply

- Legal distributor identity and intended distribution territories/channels.
- Relevant Apple developer agreements/accounts and known acceptance facts;
  explicitly mark hosted-runner acceptance or upstream-generation facts unknown
  where they cannot be established. Do not supply account credentials.
- Claimed supported macOS versions and the intended modified-build route.

## Record the response

Retain reviewer identity, date, assessed scope, separate conclusions, conditions
and unresolved questions. Obtain permission before publishing privileged or
confidential advice; a public engineering decision summary can reference a
privately retained assessment. Implement conditions and verify the final
candidate before requesting maintainer sign-off. A conditional answer with
unmet conditions is not a closed finding.
