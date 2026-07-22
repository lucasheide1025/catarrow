# QR Guest Mode Feasibility

## Conclusion

The requested flow is feasible on the current architecture, but it is not a UI-only change. A QR entrant can use anonymous Firebase Auth plus a temporary `members` document, allowing existing reward and inventory systems to operate without collecting contact information.

## Existing capabilities that can be reused

- Member Management > Guest QR already creates `campSessions` and generates `?kid=<sessionId>` URLs.
- Anonymous Firebase Auth is already used by `resolveGuestSession`.
- Combat components already accept guest profile overrides.
- Solo reward callable validates that the anonymous auth UID owns the member document and can atomically grant coins, materials, and cards.
- Existing guest-compatible inventory, equipment, chest, card, party, dungeon, and world-boss surfaces provide most of the required UI and data paths.

## Required changes

1. Split entry resolution:
   - Website-booking `guest`: keep bound/persistent lookup.
   - QR `kid` internal type: accept nickname only, create an anonymous-auth-owned temporary profile with session identity and expiration metadata.
2. Preserve the deployed two-hour deletion mechanism, but verify its actual implementation before changing the document schema. No two-hour scheduler or TTL declaration is present in the repository.
3. Ensure deletion cascades beyond `members/{id}`. Rewards currently also exist in documents such as material/card/chest inventories, reward claims, battle records, and room participation. The local `deleteMember` helper deletes only the member document.
4. Enforce the six-family T1 cap at the deepest monster-selection/reward boundary in every mode. The current guest dungeon call uses `tierCap={2}`, party rooms inherit their room monster, and world boss uses the shared live event; UI filtering alone is insufficient.
5. Normalize guest rewards across solo, party, dungeon, and world boss. Current modes do not share one guest reward contract: world boss intentionally limits formal claims, dungeon skips some guest persistence, while party treats guest rewards close to official rewards.
6. Tighten Firestore guest access before expansion. Current `members` rules allow any authenticated user to read any guest/kid member document and broadly update a guest/kid document. Temporary profiles must be owner-scoped.

## Risk statement

Do not claim the existing two-hour cleanup is complete from repository evidence alone. The live Firebase TTL/scheduler must be inspected, and a test must prove that every per-player asset and claim document is removed or expires together.
