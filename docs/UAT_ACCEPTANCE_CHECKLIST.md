# UAT Acceptance Checklist

Use this checklist for final acceptance before production bundle release.

## A. Connection

- [ ] Save connection config successfully.
- [ ] Test connection shows correct state.
- [ ] Disconnect updates header badge correctly.
- [ ] Provider switching (`evolution`/`mock`) works as expected.

## B. Groups

- [ ] Sync groups pulls latest data.
- [ ] Search by group name and chat id works.
- [ ] Status filters (`all`, `admin`, `sent`, `pending`) are accurate.
- [ ] Min members filter works and can be cleared.
- [ ] Select all / deselect / invert only affect filtered set.

## C. Composer

- [ ] Pick image and preview updates.
- [ ] Replace and remove image work with confirmation.
- [ ] Recent files list can restore previous image.
- [ ] Placeholder chips insert token at cursor location.
- [ ] Draft autosaves and is restored after restart.
- [ ] Clear draft and reset defaults work as expected.

## D. Preview

- [ ] Image stays inside card container (no overflow).
- [ ] Message simulation stays inside card container (no overflow).
- [ ] Preview content updates immediately after composer changes.
- [ ] Selected group context appears correctly.

## E. Broadcast

- [ ] Dry run can start and finish.
- [ ] Real send can start (safe sample).
- [ ] Pause/retry/attempt logic works.
- [ ] Emergency stop cancels future queue items.
- [ ] Progress bar and footer metrics update correctly.

## F. History and Logs

- [ ] History list loads without crash.
- [ ] Open campaign details works.
- [ ] Reuse content loads into composer.
- [ ] CSV export works.
- [ ] Delete campaign works and updates UI.
- [ ] Activity log filters/search/clear operate correctly.

## G. Stability

- [ ] No black screen or render crash during major flows.
- [ ] Error boundary catches and displays fallback when forced error occurs.
- [ ] Reopen app after interrupted run recovers campaign state safely.

## H. Final Decision

- [ ] UAT passed.
- [ ] Known issues documented and accepted.
- [ ] Approved for release.
