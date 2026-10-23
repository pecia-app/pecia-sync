# Maintainer release review

Status: **pending — not authorization to publish**.

The repository maintainer has agreed to act as the approving maintainer.
This designates the decision-maker; it is not approval of a particular candidate
or a conclusion about unresolved third-party licensing questions.

## Candidate and approval fields

- Approving maintainer's recorded name/handle: to be confirmed at sign-off.
- Final release tag and commit: not selected.
- Installer and matching-source SHA-256 manifest: not finalized.
- Approval date and decision: not recorded.
- Current engineering baseline: merged PR #19,
  `7027a96f5549fb885f156f4245efd9ec4da5b74e`. The
  [source audit](https://github.com/pecia-app/pecia-sync/actions/runs/39030971979)
  passed on macOS, Windows and Linux. This verifies the source candidate's tests
  and build checks, not complete Corresponding Source or installer equivalence.
  Earlier payload inspections remain tied to their recorded revisions.

Do not backdate approval, substitute a CI identity for the maintainer, or use
the audit snapshot as an assertion that a later release was verified.

## Evidence and outstanding actions

### Evidence refresh — 21 October 2026

Main is `4f60d7eecd7065ce51c3d3034e3ed435af3a74fc` (PR #33).
The older baseline above is historical. The latest full audits ran at PR
checkout `51e7279d984ccc863279a9c76825417b2dcfaafc`, not the merge or a
final release candidate:

- [Source audit 39396696196](https://github.com/pecia-app/pecia-sync/actions/runs/39396696196)
  passed on macOS, Windows and Linux, including offline QCMS and OpenJPEG
  reproduction on Linux. Decoder reproduction is no longer an unrun CI check.
- [Installer audit 39396696008](https://github.com/pecia-app/pecia-sync/actions/runs/39396696008)
  passed on all three platforms. Windows verified the controlled plugin against
  the packaged payload; Linux collected and packaged its native-source supplement.
- PRs #28–30 mapped all 48 initially unmatched historical AppImage regular
  files to copied inputs or generators. Startup-code attribution, desktop/FUSE
  testing and final-candidate correspondence remain open.

These audit results do not close Liberation font
correspondence, Foxit preferred-source assessment, decoder toolchain
source/notices, WiX/NSIS provenance, the objc2 assessment, or final source/notice
delivery. No approval fields have changed.

Local follow-up on 21 October reproduced both JBIG2 outputs exactly using
the two retained archives and Emscripten 6.0.9, without external PDFium DEPS.
See [JBIG2 reproduction](JBIG2-REBUILD-EXPERIMENT.md). Its extracted-source CI
check is now implemented but has not run. Toolchain source/notices and wrapper
header attribution remain open; the local result is not final-candidate evidence.

Follow-up on 22 October: PR #35 merged as
`4ff489ff5b54570e0f285b119afe99c7df74ec27`; its source audit
[39798086732](https://github.com/pecia-app/pecia-sync/actions/runs/39798086732)
was still queued when checked. The JBIG2 header notice supplement now delivers
Chromium's full BSD license and the retained 2012/2015 copyright notices.
Exact `build_config.h` upstream attribution and toolchain coverage remain open;
see [header notice evidence](JBIG2-REBUILD-EXPERIMENT.md#header-notice-delivery--22-october-2026).

Evidence update on 22 October: source audit
[39798086732](https://github.com/pecia-app/pecia-sync/actions/runs/39798086732)
now passes on all three platforms at `26a78c12cd0ac1b9e89c35608f80b5b337fa28aa`,
including both exact JBIG2 outputs on Linux. Chromium `build_config.h` now has
an exact source match with the retained BSD license; see the latest
[JBIG2 evidence](JBIG2-REBUILD-EXPERIMENT.md). These supersede the pending-CI
and unresolved header-mapping statements above for that audit revision.
Toolchain source/notices and final candidate verification remain open.

On 23 October, all four Liberation Sans fonts were matched exactly to Debian
`fonts-liberation 1:1.07.4-11`; its missing patch archive is now collected alongside
the matching original SFD sources. See the [package/source correspondence](PDFJS-NESTED-SOURCE-REVIEW.md#liberation-packagesource-correspondence--23-october-2026).
This resolves the previous version-only font source mapping, while final source
and notice delivery still need inspection.

Emscripten runtime coverage now includes both pinned source archives and
supplementary system-library notices. Their runtime trees match the successful
reproduction images (6,558 files per version); see
[decoder runtime evidence](DECODER-RUNTIME-SOURCE.md). PR #42 adds the official
Rust 1.97.1 source component, QCMS wrapper license and notices from all 13 locked
registry packages. Source identity, 73 Rust notice files and package notice
checksums were checked. The scoped toolchain assessment and final delivery
remain open; no standard-library binary rebuild is claimed.

PR #40's Linux installer audit
[39908624334](https://github.com/pecia-app/pecia-sync/actions/runs/39908624334)
passed real AppImage startup through both FUSE and extraction on Ubuntu 26.04.1.
Both screenshots were visually verified as loaded dashboards. Exact revision,
installer and screenshot hashes, runtime warnings and scope are recorded in
[AppImage evidence](APPIMAGE-ASSET-REVIEW.md#candidate-desktop-launch-check).
This supersedes the unrun desktop/FUSE check above for that artifact only.
The final candidate still needs all-platform verification.

### Current remaining-work checklist

- [x] PR #22: source/notices for the runtime and six linked libraries collected,
  checksum-verified, and source-audited across macOS, Windows and Linux.
- [x] PR #23: pinned AppRun source/full opening notice and extracted-source Linux
  compile/launch fixture passed CI; merged as `2bded7eed37119194df1c67020b6189643bf7ff1`.
  Retained launcher bytes match upstream; historical bit-for-bit rebuild is not claimed.
- [x] PR #26: clean offline runtime rebuild/relink passed in CI (run
  `39151279693`, audit checkout `c5b3633a34b3cf2126e7e5beaa8ab839268dcfde`).
  Merged as `4ca1b394972850072e502d160597feed9ee83f3c`.
- [x] Historical AppImage digest transformation and full runtime-prefix match
  reproduced for the specifically pinned older audit artifact.
- [x] PR #27: synthetic gzip/zstd extraction and execution passed for both
  rebuilt runtimes, including argument preservation (runtime CI `39154541990`).
- [ ] AppImage: final delivery of startup attribution recorded in
  [non-ELF asset review](APPIMAGE-ASSET-REVIEW.md), supported Linux desktop/FUSE
  tests and final artifact correspondence. The identified missing GTK notice
  and upstream source archive are now collected.
- [ ] Windows: installer component source/notices and final-candidate checks.
  Historical MSI destination/feature mapping is recorded in
  [Windows installer review](WINDOWS-INSTALLER-REVIEW.md); embedded WiX custom
  actions and NSIS runtime provenance remain open. Controlled plugin build and
  payload verification passed; repeat them for the final candidate.
- [ ] PDF.js: decoder toolchain source/notices and final font delivery. QCMS/OpenJPEG/JBIG2 reproduction passed extracted-source
  CI; header mapping and notice delivery are recorded in the JBIG2 evidence.
- [ ] objc2: scoped, reasoned maintainer assessment (paid counsel optional).
- [ ] Final release: choose candidate/version, retain matching hashes and obtain
  explicit maintainer sign-off. The approval ledger remains pending.

| Review area | Existing evidence | Required before sign-off |
| --- | --- | --- |
| Notices | [Licensing audit](LICENSING-AUDIT.md), [installer inspection](INSTALLER-AUDIT.md) | Common-license texts are now bundled and checked; five Windows plugin payloads match retained inputs. Finish runtime/plugin notice review and inspect final rebuilt artifacts. |
| Preferred source | [Distribution/source policy](LICENSING.md), pinned source manifest | Native-source supplement packaging passed audit `39396696008`; historical AppImage generated-file mappings and QCMS/OpenJPEG reproduction are recorded. Finish remaining font/decoder dependency and toolchain coverage, then verify final delivery. |
| Platform rebuilds | [Source CI evidence](RELEASE-SOURCE-EVIDENCE.md) | Verify the final revision and source archives against the actual installers to be published. |
| Native payloads | [Installer inspection](INSTALLER-AUDIT.md) | Map exact bundled versions to source/notices, including installer runtimes; document any justified exclusions. |
| Apple bindings | [objc2 brief](OBJC2-REVIEW-BRIEF.md), [reviewer handoff](OBJC2-REVIEW-HANDOFF.md) | Record a reasoned maintainer assessment or applicable upstream clarification, including source/binary scope, supporting terms, unknowns and conditions. Paid counsel is optional. The handoff is prepared, not sent. |

The intended scope remains macOS, Windows and Linux, including AppImage.
Omitting a platform or format requires an explicit maintainer decision. Such
omission does not automatically resolve source-archive or other-platform issues.

## Approval procedure

The maintainer has chosen not to hire counsel at this stage. This changes the
review route, not third-party obligations or the status of unresolved findings.
The objc2 brief remains an evidence/question reference, not a legal conclusion.

1. Close or explicitly resolve each finding with its supporting evidence;
   merely acknowledging a finding is not remediation.
2. Present the maintainer with the final candidate commit, artifact/source
   hashes, distribution scope, conclusions and any limitations.
3. Obtain explicit approval for that specific candidate and record the
   maintainer's chosen identity and approval date.
4. Populate `release/licensing-review.json` with that identity, evidence paths
   and current review input hashes, then set its status to `approved`.
5. Run `npm run licenses:release-check` and the release verification workflow.
   Reopen review if relevant inputs change. A passing structural check does not
   itself establish that the documented conclusions are correct.

Until these steps are complete, leave the release ledger pending and do not
create a release tag expecting the gate to pass.
