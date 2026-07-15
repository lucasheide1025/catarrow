# Deduplicate Cat Village listeners and reads

## Goal

Reduce Firestore document reads caused by entering and navigating Cat Village without making shared market or goal data stale when real-time behavior matters.

## Confirmed Facts

- Passive building production is calculated locally once per minute and performs no Firestore read or write.
- Manual building collection merges every unlocked building into one member-document `updateDoc` and rejects collection intervals below roughly three minutes.
- `CatVillage` opens one `subscribeMyCats` collection listener for the entire page; `ForgePanel` opens a second listener for the same member while the forge tab is mounted.
- The parent already has enough cat state to supply `ForgePanel`; the duplicate forge listener is not required.
- `CardMarketPanel` is conditionally mounted and its live collection listener is justified while a multi-user market surface is visible.
- `VillageGoalBanner` is only mounted on the village tab; shared goal progress is genuinely multi-user and remains live there.
- `subscribePotions` is already a one-off read, despite its legacy name.
- `subscribeVillageMarketConfig` is a permanent document listener for configuration that normally changes only through admin actions.
- Village-market exchange configuration changes extremely rarely and does not require instant propagation to an already-open student page.

## Requirements

- Cat Village must open at most one `subscribeMyCats` listener for a member.
- Forge must consume parent cat state and continue reflecting equip/upgrade mutations.
- Card-market and village-goal listeners must exist only while their corresponding UI is mounted.
- Static market configuration should use a one-off read unless instant admin-to-student propagation is explicitly required.
- Existing local one-minute production calculations and one-write manual collection behavior must remain unchanged.
- All effects must return cleanup functions where a listener is retained.

## Acceptance Criteria

- [ ] Opening Forge does not create a second cats collection listener.
- [ ] Returning between village/forge tabs does not increase concurrent cats listeners.
- [ ] Market listings continue to update live while Card Market is visible and unsubscribe when hidden.
- [ ] Village goals continue to update live only while the village tab is visible.
- [ ] Market configuration performs no permanent listener when the page is idle.
- [ ] Cat equip and forge UI refresh correctly after mutations.
- [ ] Production build passes.

## Product Decision

- Read village-market exchange configuration once when Cat Village mounts; students re-enter the page to receive a rare admin change.

## Out of Scope

- Changing building production formulas or collection rewards.
- Batching the bounded daily council/gathering reward writes.
- Removing real-time behavior from the multi-user card market or village goal.
