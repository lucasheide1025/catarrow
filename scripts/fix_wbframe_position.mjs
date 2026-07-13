// Fix: Move myWbFrame declaration after myCardColl + useEffect
import { readFileSync, writeFileSync } from 'fs';

const path = 'src/components/dungeon/DungeonBattleRoom.jsx';
let c = readFileSync(path, 'utf8');

// The misplaced myWbFrame block is DIRECTLY before the cardCollection subscription:
//
//   // 從已裝備的世界王卡計算邊框顏色與稱號（用於玩家小卡）
//   const myWbFrame = ...    <-- this needs to go AFTER
//
//   // ── 訂閱卡片收藏（只用來顯示世界王卡徽章，純視覺）───────────
//   const [myCardColl, setMyCardColl] = useState({ cards: {}, wbCards: {}, equipped: [] });
//   useEffect(() => { ... }, [myId, isGuestMode]);   <-- after this line
//
// Strategy: remove the 4 lines that are myWbFrame, then insert them after the useEffect

// Find the misplaced block start
const startMarker = '  // 從已裝備的世界王卡計算邊框顏色與稱號（用於玩家小卡）';
const blockStart = c.indexOf(startMarker);
if (blockStart < 0) {
  console.log('❌ misplaced wbFrame block not found');
  process.exit(1);
}

// The block spans until the line before the cardCollection comment
// Find the cardCollection comment
const cardCollComment = '  // ── 訂閱卡片收藏（只用來顯示世界王卡徽章，純視覺）───────────';
const cardCollStart = c.indexOf(cardCollComment, blockStart);
if (cardCollStart < 0) {
  console.log('❌ cardCollection comment not found after block');
  process.exit(1);
}

// The misplaced block is from blockStart to cardCollStart (exclusive)
const misplacedBlock = c.substring(blockStart, cardCollStart);
console.log('Misplaced block length:', misplacedBlock.length);
console.log('Removing:', JSON.stringify(misplacedBlock.substring(0, 50)) + '...');

// Remove the misplaced block
c = c.substring(0, blockStart) + c.substring(cardCollStart);

// Now find the end of the cardCollection useEffect
const useEffectEnd = `  }, [myId, isGuestMode]);`;
const effectEndIdx = c.indexOf(useEffectEnd);
if (effectEndIdx < 0) {
  console.log('❌ useEffect end not found');
  process.exit(1);
}

// Find the end of this line
const lineEndIdx = c.indexOf('\n', effectEndIdx);
if (lineEndIdx < 0) {
  console.log('❌ line end not found');
  process.exit(1);
}

// The block to insert (reconstruct it without the leading blank line)
const insertionBlock = `  // 從已裝備的世界王卡計算邊框顏色與稱號（用於玩家小卡）
  const myWbFrame = (() => {
    const wbCard = (myCardColl?.equipped || []).find(e => e?.source === "wb");
    if (!wbCard) return null;
    const def = WB_CARDS[wbCard.bossKey];
    return {
      color: def?.frameColor || "#f5b942",
      title: def?.title || def?.name || "世界王卡",
    };
  })();

`;

// Insert after the useEffect line break
c = c.substring(0, lineEndIdx + 1) + insertionBlock + c.substring(lineEndIdx + 1);

// Verify ordering
const firstWb = c.indexOf('const myWbFrame');
const firstCc = c.indexOf('const [myCardColl');
console.log('myWbFrame at:', firstWb);
console.log('myCardColl at:', firstCc);
console.log('✅ Order correct:', firstWb > firstCc);

writeFileSync(path, c, 'utf8');
console.log('✅ myWbFrame moved to correct position');
