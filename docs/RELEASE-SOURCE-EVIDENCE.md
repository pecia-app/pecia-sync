# Source verification evidence — 16 October 2026

Status: engineering evidence only; licensing approval remains pending.

## Provenance

- [PR #15 source audit](https://github.com/pecia-app/pecia-sync/actions/runs/38887194996): all three jobs passed.
- Tested checkout: `64c164f9d88fb467a04194e29ab31de6833d96a0` (GitHub PR merge snapshot).
- Merged main commit: `9b5b3cba7077af309abd447bcdf2aa65a8487c2f`.
- Both commits have Git tree `513dcaa9390bf918bac5ad34d2cc6c3b1777b649`, checked through GitHub's Git commit API.
- [Main CI](https://github.com/pecia-app/pecia-sync/actions/runs/38905641379) passed, including native app packaging on all three platforms.

Downloaded source-verification reports identify Node `v22.23.3` and Rust
`1.99.1 (58cf8f9c3 2026-10-13)` on each platform. Report artifact IDs:

| Platform | Architecture | Artifact ID | Candidate archive SHA-256 |
| --- | --- | --- | --- |
| macOS | arm64 | 12040561328 | `4968449fd09e2d3c002e75d080629eefa12fd85b94160ed097fb51244b5abd27` |
| Linux | x64 | 12040855794 | `f0eb9b4a73ff829cb17325d3bdc9269caf84e53bb7872d210da6ff1e18933af1` |
| Windows | x64 | 12040446689 | `e189595a1ebce21381684c94139c02f6a288953d7572bcd3429e88e553a1a6fe` |

The reports record successful preferred-source checksum checks, license resource
checks, licensing tests, frontend tests, TypeScript, Vite production builds and
offline native Cargo tests from extracted archives. Host-specific dependency
trees and archive metadata mean these are separate candidates, not one identical
archive proved portable across all platforms. CI retained verification reports,
not the candidate archives themselves.

## Limits and remaining release work

The extracted-source verifier runs native tests, not installer packaging.
Main CI packages installers separately, but does not retain payloads for
inspection. Neither result proves a final installer was built from the exact
source archive that will accompany it. No bit-for-bit reproducibility claim is
made. A final release candidate still needs matching-source verification and
inspection of bundled native libraries/assets, particularly AppImage contents.

Nested frontend dependency notices/source still require review. The objc2-family
Apple SDK-derived binding question documented in LICENSING-AUDIT.md remains open;
passing tests does not resolve it. A qualified licensing review or relevant
upstream clarification is needed, with the decision and its basis recorded.
Do not set the review ledger to approved based solely on this evidence.

## Candidate correspondence workflow — 22 October 2026

The non-publishing installer audit now creates and retains a source archive on
each platform, runs extracted-source verification, and invokes Tauri packaging
inside that extracted tree with Cargo offline. The generated bundle is copied
back for the existing platform inspections. Windows plugin payload verification
also runs inside the extracted project. The collector rejects stale destination
bundles, a source/check-out revision mismatch, altered archive bytes, a changed
platform/architecture, or any mismatch in bundle file hashes and symlink targets.

Each `candidate-source-<OS>-<commit>` artifact retains the source archive, source
checksum manifest and verification report. Its corresponding installer inventory
records that archive hash and checks every retained bundle entry against the
extracted-source packaging report. These are host-specific source archives:
vendored npm native build packages differ by platform. Preserve all three with
the candidate. Native Linux source remains a separate required supplement.

This workflow change needs a successful three-platform audit before it becomes
candidate evidence. It does not establish bit-for-bit reproducibility or an
air-gapped installer build: native bundler tools can still download online.
Toolchain coverage, payload/source review, desktop tests and maintainer sign-off
remain independent requirements. No release approval is granted by these checks.

The initial extracted-source packaging audit passed macOS and Windows at
`20e65bd324ae163d6122b79e80e00dfca122af7e` in
[39825068366](https://github.com/pecia-app/pecia-sync/actions/runs/39825068366).
Linux packaging and correspondence passed there, but native-source inspection
failed because the bundler cache had not been copied back. After that fix,
Linux passed all steps at `75a4a4f` in
[39842901099](https://github.com/pecia-app/pecia-sync/actions/runs/39842901099).
PR #38 was merged following these audits and passing lightweight checks.
These establish the workflow on the recorded revisions; repeat all three
platforms against the selected final candidate before approval.
