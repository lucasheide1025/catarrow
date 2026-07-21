# Design Notes — Zombie Survival Mode

## Architecture decision

Create a new `zombieRooms` collection and a `src/zombie/` feature boundary. Do not add `mode === "zombie"` branches to `dungeonDb`, `DungeonBattleRoom`, or `processDungeonRound`. This is a physical-archery cooperative tabletop system, not a dungeon/RPG combat variant: preserve real shooting as the only player battle action, with automatic resolution after coordinate entry.

Suggested layers:

```text
src/zombie/
  domain/       pure types, encounter resolver, distance, infection, supplies
  target/       zombie SVG hit-map and coordinate transforms
  data/         zombie archetypes, item catalogues, map/extraction definitions
  db/           room commands, transactions, subscriptions, reward claims
  ui/           lobby, setup, battle, map, extraction, base surfaces
  display/      read-only central battle presentation and event playback
  bridge/       cross-world effect IDs and allowlisted dungeon translation
```

The domain resolver returns a deterministic event list from persisted state plus submitted arrows. UI renders events; it must not be the authority for movement, infection, equipment durability, or rewards. A future central display subscribes to the same resolved event log and plays it as a read-only presentation; no client, including the display, independently recalculates outcomes.

## Confirmed reuse boundary

| Reuse safely | Must remain independent |
|---|---|
| Firebase initialization, authentication, `hostId`, subscriptions, transaction patterns | `dungeonRooms`, `partyRooms`, dungeon room statuses and `processDungeonRound` |
| normalized `nx`/`ny` landing-record shape and target-input interaction pattern | ring-score geometry and score labels from `targetFace.js` |
| node-map presentation concepts and host-only map progression | dungeon floor generation, monster HP/ATK/DEF, contracts and counterattacks |
| member coins, material inventory, village-resource grant patterns | dungeon equipment/potions/buffs and all combat maths |
| team reconnect and idempotent reward-claim patterns | current Firestore room security rules; new rules require membership/host validation |

## Core persisted model (draft)

```ts
type ZombieRoom = {
  schemaVersion: 1;
  hostId: string;
  status: ZombiePhase;
  settings: { targetSlots: TargetSlot[]; realDistanceM: number; timerProfileId: string };
  members: Record<string, ZombieSurvivor>;
  encounter?: ZombieEncounter;
  map?: ZombieMapState;
  clearedBossIds?: Record<string, true>;
  safety: { paused: boolean; pauseReason?: string; shootingStartedAt?: Timestamp; deadlineAt?: Timestamp };
  commandVersion: number;
  presentation?: { resolutionId: string; eventLogId: string; playbackState: "idle" | "ready" | "playing" | "complete" };
};

type ZombieSurvivor = {
  name: string;
  lifeState: "healthy" | "protected" | "infected" | "suppressed" | "fully_infected" | "dead" | "extracted";
  infection?: { remainingMapNodes: number; delays: number; source?: string; consecutiveAttacks: number };
  fullyInfectedSupport?: { interferenceScore?: number; interferenceCooldown?: number; interferenceUses?: number };
  armor: Record<string, { itemId: string; durability: number }>;
  supplies: Record<string, number>;
  role: "main_archer" | "remote_sniper";
  hitDistanceOffsetM?: number;
  submissions: Record<number, ZombieArrow[]>;
};

type ZombieArrow = { targetSlot: TargetSlot; nx?: number; ny?: number; isMiss: boolean };
type ZombieEncounter = { round: number; zombies: Record<string, Zombie>; pendingResolution?: string };
type Zombie = { archetypeId: string; targetSlot: TargetSlot; distanceM: number; status: string[]; body: Record<string, string>; threatOrderMemberIds: string[]; threatCursor: number };
```

No nested arrays should be stored in Firestore. Persist map nodes as a flat object/list and arrows as maps keyed by player/round/arrow index if rules need field-level validation.

## State machine

```text
LOBBY -> TARGET_SETUP -> EXPLORING -> ENCOUNTER_PREPARE
  -> WAITING_FOR_SHOOTERS -> SAFETY_COUNTDOWN -> SHOOTING -> SCORE_INPUT -> RESOLVING
  -> ARROW_RETRIEVAL -> (EXPLORING | ENCOUNTER_PREPARE)

Any safe state --host emergency pause--> SAFETY_PAUSED --resume--> prior state
RESOLVING -> PLAYER_ATTACKED -> (EXTRACTION | MISSION_FAILED | ARROW_RETRIEVAL)
EXPLORING -> EXTRACTION -> MISSION_COMPLETE
```

Only host commands may start the five-second safety countdown / shooting window, mark shooting complete, submit scores for resolution, advance a map node, resume safety pause, and start a new round. `SAFETY_COUNTDOWN` ends with an audible shoot cue. `SHOOTING` persists a distance-selected deadline (120s at 10m+, 60s at 7–9m, 45s at 4–6m, 30s at 3m; rescue windows at 0m are 15s) and ends with an audible stop cue. Each archer may submit only their own target-slot and SVG-coordinate entries during `SCORE_INPUT`. `SCORE_INPUT` is deliberately separate from `SHOOTING`; it accepts results after the stop cue and never owns an active deadline. The client must present an `M` choice for arrows the archer did not shoot by the deadline, relying on archer self-report rather than attempting to lock score input.

`submitScores` normally rejects while any active archer is incomplete, exposing member-level completion state to the host. A separate, audited host `forcePassIncomplete` command is allowed for disconnect/UI recovery. It leaves submitted arrow records unchanged and writes explicit no-effect/lost entries only for missing arrows; it must not fabricate target coordinates or overwrite a completed player.

## SVG hit map and distance

Each target-sheet template is traced from an approved physical-sheet photograph and defines a canonical `viewBox`, anatomical regions, an anchor point, and a silhouette-surrounding `M` region. The first MVP template is a fixed black-and-white sheet, not a runtime photo-recognition feature. At scoring time the client saves canonical coordinates for anatomical hits. A click in the dedicated outer `M` region records `isMiss: true` without a coordinate requirement. The resolver transforms an anatomical entered coordinate into the target's canonical space before hit testing:

```text
displayScale = realDistanceM / zombieDistanceM
visualScale = clamp(displayScale, visualMin, visualMax)
hitScale = clamp(displayScale, hitMin, hitMax)
canonicalPoint = anchor + (displayPoint - anchor) / hitScale
```

All regions are transformed together; no body part scales independently. Visual and hit-scale caps are separate configuration. Target coordinate data is not passed to current `resolveTargetHit`, because that function only knows scoring rings. Asset review must compare the traced SVG against a photographed sheet at normal viewing size before enabling the template.

## Round resolution order

1. Host starts `SHOOTING` and the persisted deadline; each archer shoots in the physical range.
2. Host marks shooting complete (or deadline expires), immediately ending the countdown and entering `SCORE_INPUT`.
3. Each archer records only their own valid target-slot and SVG-coordinate entries.
4. Host explicitly submits the completed score set for resolution. If an archer is incomplete, the room waits; the host can explicitly force-pass that archer when recovery is necessary.
5. Resolve each arrow through the zombie hit-map and archetype rule table; persist descriptive body-state outcomes rather than a numerical HP value.
6. Apply kill, stagger, knockback, limb destruction, armour penetration, and noise events.
7. Move surviving zombies. An ordinary zombie rolls a 1–3m advance each round, modified by persisted knockback and slow status. Zombies may exist beyond the 10m player-visible / physical-target range (encounters can begin at 3m to beyond 20m); retain them in a controlled off-field queue. Allocate a zombie to a physical target slot only when it is below 10m and an empty slot exists. While no slot is empty, clamp each queued zombie at 10.1m minimum; when a slot opens, admit the closest queued zombie, which cannot move or attack during that admission round. This prevents a sudden multi-zombie rush or a near-zero-distance ambush on entry.
8. For every survivor zombie now at 0m, iterate its persisted `threatOrderMemberIds` from `threatCursor`. Before each imminent attack, there is a **50% chance** to open a 15-second rescue event: every main archer and remote sniper may submit one arrow, resolved through the normal body-part rules with text + animation presentation. If the attack is prevented, skip its attack resolution; otherwise continue.
9. If the zombie remains alive and its rescue window did not prevent the attack, attack the current living survivor. First roll the matching armour's level-based chance to fully block the attack; only a failed block applies infection and any armour-durability consequence. Persist the result in attack logs.
10. If it remains alive, advance to the next living survivor and repeat steps 8–9. End only when the zombie is killed/stopped by an effect that prevents attack, or no living survivor remains. The UI must announce the current target as the cursor advances.
11. Advance combat effects once per resolved game round, but advance infection at map-node progression (not each combat round) so players have time for treatment or extraction decisions. Medicines may delay or cure infection and are the only action that resets the consecutive-suffered-attack counter; successful armour blocks and map-node progression do not reset it. Three consecutive suffered zombie attacks immediately force the persisted fully-infected state, which preserves the player as a remaining-consciousness support teammate: their normal body effects are halved and they gain a score-based interference action. Hunger/thirst and other effects use their individually configured cadence.
12. Persist one event log plus next state atomically; render it client-side. The current `eventLogId`/`resolutionId` is the only central-display playback source.

## Armor system (5-tier, confirmed)

Armor positions: helmet, chestplate, gauntlets, boots. Each piece has:
- `tier`: 1–5 (common → legendary)
- `blockRate`: base block percentage (T1=40%, T2=55%, T3=70%, T4=82%, T5=92%)
- `durability`: base max durability (T1=3, T2=5, T3=8, T4=12, T5=16)
- `slots`: enhancement slot count (T1=0, T2=1, T3=1, T4=2, T5=2)
- `enhancements`: items found in exploration/boss drops, each adds bonuses (+blockRate, +durability, special resistances)
- `currentDurability`: decremented by 1 on each successful block; when 0, armor piece is disabled

`block()` resolves: if random < blockRate → attack fully blocked (no damage/infection). Otherwise → infection roll + durability penalty.

## Accessory system (confirmed)

- Slot count grows with base level (starts at 1)
- 3 uses per expedition per accessory
- Confirmed accessory types: drone (amplifies non-head effects), radio (intel prediction), reserve team (temp supplies)

## Weapon/arrow types (all 5 in Phase 2, confirmed)

| Type | Effect | Carry limit |
|------|--------|-------------|
| Threshold-reduction arrow | Lowers non-head kill threshold (e.g. 3 chest→2) | 3–5 per expedition |
| Knockback arrow | Increases knockback distance | 3–5 per expedition |
| Penetration arrow | Passes through first zombie to hit the next | 3–5 per expedition |
| Explosive arrow | 3m AoE blast | 3–5 per expedition |
| Silent arrow | Lowers noise (stealth benefits) | 3–5 per expedition |

Normal arrows: unlimited carry.

## Backpack weight system (confirmed)

`baseCapacity = 20kg` (initial, grows with base level + player level)

| Item | Weight |
|------|--------|
| Food | 1kg |
| Water | 1kg |
| Medical item | 0.5kg |
| Normal arrows (10) | 1kg |
| Special arrow (1) | 0.5kg |
| Tool | 2–3kg |

## Fully infected support role (confirmed)

- Mark Target ability: shoot a zombie → marks it → teammates deal increased damage/effects for a duration
- Curable with experimental serum (restores to normal survivor)
- Standard body effects halved (2 head hits, 6 torso hits)

## Base building system (confirmed)

- Aligned with cat village: **10 levels per building**, 9 shared materials
- All 9 buildings Phase 4:
  1. Growing Room (food supply)
  2. Water Purification Station (water supply)
  3. Expedition Supply Team (async material return)
  4. Medical Room (medical kits, suppressants, serums)
  5. Equipment Workbench (craft/upgrade accessories)
  6. Armor Repair Station (repair armor durability)
  7. Radio Tower (remote intel prediction)
  8. Scout Station (map reveal + intel accuracy)
  9. Rescue Team (post-wipe gear recovery)

## Encounter rates per zone (confirmed)

| Zone | Base encounter rate | Special zombie | Elite | BOSS |
|------|-------------------|----------------|-------|------|
| Safe (🟢) | 0% | ❌ | ❌ | ❌ |
| Normal (🟡) | 20% | Low | ❌ | ❌ |
| Danger (🟠) | 40% | ✅ | Low | ❌ |
| High-risk (🔴) | 60% | Higher | Few | Warning event |
| Restricted (⚫) | 80% | ✅ | ✅ | Very high |

## Extraction types (5 types, confirmed)

1. 🎲 Random extraction point — requires item trigger
2. ✅ Guaranteed extraction endpoint — guaranteed on every map
3. ⚡ Rapid extraction — safe-phase only, loses 30% carried supplies
4. 🔑 Special extraction — requires specific conditions (fuel, key, etc.)
5. 🤝 NPC rescue — free extraction after completing quest

## Cross-world bridge

`crossWorldEffectId` is owned by zombie rewards. The bridge has a finite allowlist such as `dungeon_reward_coin_bonus`, `dungeon_existing_buff`, or `dungeon_material_grant`. It may use verified dungeon concepts (existing buff multiplier, existing reward, chest/material grant, `skip_counter` only if deliberately approved); it must reject unknown IDs. No zombie item directly mutates a dungeon member's stats. BOSS-exclusive rewards are high-value materials/research artifacts gated by the BOSS clear; they may only cross worlds through this adapter.

**Cross-world effects**: deferred to Phase 4 for decision. Currently keep `crossWorldEffectId` placeholder interface only.

## Economy

- **Shared economy with dungeon**: zombie mode uses the same coin + material system (no separate currency)
- Individual extraction: supplies stay with team, equally divided (not 15% penalty)

## BOSS common interface (confirmed)

```ts
type BOSSArchetype = {
  id: string;
  name: string;
  map: string;           // map it belongs to
  phases: BOSSPhase[];   // multi-phase behavior
  visibleWeakPoints: string[];
  specialAttacks: string[];
  clearedFlag: boolean;  // persists after kill
  rewards: string[];     // exclusive materials/research
};

type BOSSPhase = {
  name: string;            // e.g. "armored", "enraged", "weakened"
  condition: string;       // trigger condition (e.g. "HP < 50%")
  behavior: string;        // what the BOSS does differently
  specialTarget?: string;  // unique target mechanics
};
```

First BOSS prototype: **Giant Zombie King** (multi-phase: armored → enraged → weakened).

## Risks and mitigations

- **Physical safety:** host-only start, emergency pause, and no timer outside shooting are release gates, not polish.
- **Client authority/cheating:** current room rules are broad; plan a new restrictive ruleset and transaction checks before multiplayer beta.
- **Timer drift/reconnect:** persist deadline timestamps, not decrementing client counters; server time is needed for trustworthy enforcement.
- **Display sync:** a central display is a read-only subscriber to persisted resolution events. It may replay the current/last event log after reconnect, but cannot start rounds, submit scores, or write state.
- **Concurrent resolution:** lock `pendingResolution`/`commandVersion` inside a transaction; resolver must be idempotent.
- **Multiplayer fairness:** select and persist each zombie's ordered attack list when it spawns, announce the first target in preparation UI, and never silently rewrite the order during normal movement. At 0m, display each cursor advance before resolving the next attack/rescue decision.
- **Balance:** configuration tables, seeded encounter tests, and field testing precede economy/cross-world rewards.
- **Scope creep:** fully infected play, BOSSes, base, and cross-world effects remain post-MVP.
