# Current Guest UI Review

Reviewed locally at a 390 x 844 mobile viewport on 2026-07-22. Temporary screenshots and the isolated browser profile were removed after inspection.

## Entry screen

- Strong, coherent dungeon visual direction and a clear single primary action.
- Requires email or phone before any play; nickname is optional.
- The page communicates that this is a full-feature trial, but does not preview the exact first activity or time-to-play.

## Authenticated guest home

- Sticky top bar contains mode identity, player name, coins, member-center conversion, and logout.
- The hero contains three competing actions: solo battle, world boss, and share card.
- Two status cards immediately repeat coins and world-boss availability.
- The activity feed exposes practice, performance, solo adventure, party battle, dungeon exploration, world boss, profile/equipment, and related secondary systems.
- The fixed bottom navigation contains eight destinations: home, practice, performance, battle, party, dungeon, world boss, and profile.

## UX diagnosis

- Visual quality is acceptable; the primary problem is information architecture.
- The screen presents a member dashboard with many parallel destinations instead of a guided guest loop.
- Hero actions, activity cards, and bottom navigation duplicate destinations.
- World boss and party play receive first-class placement before the guest learns the basic solo loop.
- Eight bottom-navigation items are too dense for a 390 px mobile viewport and weaken destination recognition.
- Guest conversion is present as a small top-bar action, but the UI does not explain what registering unlocks at the moment a player encounters a limit.

## Recommended direction for discussion

- Preserve the entry-screen art direction.
- Rebuild the authenticated home around one primary `Continue adventure` action and a short guided progression.
- Reduce persistent bottom navigation to 3-4 destinations.
- Keep advanced features discoverable as previews or milestone locks rather than equal-priority playable tabs.
