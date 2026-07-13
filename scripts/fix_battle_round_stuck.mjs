// Bug 1a: Add partyRound reset effect in BattleScreen.jsx
import { readFileSync, writeFileSync } from 'fs';

const path = 'src/components/battle/BattleScreen.jsx';
let content = readFileSync(path, 'utf8');

const oldBlock = `  // 组队回合由房间状态主导。新回合到来时只清空本机计分，不能重置房间战斗。
  useEffect(()=>{
  // ─── 计分模式（PartyBattleRoom 等外部元件用）───
  });`;

const newBlock = `  // 组队回合由房间状态主导。新回合到来时强制重置内部计分状态
  // NEXT_ROUND 只清空箭矢/伤害/phase，不 reset 整个战斗。
  useEffect(()=>{
    if(!partyMode || !partyRound) return;
    dispatch({type:"NEXT_ROUND"});
  },[partyMode, partyRound]);

  // ─── 计分模式（PartyBattleRoom 等外部元件用）───`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  writeFileSync(path, content, 'utf8');
  console.log("✅ Bug 1a fixed: Added partyRound reset effect");
} else {
  console.log("❌ Could not find target block");
  // search for it
  const idx = content.indexOf("组队回合由房间");
  if (idx >= 0) {
    console.log("Found at", idx, ":", content.substring(idx, idx + 200));
  }
}
