# Implementation Plan

1. Consolidate the Free Hunt environment model around World Boss distance/face sources; remove bow multipliers and add versioned normalization, defaults, legal labels and snapshot transitions.
2. Build a shared mobile preparation editor for distance, target and input mode, including remembered prefill, explicit confirm, cancel/edit and private summary.
3. Wire solo single-monster and solo multi-monster entry paths to freeze snapshots before combat; reconnect restores them.
4. Wire party single-monster and party multi-monster waiting rooms with member drafts, confirmation-only roster visibility, unconfirmed-member host gate and atomic host lock.
5. Replace fixed score lists in all four combat variants with the locked target renderer or target-specific score buttons; preserve raw landings and enforce triple-face assignment/caps.
6. Apply the locked World Boss environment multiplier once to outgoing arrow damage in single-monster and generated multi-monster authority; reject invalid labels, cap violations and mid-battle changes server-side.
7. Add migration fallbacks and reconnect/idempotency coverage for legacy rooms and half-completed transitions.
8. Run focused tests, generated-runtime parity, relevant suites and production build; visually verify 360×640 and 390×844 in both input modes.
9. Deploy Functions and frontend only after all gates pass and the user separately authorizes deployment.

## Risk and rollback points

- Do not deploy frontend snapshot writes before Functions authority understands v1 snapshots.
- Do not duplicate World Boss multiplier constants or target geometry.
- Preserve unrelated dirty work and isolate validation to task-owned files where possible.
- If an adapter cannot carry landing/face data without a schema break, revise the design instead of weakening triple-face validation.

