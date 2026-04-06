# App Finalization Playbook

This document is the standard operating procedure (SOP) to bring `evo-broadcast-control` from active development to production-ready release.

## 1. Scope Freeze

1. Freeze feature scope for the release candidate (RC).
2. Move non-critical items to next milestone.
3. Mark blockers as:
- `P0`: must-fix before release.
- `P1`: fix if low-risk and fast.
- `P2`: defer.

Release can continue only when all `P0` items are closed.

## 2. Quality Gate (Automated)

Run from project root:

```bash
npm install
npm run check
```

`npm run check` must pass:

1. `lint`
2. `test -- --run`
3. `build`

If any step fails, release is blocked.

## 3. Core Functional QA (Manual)

Validate end-to-end user flow:

1. Connection setup:
- Save config.
- Test connect/disconnect.
- Switch between `evolution` and `mock`.

2. Group handling:
- Sync groups from provider.
- Search/filter/select/invert.
- Min member filter behavior.

3. Composer:
- Pick, replace, remove image.
- Template placeholders insertion.
- Draft autosave and restore.

4. Preview:
- Image and message render in sync.
- No overflow outside parent cards.

5. Broadcast run:
- Dry run.
- Real run (safe sample groups).
- Emergency stop.
- Retry and failure handling.

6. Campaign history:
- Open details.
- Reuse content.
- Export CSV.
- Delete campaign.

7. Logs:
- UI logs and campaign logs visible and filterable.
- Dedup behavior still meaningful.

## 4. Data and Recovery Readiness

1. Confirm SQLite schema is up to date (`src/lib/db/schema.ts`).
2. Confirm startup recovery logic:
- Interrupted `running` campaigns move to safe terminal state.
3. Validate cache clear operations do not corrupt campaign history.
4. Prepare backup and restore test:
- Backup DB.
- Restore and verify campaigns/logs load correctly.

## 5. Security and Safety Review

1. Confirm API key handling:
- Obfuscation in DB remains working.
- No API key in logs.

2. Confirm outbound safety:
- Dry run available and clear.
- Warning thresholds visible.
- Blacklist/whitelist logic respected.

3. Confirm destructive actions require confirmation:
- Remove image.
- Clear draft.
- Delete campaign.

## 6. Performance and UX Stability

1. Run app with larger dataset (many groups/log rows).
2. Verify scrolling performance in:
- group table
- activity log
- history list

3. Validate responsive behavior for narrow widths:
- no clipped controls
- no overflowing cards

## 7. Packaging and Release Candidate

Build desktop bundle:

```bash
npm run release:prep
```

Artifacts:

- `src-tauri/target/release/bundle`

For each target OS:

1. Install app from bundle.
2. Launch and execute smoke test (section 8).
3. Record build version and checksum.

## 8. Smoke Test on Built Artifact

On packaged app, verify:

1. App boots without console crash screen.
2. DB initializes and settings load.
3. Connect panel works.
4. Groups sync and render.
5. Composer and preview update immediately.
6. Dry run starts and logs update.
7. History screen loads without blank/black screen.

## 9. Release Sign-off

Release sign-off requires all below:

1. Engineering: automated gate + smoke pass.
2. Product/Operations: flow acceptance.
3. QA: checklist completed.

Recommended sign-off template:

- RC version:
- Build date:
- Engineering approver:
- QA approver:
- Product approver:
- Known limitations accepted:

## 10. Rollback and Hotfix Plan

If critical issue appears post-release:

1. Stop rollout of current bundle.
2. Revert to previous known-good bundle.
3. Tag hotfix branch.
4. Run `npm run check` and smoke test.
5. Publish patched bundle with release note.

## 11. Post-release Monitoring (First 48h)

Track:

1. Crash frequency.
2. Connection failure rate.
3. Send failure spikes.
4. User-reported UX blockers.

Open hotfix only for:

1. data loss
2. send logic corruption
3. app crash/black screen
