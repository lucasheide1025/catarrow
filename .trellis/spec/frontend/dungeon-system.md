# Dungeon System — Frontend Spec

> Contracts, patterns, and gotchas for the dungeon components.
> Covers: DungeonBattleRoom, DungeonShop, DungeonRest, dungeonData.js

---

## Architecture

```
DungeonController
  └─ DungeonBattleRoom   ← main battle/input/overlay orchestrator
       ├─ DungeonShop    ← status="shop"
       ├─ DungeonRest    ← status="rest" (via DungeonExplore)
       ├─ DungeonPathSelect
       └─ DungeonEvent
```

All non-combat rooms use the same **confirm → resolve** two-phase pattern (see below).

---

## Member Role Model

| `role` | `alive` | Meaning |
|--------|---------|---------|
| `"front"` | `true` | Active front-line archer |
| `"rear"` | `true` | **Fallen front archer** (demoted, still alive) |
| `"rear"` | `true` | Original rear-guard |
| any | `false` | Fully dead (wiped) |

> **Critical distinction**: `role === "rear" && alive === true` can mean EITHER a fallen front archer OR an original rear-guard. To detect a "fallen front archer eligible for revival", filter by `alive && role === "rear"` — there is no separate `fallen` flag. Revival restores `role → "front"` and `hp → maxHP * 0.5`.

---

## Non-Combat Room Pattern (confirm → resolve)

All non-combat rooms (shop, rest, trap, event) follow this contract:

```
Each member: confirmNonCombatRoom(roomId, memberId, choice?)
  → writes roomConfirms[memberId] = true
  → writes roomChoices[memberId] = choice (optional)

Host only: resolveNonCombatRoom(roomId, room, hostId, activeRoomId)
  → applies effect once, clears room state, advances status
```

**Never** apply individual effects inside `confirmNonCombatRoom`. Effects are applied once by the host in `resolve`.

---

## DungeonShop — Purchase Contracts

### One-time purchases (non-potion items)

```js
// Firestore: shopPurchases[memberId] = arrayUnion(item.id)
// Persists across ALL shops/floors for the entire run (NOT reset between rooms)
// Source: dungeonDb.js → "不重置 shopPurchases，讓購買記錄跨商店持久"

// Correct check:
const alreadyBought = !isPotion && myPurchases.includes(item.id);
// Do NOT rely on local `bought` state — it resets on component remount
```

### revival_front purchase condition

```js
// revival_front can only be bought when a fallen front archer exists:
const hasFallenFront = Object.values(members).some(m => m.alive && m.role === "rear");
// Disable button + show "⚠️ 無前衛倒地" when !hasFallenFront
```

### handleResolve — revival_front target

```js
// WRONG — checks if the purchaser is rear (they almost never are):
if (choice === "revive_front") {
  const m = members[id]; // id = purchaser
  if (m && m.role === "rear") { /* revive */ }
}

// CORRECT — scan members for any fallen front archer:
const fallenFronters = Object.entries(members)
  .filter(([, m]) => m.alive && m.role === "rear");
if (fallenFronters.length > 0) {
  const [targetId, targetM] = fallenFronters[0];
  upd[`members.${targetId}.role`] = "front";
  upd[`members.${targetId}.hp`] = Math.round((targetM.maxHP || 100) * 0.5);
}
```

---

## DungeonRest — Vote Mechanic

- Each member votes via `confirmNonCombatRoom(roomId, memberId, optionId)`
- Host resolves: pick highest-voted option, apply it **once**
- `revive` fallback: if `revive` wins but no member has `role === "rear"`, apply heal +50% instead
- `hasFrontFallen` = `aliveIds.some(id => members[id]?.role === "rear")`

---

## Contract Types — calcDungeonContractDmg

| type | mechanic | score buttons |
|------|----------|---------------|
| `standard` | full scoring | X 10 9 8 7 6 5 4 3 2 1 M |
| `hit_count` | hit=fixed dmg, M=0 | 命中 / M only |
| `all_hit` | **each M −10% total dmg** | full scoring (X 10 9…M) |
| `score_gate` | per-arrow proportional penalty below threshold; threshold capped at 9; X/10 treated as 9 | 9 8 7 6 5 4 3 2 1 M (no X/10) |
| `x_crit` | X = crit ×2, others ×0.5 | full scoring |
| `target_score` | total < param → 0 dmg | full scoring |
| `reversal` | 6↔X, 7↔10, 8↔9 then standard | full scoring |
| `odd_only` | only 7,9,X; others = M | full scoring |
| `even_only` | only 6,8,10; others = M | full scoring |

### score_gate proportional penalty (per arrow)

```js
// threshold = Math.min(param ?? 9, 9)
// For each arrow: if arrowScore < threshold:
//   arrow_factor = max(0, 1 - (threshold - min(arrowScore, 9)) * 0.1)
// Apply arrow_factor to that arrow's damage contribution
// X and 10 both treated as score=9 for threshold comparison
```

### all_hit M-penalty

```js
// Standard scoring first, then:
const mCount = arrows.filter(a => (a.score ?? 0) === 0).length;
dmg = Math.round(dmg * Math.max(0, 1 - mCount * 0.1));
```

### _roomMeta contractParam cap

```js
// All score_gate params must be capped at 9 (X/10 too hard as target):
contractParam: Math.min(6 + tier, 9)
```

---

## DungeonBattleRoom — Score Button UI

### Folded score rows

```js
const SCORE_ROW_A = ["X","10","9","8","7","6","M"]; // page 0 (default)
const SCORE_ROW_B = ["6","5","4","3","2","1","M"];   // page 1

// Toggle via scoreRowPage state (0/1)
// score_gate type: only show ["9","8","7","6","5","4","3","2","1","M"] (no X/10)
// all_hit type: use full row (SCORE_ROW_A/B), NOT 命中/M buttons
// hit_count type: still shows only 命中/M
```

### Rear-view toggle during input

```js
// State: viewRearInInput (bool) — only meaningful when !isAnimating && !submitted
// Show toggle button only when: !isAnimating && !submitted && rearDisplayMembers.length > 0
// Toggles displayed member cards between myRowMembers and rearDisplayMembers
// Does NOT affect score submission or role logic
```

---

## Scoring Input Mode (`targetMode`) Must Be Locked Once a Round Starts

`TargetFaceOverlay` (`src/components/shared/TargetFaceOverlay.jsx`) is the shared target-face tap-to-score UI. It is wired into **5** call sites across the battle system: `PartyBattleRoom.jsx`, `DungeonBattleRoom.jsx`, `MonsterBattle.jsx`, `WorldBossAttack.jsx`, `DuelRoom.jsx`. Each of these also has a local `targetMode` boolean toggling between button-scoring and target-face-scoring for the current round.

**Never let `targetMode` change after the player has started entering arrows for the round.** Every one of the 5 call sites originally shipped with an always-clickable 🎯 toggle button (no lock condition) and a `TargetFaceOverlay onClose` handler that silently flipped `targetMode` back to button mode. Switching mode mid-round while arrows are partially entered leaves the round in an inconsistent state and can permanently disable the submit button (`targetPending`/completion-state gets stuck). `DuelRoom.jsx` and `WorldBossAttack.jsx` had this exact bug and were not caught until a follow-up `trellis-check` pass grepped **all** `setTargetMode(` call sites project-wide — the original fix only covered 3 of the 5 files because the task description didn't know the other two existed.

Correct pattern (applied to all 5 files):

```js
// Toggle button: only rendered before any arrow has been entered this round
{arrows.length === 0 && (
  <button onClick={() => setTargetMode(m => !m)}>🎯</button>
)}

// TargetFaceOverlay: onClose must NOT change targetMode/input mode.
// Closing the overlay just hides it — it does not revert the player's choice.
<TargetFaceOverlay ... onClose={() => setShowOverlay(false)} />
// NOT: onClose={() => { setTargetMode(false); setBattleInputMode("button"); }}

// handleTargetSubmit: guard against re-entrant calls
function handleTargetSubmit() {
  if (targetPending) return;
  setTargetPending(true);
  setTimeout(() => { setTargetPending(false); handleSubmit(); }, 2000);
}
```

**If you touch `TargetFaceOverlay` or add a 6th call site**, grep `setTargetMode(` and `onClose=.*setTargetMode` across the whole `src/` tree before considering the change complete — a partial fix that covers only the files named in a task description is not sufficient.

## Admin Theme — Dark Mode Convention

All admin components use a **dark background** (slate-900 / slate-800 range). Any card, modal, or panel must use dark backgrounds:

| Pattern | Replacement |
|---------|-------------|
| `bg-white` | `rgba(255,255,255,0.06)` or `bg-white/6` |
| `bg-gray-50` | `rgba(255,255,255,0.04)` |
| `bg-gray-100` | `bg-white/8` |
| `text-gray-800` | `text-white` |
| `text-gray-700` | `text-slate-300` |
| `text-gray-500` | `text-slate-400` |
| `border-*-200` | `border-*-500/30` |
| `bg-*-50 border-*-200` cards | `bg-*-900/30 border-*-500/30` |

**Exception**: QR code containers (`bg-white p-2`) must stay white for scanner readability.

---

## All-Member Status Card

Pattern for displaying member status in non-combat rooms:

```jsx
<div style={{ display:"flex", gap:4, padding:"6px 12px", overflowX:"auto",
  background:"rgba(0,0,0,0.3)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
  {Object.entries(members).map(([id, m]) => {
    const hpPct = m.maxHP > 0 ? Math.max(0, Math.min(1, m.hp/m.maxHP)) : 0;
    return (
      <div key={id} style={{ flexShrink:0, minWidth:52, textAlign:"center", padding:"4px 4px 3px",
        borderRadius:6, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.04)" }}>
        <div style={{ fontSize:7, color: m.alive ? (m.role==="rear"?"#a78bfa":"#4ade80") : "#f87171",
          fontWeight:700, marginBottom:2 }}>
          {m.alive ? (m.role==="rear"?"🛡":"⚔️") : "💀"} {(m.name||"").slice(0,5)}
        </div>
        <div style={{ height:3, borderRadius:2, background:"rgba(255,255,255,0.1)", overflow:"hidden", marginBottom:2 }}>
          <div style={{ height:"100%", width:`${hpPct*100}%`,
            background:hpPct>0.5?"#16a34a":hpPct>0.25?"#d97706":"#dc2626" }}/>
        </div>
        <div style={{ fontSize:7, color:"#94a3b8" }}>{m.hp}/{m.maxHP}</div>
      </div>
    );
  })}
</div>
```

Place after the room header, before main content.

---

## Team Expedition Coordination

Team expeditions use two document roles in the shared `dungeonRooms` collection:

- Coordination room: waiting members, selected dungeon, current battle room, final result.
- Battle room: one floor handled by `DungeonBattleRoom`.

### Host authority

- Persist the coordination room's `hostId`; never infer the host from Firestore map iteration order.
- Only the host creates the next battle room, advances floors, publishes the final result, broadcasts failure, and deletes per-floor battle rooms.
- Non-host clients subscribe and route only. They must never delete a battle room after observing its terminal state.

### Membership

- Joining must use a transaction that rechecks `status === "expedition_waiting"` and the maximum member count.
- Leaving must delete the member field with `deleteField()`. A `null` member still occupies a key and causes incorrect capacity counts.
- Starting changes the coordination status before entering combat so the room disappears from open-room queries and rejects late joins.

### Floor carry-over

- After each floor, copy `hp`, `maxHP`, `atk`, `def`, and `alive` from the battle-room snapshot back to the coordination room.
- Use nullish fallback (`??`) for numeric combat fields. `value || default` revives members whose valid HP is `0`.
- Synchronization must preserve concurrent departures and must not recreate a member who already left.

### Result consistency

- `calculateExpeditionRewards()` is random. Calculate it exactly once, persist the result in `expeditionResult.rewards`, and render/grant that same object.
- Keep the coordination room until all active members have claimed, otherwise the host can delete the result before teammates receive it.
- `members.expeditionRecords` must remain in the Firestore member-update allowlist.

### Saved-dungeon boundary

Saving a revealed dungeon already clears the previous pending reveal/progress and starts the next excavation cycle. Starting a saved dungeon consumes only the selected saved slot.

**Never call `completeExcavation()` or `abandonExcavation()` when a saved-slot run ends.** Doing so destroys the player's newly accumulated excavation progress. This applies to success, wipe, and manual exit.

### Local E2E tooling

Do not install temporary browser-automation packages into this project's live `node_modules` while the development server is running. npm may re-layout nested Firebase packages; an interrupted install can leave `firebase/node_modules/@firebase/auth` incomplete and make webpack report that every `firebase/auth` export is missing. Use an isolated temporary tool directory instead.

## Expedition Monster Plan

- Expedition difficulty maps to one exact base monster tier:
  `1..6 -> common, rare, elite, fierce, boss, mythic`.
- Never build an expedition pool from every tier below the selected difficulty. That allowed high-level dungeons to produce T1 bosses.
- Variants are assigned by room role:
  - floor 1 encounters: `weak`
  - floor 2 encounters: `normal`
  - floor 2 elite and floor 3 branch encounters: `strong`
  - final room: `boss`
- Generate and persist the final boss when the dungeon descriptor is created. Selection UI, solo runs, and team coordination rooms must reuse that same boss.
- A persisted boss already has its variant stats. Do not apply the boss multiplier a second time when starting a floor.

## Expedition Loot and Claims

- Every defeated expedition monster produces two matching family/tier material chests and two matching-tier coin chests.
- Keep the complete run loot summary for the final report, including defeated monsters and treasure-room bonuses.
- Treasure-room reward data is generated once. Animation state may reveal it progressively but must not reroll it.
- Team loot is persisted on the coordination room. Claiming must atomically:
  1. verify membership and an available result;
  2. reject an existing member claim;
  3. increment member resources;
  4. append the expedition record and chests;
  5. write `resultClaims[memberId]`.
- Do not grant resources before setting the claim marker in a separate operation.

## Dungeon Lobby Scrolling

- `MemberApp .content-area` is the only vertical scroll owner for the dungeon lobby.
- `DungeonLobby`, `DungeonTeamLobby`, and the excavate, storage, and dex tabs must use natural content height. Do not add `100dvh`, fixed `h-full + overflow-hidden`, `overflow-y-auto`, or another vertical scroll viewport inside these lobby surfaces.
- The team waiting-room action footer may be `position: sticky; bottom: 0`, but it must remain in normal document flow and include `env(safe-area-inset-bottom)`.
- Horizontal filter strips may keep `overflow-x-auto`; overlays and battle screens remain independent full-screen surfaces.

## Locked Run Settings

- The host selects `arrowsPerRound` (`3` or `6`) and `targetFmt` (`full_110`, `half_610`, or `field_16`) before an expedition starts.
- Persist both values on the solo run descriptor or team coordination room, then copy them into every floor battle room.
- Team setting updates require the coordination room host and `status === "expedition_waiting"`.
- `DungeonBattleRoom` only reads these settings. Never expose arrows-per-round or target-format mutation controls after the run starts or inside individual map encounters.

## Team Expedition Reconnect

- On entering the dungeon lobby, query for a coordination room that still contains the current member and has `expedition_waiting` or `expedition_active` status.
- Do not force navigation. Show an explicit resume action so the player may return to the waiting room, current battle, or an unclaimed final result.
- Ignore result rooms already claimed by the current member.
- Reconstruct the lobby descriptor from the coordination room, including its persisted boss, arrows-per-round, and target format. The coordination room and its current battle-room ID remain the source of truth after a client disconnect.

## Team Expedition Map Parity

- Solo and team expeditions share `GridMapStage` and `BranchStage`; do not maintain a separate direct three-battle team flow.
- Persist the complete team exploration state on the coordination room as `expeditionMapState`: phase, floor, generated `rooms`/branch, party position, visited IDs, branch choice/step, and pending room. **Never persist `gridFloor.grid` itself** — see "Firestore Cannot Store Nested Arrays" below.
- The host is the only map controller. Other members render the same persisted state and wait for host navigation.
- Attach each generated monster to its room before persisting the map so reconnects and all clients see the same monster.
- Per-room battle documents remain multiplayer `DungeonBattleRoom` documents. Copy `role`, `displayGroup`, `buffs`, HP, and alive state both into and back out of every battle room so front/rear behavior survives the entire expedition.
- After the final boss, synchronize one treasure-room loot object before rendering teammates' treasure cards, then publish the shared final result.

## Firestore Cannot Store Nested Arrays

`generateGridFloor()` (`src/lib/expeditionGrid.js`) returns a `gridFloor` object whose `grid` field is a literal 2D array (`grid[y][x] = roomId`). Firestore's `updateDoc`/`setDoc` reject any array-of-arrays with `"Function updateDoc() called with invalid data. Nested arrays are not supported"`. Solo play never hit this because its `gridFloor` lives only in local React state; team play crashed immediately on `建立組隊 → 進入` because `TeamExpeditionBattle.jsx` persists the map to the coordination room's `expeditionMapState`.

`grid` has **no downstream consumer** — `GridMapStage` builds its own `roomByPos` lookup from `gridFloor.rooms` (array-of-objects, which Firestore allows) and never reads `.grid`. So the fix does not need a read-side reconstruction:

```js
// expeditionGrid.js
export function stripGridForSync(gridFloor) {
  if (!gridFloor) return gridFloor;
  const { grid, ...rest } = gridFloor;
  return rest;
}
```

Call this (via a local `stripMapStateGrid(state)` wrapper) at **every** site in `TeamExpeditionBattle.jsx` that writes `expeditionMapState` through `updateTeamExpeditionRoom(...)` — there are 9 such call sites; missing even one reintroduces the crash. Do not change `generateGridFloor()`'s own return shape — it is a shared pure function and solo mode still relies on the full `grid` array.

**General rule**: before putting any board/grid-shaped game state into a Firestore write, check whether it's actually array-of-arrays. If so, either flatten it into an array of `{pos:{x,y}, ...}` objects (already the project convention — see `posKey(x,y)` in `expeditionGrid.js`) or strip it before the write and reconstruct from the flat form on read, whichever the consumer actually needs.

## Front/Rear Initial Role Selection (Pre-Battle) vs Mid-Battle Auto-Promotion

Two independent mechanisms, do not conflate them:

- **Pre-battle selection** (new): `setTeamExpeditionMemberRole()` (`expeditionTeamDb.js`) and `setPartyMemberRole()` (`partyDb.js`) let each member pick their own starting `role` in the waiting room, each a Firestore transaction capped at 4 per role. This only sets the *initial* `role` before the battle room is created.
- **Mid-battle auto-promotion** (existing, untouched): when a front-line member's HP hits 0, the server flips their `role` to `"rear"` and revives them at 50% HP. For Party mode this lives in `partyDb.js::processPartyRound` (~line 508-518); the dungeon equivalent is the `revival_front` shop/rest handler documented above (`handleResolve — revival_front target`).
- Never let a "pre-battle role picker" feature touch the mid-battle promotion logic, and never assume `role` is static for the whole battle — it changes dynamically regardless of what was picked at the start.

## Expedition Battle Presentation

- The persisted `monster.variant` is the only source for the entry glow, battle badge, combat stats, and result label. Never infer a variant from room type or use a hard-coded red entry glow.
- Every expedition battle must visibly label `weak`, `normal`, `strong`, or `boss` as 弱化、普通、強悍、BOSS.
- If a generated monster queue is exhausted, the fallback variant still follows the floor contract: floor 1 weak, floor 2 normal, floor 3 strong.
- The completed/result branch must not render while the kill overlay is active.
- Flatten the equipped cat into expedition member data (`catId`, `catName`, `catAtk`) before creating solo or team battle rooms. Cat attack rounds read these persisted fields, not the current client's profile.
- Treasure-room card rewards must be generated from a real monster descriptor with a stable ID and name. Play reveal audio from the user-triggered flip action.
