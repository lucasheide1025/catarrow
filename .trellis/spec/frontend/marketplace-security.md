# Marketplace Security

## Security boundary

`cardMarket` is an economy boundary. Client-side checks are only user feedback; Firestore Rules must independently verify every ownership, state-transition, and asset-delta invariant.

Every operation that moves an asset must update the listing and the affected `members/{id}` document in the same atomic batch. Rules use `getAfter()` to validate the final state:

- Creating an active listing decrements exactly one copy of the listed card and leaves the seller with at least one copy.
- Cancelling an active listing returns exactly one copy to the same seller.
- Buying changes only `active -> sold`, grants exactly one listed card, and deducts exactly the declared arrowdew, gacha token, or offered card.
- Claiming proceeds credits exactly the sale proceeds while changing `sellerClaimed` from false to true.

## Forbidden patterns

- A status-only market update without its corresponding asset delta.
- Crediting proceeds and marking them claimed in separate writes.
- Trusting seller, buyer, card, price, or offered-card values supplied by an update when the immutable listing already contains the canonical values.
- Broad member-document writes during a market operation; validate the exact nested keys that may change.

## Required tests

Rules tests must include both valid batched flows and adversarial status-only writes for listing, cancellation, all three payment types, and proceeds claiming. Run them against the Firestore Emulator after any rule or client transaction change.
