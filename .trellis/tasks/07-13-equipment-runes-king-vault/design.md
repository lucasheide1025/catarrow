# Technical design

## Phase one: dungeon reward foundation

### Ordinary chest rooms

The host generates an `ordinaryChestLoot` object once and writes it to the room. It contains coins and a small list of material/item entries. Its material-tier ceiling is T4 even when the expedition itself is T5 or T6. Clients only display this object; they never reroll it.

### Boss reward and king vault

Boss defeat has two distinct rewards:

1. Defeat loot: matching monster-family material and coin chests, following the expedition's existing T1--T6 tier.
2. King vault: a one-time, persisted post-boss object. It provides a better tier-matched material bundle, coins, King Seals, and later rune fragments/full runes. It never directly grants legendary equipment.

Team generation occurs once under host authority and all claims use Firestore transactions.

### King Seal

`kingSeals: number` lives on the member profile. It is earned from boss/special reward grants and reserved for later equipment grade breakthroughs and socketing. The existing planned breakthrough amounts remain:

| New grade | Seal cost |
| --- | ---: |
| Elite | 1 |
| Epic | 3 |
| Legend | 6 |
| Mythic | 10 |

## Later phase: equipment rune system

New fields will be `equipmentRuneInventory`, `equipmentRuneFragments`, and per-equipment `sockets`. The old `runeInventory`, `memberRunes`, durability and legacy dungeon-rune effects are not reused.

Runes are T1--T4 and must be combined sequentially. A failed combine consumes gold and materials but retains the existing source rune; installed runes can be removed and reused in a later combine. Rune types are attack, defense, health, and rare cat-spirit all-stat.

## Migration gate

Before old-rune deletion, define and implement an explicit conversion for existing accounts. No existing player-owned legacy rune may be silently discarded.
