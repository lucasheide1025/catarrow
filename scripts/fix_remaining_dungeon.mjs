// Fix remaining Bug 1b and Bug 2/3 changes in DungeonBattleRoom.jsx
// Run after fix_dungeon_battle_room.mjs
import { readFileSync, writeFileSync } from 'fs';

const path = 'src/components/dungeon/DungeonBattleRoom.jsx';
let c = readFileSync(path, 'utf8');
let changed = false;

// Step 1: Find isHost/me/status and add myLevel after them
const mePattern = `  const me     = room?.members?.[myId] || {};
  const status = room?.status;`;
const meReplacement = `  const me     = room?.members?.[myId] || {};
  const status = room?.status;
  const myLevel = !isGuestMode && profile?.archerXP ? (() => {
    // Dynamic import for archerLevelFromXP - avoid top-level dependency
    const { archerLevelFromXP } = require("../../lib/archerLevel");
    return archerLevelFromXP(profile.archerXP);
  })() : (me?.level || 1);`;

// Actually, for a React component we should avoid require().
// Let me use a different approach - compute it with the import already added.
const meBetterReplacement = `  const me     = room?.members?.[myId] || {};
  const status = room?.status;
  const myLevel = !isGuestMode && profile?.archerXP !== undefined ? archerLevelFromXP(profile.archerXP) : (me?.level || 1);`;

// But the import was already added - check
if (c.includes('archerLevelFromXP, archerLevelFromXP')) {
  // Duplication, fix it
  c = c.replace('archerLevelFromXP, archerLevelFromXP', 'archerLevelFromXP');
}

if (c.includes(mePattern) && !c.includes('myLevel')) {
  c = c.replace(mePattern, meBetterReplacement);
  console.log("✅ Added myLevel computation after me/status");
  changed = true;
} else {
  const idx = c.indexOf("const status = room?.status;");
  if (idx >= 0 && c.indexOf("const myLevel", idx) < 0) {
    // Found status but no myLevel after it
    const after = c.substring(idx + "const status = room?.status;".length);
    const insertionIdx = idx + "const status = room?.status;".length;
    c = c.substring(0, idx) + `const status = room?.status;\n  const myLevel = !isGuestMode && profile?.archerXP !== undefined ? archerLevelFromXP(profile?.archerXP || 0) : (me?.level || 1);\n  ` + c.substring(idx);
    console.log("✅ Added myLevel computation (alternative method)");
    changed = true;
  } else {
    console.log("❌ Could not find me/status pattern");
    console.log("mePattern found:", c.includes(mePattern));
    const sidx = c.indexOf("const status = room");
    if (sidx >= 0) console.log("Status found at:", sidx, ":", c.substring(sidx, sidx + 60));
  }
}

// Step 2: Add myWbFrame after the cardCollection subscription
// The cardCollection subscription starts with:
//   const [myCardColl, setMyCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });
// Followed by the useEffect
const cardCollEnd = `  }, [myId, isGuestMode]);

  // ── 各自領取按鈕已取代此自動存檔（handleClaimSelf 處理所有獎勵）`;
  
const wbFrameInsert = `  }, [myId, isGuestMode]);
  // 從已裝備的世界王卡計算邊框顏色與稱號（用於玩家小卡）
  const myWbFrame = (() => {
    const wbCard = (myCardColl?.equipped || []).find(e => e?.source === "wb");
    if (!wbCard) return null;
    const def = WB_CARDS[wbCard.bossKey];
    return {
      color: def?.frameColor || "#f5b942",
      title: def?.title || def?.name || "世界王卡",
    };
  })();

  // ── 各自領取按鈕已取代此自動存檔（handleClaimSelf 處理所有獎勵）`;

if (c.includes(cardCollEnd) && !c.includes('myWbFrame')) {
  c = c.replace(cardCollEnd, wbFrameInsert);
  console.log("✅ Added myWbFrame computation after cardCollection");
  changed = true;
} else {
  const idx = c.indexOf("各自領取按鈕已取代");
  if (idx >= 0) {
    console.log("Found anchor at:", idx);
    console.log("Context:", c.substring(idx - 80, idx + 80));
  }
  console.log("myWbFrame already present:", c.includes('myWbFrame'));
}

// Step 3: Update cardBorder in mini-card section
// Find the section where cardBorder is computed in the mini-card row
const cardBorderPatternSrc = `            const cardBorder = isMe`;
const idx = c.indexOf(cardBorderPatternSrc);
if (idx >= 0) {
  // Find where the cardBorder variable ends (the semicolon after "rgba(255,255,255,0.07)")
  const endPattern = 'rgba(255,255,255,0.07)";';
  const endIdx = c.indexOf(endPattern, idx);
  if (endIdx >= 0) {
    const oldSection = c.substring(idx, endIdx + endPattern.length);
    
    // Check if it already has mWbFrame
    if (oldSection.includes('mWbFrame')) {
      console.log("✅ cardBorder already has wbFrame support");
    } else {
      // Create new cardBorder with wbFrame support
      const newSection = oldSection.replace(
        `const cardBorder = isMe
              ? "rgba(251,191,36,0.45)"`,
        `const mWbFrame = isMe ? myWbFrame : (m.battleCosmetics?.wbFrame || null);
            const cardBorder = isMe
              ? (mWbFrame ? mWbFrame.color + "99" : "rgba(251,191,36,0.45)")`
      ).replace(
        `: isRearInFront || isViewingRear
              ? "rgba(168,85,247,0.45)"`,
        `: isRearInFront || isViewingRear
              ? (mWbFrame ? mWbFrame.color + "99" : "rgba(168,85,247,0.45)")`
      ).replace(
        `: myDisplayGroup === "rear"
              ? "rgba(20,184,166,0.4)"`,
        `: myDisplayGroup === "rear"
              ? (mWbFrame ? mWbFrame.color + "99" : "rgba(20,184,166,0.4)")`
      ).replace(
        `: "rgba(255,255,255,0.07)";`,
        `: mWbFrame
              ? mWbFrame.color + "77"
              : "rgba(255,255,255,0.07)";`
      );
      
      if (oldSection !== newSection) {
        c = c.replace(oldSection, newSection);
        console.log("✅ Updated mini-card cardBorder with wbFrame color");
        changed = true;
      } else {
        console.log("❌ Old section and new section are the same - replacement might have an issue");
        console.log("Old:", oldSection.substring(0, 100));
      }
    }
  } else {
    console.log("❌ Could not find cardBorder end pattern");
  }
} else {
  console.log("❌ Could not find cardBorder in mini-card section");
}

if (changed) {
  writeFileSync(path, c, 'utf8');
  console.log("\n✅ All remaining fixes applied");
} else {
  console.log("\n⚠️ No changes needed or no changes could be applied");
}
