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
- Current engineering evidence: PR #15 source verification and PR #16 installer
  audit. Their exact revisions differ; see the evidence documents below.

Do not backdate approval, substitute a CI identity for the maintainer, or use
the audit snapshot as an assertion that a later release was verified.

## Evidence and outstanding actions

| Review area | Existing evidence | Required before sign-off |
| --- | --- | --- |
| Notices | [Licensing audit](LICENSING-AUDIT.md), [installer inspection](INSTALLER-AUDIT.md) | Resolve incomplete AppImage license references and Windows installer-plugin provenance; inspect any rebuilt artifacts. |
| Preferred source | [Distribution/source policy](LICENSING.md), pinned source manifest | Finish nested PDF.js font/WASM source coverage and matching source for redistributed native libraries. |
| Platform rebuilds | [Source CI evidence](RELEASE-SOURCE-EVIDENCE.md) | Verify the final revision and source archives against the actual installers to be published. |
| Native payloads | [Installer inspection](INSTALLER-AUDIT.md) | Map exact bundled versions to source/notices, including installer runtimes; document any justified exclusions. |
| Apple bindings | [objc2 brief](OBJC2-REVIEW-BRIEF.md) | Record a qualified assessment or applicable upstream clarification and implement its conditions. |

The intended scope remains macOS, Windows and Linux, including AppImage.
Omitting a platform or format requires an explicit maintainer decision. Such
omission does not automatically resolve source-archive or other-platform issues.

## Approval procedure

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
