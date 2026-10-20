# CI budget and release verification

Automatic pull-request CI runs one Ubuntu job: frontend tests, source/licensing
regression tests, TypeScript, and the frontend production build. Superseded
runs on the same PR are canceled; the job has a ten-minute timeout.
There is no duplicate automatic push-to-main build.

These workflows are manual (`workflow_dispatch`):

- Native verification: full macOS/Linux/Windows checks and installer builds.
- Source archive audit: extracted-source checks on all three platforms,
  including exact QCMS and OpenJPEG reproduction on Linux.
- Installer audit: installer evidence, platform notices and native-source mapping.
- AppImage runtime source rebuild.
- Controlled Windows plugin build.

Use the Actions tab to choose the workflow and intended branch/ref. Do not
dispatch every audit for documentation-only changes. For platform-specific
failures, rerun only the failed job rather than the entire workflow.

Before a release, run the relevant full audits against the final candidate and
review their evidence. Lightweight green CI does **not** establish native-build,
cross-platform, decoder reproduction, licensing approval, or release readiness.
The release workflow and licensing approval gate are unchanged.

No billing settings are changed by these workflow edits. An organization owner
must separately set a $0 Actions budget if overage charges must be blocked.
Disabling automatic audits trades immediate native regression detection for
lower routine CI consumption; native checks must be requested deliberately.
