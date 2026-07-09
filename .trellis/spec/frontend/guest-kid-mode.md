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

## Convention: excluding guest/kid from official-only queries

**What**: `getMembers()` and `getMembersForBilling()` in `src/lib/db.js` filter out `accountType in ["guest","kid"]` after fetching, treating an absent `accountType` field as official.

**Why**: Both functions feed multiple consumers (`AdminMembers.jsx`'s member list, `MemberLeaderboard.jsx`'s leaderboard, billing). Filtering once at the source keeps every consumer correct without duplicating the check. A Firestore-side `where` clause was deliberately avoided because it cannot express "field is absent" without an extra composite condition, and older official docs predate the `accountType` field entirely.

**Related**: [[project_party_system]] room-code join is `accountType`-agnostic by design (no filtering needed there — see the `07-09-guest-kid-mode-overhaul` task's `design.md` §4).

**Deliberately NOT filtered**: `resetAllDungeonUsed`, `resetAllMonsterSessions` (daily resets should apply to guest/kid too), and cert/competition registration queries (guest/kid accounts have no UI path into those flows in `GuestApp.jsx`, so filtering there would be dead code).
