// Fix Bug 1b (level) and Bug 2/3 (wbFrame) in DungeonBattleRoom.jsx
import { readFileSync, writeFileSync } from 'fs';

const path = 'src/components/dungeon/DungeonBattleRoom.jsx';
let c = readFileSync(path, 'utf8');

// Step 1: Add archerLevel import
const importLine = `import { DUNGEON_FLOOR_XP, MONSTER_TIER_XP } from "../../lib/archerLevel";`;
const newImportLine = `import { DUNGEON_FLOOR_XP, MONSTER_TIER_XP, archerLevelFromXP } from "../../lib/archerLevel";`;

if (c.includes(importLine)) {
  c = c.replace(importLine, newImportLine);
  console.log("✅ Added archerLevelFromXP import");
} else {
  console.log("❌ Could not find archerLevel import line");
  // Check what's actually there
  const idx = c.indexOf("DUNGEON_FLOOR_XP");
  if (idx >= 0) console.log("Found at", idx, ":", c.substring(idx, idx + 80));
}

// Step 2: Add wbFrame import
const wbImportLine = `import WorldBossCardBadge from "../shared/WorldBossCardBadge";`;
const newWbImportLine = `import WorldBossCardBadge from "../shared/WorldBossCardBadge";
import { WB_CARDS } from "../../lib/worldBossCards";`;

if (c.includes(wbImportLine) && !c.includes("WB_CARDS")) {
  c = c.replace(wbImportLine, newWbImportLine);
  console.log("✅ Added WB_CARDS import");
}

// Step 3: Compute myLevel from archerXP
// After `const isHost = room?.hostId === myId;`
// Add level computation
const levelAnchor = `  const isHost = room?.hostId === myId;
  const me     = room?.members?.[myId] || {};`;
const levelAnchorNew = `  const isHost = room?.hostId === myId;
  const me     = room?.members?.[myId] || {};
  const myLevel = !isGuestMode && profile?.archerXP ? archerLevelFromXP(profile.archerXP) : (me?.level || 1);`;

if (c.includes(levelAnchor)) {
  c = c.replace(levelAnchor, levelAnchorNew);
  console.log("✅ Added myLevel computation");
} else {
  console.log("❌ Could not find level anchor");
}

// Step 4: Compute wbFrame from myCardColl
// After the cardCollection subscription effect
// Add computation of wbFrameTitle and wbFrameColor
const wbComputeAnchor = `  // ── 訂閱卡片收藏（只用來顯示世界王卡徽章，純視覺）───────────
  const [myCardColl, setMyCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });`;
const wbComputeNew = `  // ── 訂閱卡片收藏（只用來顯示世界王卡徽章，純視覺）───────────
  const [myCardColl, setMyCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });
  // 從已裝備的世界王卡計算邊框顏色與稱號
  const myWbFrame = (() => {
    const wbCard = (myCardColl?.equipped || []).find(e => e?.source === "wb");
    if (!wbCard) return null;
    const cardDef = WB_CARDS[wbCard.bossKey];
    return {
      color: cardDef?.frameColor || "#f5b942",
      title: cardDef?.title || cardDef?.name || "世界王卡",
    };
  })();`;

if (c.includes(wbComputeAnchor)) {
  c = c.replace(wbComputeAnchor, wbComputeNew);
  console.log("✅ Added wbFrame computation");
} else {
  console.log("❌ Could not find wbFrame anchor");
}

// Step 5: Pass lv and battleCosmetics to BattleScreen player prop
// Find the BattleScreen player prop and add lv and battleCosmetics
const playerLvOld = `          lv: me?.level || 1,`;
const playerLvNew = `          lv: myLevel,
          battleCosmetics: { wbFrame: myWbFrame },`;

if (c.includes(playerLvOld)) {
  c = c.replace(playerLvOld, playerLvNew);
  console.log("✅ Updated player lv and added battleCosmetics");
} else {
  console.log("❌ Could not find player lv");
}

// Step 6: Add battleCosmetics to allies
// The allies prop has each member without battleCosmetics
const alliesOld = `allies={memberList.filter(member => member.id !== myId).map(member => ({ id:member.id, name:member.name, catId:member.catId || "diandian", catName:member.catName, hp:member.hp || 0, maxHp:member.maxHP || 1, maxHP:member.maxHP || 1, atk:member.atk || 0, def:member.def || 0, ready:!!member.ready, done:!!member.ready, alive:member.alive !== false, role:member.role || "front", isFront:(member.role || "front") === "front" }))}`;
const alliesNew = `allies={memberList.filter(member => member.id !== myId).map(member => ({ id:member.id, name:member.name, catId:member.catId || "diandian", catName:member.catName, hp:member.hp || 0, maxHp:member.maxHP || 1, maxHP:member.maxHP || 1, atk:member.atk || 0, def:member.def || 0, ready:!!member.ready, done:!!member.ready, alive:member.alive !== false, role:member.role || "front", isFront:(member.role || "front") === "front", battleCosmetics: member.battleCosmetics || null }))}`;

if (c.includes(alliesOld)) {
  c = c.replace(alliesOld, alliesNew);
  console.log("✅ Added battleCosmetics to allies");
} else {
  console.log("❌ Could not find allies prop line");
  // Try to find it with pattern
  const idx = c.indexOf("allies={memberList.filter");
  if (idx >= 0) {
    const end = c.indexOf(")}", idx) + 2;
    console.log("Found allies at", idx, ":", c.substring(idx, end).substring(0, 200));
  }
}

// Step 7: Use wbFrame for mini-card border in the non-BattleScreen section
// Find the cardBorder assignment in the mini-card section
// The mini-card section has: const cardBorder = isMe ? "rgba(251,191,36,0.45)" : ...
// We need to add wbFrame color to it
const cardBorderOld = `            const cardBorder = isMe
              ? "rgba(251,191,36,0.45)"
              : isRearInFront || isViewingRear
              ? "rgba(168,85,247,0.45)"
              : myDisplayGroup === "rear"
              ? "rgba(20,184,166,0.4)"
              : "rgba(255,255,255,0.07)";`;
const cardBorderNew = `            const mWbFrame = isMe ? myWbFrame : (m.battleCosmetics?.wbFrame || null);
            const cardBorder = isMe
              ? (mWbFrame ? \`\${mWbFrame.color}99\` : "rgba(251,191,36,0.45)")
              : isRearInFront || isViewingRear
              ? (mWbFrame ? \`\${mWbFrame.color}99\` : "rgba(168,85,247,0.45)")
              : myDisplayGroup === "rear"
              ? (mWbFrame ? \`\${mWbFrame.color}99\` : "rgba(20,184,166,0.4)")
              : mWbFrame
              ? \`\${mWbFrame.color}77\`
              : "rgba(255,255,255,0.07)";`;

if (c.includes(cardBorderOld)) {
  c = c.replace(cardBorderOld, cardBorderNew);
  console.log("✅ Updated mini-card borders with wbFrame color");
} else {
  console.log("❌ Could not find cardBorder in mini-card section");
  // Try fuzzy match
  const idx = c.indexOf("const cardBorder = isMe");
  if (idx >= 0) {
    console.log("Found cardBorder at", idx);
    const end = c.indexOf(";", c.indexOf("rgba(255,255,255,0.07)", idx));
    console.log("Content:", c.substring(idx, end + 1));
  }
}

writeFileSync(path, c, 'utf8');
console.log("\n✅ All DungeonBattleRoom fixes written");
