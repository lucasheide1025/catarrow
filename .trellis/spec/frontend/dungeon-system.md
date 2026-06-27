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
