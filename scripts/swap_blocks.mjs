// Direct fix: swap myWbFrame block with myCardColl block
import fs from 'fs';
const c = fs.readFileSync('src/components/dungeon/DungeonBattleRoom.jsx', 'utf8');
const lines = c.split(/\r?\n/);

// Lines 407-415: myWbFrame block (8 lines including comment)
// Lines 416-421: myCardColl block (6 lines)
// Need to swap so cardColl comes first

const wbBlock = lines.slice(406, 416); // lines 407-415 (0-indexed)
const cardBlock = lines.slice(416, 422); // lines 416-421 (0-indexed)

console.log('wbBlock lines 407-415 count:', wbBlock.length);
console.log('cardBlock lines 416-421 count:', cardBlock.length);

// Replace positions
const newLines = [...lines];
newLines.splice(406, 16, ...cardBlock, ...wbBlock);

fs.writeFileSync('src/components/dungeon/DungeonBattleRoom.jsx', newLines.join('\n'), 'utf8');
console.log('✅ Swapped blocks successfully');
