# Implementation Plan

- [x] Extract the day-view lane assignment and range-hour derivation logic.
- [x] Add atomic range block/unblock API to `bookingDb.js`.
- [x] Add explicit admin-only lead-time bypass option to booking creation while preserving all public callers.
- [x] Default the admin calendar to day view and implement the 8-lane spanning scheduler.
- [x] Keep week view compact while adding visible headcount/duration context.
- [x] Add range close/open UI with occupied-slot warning and refresh behavior.
- [x] Simplify slot-originated admin creation to fixed date/start plus plan, duration, and headcount.
- [x] Verify Firestore rules and all `createBooking` call sites.
- [x] Run static checks and the production build. Automated visual checks are unavailable because Playwright is not installed.
- [x] Review final diff for unrelated changes and update booking spec with the reusable admin scheduling contracts.

## Rollback points

- The day scheduler is isolated to `viewMode === "day"`; week view remains a fallback.
- New data-layer parameters default to existing behavior.
- Range blocking writes only the existing `blocked` field and requires no migration.
