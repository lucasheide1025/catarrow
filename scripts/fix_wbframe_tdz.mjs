// Fix myWbFrame declared before myCardColl TDZ error
import fs from 'fs';

const filePath = 'src/components/dungeon/DungeonBattleRoom.jsx';
let c = fs.readFileSync(filePath, 'utf8');
const lines = c.split('\n');

// Find myWbFrame and myCardColl line indices
let wbFrameStart = -1, wbFrameEnd = -1;
let cardCollState = -1, cardCollEnd = -1;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('// 從已裝備的世界王卡計算邊框顏色與稱號')) {
    wbFrameStart = i;
  }
  if (wbFrameStart >= 0 && wbFrameEnd < 0 && l.includes('})();')) {
    wbFrameEnd = i + 1; // include the empty line after
  }
  // Find "const [myCardColl, setMyCardColl] = useState" line
  if (l.includes('const [myCardColl, setMyCardColl]')) {
    cardCollState = i;
  }
  if (cardCollState >= 0 && cardCollEnd < 0 && l.includes('  }, [myId, isGuestMode]);')) {
    cardCollEnd = i + 1; // after the useEffect closes, plus the blank line
    // Check if next line is blank, skip it
    if (i + 1 < lines.length && lines[i + 1].trim() === '') {
      cardCollEnd = i + 2;
    }
  }
}

console.log(`wbFrameStart: ${wbFrameStart}, wbFrameEnd: ${wbFrameEnd}`);
console.log(`cardCollState: ${cardCollState}, cardCollEnd: ${cardCollEnd}`);

if (wbFrameStart >= 0 && wbFrameEnd >= 0 && cardCollEnd >= 0) {
  // Extract the myWbFrame block
  const wbBlockLines = lines.slice(wbFrameStart, wbFrameEnd);
  console.log('wbBlock:', wbBlockLines.map((l, i) => `${i}: ${l.trim()}`).join('\n'));
  
  // Remove it from current position
  const linesBeforeWb = lines.slice(0, wbFrameStart);
  const linesAfterWb = lines.slice(wbFrameEnd);
  
  // The myWbFrame block is between the potions useEffect and cardCollection useEffect
  // After removing it, we need to reconstruct
  let newLines = lines.slice(0, wbFrameStart - 1); // also remove the blank line before comment
  // Ensure there's a blank line after potions useEffect  
  if (newLines[newLines.length - 1].trim() !== '') {
    // last line is the useEffect closing
  }
  newLines.push(''); // blank line
  // Add the cardCollection state and useEffect
  newLines = newLines.concat(lines.slice(wbFrameStart + wbBlockLines.length, cardCollEnd));
  // Now add the wbBlock after cardCollEnd
  newLines = newLines.concat(wbBlockLines);
  // Add the rest of the file
  newLines = newLines.concat(lines.slice(cardCollEnd));
  
  // But wait, this might create duplicates or missing sections. Let me be more careful.
  // The current structure is:
  //   ... potions useEffect
  //   blank
  //   wbFrame comment + IIFE
  //   blank
  //   ── 訂閱卡片收藏 comment
  //   const [myCardColl, ...]
  //   useEffect for cardColl
  //   blank
  //   ── 各自領取按鈕 comment
  //   blank
  //   ── 重整後同步 comment
  //   ...
  
  // We want:
  //   ... potions useEffect
  //   blank
  //   ── 訂閱卡片收藏 comment
  //   const [myCardColl, ...]
  //   useEffect for cardColl
  //   blank
  //   wbFrame comment + IIFE
  //   blank
  //   ── 各自領取按鈕 comment
  //   ...
  
  // The cardColl section starts at wbFrameEnd (the line after myWbFrame IIFE)
  // which is the blank line and then ── 訂閱卡片收藏
  
  // Rethink: let's just find and swap
  // The section from wbFrameStart to wbFrameEnd-1 is the myWbFrame block
  // The section from wbFrameEnd to cardCollEnd-1 is the cardCollection block (including blank line)
  
  // Actually, let me try a simpler approach: remove wbBlock, then insert at cardCollEnd
  const finalLines = [...lines];
  // Remove wbBlock (from wbFrameStart to wbFrameEnd)
  finalLines.splice(wbFrameStart, wbFrameEnd - wbFrameStart);
  // Now adjust insertion point (shifted because we removed lines)
  const insertAt = cardCollEnd - (wbFrameEnd - wbFrameStart);
  // Insert wbBlock at insertAt
  finalLines.splice(insertAt - wbBlockLines.length, 0, ...wbBlockLines);
  
  // But this could mess up. Let me try a different approach entirely:
  // Just rewrite lines 405-422 from the header comment to exactly what we want
  
  // Find the exact sections
  const cardCommStart = lines.findIndex((l, i) => i > cardCollState && l.includes('// ── 訂閱卡片收藏'));
  console.log('cardCommStart:', cardCommStart);
  
  const claimCommStart = lines.findIndex((l, i) => i > cardCollEnd && l.includes('// ── 各自領取按鈕'));
  console.log('claimCommStart:', claimCommStart);
  
  // OK let's try the simpler splice approach
  // First, find the exact positions
  let potEnd = -1;
  for (let i = cardCollState - 1; i >= 0; i--) {
    if (lines[i].includes('}, [myId, isGuestMode]);')) {
      potEnd = i;
      break;
    }
  }
  console.log('potEnd:', potEnd);
  
  // Remove myWbFrame block (from potEnd+2 to cardCommStart-1)  
  // Structure: potEnd ... blank ... wbFrame comment+IIFE ... blank ... cardCommStart comment
  const removeStart = potEnd + 2; // after useEffect + blank
  const removeEnd = cardCommStart; // the cardCommStart comment itself
  console.log(`Removing lines ${removeStart} to ${removeEnd-1}`);
  console.log('Content to remove:', lines.slice(removeStart, removeEnd).map(l => l.trim()).join(' | '));
  
  // Now remove and re-insert after cardCollEnd
  const removedBlock = lines.splice(removeStart, removeEnd - removeStart);
  
  // Now adjust cardCollEnd since we removed lines
  const adjustedCardCollEnd = cardCollEnd - removedBlock.length;
  
  // Remove blank line before insert
  let insertPos = adjustedCardCollEnd;
  // Skip any blank lines at insertPos
  // The structure at insertPos should be: was cardCollEnd = }], [myId, ...]); + blank
  // After removal, it's probably just }], [myId, ...]); + blank
  if (insertPos < finalLines.length && finalLines[insertPos].trim() === '') {
    insertPos++;
  }
  // Now the next line should be ── 各自領取
  // Insert wbBlock before that
  console.log(`Inserting at line ${insertPos}, content:`, finalLines.slice(insertPos, insertPos + 2).map(l => l.trim()));
  
  // Add a blank line before the block
  finalLines.splice(insertPos, 0, '', ...removedBlock);
  
  fs.writeFileSync(filePath, finalLines.join('\n'), 'utf8');
  console.log('✅ myWbFrame successfully moved after myCardColl');
} else {
  console.log('❌ Could not find required positions');
}
