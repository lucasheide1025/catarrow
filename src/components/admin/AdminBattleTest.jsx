// src/components/admin/AdminBattleTest.jsx
// 教練後台 — 戰鬥模擬器 — 使用 BattleScreen 元件

import { useState, useMemo, useRef, useEffect } from "react";
import MonsterSVG from "../MonsterSVG";
import CatSVG from "../cat/CatSVG";
import { MONSTERS as ALL_MONSTERS } from "../../lib/monsterData";
import { CATS, CAT_IDS, CAT_TYPE_MAP, CAT_SKILL_GROUPS } from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
import { POTIONS } from "../../lib/itemData";
import BattleSoundIndicator from "../shared/BattleSoundIndicator";
import BattleScreen from "../battle/BattleScreen";

function getRealMonster(id) { return ALL_MONSTERS.find(m => m.id === id); }
const FAMILY_COLORS = { ghost:"#6366f1", mountain:"#16a34a", insect:"#ca8a04", workplace:"#dc2626", exam:"#7c3aed", temple:"#ea580c" };
const PICKED_IDS = ["ghost_6","mountain_5","insect_5","temple_6","workplace_6","exam_6"];
const MONSTERS = PICKED_IDS.map(id => {
  const m = getRealMonster(id);
  return { id, name: m.name, family: m.family, hp: m.hp, atk: m.atk, def: m.def, tier: m.tier, color: FAMILY_COLORS[m.family] || "#888" };
});
const DIFF_MULTS = [
  { id:"normal",    label:"普通",  color:"#4ade80", hp:1.0,  atk:1.0,  def:1.0  },
  { id:"hard",      label:"困難",  color:"#fbbf24", hp:1.5,  atk:1.25, def:1.15 },
  { id:"nightmare", label:"惡夢",  color:"#fca5a5", hp:2.2,  atk:1.5,  def:1.35 },
];
const MATE_DATA = [
  { catId:"daming",  name:"大娘",  atk:180, def:120, hp:3200, maxHp:3200, isFront:true,  done:true  },
  { catId:"gege",    name:"哥哥",  atk:150, def:130, hp:2800, maxHp:2800, isFront:true,  done:false },
  { catId:"meimei",  name:"妹妹",  atk:200, def:90,  hp:2400, maxHp:2400, isFront:false, done:true  },
  { catId:"niuniu",  name:"妞妞",  atk:210, def:80,  hp:2200, maxHp:2200, isFront:false, done:false },
  { catId:"haji",    name:"哈吉",  atk:140, def:140, hp:3000, maxHp:3000, isFront:true,  done:true  },
  { catId:"baobao",  name:"寶寶",  atk:190, def:100, hp:2600, maxHp:2600, isFront:false, done:true  },
  { catId:"youyou",  name:"悠悠",  atk:160, def:150, hp:3400, maxHp:3400, isFront:false, done:true  },
  { catId:"xiaoan",  name:"小安",  atk:130, def:160, hp:3600, maxHp:3600, isFront:true,  done:true  },
];
const SELF = { catId:"diandian", name:"顛顛", lv:42, atk:275, def:165, hp:3180, maxHp:3180 };
const TEST_POTIONS = [
  POTIONS.find(p => p.id === "carry_heal_basic"),
  POTIONS.find(p => p.id === "carry_heal_advanced"),
  POTIONS.find(p => p.id === "carry_power_basic"),
  POTIONS.find(p => p.id === "carry_power_advanced"),
  POTIONS.find(p => p.id === "carry_guard_basic"),
  POTIONS.find(p => p.id === "carry_guard_advanced"),
  POTIONS.find(p => p.id === "carry_shield_basic"),
  POTIONS.find(p => p.id === "carry_regen_basic"),
  POTIONS.find(p => p.id === "carry_berserk_basic"),
  POTIONS.find(p => p.id === "throw_knife"),
  POTIONS.find(p => p.id === "throw_bomb"),
  POTIONS.find(p => p.id === "throw_weaken"),
  POTIONS.find(p => p.id === "throw_armor_break"),
  POTIONS.find(p => p.id === "throw_paralyze"),
  POTIONS.find(p => p.id === "throw_smoke"),
  POTIONS.find(p => p.id === "throw_corrosion"),
].filter(Boolean);
const CARRY_TEST = TEST_POTIONS.filter(p => p.kind === 'carry');
const THROW_TEST = TEST_POTIONS.filter(p => p.kind === 'throw');
const ARROWS_PER_ROUND = 6;

export default function AdminBattleTest() {
  const [mIdx, setMIdx] = useState(0);
  const [dIdx, setDIdx] = useState(2);
  const [playerCount, setPlayerCount] = useState(1);
  const [showCtl, setShowCtl] = useState(true);
  const [battleMode, setBattleMode] = useState("score");
  const [scoreInput, setScoreInput] = useState("keypad");
  const [cardFrame, setCardFrame] = useState("none");
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [battleActive, setBattleActive] = useState(false);
  const [battleResult, setBattleResult] = useState(null);

  const battleRef = useRef(null);
  const mon  = MONSTERS[mIdx];
  const diff = DIFF_MULTS[dIdx];
  const bgUrl = '/ui/battle-bg/bg_' + mon.family + '_' + ((mIdx % 6) + 1) + '.webp';
  const hasCat = !!selectedCatId;
  const catName = hasCat ? (CATS[selectedCatId]?.name || '') : '';
  const catType = hasCat ? (CAT_TYPE_MAP[selectedCatId] || 'allround') : 'allround';
  const skillGroup = hasCat ? (CAT_SKILL_GROUPS[selectedCatId] || 'heal') : 'heal';
  const catCombatStats = useMemo(() => hasCat ? calcCatCombatStats({ catId: selectedCatId, catXP: 5000, bond: 50, type: catType }) : null, [hasCat, selectedCatId, catType]);
  const catMaxHP = hasCat ? (catCombatStats?.catHP || 300) : 300;
  const catATK = hasCat ? (catCombatStats?.catATK || 25) : 25;
  const catDEF = hasCat ? (catCombatStats?.catDEF || 12) : 12;
  const catBondLv = hasCat ? (catCombatStats?.bondLv || 0) : 0;
  const catLevel = hasCat ? (catCombatStats?.catLevel || 1) : 1;
  const catTypeLabel = hasCat ? (catType === 'heal' ? '治癒型' : catType === 'atk' ? '攻擊型' : '防禦型') : '';
  const catGlowColor = skillGroup === 'heal' ? '#10b981' : skillGroup === 'atk' ? '#ef4444' : '#a78bfa';

  const team = useMemo(() => {
    const cnt = Math.max(1, Math.min(playerCount - 1, MATE_DATA.length));
    return MATE_DATA.slice(0, cnt);
  }, [playerCount]);

  const player = useMemo(() => ({ ...SELF, cardFrame }), [cardFrame]);
  const allies = useMemo(() => team.map(m => ({
    catId: m.catId, name: m.name, atk: m.atk, def: m.def,
    hp: m.hp, maxHp: m.maxHp, role: m.isFront ? 'front' : 'rear', done: m.done,
  })), [team]);
  const catProp = useMemo(() => selectedCatId ? {
    catId: selectedCatId, catName, type: catType, catXP: 5000, bond: 50,
  } : null, [selectedCatId, catName, catType]);
  const potions = useMemo(() => [...CARRY_TEST, ...THROW_TEST], []);

  function handleStartBattle() {
    setBattleActive(true);
    setBattleResult(null);
  }
  useEffect(() => {
    if (battleActive && battleRef.current) { battleRef.current.startBattle(); }
  }, [battleActive]);
  function handleBattleEnd(result) { setBattleResult(result); }
  function handleReset() { setBattleActive(false); setBattleResult(null); }

  const btnStyle = { display:'flex',alignItems:'center',gap:8, border:'1px solid rgba(255,255,255,.12)', borderRadius:12, padding:'9px 13px', background:'rgba(9,14,25,.86)', backdropFilter:'blur(9px)', color:'#eef3fc', fontSize:13, fontWeight:800, cursor:'pointer', minWidth:104, justifyContent:'flex-end', boxShadow:'0 5px 16px rgba(0,0,0,.45)', transition:'transform .12s, filter .12s' };
  const btnPrim = { ...btnStyle, border:'1px solid rgba(255,255,255,.35)', padding:'11px 15px', background:'linear-gradient(135deg,#f7c65a,#e79a1e)', color:'#241400', fontSize:14, fontWeight:900, boxShadow:'0 6px 20px rgba(231,154,30,.45)' };

  const Btn = ({ label, icon, primary, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={primary ? btnPrim : btnStyle}
      onMouseEnter={e=>{if(!disabled){e.currentTarget.style.filter='brightness(1.14)';e.currentTarget.style.transform='translateX(-2px)';}}}
      onMouseLeave={e=>{if(!disabled){e.currentTarget.style.filter='brightness(1)';e.currentTarget.style.transform='translateX(0)';}}}
      onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform='scale(.97)';}}
      onMouseUp={e=>{if(!disabled)e.currentTarget.style.transform='';}}>
      {icon}{label}</button>);

  return (
    <div style={{ padding:'16px 12px', background:'linear-gradient(180deg,#0f172a,#0a0e18)', minHeight:'100vh', fontFamily:'"Segoe UI Variable","Segoe UI",system-ui,-apple-system,"PingFang TC","Microsoft JhengHei",sans-serif', display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
      <div style={{textAlign:'center',marginBottom:4}}>
        <div style={{fontSize:11,letterSpacing:'.32em',color:'#f5b942',fontWeight:800,marginBottom:6}}>🐱 貓小隊 · 戰鬥模擬器</div>
        <div style={{fontSize:20,fontWeight:900,color:"#eef3fc"}}>⚔️ {playerCount > 1 ? `${playerCount} 人組隊戰鬥` : "單人戰鬥"}</div>
        <div style={{fontSize:12,color:"#9fb0cf",marginTop:4}}>真怪物資料 · 真傷害公式 · 完整回合流程</div>
      </div>

      {!battleActive ? (
        <div style={{ width:380, maxWidth:'92vw', aspectRatio:'9/19', borderRadius:30, background:'linear-gradient(135deg,#141a28,#080c18)', boxShadow:'0 30px 70px rgba(0,0,0,.6), 0 0 0 8px #0a0e18, 0 0 0 9px rgba(255,255,255,.06)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:'#6b7a99', fontSize:14, fontWeight:700 }}>
          <span style={{fontSize:40}}>🎯</span>
          <div>設定好怪物與難度後，點擊「開始戰鬥」</div>
        </div>
      ) : (
        <BattleScreen ref={battleRef} key={`battle-${mIdx}-${dIdx}-${battleMode}`}
          player={player} monster={mon} battleMode={battleMode} scoreInput={scoreInput}
          difficulty={diff} arrowsPerRound={ARROWS_PER_ROUND}
          allies={playerCount > 1 ? allies : []} cat={catProp} potions={potions} bgImage={bgUrl}
          onBattleEnd={handleBattleEnd} onPotionUsed={()=>{}} />)}

      {showCtl && (
        <div style={{width:'100%',maxWidth:380,display:'flex',flexDirection:'column',gap:14}}>
          <CtrlGroup title='怪物選擇'>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {MONSTERS.map((m,i)=>(<Chip key={m.id} active={mIdx===i} onClick={()=>{if(!battleActive)setMIdx(i);}} disabled={battleActive}><MonsterSVG id={m.id} size={18} /> {m.name}</Chip>))}
            </div></CtrlGroup>
          <CtrlGroup title='難度'>
            <div style={{display:'flex',gap:6}}>
              {DIFF_MULTS.map((d,i)=>(<Chip key={d.id} active={dIdx===i} onClick={()=>{if(!battleActive)setDIdx(i);}} disabled={battleActive}>{d.label}</Chip>))}
            </div></CtrlGroup>
          <CtrlGroup title='戰鬥模式'>
            <div style={{display:'flex',gap:6}}>
              <Chip active={battleMode==='score'} onClick={()=>{if(!battleActive)setBattleMode('score');}} disabled={battleActive}>🎯 分數靶</Chip>
              <Chip active={battleMode==='zombie'} onClick={()=>{if(!battleActive)setBattleMode('zombie');}} disabled={battleActive}>🧟 殭屍靶</Chip>
            </div></CtrlGroup>
          <CtrlGroup title='計分方式'>
            <div style={{display:'flex',gap:6}}>
              <Chip active={scoreInput==='keypad'} onClick={()=>{if(!battleActive)setScoreInput('keypad');}} disabled={battleActive}>🔢 數字計分</Chip>
              <Chip active={scoreInput==='target'} onClick={()=>{if(!battleActive)setScoreInput('target');}} disabled={battleActive}>🎯 靶面計分</Chip>
            </div></CtrlGroup>
          <CtrlGroup title='🐱 貓貓夥伴'>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
              <Chip active={!selectedCatId} onClick={()=>{if(!battleActive)setSelectedCatId(null);}} disabled={battleActive} style={{fontSize:10}}>❌ 無</Chip>
              {CAT_IDS.map(cid => (<Chip key={cid} active={selectedCatId===cid} onClick={()=>{if(!battleActive)setSelectedCatId(cid);}} disabled={battleActive} style={{fontSize:10,gap:3}}><CatSVG catId={cid} size={16} /> {CATS[cid]?.name}</Chip>))}
            </div>
            {hasCat && !battleActive && <div style={{fontSize:10,color:'#a78bfa',fontWeight:700}}>🎯 {catName} · {catTypeLabel} · Lv.{catLevel} · 羈絆 Lv.{catBondLv} · HP:{catMaxHP} ATK:{catATK} DEF:{catDEF}</div>}
          </CtrlGroup>
          <CtrlGroup title='玩家人數（隊友視覺）'>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {[1,2,3,4,5,6,7,8].map(n=>(<Chip key={n} active={playerCount===n} onClick={()=>setPlayerCount(n)} disabled={battleActive}>{n===1?'單人':`${n}人`}</Chip>))}
            </div></CtrlGroup>
          <CtrlGroup title='戰鬥資訊'>
            <div style={{fontSize:12,color:'#9fb0cf',lineHeight:1.8}}>
              {battleActive ? (<div><div>⚔️ 戰鬥進行中 ...</div><div>👹 {mon.name}（{diff.label}）</div>{hasCat && <div>🐱 {catName} · {catTypeLabel}</div>}{battleResult && <div style={{color:battleResult==='won'?'#4ade80':'#f87171',fontWeight:900,marginTop:4}}>{battleResult==='won'?'🏆 戰鬥勝利！':'💀 戰鬥敗北...'}</div>}</div>)
              : <div>點擊「開始戰鬥」進行實戰測試</div>}
            </div></CtrlGroup>
          <BattleSoundIndicator />
          {!battleActive ? (
            <button onClick={handleStartBattle} style={{width:'100%',padding:'14px 0',borderRadius:14,background:'linear-gradient(135deg,#f7c65a,#e79a1e)',border:'none',color:'#241400',fontSize:16,fontWeight:900,cursor:'pointer',boxShadow:'0 8px 24px rgba(231,154,30,.4)',transition:'transform .12s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.02)';}} onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';}} onMouseDown={e=>{e.currentTarget.style.transform='scale(.97)';}}>⚔️ 開始戰鬥</button>
          ) : (
            <button onClick={handleReset} style={{width:'100%',padding:'12px 0',borderRadius:14,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.06)',color:'#9fb0cf',fontSize:14,fontWeight:800,cursor:'pointer',transition:'transform .12s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.02)';}} onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';}}>🔄 重置戰鬥</button>
          )}
        </div>
      )}
      <button onClick={()=>setShowCtl(s=>!s)} style={{padding:'8px 20px',borderRadius:10,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.06)',color:'#9fb0cf',fontSize:12,fontWeight:800,cursor:'pointer'}}>{showCtl?'🙈 隱藏控制面板':'👁️ 顯示控制面板'}</button>
    </div>
  );
}

function CtrlGroup({ title, children }) {
  return <div style={{background:'rgba(12,18,30,.55)',border:'1px solid rgba(255,255,255,.07)',borderRadius:14,padding:12}}><div style={{fontSize:10,color:'#6b7a99',fontWeight:800,letterSpacing:'.1em',marginBottom:8}}>{title}</div>{children}</div>;
}
function Chip({ active, onClick, disabled, children, style }) {
  return <button onClick={onClick} disabled={disabled} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:9,border:active?'1px solid rgba(245,185,66,.4)':'1px solid rgba(255,255,255,.1)',background:active?'rgba(245,185,66,.18)':'rgba(255,255,255,.05)',color:active?'#f5b942':disabled?'#4a5a7a':'#cbd6ea',fontSize:12,fontWeight:800,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,transition:'all .12s',...style}}
    onMouseEnter={e=>{if(!disabled&&!active)e.currentTarget.style.background='rgba(255,255,255,.1)';}}
    onMouseLeave={e=>{if(!disabled&&!active)e.currentTarget.style.background='rgba(255,255,255,.05)';}}>{children}</button>;
}
