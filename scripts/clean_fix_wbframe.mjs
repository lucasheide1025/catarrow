import fs from 'fs';

const filePath = 'src/components/dungeon/DungeonBattleRoom.jsx';
let c = fs.readFileSync(filePath, 'utf8');
let lines = c.split('\n');

// Find the problematic section
const line390 = lines[389]; // line 390 (0-indexed = file line 390)
console.log('Line 390:', line390);

// Fix 1: Restore the potions useEffect by removing myWbFrame from it
// Current (lines 399-413):
//   useEffect(() => {
//     if (!myId || isGuestMode) return;
//     const unsub = subscribePotions(myId, setPotionInv);
//   // 從已裝備的世界王卡計算邊框顏色與稱號（用於玩家小卡）
//   const myWbFrame = ...
//     return unsub;
//   }, [myId, isGuestMode]);

// Target:
//   useEffect(() => {
//     if (!myId || isGuestMode) return;
//     const unsub = subscribePotions(myId, setPotionInv);
//     return unsub;
//   }, [myId, isGuestMode]);

// Find the useEffect starting at line 399
const potStart = lines.findIndex((l, i) => i >= 397 && l.trim() === 'useEffect(() => {');
console.log('potStart:', potStart + 1);

// Find the wbFrame comment line
const wbCommentLine = lines.findIndex((l, i) => i >= potStart && l.includes('從已裝備的世界王卡計算邊框顏色與稱號'));
console.log('wbCommentLine:', wbCommentLine + 1);

// Find the return unsub line (the one at the current indentation level of the useEffect)
const returnUnsubLine = lines.findIndex((l, i) => i >= wbCommentLine && l.trim() === 'return unsub;');
console.log('returnUnsubLine:', returnUnsubLine + 1);

// Find the useEffect close
const closeBrace = lines.findIndex((l, i) => i >= returnUnsubLine && l.trim() === '}, [myId, isGuestMode]);');
console.log('closeBrace:', closeBrace + 1);

// Extract the myWbFrame block (from wbCommentLine to returnUnsubLine - 1)
const wbBlock = lines.slice(wbCommentLine, returnUnsubLine);
console.log('wbBlock to move:', wbBlock.map(l => l.trim()).join(' | '));

// Remove the wbBlock lines
lines.splice(wbCommentLine, returnUnsubLine - wbCommentLine);

// Now the returnUnsub line has shifted up. Add proper indentation before it.
// Find the return unsub line again
const newReturnUnsub = lines.findIndex((l, i) => i >= potStart && l.trim() === 'return unsub;');
console.log('newReturnUnsub:', newReturnUnsub + 1);
// Fix its indentation to match useEffect body
lines[newReturnUnsub] = '    return unsub;';

// Now find where the cardCollection useEffect ends
const cardCollEnd = lines.findIndex((l, i) => i > newReturnUnsub && l.trim() === '}, [myId, isGuestMode];');
console.log('cardCollEnd (after)', cardCollEnd + 1, ':', lines[cardCollEnd]);
// Look for the actual closing line
const actualCardCollEnd = lines.findIndex((l, i) => i > newReturnUnsub && l.includes('}, [myId, isGuestMode])') && !l.includes('potions'));
console.log('actualCardCollEnd:', actualCardCollEnd + 1, ':', lines[actualCardCollEnd]);
const realCardCollEnd = actualCardCollEnd >= 0 ? actualCardCollEnd : cardCollEnd;

// Insert wbBlock after cardCollection useEffect ends (+1 for the blank line after it)
const insertAt = realCardCollEnd + 2; // after }, [myId, isGuestMode]); + blank line
console.log('Inserting at line:', insertAt + 1);
console.log('Current content at insert point:', lines.slice(insertAt - 1, insertAt + 2).join(' | '));

// Add a blank line before the block
lines.splice(insertAt, 0, '', ...wbBlock);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('✅ Fix applied successfully');
