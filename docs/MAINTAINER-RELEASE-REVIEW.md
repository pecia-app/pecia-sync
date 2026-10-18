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

### Current remaining-work checklist

- [x] PR #22: source/notices for the runtime and six linked libraries collected,
  checksum-verified, and source-audited across macOS, Windows and Linux.
- [x] PR #23: pinned AppRun source/full opening notice and extracted-source Linux
  compile/launch fixture passed CI; merged as `2bded7eed37119194df1c67020b6189643bf7ff1`.
  Retained launcher bytes match upstream; historical bit-for-bit rebuild is not claimed.
- [ ] AppImage: full runtime rebuild/relink test, digest transformation evidence,
  non-ELF asset review and final artifact correspondence.
- [ ] Windows: installer component source/notices and MSI destination mapping.
- [ ] PDF.js: nested font and generated-decoder preferred-source coverage.
- [ ] objc2: scoped, reasoned maintainer assessment (paid counsel optional).
- [ ] Final release: choose candidate/version, retain matching hashes and obtain
  explicit maintainer sign-off. The approval ledger remains pending.

| Review area | Existing evidence | Required before sign-off |
| --- | --- | --- |
| Notices | [Licensing audit](LICENSING-AUDIT.md), [installer inspection](INSTALLER-AUDIT.md) | Common-license texts are now bundled and checked; five Windows plugin payloads match retained inputs. Finish runtime/plugin notice review and inspect final rebuilt artifacts. |
| Preferred source | [Distribution/source policy](LICENSING.md), pinned source manifest | 92 exact Ubuntu source-package versions were captured in the PR #19 audit. Native-source release attachment is now implemented, pending fresh CI verification; finish AppImage launcher/runtime and nested PDF.js font/WASM source coverage. |
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
