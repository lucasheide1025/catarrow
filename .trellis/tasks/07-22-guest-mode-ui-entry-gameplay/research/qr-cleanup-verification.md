# QR cleanup verification (Phase 0)

Repository and Firebase configuration inspection on 2026-07-22 found no implementation of the asserted two-hour QR cleanup:

- no Firestore TTL declaration or TTL field configuration is represented in `firebase.json`;
- no scheduled/triggered Function deletes `kid` member profiles or their dependent documents;
- the local `deleteMember` helper deletes only `members/{memberId}`;
- the repository does not contain a cascade covering inventory, cards, chests, claims, battle resume, or room participation.

The live project may have a console-managed Firestore TTL policy, an externally deployed scheduler, or an out-of-repository service. That state was not changed and no deployment was performed.

## Blocker

Do not deploy the new QR profile schema or claim complete automatic deletion until the live Firebase project is inspected and an end-to-end deletion proof covers at least:

- `members/{memberId}`;
- `materialInventory`, `chestInventory`, `potionInventory`, `fragmentInventory`, `cardCollections`;
- monster/dungeon/world-boss reward and choice claims;
- resumable battle/dungeon state and private room participation records.

Phase 1 creates `expiresAt` as an authoritative fixed two-hour timestamp and makes Rules reject expired QR profiles. This limits access after expiry, but it is not a physical deletion cascade.
