# Guest / Kid Mode Account System

> Persistent, login-free guest and kid accounts (`accountType`), camp-session QR onboarding, and in-place conversion to official membership.

---

## Scenario: `accountType` account model + in-place official conversion

### 1. Scope / Trigger

Cross-layer contract: new `members.accountType` field changes what every existing official-member query must return, plus a new Firestore collection (`campSessions`) and a schema-mutating conversion flow (`convertGuestToOfficial`). Code-spec depth required.

### 2. Signatures

`src/lib/guestAuth.js`
```js
resolveGuestSession(contact, accountType /* "guest"|"kid" */, sessionSourceId) -> Promise<{ id, accountType, uid, ... }>
```

`src/lib/db.js`
```js
getMembers() -> Promise<Member[]>                    // official only
getMembersForBilling() -> Promise<Member[]>           // official only
subscribeKidAccounts(callback) -> unsubscribe          // accountType in ["guest","kid"]
convertGuestToOfficial(memberId, officialFields, newUid, operatorId) -> Promise<Member>
getCampSessions() / subscribeCampSessions(cb) / createCampSession(data) / updateCampSession(id, patch) / deleteCampSession(id)
```

`src/App.jsx` routing (already wired, do not duplicate):
```
?guest=1        -> <GuestApp accountType="guest" />
?kid=<sessionId | 1> -> <GuestApp accountType="kid" sessionSourceId={sessionId or null} />
```

### 3. Contracts

`members/{id}` fields added by this feature:
```js
{
  accountType: "official" | "guest" | "kid",  // ABSENT on legacy docs = treat as "official"
  contactHash: string | null,                 // sha256(normalized email/phone), guest/kid only
  contactRaw: string | null,                  // plaintext, coach-visible only
  sessionSourceId: string | null,             // campSessions doc id, or null
  createdViaQR: string | null,
}
```

`campSessions/{id}`: `{ name, startDate, endDate, qrCode, createdBy, createdAt, active }`.

**Doc-ID invariant**: official accounts happen to get `docId === authUid` at creation time (`createMember` uses `setDoc(doc(db, C.members, uid), ...)`), but nothing in the app relies on that equivalence — `useAuth.js` resolves the logged-in member via `query(collection(db,"members"), where("uid","==",fbUser.uid))`, never by doc ID. Guest/kid docs get a random `addDoc`-generated ID. This is why `convertGuestToOfficial` can safely rewrite the guest/kid doc **in place** (same doc ID, new `uid`) instead of migrating to a new document — login lookup is doc-ID-agnostic by design.

### 4. Validation & Error Matrix

| Condition | Behavior |
|---|---|
| `accountType` field absent on a member doc | Treated as `"official"` everywhere (JS-side check, never a Firestore `where("accountType","==",...)` clause, since Firestore can't match "field absent" that way) |
| `convertGuestToOfficial` writes audit log | Audit log write uses `addDoc` (document **create**), not `updateDoc` — see gotcha below |
| Firestore rules for `members` create/update on `guest`/`kid` | Do not require `resource.data.uid == request.auth.uid` — accepted tradeoff since anonymous re-login rotates `uid` every visit (see `firestore.rules` comment above `match /members/{memberId}`) |

### 5. Good/Base/Bad Cases

- **Good**: `getMembers()` / `getMembersForBilling()` fetch all docs, then filter in JS with `accountType !== "guest" && accountType !== "kid"` — legacy official docs (no field) pass through correctly.
- **Base**: A guest converts to official mid-camp — `convertGuestToOfficial` updates the same doc, keeps `contactRaw`/`sessionSourceId` as history, clears `contactHash`/`createdViaQR`.
- **Bad**: Using a Firestore `where("accountType","==","official")` query — silently drops every legacy doc that predates this field.

### 6. Tests Required

- Manual: create a kid account via `?kid=<sessionId>`, confirm it does NOT appear in `AdminMembers.jsx` list or `MemberLeaderboard.jsx`, DOES appear in `AdminKidMode.jsx`'s account list.
- Manual: run 轉正式 (convert-to-official) end to end — confirm the resulting account can log in normally with the new email/password, keeps its coins/game progress (same doc), and now appears in the official member list/leaderboard.
- Build: `CI=true npx react-scripts build` must compile clean after any change to `db.js`'s member-query functions.

### 7. Wrong vs Correct

#### Wrong
```js
// convertGuestToOfficial — passing the raw patch (with deleteField() sentinels)
// straight into an audit-log addDoc() call
await writeAuditLog({ action: "convertToOfficial", after: patch, ... }); // patch.contactHash = deleteField()
// -> throws at runtime: FieldValue.delete() can only appear in update(), not in set()/addDoc()
```

#### Correct
```js
// Build a sanitized copy for anything that isn't the actual updateDoc() call
const logged = { ...patch, contactHash: null, createdViaQR: null };
await updateDoc(doc(db, C.members, memberId), patch);   // deleteField() OK here (update)
await writeAuditLog({ action: "convertToOfficial", after: logged, ... }); // never pass deleteField() into addDoc/set
```

---

## Gotcha: `deleteField()` sentinels don't survive outside `updateDoc`

> `firebase/firestore`'s `deleteField()` (aka `FieldValue.delete()`) is only legal as a value inside an `updateDoc()` payload. If the same object is reused for an `addDoc()` (e.g. writing an audit-log entry with `after: patch`), Firestore throws at write time. Whenever a mutation function builds a `patch` object containing `deleteField()` for its primary `updateDoc()`, build a **separate** sanitized object (nulls instead of sentinels) for any secondary writes (audit logs, return values, UI state) derived from the same patch.

## Gotcha (severity: production incident, 2026-07-10): `resolveGuestSession` must never reuse an already-signed-in real user's `auth` object

> **What happened**: `resolveGuestSession(contact, accountType, sessionSourceId)` originally did `if (!auth.currentUser) await signInAnonymously(auth); const uid = auth.currentUser.uid;` — it only created a fresh anonymous identity when NO ONE was signed in. If a coach or official member was already logged in on the same browser tab (`auth.currentUser` = their real, non-anonymous user) and then scanned a kid-mode QR (`?kid=<sessionId>`) on that same device/tab, `resolveGuestSession` silently reused the coach's real `uid` and wrote it onto a brand-new guest/kid `members` doc via `addDoc`. Result: two `members` documents sharing the same `uid`. `useAuth.js`'s login resolves the profile via `getDocs(query(collection(db,"members"), where("uid","==",fbUser.uid)))` and takes `docs[0]` — with two matching docs, the coach's own subsequent logins could resolve to the wrong (kid) document, making it look like "my account got overwritten by a kid account" (the coach's real doc was never touched — the lookup just picked the wrong match). The uid-sharing also destabilized `profile` identity across the ~13 `onSnapshot` listeners mounted per session (see `firestore-cost-optimization.md`), which is suspected to have driven a spike of 20,000+ Firestore reads in 5 minutes and exhausted the project's daily quota.
>
> **Fix** (`src/lib/guestAuth.js`, commit `bd5e667`): only reuse `auth.currentUser` when it's already anonymous (`auth.currentUser.isAnonymous === true`). If a real user is signed in, open an isolated temporary secondary Firebase App (`initializeApp(firebaseConfig, "guest_tmp_"+Date.now())`, own `getAuth()`, `deleteApp()` in `finally`) — the same pattern `AddMemberModal` in `AdminMembers.jsx` already uses to create official accounts without disturbing the coach's own login session. Never let a guest/kid session write a real user's `uid` onto any `members` document.
>
> **Prevention**: any code path that calls `signInAnonymously` (or otherwise mints a Firebase Auth identity for an unauthenticated flow) on a page that a logged-in coach/member could also reach in the same tab/session **must** check `auth.currentUser?.isAnonymous` before deciding whether to reuse vs. isolate. Grep for `signInAnonymously` before adding a new one — as of this fix there is exactly one call site in the codebase (`guestAuth.js`); keep it that way or apply the same isolation pattern to any new one.

## Convention: threading `guestProfile`/`isGuest`/`tierCap` into production components (dungeon/equipment reuse, 2026-07-10)

**What**: rather than building a separate simplified clone of a system for guest/kid mode (the old `GuestDungeonSimple.jsx` approach), the project now prefers extending the REAL production component with optional params that default to identical behavior when absent:
```js
// DungeonLobby.jsx / EquipmentPage.jsx / DungeonBattleRoom.jsx pattern
export default function DungeonLobby({ onBack, guestProfile, isGuest, tierCap }) {
  const { profile: authProfile } = useAuth();
  const profile = guestProfile || authProfile;   // official callers pass nothing -> byte-identical to before
  ...
}
```
`isGuest` gates which UI sections render at all (hide, never grey-out — see the existing `{!isGuest && ...}` convention already used throughout `MonsterBattle.jsx`). `tierCap` (e.g. `2`) clamps a difficulty value at **two independent points**: once where the guest UI lets the user choose a tier, and again at the deepest point where that tier number is actually consumed to draw monsters/bosses (`Math.min(source, tierCap)`) — never trust the upstream value alone, in case a future code path produces a dungeon object that wasn't generated through the capped entry point.

**Why**: keeps exactly one implementation of game logic (no drift between a "real" and "guest" version), and the fallback pattern makes official-student regression risk mechanically checkable (grep every call site, confirm none pass the new params, confirm the fallback reduces to old behavior when they're absent).

**Gotcha — the `useAuth()` leak is not confined to the component you're editing.** When adding `guestProfile` support to an entry component (e.g. `DungeonLobby.jsx`), grep **every component reachable from its render tree** for direct `useAuth()` calls, not just its direct children. `DungeonSelectionPanel.jsx`/`EquipmentPage.jsx` were fixed first; a check pass later caught that `RPGEquipPanel.jsx` and `DungeonDex.jsx` also called `useAuth()` directly (missed because they're one hop removed from the obvious call site) — and a *second* check pass caught that `DungeonBattleRoom.jsx` (reached via a local wrapper inside `DungeonExpedition.jsx`, two hops down) had the same gap. Each miss meant: if a coach's own device is already logged in with a real account and someone scans a kid-mode QR code on that same tab (see the anonymous-auth-reuse incident above — this is a real, expected scenario, not an edge case), the affected component would silently show/write **the coach's own data** instead of the child's. Treat this as an exhaustive-grep problem, not a "check the obvious spots" problem — search the whole subtree every time, including wrapper/helper components that don't look like they'd need auth.

**Related pitfall — a boolean flag flowing into unrelated logic.** `DungeonExpedition.jsx` had a `fromStorage` flag that was unconditionally `true` (assuming every dungeon came from the saved/`pendingReveal` storage system). Guest dungeons are ephemeral (`savedId:null`, never written to storage), so this needed to become `fromStorage: !isGuest` — otherwise the consume-effect tried to remove a saved dungeon that was never saved, and the guest got stuck on a permanent loading screen (no render branch handled the resulting stuck `"consume"` phase). When reusing a production component for a new caller, audit every boolean/flag param it already takes, not just the ones you're intentionally threading through.

## Convention: excluding guest/kid from official-only queries

**What**: `getMembers()` and `getMembersForBilling()` in `src/lib/db.js` filter out `accountType in ["guest","kid"]` after fetching, treating an absent `accountType` field as official.

**Why**: Both functions feed multiple consumers (`AdminMembers.jsx`'s member list, `MemberLeaderboard.jsx`'s leaderboard, billing). Filtering once at the source keeps every consumer correct without duplicating the check. A Firestore-side `where` clause was deliberately avoided because it cannot express "field is absent" without an extra composite condition, and older official docs predate the `accountType` field entirely.

**Related**: [[project_party_system]] room-code join is `accountType`-agnostic by design (no filtering needed there — see the `07-09-guest-kid-mode-overhaul` task's `design.md` §4).

**Deliberately NOT filtered**: `resetAllDungeonUsed`, `resetAllMonsterSessions` (daily resets should apply to guest/kid too), and cert/competition registration queries (guest/kid accounts have no UI path into those flows in `GuestApp.jsx`, so filtering there would be dead code).
