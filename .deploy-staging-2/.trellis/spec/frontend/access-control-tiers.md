# Student Tier & Access Lock System

## Scope

Member-side feature gating by account tier (`restricted` / `official` / `retired`), an independent
`accountFrozen` kill-switch, and a site-wide maintenance lock. This is a separate axis from
`CERT_LEVELS` (bow-technique certification) and `monthlyCard` (paid-package expiry) — do not merge
or cross-reference these systems.

## Core module: `src/lib/accessControl.js`

Pure functions, no Firestore/React dependency:

```js
DEFAULT_TIER_PERMISSIONS = {
  restricted: ["home", "training-hub", "practice", "profile"],
  autoLocked: ["home", "training-hub", "practice", "gacha", "profile", "achievements"],
  retired:    ["profile"],
}

PAGE_REGISTRY  // grouped page-id catalog used to render the admin checkbox matrix
isAutoLocked(member)                         // official + no checkin in 14 days
getAllowedPages(member, role, tierPermissions) // null = unrestricted; [] = fully blocked; array = allowlist
isPageAllowed(member, role, pageId, tierPermissions)
```

Gating granularity is **per page id, not per hub**. A hub landing page can be allowed while a
sub-page inside it stays locked — e.g. `restricted` may enter the `training-hub` landing page and
`practice`, but `comps` (competitions, a sibling sub-page under the same hub) must still lock.
Adding a new tier/page combination means editing `DEFAULT_TIER_PERMISSIONS` (and/or the live
`systemConfig/tierPermissions` doc), not adding a special case inside `MemberApp.jsx`.

## Adjustable permission matrix (not hardcoded)

The allowlists above are only the fallback. The live source of truth is Firestore
`systemConfig/tierPermissions` (`{ restricted: [...], autoLocked: [...], retired: [...] }`), edited
via the coach-only admin page `AdminTierPermissions.jsx` (checkbox grid grouped by `PAGE_REGISTRY`).
`MemberApp.jsx` subscribes with `onSnapshot` — a coach toggling a checkbox takes effect on every
logged-in member's next click, with no page reload. If the doc doesn't exist yet, code falls back to
`DEFAULT_TIER_PERMISSIONS`. Verified live in a real Chrome session: writing directly to that Firestore
doc changed a locked/unlocked page on an already-open tab with zero refresh.

## Firestore security boundary (do not weaken)

`members/{memberId}` self-write rule (`firestore.rules`, member's own `hasOnly` allowlist):

- `studentTier` and `accountFrozen` must **never** be added to that member self-write allowlist.
  They are writable only through `allow write: if isAdmin();`. A member's own client must not be
  able to promote or unfreeze itself.
- `lastCheckinDate` **is** in that allowlist — the check-in flow needs the member's own client to
  write it.

If a future change adds a new member-self-updatable field, re-check this list; it's the one place
where a careless addition turns into a privilege-escalation bug (a student unlocking themselves).

## Coach exemption is structural, not a conditional check

`role === "admin"` accounts are exempt from every lock (tier, frozen, maintenance) — but there is no
`if (role !== "admin")` short-circuit inside the lock logic that a future refactor could accidentally
delete. The exemption exists because `AdminApp.jsx`'s "archer mode" (射手模式) is a separate, parallel
UI implementation embedded directly in `AdminApp.jsx`. It never renders `MemberApp.jsx`, so the lock
code path is simply never executed for a coach account. Do not "fix" this by routing archer mode
through `MemberApp.jsx` without re-adding an explicit admin bypass — that would newly expose coaches
to their own tier settings.

## `lastCheckinDate` write timing

Written in `submitCheckin` (the moment the student submits), not in `approveCheckin` (coach review).
This means an auto-locked `official` member regains full access as soon as they submit a check-in,
without waiting on coach approval. Verified: submitting check-in while auto-locked flips
`lastCheckinDate` to today immediately, and the currently-open locked page becomes accessible without
a reload.

## Missing-field fallback semantics (intentionally asymmetric)

- Missing `studentTier` → treated as `"restricted"`. Chosen so that at rollout, all pre-existing
  members default to the conservative state and a coach must explicitly promote each one to
  `official`. This was a deliberate choice over bulk-migrating existing members to `official`.
- Missing `lastCheckinDate` → `isAutoLocked` returns `false` (not locked). Chosen so that rolling out
  this new field never retroactively locks an already-`official` member who simply hasn't triggered
  a check-in since the field was introduced.

These two fallbacks point in opposite directions on purpose — don't "simplify" them to match.

## Known benign edge case: `TierModal` save-if-changed diff

`AdminMembers.jsx`'s `TierModal` only calls `setStudentTier` when the selected value differs from
`studentTierOf(member)` (the same helper that supplies the fallback display value). If a member's
`studentTier` field is missing, the dropdown shows the fallback "restricted" label; clicking Save
without touching the dropdown does **not** issue a Firestore write, because the diff sees no change.
This is not a bug — behaviorally, "missing field" and "explicit `restricted`" are identical per the
fallback rule above — but the field will stay absent rather than becoming an explicit string. If a
coach needs to force an explicit write, they must change the dropdown to another value and back, or
use the bulk-set tool.
