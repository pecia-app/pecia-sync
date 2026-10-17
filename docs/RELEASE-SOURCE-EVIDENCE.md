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
