// src/components/battle/BattleScreen.jsx
// 新一代統一戰鬥 UI 元件 — props-driven，支援單人/組隊/地下城/世界王

import { useState, useReducer, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import MonsterSVG from "../MonsterSVG";
import CatSVG from "../cat/CatSVG";
import { resolveHitPart } from "../../lib/monsterData";
import { calcStandardArrowDmg, calcStandardCounter } from "../../lib/damage";

import { CAT_SKILL_GROUPS, calcCatSkillChance, calcCatSkillEffect } from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
import { playBattleSound } from "../../lib/battleSound";
import BattleSoundIndicator from "../shared/BattleSoundIndicator";
import { sfxTap } from "../../lib/sound";

function StatGlyph({ type, color }) {
  const path = type === "hp" ? <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /> : type === "atk" ? <><path d="m14 5 5 5-9 9-5-5 9-9Z" /><path d="m4 20 3-3" /></> : <><path d="M12 3 19 6v5c0 4.5-3 7-7 10-4-3-7-5.5-7-10V6l7-3Z" /><path d="M9 12h6M12 9v6" /></>;
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>;
}

// ═══════════ Phase ═══════════
const PHASE = { IDLE:"idle", INTRO:"intro", PLAYING:"playing", SCORING:"scoring", PROCESSING:"processing", ROUND_RES:"round_result", VICTORY_ANIM:"victory_anim", WON:"won", LOST:"lost" };

const FRAME_TIERS = {
  none:{c:"#4cc9f0",glow:"transparent",label:"無稱號"},
  rare:{c:"#a78bfa",glow:"rgba(167,139,250,.55)",label:"稀有卡"},
  epic:{c:"#f472b6",glow:"rgba(244,114,182,.55)",label:"傳說卡"},
  worldboss:{c:"#f5b942",glow:"rgba(245,185,66,.65)",label:"世界王卡（金邊）"},
};

const TIER_LABEL = {
  common:{label:"普通",color:"#6b7280",bg:"#f3f4f6"},
  rare:{label:"稀有",color:"#3b82f6",bg:"#eff6ff"},
  elite:{label:"精英",color:"#8b5cf6",bg:"#f5f3ff"},
  fierce:{label:"強悍",color:"#f97316",bg:"#fff7ed"},
  boss:{label:"頭目",color:"#ef4444",bg:"#fef2f2"},
  mythic:{label:"神話",color:"#fbbf24",bg:"#fffbeb"},
};

const VARIANT_LABEL = {
  weak:{label:"弱化",color:"#22c55e",bg:"rgba(34,197,94,0.2)"},
  normal:{label:"普通",color:"#eab308",bg:"rgba(234,179,8,0.2)"},
  strong:{label:"強悍",color:"#ef4444",bg:"rgba(239,68,68,0.2)"},
  boss:{label:"BOSS",color:"#ef4444",bg:"rgba(239,68,68,0.3)"},
};

const CAT_BATTLE_CRIES = { heal:["一起上吧！ 💚","我來支援你！ ✨"], atk:["看我的厲害！ ⚡","咬死牠！ 💥"], def:["別想傷害主人！ 🛡️","我來擋住牠！ 🐾"] };

const CAT_INTRO_EFFECTS = {
  heal:{icon:"💚",label:"治癒型",particle:"✨",particleCount:6,colors:["#10b981","#34d399","#6ee7b7"],bgGradient:"radial-gradient(circle,rgba(16,185,129,.2),transparent 70%)",borderGlow:"0 0 20px #10b98166, 0 0 40px #10b98133"},
  atk:{icon:"⚡",label:"攻擊型",particle:"💥",particleCount:5,colors:["#ef4444","#f87171","#fbbf24"],bgGradient:"radial-gradient(circle,rgba(239,68,68,.2),transparent 70%)",borderGlow:"0 0 20px #ef444466, 0 0 40px #ef444433"},
  def:{icon:"🛡️",label:"防禦型",particle:"🔮",particleCount:5,colors:["#a78bfa","#8b5cf6","#c4b5fd"],bgGradient:"radial-gradient(circle,rgba(167,139,250,.2),transparent 70%)",borderGlow:"0 0 20px #a78bfa66, 0 0 40px #a78bfa33"},
};

const CAT_MSG_POOL = {
  heal:[n=>`🐱 ${n} 用尾巴掃過你的傷口，癒合了！💚`,n=>`🐱 ${n} 叼來貓草葉，傷口在發光了 ✨`,n=>`🐱 ${n} 蹭了蹭你的腳，一股暖流湧上 🫶`],
  atk:[n=>`🐱 ${n} 利爪出擊！追加傷害！⚡`,n=>`🐱 ${n} 目光如炬，找到了弱點 💥`,n=>`🐱 ${n} 撲了上去追加一擊！🎯`],
  def:[n=>`🐱 ${n} 擋在你面前！減傷！🛡️`,n=>`🐱 ${n} 用腦袋頂開了攻擊！✨`,n=>`🐱 ${n} 發出嘶吼威嚇怪物！🐾`],
};

const CAT_MAX_HP_FIXED = 300;
const CAT_ATK_FIXED = 25;
const CAT_DEF_FIXED = 12;

const ROUND_EVENTS = [
  {icon:"🌪️",title:"逆風",desc:"強風干擾，本回合較難瞄準（示意）",color:"#7dd3fc"},
  {icon:"✨",title:"順風",desc:"順風助威，本回合手感絕佳（示意）",color:"#fbbf24"},
  {icon:"🎯",title:"全神貫注",desc:"本回合爆擊機率提升（示意）",color:"#f472b6"},
  {icon:"🩹",title:"補給箱",desc:"回合開始回復少量 HP",color:"#4ade80",heal:200},
  {icon:"🕸️",title:"怪物蓄力",desc:"怪物正在蓄力，小心這回合的反擊（示意）",color:"#f87171"},
];

// ═══════════ initState & helpers ═══════════
const initBattle = {
  phase:PHASE.IDLE, round:1, arrowIdx:0, arrows:[], monsterHp:0, monsterMaxHp:0, monsterAtk:0, monsterDef:0,
  monsterName:"", monsterFamily:"", battleMode:"score", unlockedParts:new Set(),
  playerHp:0, playerMaxHp:0, playerAtk:0, playerDef:0, roundDmg:0, roundCrits:0, totalDmgAllRounds:0,
  counterDmg:0, pendingCounter:0, potionShield:0, messages:[], lastArrowDmg:0, lastArrowCrit:false, lastArrowPart:"",
};

function computeUnlocked(arrows) {
  const set = new Set();
  arrows.forEach(a=>{const p=a.part;if(!p)return;if(p.id==="chest"){set.add("chest");set.add("heart");set.add("lung");}if(p.id==="belly"){set.add("belly");set.add("kidney");}if(p.id==="groin"){set.add("groin");set.add("balls");}});
  return set;
}

function battleReducer(state, action) {
  switch(action.type){
    case"START_SCORING":return{...state,phase:PHASE.SCORING,arrowIdx:0,arrows:[],lastArrowDmg:0,lastArrowCrit:false,lastArrowPart:""};
    case"START":{
      const{monster,diff,battleMode}=action;
      const mHp=Math.round(monster.hp*diff.hp);const mAtk=Math.round(monster.atk*diff.atk);const mDef=Math.round(monster.def*diff.def);
      return{...initBattle,phase:PHASE.INTRO,battleMode:battleMode||"score",monsterHp:mHp,monsterMaxHp:mHp,monsterAtk:mAtk,monsterDef:mDef,monsterName:monster.name,monsterFamily:monster.family,playerHp:action.playerHp||action.playerMaxHp||initBattle.playerHp,playerMaxHp:action.playerMaxHp||initBattle.playerMaxHp,playerAtk:action.playerAtk||initBattle.playerAtk,playerDef:action.playerDef||initBattle.playerDef,messages:[`⚔️ 戰鬥開始！對上 ${monster.name}（HP:${mHp} ATK:${mAtk} DEF:${mDef}）`,battleMode==="zombie"?"🧟 殭屍靶模式：分數決定命中部位，高部位倍率最高 ×3.0！":"🎯 分數靶模式：每箭依環數計算傷害。"]};
    }
    case"SCORE_ARROW":{
      if(state.arrowIdx>=action.arrowsPerRound)return state;
      const{score,battleMode}=action;const isX=score==="X";const numScore=isX?10:(score==="M"?0:score);const isZombie=battleMode==="zombie";
      let part=null,partMult=1.0,newUnlocked=new Set(state.unlockedParts||[]);
      if(isZombie){part=resolveHitPart(numScore,newUnlocked,isX);if(part){partMult=part.mult;if(part.id==="chest"){newUnlocked.add("chest");newUnlocked.add("heart");newUnlocked.add("lung");}if(part.id==="belly"){newUnlocked.add("belly");newUnlocked.add("kidney");}if(part.id==="groin"){newUnlocked.add("groin");newUnlocked.add("balls");}}}
      const dmg=calcStandardArrowDmg(numScore,state.playerAtk,state.monsterDef,partMult);const isCrit=isZombie?(part&&part.mult>=1.8):(isX||Math.random()<0.08);
      const newArrows=[...state.arrows,{score,dmg,isCrit,part:isZombie?part:null}];
      return{...state,arrows:newArrows,arrowIdx:state.arrowIdx+1,unlockedParts:isZombie?newUnlocked:(state.unlockedParts||new Set()),lastArrowDmg:dmg,lastArrowCrit:isCrit,lastArrowPart:isZombie&&part?`${part.icon} ${part.name} ×${part.mult}`:(numScore===0?"脫靶":(isX?"X環":`${numScore}環`))};
    }
    case"UNDO_ARROW":{
      if(state.arrows.length===0)return state;const newArrows=state.arrows.slice(0,-1);const last=newArrows[newArrows.length-1];
      return{...state,arrows:newArrows,arrowIdx:newArrows.length,unlockedParts:computeUnlocked(newArrows),lastArrowDmg:last?last.dmg:0,lastArrowCrit:last?last.isCrit:false,lastArrowPart:last?(last.part?`${last.part.icon} ${last.part.name} ×${last.part.mult}`:""):""};
    }
    case"SUBMIT_ROUND":{
      const{skipCounter,counterReduce}=action;const totalDmg=state.arrows.reduce((s,a)=>s+a.dmg,0);const crits=state.arrows.filter(a=>a.isCrit).length;
      const shieldAbsorb=Math.min(state.potionShield||0,state.monsterAtk*2);const rawCounter=skipCounter===true?0:calcStandardCounter(state.monsterAtk,state.playerDef);
      const pendingCounter=Math.max(0,Math.round(rawCounter*(1-(counterReduce||0)/100)-shieldAbsorb));
      return{...state,roundDmg:totalDmg,roundCrits:crits,totalDmgAllRounds:(state.totalDmgAllRounds||0)+totalDmg,pendingCounter,counterDmg:pendingCounter,phase:PHASE.PROCESSING};
    }
    case"HIT_MONSTER":return{...state,monsterHp:Math.max(0,state.monsterHp-(action.dmg||0))};
    case"MONSTER_DIED":return{...state,phase:PHASE.VICTORY_ANIM,messages:[...state.messages,`💀 ${state.monsterName} 被擊倒！`,`🏹 第${state.round}回合：${state.roundDmg} 傷害（${state.roundCrits} 爆擊）`]};
    case"APPLY_COUNTER":{const n=Math.max(0,state.playerHp-(state.pendingCounter||0));return{...state,playerHp:n,phase:n<=0?PHASE.LOST:state.phase,messages:[...state.messages,`🏹 第${state.round}回合：${state.roundDmg} 傷害（${state.roundCrits} 爆擊）`,`💥 怪物反擊：${state.pendingCounter} 傷害`]};}
    case"CARRY_BUFF":{const{atkAdd,defAdd,heal,shieldHp,buffMsgs,name}=action;return{...state,playerAtk:state.playerAtk+(atkAdd||0),playerDef:state.playerDef+(defAdd||0),playerHp:Math.min(state.playerMaxHp,state.playerHp+(heal||0)),potionShield:Math.max(state.potionShield||0,shieldHp||0),messages:[...state.messages,...(buffMsgs||[`⚗️ ${name||"藥水"} 效果發動！`])]};}
    case"THROW_DMG":{const dmg=action.dmg;const nhp=Math.max(0,state.monsterHp-dmg);return{...state,monsterHp:nhp,phase:nhp<=0?PHASE.VICTORY_ANIM:state.phase,messages:[...state.messages,action.msg||`🔪 投擲傷害：${dmg}`]};}
    case"DEBUFF_MONSTER":{const{monAtkPct,monDefPct,msg}=action;return{...state,monsterAtk:monAtkPct?Math.max(1,Math.round(state.monsterAtk*(1-monAtkPct/100))):state.monsterAtk,monsterDef:monDefPct?Math.max(0,Math.round(state.monsterDef*(1-monDefPct/100))):state.monsterDef,messages:[...state.messages,msg||`🧴 怪物被削弱！`]};}
    case"HEAL":{const h=Math.min(state.playerMaxHp,state.playerHp+(action.amount||0));return{...state,playerHp:h,messages:[...state.messages,`💚 回復 ${action.amount} HP`]};}
    case"START_PLAYING":return{...state,phase:PHASE.PLAYING};
    case"SHOW_WON":return{...state,phase:PHASE.WON};
    case"NEXT_PHASE":return state.phase===PHASE.PROCESSING?{...state,phase:PHASE.ROUND_RES}:state;
    case"NEXT_ROUND":return{...state,phase:PHASE.PLAYING,round:state.round+1,arrowIdx:0,arrows:[],roundDmg:0,roundCrits:0,counterDmg:0,lastArrowDmg:0,lastArrowCrit:false,lastArrowPart:""};
    case"RESET":return{...initBattle,playerHp:action.playerHp||initBattle.playerHp,playerMaxHp:action.playerMaxHp||initBattle.playerMaxHp,playerAtk:action.playerAtk||initBattle.playerAtk,playerDef:action.playerDef||initBattle.playerDef};
    default:return state;
  }
}

// ═══════════ Target Face ═══════════
const TARGET_ANGLES=[35,160,275,95,210,330];
function arrowMark(i,score){const isX=score==="X",isM=score==="M";const num=isX?10:(isM?0:Number(score));const ang=TARGET_ANGLES[i%TARGET_ANGLES.length]*Math.PI/180;const rNorm=isM?1.08:isX?0.04:((10-num)+0.5)/10;return{x:Math.cos(ang)*rNorm,y:Math.sin(ang)*rNorm};}
function TargetFace({arrows,onPick}){const R=90,c=100;const bands=[{r:1,fill:"#dfe5ec"},{r:.8,fill:"#2b3242"},{r:.6,fill:"#3f8ee0"},{r:.4,fill:"#e8524e"},{r:.2,fill:"#f5c93f"}];function hdl(e){if(!onPick)return;const rect=e.currentTarget.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*200-c;const y=(e.clientY-rect.top)/rect.height*200-c;const rNorm=Math.sqrt(x*x+y*y)/R;if(rNorm>1)return onPick("M");if(rNorm<=0.05)return onPick("X");onPick(String(Math.max(1,Math.min(10,10-Math.floor(rNorm*10)))));}
  return(<svg viewBox="0 0 200 200" onClick={hdl} style={{width:onPick?210:168,height:onPick?210:168,cursor:onPick?"crosshair":"default",filter:"drop-shadow(0 6px 16px rgba(0,0,0,.5))"}}>
    {bands.map((b,i)=><circle key={i} cx={c} cy={c} r={R*b.r} fill={b.fill}/>)}
    {Array.from({length:10}).map((_,i)=><circle key={"l"+i} cx={c} cy={c} r={R*(i+1)/10} fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="0.6"/>)}
    <circle cx={c} cy={c} r={R*0.05} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth="0.7"/>
    {arrows.map((a,i)=>{const m=arrowMark(i,a.score);const px=c+m.x*R,py=c+m.y*R;const isLast=i===arrows.length-1;return(<circle key={i} cx={px} cy={py} r={isLast?5:3.6} fill={a.isCrit?"#fff2a8":"#8affc0"} stroke="#0b1220" strokeWidth="1.4">{isLast&&<animate attributeName="r" values="7;5" dur="0.3s" repeatCount="1"/>}</circle>);})}
  </svg>);
}

// ══════════════════════════════════════════════════════════════
// 主元件
// ══════════════════════════════════════════════════════════════
const BattleScreen = forwardRef(function BattleScreen(props, ref) {
  const {
    player, monster, battleMode="score", scoreInput="keypad", difficulty={hp:1,atk:1,def:1},
    arrowsPerRound=6, allies=[], cat=null, potions=[], bgImage, onBattleEnd, onPotionUsed,
    autoStart=false, scoringMode=false, onSubmit, fullScreen=false, renderMonster,
  } = props;

  // ─── 內部狀態 ───
  const [battle, dispatch] = useReducer(battleReducer, initBattle);
  const [animStep, setAnimStep] = useState(-1);
  const [teamFx, setTeamFx] = useState([]);
  const [roundEvent, setRoundEvent] = useState(null);
  const [showPotionPanel, setShowPotionPanel] = useState(false);
  const [potionTab, setPotionTab] = useState("carry");
  const [usedPotionInfo, setUsedPotionInfo] = useState(null);
  const [poofKey, setPoofKey] = useState(0);
  const [skipBigRound, setSkipBigRound] = useState(false);
  const [counterReducePct, setCounterReducePct] = useState(0);
  const [catCurrentHP, setCatCurrentHP] = useState(0);
  const [catMsg, setCatMsg] = useState(null);
  const [catSkillActive, setCatSkillActive] = useState(null);

  // ─── 貓貓計算 ───
  const hasCat = !!cat;
  const catId = cat?.catId;
  const catName = cat?.catName || "";
  const catType = cat?.type || "allround";
  const skillGroup = hasCat ? (CAT_SKILL_GROUPS[catId] || "heal") : "heal";
  const catCombatStats = useMemo(() => hasCat ? calcCatCombatStats({ catId, catXP: cat?.catXP || 5000, bond: cat?.bond || 50, type: catType }) : null, [hasCat, catId, cat?.catXP, cat?.bond, catType]);
  const catMaxHP = hasCat ? (catCombatStats?.catHP || CAT_MAX_HP_FIXED) : CAT_MAX_HP_FIXED;
  const catATK = hasCat ? (catCombatStats?.catATK || CAT_ATK_FIXED) : CAT_ATK_FIXED;
  const catDEF = hasCat ? (catCombatStats?.catDEF || CAT_DEF_FIXED) : CAT_DEF_FIXED;
  const catBondLv = hasCat ? (catCombatStats?.bondLv || 0) : 0;
  const catLevel = hasCat ? (catCombatStats?.catLevel || 1) : 1;
  const catTypeLabel = hasCat ? (catType==="heal"?"治癒型":catType==="atk"?"攻擊型":"防禦型") : "";
  const catGlowColor = skillGroup==="heal"?"#10b981":skillGroup==="atk"?"#ef4444":"#a78bfa";

  // ─── Phase 捷徑 ───
  const inBattle = battle.phase !== PHASE.IDLE;
  const isIntro = battle.phase === PHASE.INTRO;
  const isPlaying = battle.phase === PHASE.PLAYING;
  const isScoring = battle.phase === PHASE.SCORING;
  const isRoundRes = battle.phase === PHASE.ROUND_RES;
  const isProcessing = battle.phase === PHASE.PROCESSING;
  const isVictoryAnim = battle.phase === PHASE.VICTORY_ANIM;
  const isWon = battle.phase === PHASE.WON;
  const isLost = battle.phase === PHASE.LOST;
  const showBattleUI = isPlaying||isScoring||isProcessing||isRoundRes||isVictoryAnim||isWon||isLost;

  // ─── 進場動畫 ⏱ ───
  useEffect(()=>{if(!isIntro)return;if(hasCat){const fx=CAT_INTRO_EFFECTS[skillGroup]||CAT_INTRO_EFFECTS.heal;playBattleSound("cat_intro",{catName,typeLabel:fx.label,typeIcon:fx.icon});playBattleSound("cat_type_sound",{skillGroup});}const t=setTimeout(()=>dispatch({type:"START_PLAYING"}),2500);return()=>clearTimeout(t);},[isIntro,dispatch,hasCat,catName,skillGroup]);

  // ─── 回合前事件 🎲 ───
  useEffect(()=>{if(!isPlaying)return;if(Math.random()<0.6){const ev=ROUND_EVENTS[Math.floor(Math.random()*ROUND_EVENTS.length)];setRoundEvent(ev);if(ev.heal)dispatch({type:"HEAL",amount:ev.heal});}},[isPlaying,battle.round,dispatch]);

  // ─── 擊倒動畫 ⏱ ───
  useEffect(()=>{if(!isVictoryAnim)return;playBattleSound("victory_fanfare",{monsterName:battle.monsterName,round:battle.round,roundDmg:battle.roundDmg});const t=setTimeout(()=>{playBattleSound("victory_cheer",{});dispatch({type:"SHOW_WON"});},3000);return()=>clearTimeout(t);},[isVictoryAnim,dispatch,battle.monsterName,battle.round,battle.roundDmg]);

  // ─── 勝利回呼 ⏱ ───
  useEffect(()=>{if(!isWon||!onBattleEnd)return;onBattleEnd("won",{rounds:battle.round,totalDamage:battle.totalDmgAllRounds||battle.roundDmg,crits:battle.roundCrits,arrows:battle.arrows.length,arrowScores:battle.arrows.map(a=>a.score),playerHp:battle.playerHp,monsterHp:battle.monsterHp});},[isWon,onBattleEnd,battle]);

  // ─── 敗北音效 + 回呼 ⏱ ───
  useEffect(()=>{if(!isLost)return;playBattleSound("defeat_sigh",{monsterName:battle.monsterName,playerName:player?.name||"",round:battle.round});if(onBattleEnd)onBattleEnd("lost",{rounds:battle.round,totalDamage:battle.totalDmgAllRounds||battle.roundDmg,crits:battle.roundCrits,arrows:battle.arrows.length,arrowScores:battle.arrows.map(a=>a.score),playerHp:battle.playerHp,monsterHp:battle.monsterHp});},[isLost,battle,player?.name,onBattleEnd]);

  function delay(ms){return new Promise(r=>setTimeout(r,ms));}

  // ─── 戰鬥過程動畫 ───
  useEffect(()=>{if(!isProcessing)return;let cancelled=false;setTeamFx(allies.map(()=>{const r=Math.random();return r<0.2?"crit":r<0.32?"miss":"normal";}));(async()=>{setAnimStep(0);await delay(500);if(cancelled)return;
    let hpAfter=battle.monsterHp;
    function checkMonsterDeath(hp) { if(hp<=0){dispatch({type:"MONSTER_DIED"});return true;}return false; }
    for(let i=0;i<arrowsPerRound;i++){
      setAnimStep(i+1);const a=battle.arrows[i];
      if(a){
        playBattleSound("arrow_flight",{arrowIdx:i+1,monsterName:battle.monsterName,battleMode:battle.battleMode});
        playBattleSound("arrow_hit",{arrowIdx:i+1,score:a.score,dmg:a.dmg,isCrit:a.isCrit});
        dispatch({type:"HIT_MONSTER",dmg:a.dmg});
        hpAfter=Math.max(0,hpAfter-a.dmg);
      }
      await delay(a&&a.isCrit?1200:900);if(cancelled)return;
      if(hpAfter<=0)break;
    }
    await delay(450);if(cancelled)return;
    if(checkMonsterDeath(hpAfter))return;
    // 貓貓協戰（動畫 + 傷害）
    if(hasCat){
      const catRoundDmg=Math.max(1,Math.round(catATK*0.8*(0.75+Math.random()*0.5)));
      hpAfter=Math.max(0,hpAfter-catRoundDmg);
      dispatch({type:"THROW_DMG",dmg:catRoundDmg,msg:`🐱 ${catName} 協戰攻擊：造成 ${catRoundDmg} 傷害！`});
      const fx=CAT_INTRO_EFFECTS[skillGroup]||CAT_INTRO_EFFECTS.heal;
      playBattleSound("cat_attack",{catName,particle:fx.particle,skillGroup});
      setAnimStep(7);await delay(1700);if(cancelled)return;
      if(checkMonsterDeath(hpAfter))return;
    }
    // 怪物反擊
    if(battle.pendingCounter>0){
      setAnimStep(8);playBattleSound("monster_counter",{monsterName:battle.monsterName,counterDmg:battle.pendingCounter});
      await delay(1700);if(cancelled)return;
      if(hpAfter<=0){dispatch({type:"MONSTER_DIED"});return;}
    }
    dispatch({type:"APPLY_COUNTER"});
    if(battle.playerHp-battle.pendingCounter<=0)return;
    setAnimStep(9);await delay(450);if(cancelled)return;
    dispatch({type:"NEXT_PHASE"});
    })();return()=>{cancelled=true;};},[isProcessing,catATK,catName,skillGroup]);

  useEffect(()=>{if(!isProcessing&&animStep!==-1)setAnimStep(-1);},[isProcessing,animStep]);

  // ─── 貓貓回合結束處理 ───
  useEffect(()=>{if(!isRoundRes||!hasCat||!catId)return;let currentCatHP=catCurrentHP;if(battle.counterDmg>0&&currentCatHP>0){const catDmg=Math.max(0,Math.round(battle.counterDmg*0.35-catDEF*0.5));if(catDmg>0){currentCatHP=Math.max(0,currentCatHP-catDmg);setCatCurrentHP(currentCatHP);setCatMsg(currentCatHP<=0?`💔 ${catName} 承受了 ${catDmg} 傷害，倒地昏迷了... 😿`:`😿 ${catName} 被反擊波及，受到 ${catDmg} 傷害！（HP: ${currentCatHP}/${catMaxHP}）`);}}if(currentCatHP<=0){const t=setTimeout(()=>setCatMsg(null),3000);return()=>clearTimeout(t);}const catRoundDmg=Math.max(1,Math.round(catATK*0.8*(0.75+Math.random()*0.5)));const chance=calcCatSkillChance(catLevel,catBondLv,catId);if(Math.random()<chance){const effect=calcCatSkillEffect(skillGroup,catLevel,catBondLv,catId);if(skillGroup==="heal"&&effect.healed){dispatch({type:"HEAL",amount:effect.healed});showCatMsg(CAT_MSG_POOL.heal);}else if(skillGroup==="atk"&&effect.extraMult){const bonusDmg=Math.round(catRoundDmg*effect.extraMult);dispatch({type:"THROW_DMG",dmg:bonusDmg,msg:`🐱 ${catName} ⚡ 追加傷害 +${bonusDmg}（×${effect.extraMult.toFixed(1)}）！`});showCatMsg(CAT_MSG_POOL.atk);}else if(skillGroup==="def"&&effect.reduction){const pct=Math.min(60,Math.round(effect.reduction*100));setCounterReducePct(prev=>Math.min(70,prev+pct));showCatMsg(CAT_MSG_POOL.def);setCatSkillActive({type:"def",value:effect.reduction});}}const t=setTimeout(()=>{setCatMsg(null);setCatSkillActive(null);},3000);return()=>clearTimeout(t);},[isRoundRes]);

  function showCatMsg(pool){const fn=pool[Math.floor(Math.random()*pool.length)];setCatMsg(fn(catName));}

  const hpPct=inBattle?(battle.monsterHp/battle.monsterMaxHp)*100:100;
  const playerHpPct=inBattle?(battle.playerHp/battle.playerMaxHp)*100:100;
  const scoreKeys=["X","10","9","8","7","6","5","4","3","2","1","M"];

  // ─── 貓貓戰吼 ───
  const catBattleCry=useMemo(()=>{if(!hasCat)return "";const cries=CAT_BATTLE_CRIES[skillGroup]||CAT_BATTLE_CRIES.heal;return cries[Math.floor(Math.random()*cries.length)];},[hasCat,skillGroup]);

  // ─── handleStartBattle（必須在 useImperativeHandle 之前，避免 TDZ）───
  const handleStartBattle=useCallback(()=>{dispatch({type:"START",monster,diff:difficulty,battleMode,playerHp:player?.hp||initBattle.playerHp,playerMaxHp:player?.maxHp||initBattle.playerMaxHp,playerAtk:player?.atk||initBattle.playerAtk,playerDef:player?.def||initBattle.playerDef});if(hasCat)setCatCurrentHP(catMaxHP);},[monster,difficulty,battleMode,player?.hp,player?.maxHp,player?.atk,player?.def,hasCat,catMaxHP]);

  // ─── 回呼 ───
  const handleScore=useCallback((s)=>{if(!isScoring)return;sfxTap();dispatch({type:"SCORE_ARROW",score:s,battleMode,arrowsPerRound});},[isScoring,battleMode,arrowsPerRound]);
  const handleUndo=useCallback(()=>{if(!isScoring)return;dispatch({type:"UNDO_ARROW"});},[isScoring]);
  const handleSubmit=useCallback(()=>{if(!isScoring||battle.arrows.length<arrowsPerRound)return;dispatch({type:"SUBMIT_ROUND",skipCounter:skipBigRound,counterReduce:counterReducePct,arrowsPerRound});},[isScoring,battle.arrows.length,skipBigRound,counterReducePct,arrowsPerRound]);
  const handleNextRound=useCallback(()=>{dispatch({type:"NEXT_ROUND"});setSkipBigRound(false);setCounterReducePct(0);setUsedPotionInfo(null);},[]);
  const handleReset=useCallback(()=>{dispatch({type:"RESET",playerHp:player?.hp||initBattle.playerHp,playerMaxHp:player?.maxHp||initBattle.playerMaxHp,playerAtk:player?.atk||initBattle.playerAtk,playerDef:player?.def||initBattle.playerDef});setSkipBigRound(false);setCounterReducePct(0);setUsedPotionInfo(null);setShowPotionPanel(false);setCatCurrentHP(0);setCatMsg(null);setCatSkillActive(null);setRoundEvent(null);setTeamFx([]);},[player?.hp,player?.maxHp,player?.atk,player?.def]);

  // ─── 暴露 startBattle ───
  useImperativeHandle(ref,()=>({startBattle:handleStartBattle}),[handleStartBattle]);

  // ─── 自動啟動（MonsterBattle 等外部元件用）───
  useEffect(()=>{if(autoStart)handleStartBattle();},[autoStart]);

  // ─── 計分模式（PartyBattleRoom 等外部元件用）───
  useEffect(()=>{if(scoringMode)dispatch({type:"START_SCORING",arrowsPerRound});},[scoringMode,arrowsPerRound]);

  // ─── 計分模式提交 ───
  const handleScoringSubmit=useCallback(()=>{if(!isScoring||battle.arrows.length<arrowsPerRound)return;if(onSubmit)onSubmit(battle.arrows.map(a=>a.score));},[isScoring,battle.arrows,arrowsPerRound,onSubmit]);

  // ─── 藥水 ───
  function useCarryPotion(potion){
    if(usedPotionInfo||battle.phase===PHASE.SCORING)return;
    const e=potion.effect||{};let atkAdd=0,defAdd=0,heal=0,shieldHp=0;const msgs=[];
    if(e.hpPct){heal=Math.round(battle.playerMaxHp*e.hpPct/100);msgs.push(`💚 ${potion.icon} ${potion.name}：回復 ${heal} HP`);}
    if(e.atkPct){atkAdd=Math.round(battle.playerAtk*e.atkPct/100);msgs.push(`⚔️ ${potion.icon} ${potion.name}：ATK +${e.atkPct}%`);}
    if(e.defPct){defAdd=Math.round(battle.playerDef*e.defPct/100);msgs.push(`🛡️ ${potion.icon} ${potion.name}：DEF +${e.defPct}%`);}
    if(e.shieldPct){shieldHp=Math.round(battle.playerMaxHp*e.shieldPct/100);msgs.push(`🫧 ${potion.icon} ${potion.name}：獲得 ${shieldHp} 護盾`);}
    if(e.regenPct){heal+=Math.round(battle.playerMaxHp*e.regenPct/100);msgs.push(`🌱 ${potion.icon} ${potion.name}：回 ${e.regenPct}%/回合`);}
    if(e.dmgPct&&e.defPenaltyPct){atkAdd=Math.round(battle.playerAtk*e.dmgPct/100);defAdd=-Math.round(battle.playerDef*e.defPenaltyPct/100);msgs.push(`🔥 ${potion.icon} ${potion.name}：傷害 +${e.dmgPct}%，DEF -${e.defPenaltyPct}%`);}
    dispatch({type:"CARRY_BUFF",atkAdd,defAdd,heal,shieldHp,buffMsgs:msgs,name:potion.name});
    setUsedPotionInfo({icon:potion.icon,name:potion.name,effectText:potion.effectText});setShowPotionPanel(false);setPoofKey(k=>k+1);
    if(onPotionUsed)onPotionUsed(potion.id);
  }
  function useThrowPotion(potion){
    if(usedPotionInfo||battle.phase===PHASE.SCORING)return;
    const e=potion.effect||{};let dmg=0;const msgs=[];
    if(e.throwDmg)dmg+=e.throwDmg;if(e.throwPct)dmg+=Math.round(battle.monsterMaxHp*e.throwPct);if(e.atkDamagePct)dmg+=Math.round(battle.playerAtk*e.atkDamagePct/100);
    if(e.throwDmgMin&&e.throwDmgMax)dmg+=e.throwDmgMin+Math.floor(Math.random()*(e.throwDmgMax-e.throwDmgMin+1));
    if(dmg>0)dispatch({type:"THROW_DMG",dmg,msg:`🔪 ${potion.icon} ${potion.name}：${dmg} 傷害！`});
    if(e.monAtkPct)dispatch({type:"DEBUFF_MONSTER",monAtkPct:e.monAtkPct,msg:`🌫️ ${potion.icon} ${potion.name}：怪物 ATK -${e.monAtkPct}%！`});
    if(e.monDefPct)dispatch({type:"DEBUFF_MONSTER",monDefPct:e.monDefPct,msg:`🧴 ${potion.icon} ${potion.name}：怪物 DEF -${e.monDefPct}%！`});
    if(e.skipRound==="big"){setSkipBigRound(true);msgs.push(`🕸️ ${potion.icon} ${potion.name}：下次反擊跳過！`);}
    if(e.counterReducePct){setCounterReducePct(p=>Math.min(70,p+e.counterReducePct));msgs.push(`💨 ${potion.icon} ${potion.name}：反擊傷害 -${e.counterReducePct}%！`);}
    if(msgs.length>0)dispatch({type:"CARRY_BUFF",atkAdd:0,defAdd:0,heal:0,shieldHp:0,buffMsgs:msgs});
    setUsedPotionInfo({icon:potion.icon,name:potion.name,effectText:potion.effectText});setShowPotionPanel(false);setPoofKey(k=>k+1);
    if(onPotionUsed)onPotionUsed(potion.id);
  }

  const familyColor=monster?.color||"#888";

  // ─── Btn ───
  const Btn=({label,icon,primary,danger,onClick,disabled})=>(
    <button onClick={onClick} disabled={disabled}
      style={{display:"flex",alignItems:"center",gap:8,border:primary?"1px solid rgba(255,255,255,.35)":danger?"1px solid rgba(239,83,80,.42)":"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:primary?"11px 15px":"9px 13px",background:primary?"linear-gradient(135deg,#f7c65a,#e79a1e)":"rgba(9,14,25,.86)",backdropFilter:"blur(9px)",color:primary?"#241400":danger?"#ffd7d5":"#eef3fc",fontSize:primary?14:13,fontWeight:primary?900:800,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.4:1,minWidth:104,justifyContent:"flex-end",boxShadow:primary?"0 6px 20px rgba(231,154,30,.45)":"0 5px 16px rgba(0,0,0,.45)",transition:"transform .12s, filter .12s"}}
      onMouseEnter={e=>{if(!disabled){e.currentTarget.style.filter="brightness(1.14)";e.currentTarget.style.transform="translateX(-2px)";}}}
      onMouseLeave={e=>{if(!disabled){e.currentTarget.style.filter="brightness(1)";e.currentTarget.style.transform="translateX(0)";}}}
      onMouseDown={e=>{if(!disabled)e.currentTarget.style.transform="scale(.97)";}}
      onMouseUp={e=>{if(!disabled)e.currentTarget.style.transform="";}}>
      {icon}{label}
    </button>
  );

  // ─── 藥水分類 ───
  const carryPotions = potions.filter(p=>p.kind==="carry");
  const throwPotions = potions.filter(p=>p.kind==="throw");

  const bgUrl = bgImage || `/ui/battle-bg/bg_${monster?.family||"ghost"}_${((monster?.id?.charCodeAt(0)||0)%6)+1}.webp`;

  // ═══════════ Render ═══════════

  // ── 計分模式（只顯示計分層，無戰鬥容器）──
  if (scoringMode) {
    return (<div style={{position:"relative",width:380,maxWidth:"92vw",borderRadius:30,overflow:"hidden",boxShadow:"0 20px 50px rgba(0,0,0,.5), 0 0 0 8px #0a0e18, 0 0 0 9px rgba(255,255,255,.06)",userSelect:"none",background:"#0a1018"}}>
      {isScoring&&(<div style={{background:"linear-gradient(180deg,#101a2e,#0b1220)",borderRadius:"18px",padding:"16px 16px 20px",boxShadow:"0 -20px 50px rgba(0,0,0,.6)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:900,color:battle.arrows.length>=arrowsPerRound?"#f5b942":"#eef3fc"}}>{"\u2705"} 6 {battle.arrows.length>=arrowsPerRound?"確認無誤後送出":`箭已輸入，${battle.arrowIdx+1}`}</div>
          <div style={{fontSize:11,color:"#9fb0cf"}}>{Math.min(battle.arrows.length,arrowsPerRound)} / {arrowsPerRound}</div>
        </div>
        {scoreInput==="target"&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:10}}><TargetFace arrows={battle.arrows} onPick={battle.arrows.length<arrowsPerRound?handleScore:undefined}/><div style={{fontSize:11,color:"#9fb0cf",marginTop:4}}>點靶面對應環數計分</div></div>)}
        <div style={{display:"flex",gap:6,marginBottom:12,minHeight:36,alignItems:"center"}}>
          {Array.from({length:arrowsPerRound}).map((_,i)=>{const a=battle.arrows[i];return(<div key={i} style={{flex:1,height:34,borderRadius:9,border:a?(a.isCrit?"1px solid #fbbf24":"1px solid rgba(255,255,255,.2)"):(i===battle.arrowIdx?"2px solid #f5b942":"1px dashed rgba(255,255,255,.16)"),display:"grid",placeItems:"center",fontSize:14,fontWeight:900,color:a?"#eaf6ff":(i===battle.arrowIdx?"#f5b942":"#6b7a99"),background:a?(a.isCrit?"rgba(251,191,36,.18)":"rgba(255,255,255,.08)"):(i===battle.arrowIdx?"rgba(245,185,66,.12)":"rgba(255,255,255,.03)"),fontVariantNumeric:"tabular-nums",boxShadow:i===battle.arrowIdx?"0 0 0 2px rgba(245,185,66,.3)":"none"}}>{a?a.score:(i===battle.arrowIdx?"\u25bc":"")}</div>)})}
        </div>
        {scoreInput==="keypad"&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,opacity:battle.arrows.length>=arrowsPerRound?0.35:1,pointerEvents:battle.arrows.length>=arrowsPerRound?"none":"auto"}}>
          {scoreKeys.map(k=>(<button key={k} onClick={()=>handleScore(k)} style={{height:46,borderRadius:11,border:k==="X"?"1px solid rgba(245,185,66,.4)":k==="M"?"1px solid rgba(239,83,80,.4)":"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:k==="X"?"#f5b942":k==="M"?"#f87171":"#eef3fc",fontSize:18,fontWeight:800,cursor:"pointer",fontVariantNumeric:"tabular-nums"}}>{k}</button>))}
        </div>}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={handleUndo} disabled={battle.arrows.length===0} style={{flex:"0 0 auto",padding:"0 16px",height:46,borderRadius:11,border:"1px solid rgba(255,255,255,.14)",background:"rgba(255,255,255,.05)",color:battle.arrows.length===0?"#5a6b8a":"#cbd6ea",fontSize:14,fontWeight:800,cursor:battle.arrows.length===0?"not-allowed":"pointer"}}>刪除上一箭</button>
          <button onClick={handleScoringSubmit} disabled={battle.arrows.length<arrowsPerRound} style={{flex:1,height:46,borderRadius:11,border:"none",background:battle.arrows.length>=arrowsPerRound?"linear-gradient(180deg,#ffcf5a,#f5a623)":"rgba(255,255,255,.06)",color:battle.arrows.length>=arrowsPerRound?"#3a2600":"#5a6b8a",fontSize:16,fontWeight:900,cursor:battle.arrows.length>=arrowsPerRound?"pointer":"not-allowed",boxShadow:battle.arrows.length>=arrowsPerRound?"0 6px 18px rgba(245,166,35,.4)":"none"}}>{battle.arrows.length>=arrowsPerRound?"送出這一回合":`再輸入 ${arrowsPerRound-battle.arrows.length} 箭`}</button>
        </div>
      </div>)}
    </div>);
  }

  const containerStyle = fullScreen
    ? {position:"relative",width:"100%",height:"100%",maxWidth:540,margin:"0 auto",overflow:"hidden",isolation:"isolate",userSelect:"none",background:"#0a1018"}
    : {position:"relative",width:380,maxWidth:"92vw",aspectRatio:"9/19",borderRadius:30,overflow:"hidden",boxShadow:"0 30px 70px rgba(0,0,0,.6), 0 0 0 8px #0a0e18, 0 0 0 9px rgba(255,255,255,.06)",isolation:"isolate",userSelect:"none",background:"#0a1018"};
  return (<div style={containerStyle}>
    {/* 背景 */}
    <img src={bgUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none"}} />
    <div style={{position:"absolute",inset:0,zIndex:1,pointerEvents:"none",background:"linear-gradient(180deg,rgba(4,7,13,.5),transparent 20%,transparent 55%,rgba(4,7,13,.72))"}}>
      <div style={{position:"absolute",inset:0,boxShadow:"inset 0 0 120px 20px rgba(0,0,0,.55)"}} />
    </div>

    {/* 頂部資訊列 */}
    <div style={{position:"absolute",top:0,left:0,right:0,zIndex:5,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"7px 14px",fontSize:11,fontWeight:800,letterSpacing:".02em",color:"#dbe6f8",background:"linear-gradient(180deg,rgba(6,10,18,.9),rgba(6,10,18,.35))",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
      <span style={{color:"#fff"}}>{battleMode==="zombie"?"🧟 殭屍靶":"🎯 分數靶"}</span>
      <span style={{color:"#6b7a99"}}>·</span>
      <span>第 <b style={{color:inBattle?"#f5b942":"#6b7a99",fontVariantNumeric:"tabular-nums"}}>{inBattle?battle.round:"—"}</b> 回合</span>
      <BattleSoundIndicator compact />
    </div>

    {/* ── VS 進場 ── */}
    {isIntro&&(<div style={{position:"absolute",inset:0,zIndex:20,background:"linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
      <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-around",padding:"0 16px"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
          <div style={{display:"flex",alignItems:"flex-end",gap:0,animation:"introArc .6s cubic-bezier(.34,1.56,.64,1) both"}}>
            <CatSVG catId={player?.catId||"diandian"} size={80} />
            {hasCat&&(()=>{const fx=CAT_INTRO_EFFECTS[skillGroup]||CAT_INTRO_EFFECTS.heal;const particles=Array.from({length:fx.particleCount});return(<div style={{marginLeft:-8,marginBottom:-4,display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}}>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:100,height:100,background:fx.bgGradient,borderRadius:"50%",animation:"introCat .5s .3s cubic-bezier(.34,1.56,.64,1) both",opacity:0,pointerEvents:"none"}}/>
              {particles.map((_,i)=><div key={i} style={{position:"absolute",left:`${30+Math.sin(i*1.2)*35}%`,top:`${25+Math.cos(i*0.9)*35}%`,fontSize:10,animation:`catParticle .8s ${.35+i*0.08}s cubic-bezier(.34,1.56,.64,1) both`,opacity:0,pointerEvents:"none",filter:`drop-shadow(0 0 3px ${fx.colors[i%fx.colors.length]})`}}>{fx.particle}</div>)}
              <div style={{animation:"introCat .5s .3s cubic-bezier(.34,1.56,.64,1) both",opacity:0,position:"relative",zIndex:1}}><div style={{width:44,height:44,borderRadius:11,overflow:"hidden",boxShadow:`0 0 0 2px ${catGlowColor}66, ${fx.borderGlow}`}}><CatSVG catId={catId} size={44}/></div></div>
              <div style={{fontSize:7,fontWeight:900,color:fx.colors[0],background:`${fx.colors[0]}22`,border:`1px solid ${fx.colors[0]}44`,borderRadius:6,padding:"0 5px",animation:"introCat .5s .5s cubic-bezier(.34,1.56,.64,1) both",opacity:0,whiteSpace:"nowrap",zIndex:1}}>{fx.icon} {fx.label}</div>
              <div style={{fontSize:9,fontWeight:900,color:catGlowColor,textShadow:`0 0 8px ${catGlowColor}88,0 0 16px ${catGlowColor}44`,animation:"catCry .4s .7s cubic-bezier(.34,1.56,.64,1) both",opacity:0,whiteSpace:"nowrap",zIndex:1,letterSpacing:".04em"}}>{catBattleCry}</div>
            </div>)})()}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,animation:"introArc .6s cubic-bezier(.34,1.56,.64,1) both"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#c4b5fd",textShadow:"0 0 8px #7c3aed"}}>{player?.name||""}</div>
            {hasCat&&<div style={{fontSize:10,fontWeight:700,color:catGlowColor,textShadow:`0 0 6px ${catGlowColor}88`,animation:"introCat .5s .4s cubic-bezier(.34,1.56,.64,1) both",opacity:0}}>+ {catName}</div>}
          </div>
        </div>
        <div style={{animation:"introVs .8s .4s cubic-bezier(.34,1.56,.64,1) both"}}><div style={{fontSize:38,fontWeight:900,color:"#fbbf24",textShadow:"0 0 24px #f59e0b, 0 0 48px #f59e0b"}}>VS</div></div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,animation:"introMon .6s cubic-bezier(.34,1.56,.64,1) both"}}>
          <div style={{filter:"drop-shadow(0 0 16px #ef4444)"}}>{renderMonster ? renderMonster(80, monster) : <MonsterSVG id={monster?.id} size={80}/>}</div>
          <div style={{fontSize:12,fontWeight:700,color:"#fca5a5",textShadow:"0 0 8px #ef4444"}}>{battle.monsterName||monster?.name||""}</div>
        </div>
      </div>
      <div style={{marginTop:16,animation:"introStart .5s 1.2s cubic-bezier(.34,1.56,.64,1) both",opacity:0}}><div style={{fontSize:24,fontWeight:900,color:"#fff",textShadow:"0 0 24px #fbbf24",letterSpacing:4,textAlign:"center"}}>⚔️ 戰鬥開始！</div></div>
      <div style={{marginTop:4,fontSize:10,color:"#6b7a99",animation:"introStart .5s 1.6s both",opacity:0}}>{battleMode==="zombie"?"🧟 殭屍靶模式":"🎯 分數靶模式"}</div>
    </div>)}

    {/* ── 擊倒動畫 ── */}
    {isVictoryAnim&&(<div style={{position:"absolute",inset:0,zIndex:15,background:"linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,animation:"defFade .4s ease-out"}}>
      <div style={{position:"relative",display:"inline-block"}}>
        <div style={{animation:"defMon .2s ease-out both"}}>{renderMonster ? renderMonster(100, monster) : <MonsterSVG id={monster?.id} size={100}/>}</div>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",animation:"defBadge .5s .5s cubic-bezier(.34,1.56,.64,1) both",opacity:0,pointerEvents:"none"}}>
          <div style={{fontSize:24,fontWeight:900,color:"#ef4444",border:"4px solid #ef4444",borderRadius:8,padding:"4px 14px",letterSpacing:4,textShadow:"0 0 12px #ef4444",boxShadow:"0 0 18px #ef444488",background:"rgba(0,0,0,.55)",transform:"rotate(-8deg)"}}>擊倒</div>
        </div>
      </div>
      <div style={{animation:"defVictory .6s .8s cubic-bezier(.34,1.56,.64,1) both",opacity:0,textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:900,color:"#fbbf24",textShadow:"0 0 32px #f59e0b",letterSpacing:4}}>💀 擊倒！</div>
        <div style={{fontSize:13,color:"#94a3b8",marginTop:4}}>{battle.monsterName} 已被消滅</div>
      </div>
      <div style={{animation:"defStats .5s 1.2s ease-out both",opacity:0,display:"flex",gap:16}}>
        {[{icon:"🏹",label:"總傷害",value:battle.roundDmg},{icon:"🔄",label:"回合數",value:battle.round},{icon:"🔥",label:"爆擊",value:battle.roundCrits}].map((s,i)=>(<div key={i} style={{textAlign:"center"}}><div style={{fontSize:9,color:"#9fb0cf",fontWeight:700}}>{s.icon} {s.label}</div><div style={{fontSize:22,fontWeight:900,color:"#ffd27a",fontVariantNumeric:"tabular-nums"}}>{s.value}</div></div>))}
      </div>
    </div>)}

    {/* 🐱 貓貓訊息彈窗 */}
    {catMsg&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:25,background:"rgba(6,10,18,.88)",border:`1px solid ${catGlowColor}66`,borderRadius:16,padding:"10px 18px",fontSize:13,fontWeight:700,lineHeight:1.4,color:"#fff",backdropFilter:"blur(8px)",boxShadow:`0 0 30px ${catGlowColor}44, 0 0 60px ${catGlowColor}22`,animation:"msgIn .25s ease-out, catPulse 1.5s ease-in-out infinite",whiteSpace:"nowrap",pointerEvents:"none",textAlign:"center",borderLeft:`4px solid ${catGlowColor}`}}>{catMsg}</div>}

    {/* 戰鬥訊息 */}
    {showBattleUI&&<div style={{position:"absolute",zIndex:3,top:56,left:11,maxWidth:"46%",display:"flex",flexDirection:"column",gap:4,pointerEvents:"none"}}>
      {battle.messages.length>0&&(<div style={{background:"rgba(6,10,20,.88)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"6px 9px",maxHeight:104,overflowY:"auto",display:"flex",flexDirection:"column",gap:2,pointerEvents:"auto",boxShadow:"0 4px 14px rgba(0,0,0,.55)"}}>
        {battle.messages.slice(-4).map((m,i)=><div key={i} style={{fontSize:10.5,lineHeight:1.35,color:"#dce6f7",textShadow:"0 1px 2px rgba(0,0,0,.9)"}}>{m}</div>)}
      </div>)}
      {usedPotionInfo&&<div key={poofKey} style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(132,204,22,.4)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#bef264",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out"}}>⚗️ {usedPotionInfo.icon} <b>{usedPotionInfo.name}</b><span style={{color:"#9fb0cf",fontWeight:400,marginLeft:4}}>{usedPotionInfo.effectText}</span></div>}
      {isScoring&&battle.lastArrowDmg>0&&(<div style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#dce6f7",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out"}}>
        {battle.battleMode==="zombie"&&battle.arrows.length>0&&battle.arrows[battle.arrows.length-1]?.part?(<><b>{battle.arrows[battle.arrows.length-1].part.icon} {battle.arrows[battle.arrows.length-1].part.name}</b>{' ×'}{battle.arrows[battle.arrows.length-1].part.mult}</>):(<>箭{battle.arrowIdx} · <b style={{color:"#ffd27a"}}>{battle.lastArrowPart}</b></>)}
        {' · '}<b style={{color:battle.lastArrowCrit?"#fbbf24":"#ff7a7a"}}>{battle.lastArrowDmg}</b>{battle.lastArrowCrit&&<span style={{color:"#fbbf24",fontWeight:900}}> 💥</span>}
      </div>)}
      {isRoundRes&&(<div style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#dce6f7",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out"}}>回合合計 · <b style={{color:"#ffd27a"}}>{battle.roundDmg}</b> 傷害{battle.roundCrits>0&&<span style={{color:"#fbbf24",fontWeight:900}}> 🔥×{battle.roundCrits}</span>}</div>)}
      {isRoundRes&&battle.counterDmg>0&&(<div style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(231,76,60,.4)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#ffc4c2",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out .2s both"}}>怪物反擊 · <b style={{color:"#ff7a7a"}}>-{battle.counterDmg}</b> HP</div>)}
    </div>}

    {/* 逐箭命中特效 */}
    {isProcessing&&animStep>=1&&animStep<=6&&battle.arrows[animStep-1]&&<div key={`dmg-${animStep}`} style={{position:"absolute",zIndex:6,top:60,right:"14%",pointerEvents:"none",fontSize:battle.arrows[animStep-1].isCrit?36:26,fontWeight:900,color:battle.arrows[animStep-1].isCrit?"#fbbf24":"#ff9a9a",textShadow:"0 2px 10px rgba(0,0,0,.85)",fontVariantNumeric:"tabular-nums",animation:"dmgFloat .8s ease-out forwards"}}>-{battle.arrows[animStep-1].dmg}{battle.arrows[animStep-1].isCrit?" 💥":""}</div>}
    {isProcessing&&animStep>=1&&animStep<=6&&battle.arrows[animStep-1]?.isCrit&&<div key={`flash-${animStep}`} style={{position:"absolute",inset:0,zIndex:5,pointerEvents:"none",background:"radial-gradient(circle at 72% 20%, rgba(251,191,36,.4), transparent 55%)",animation:"critFlash .45s ease-out forwards"}}/>}

    {/* 怪物 */}
    <div style={{position:"absolute",zIndex:2,top:52,right:"4%",width:"47%",display:"flex",flexDirection:"column",alignItems:"center",gap:7,filter:"drop-shadow(0 16px 26px rgba(0,0,0,.6))",animation:isWon?"wonShake .5s ease-out":(isProcessing&&animStep>=1&&animStep<=6?(battle.arrows[animStep-1]?.isCrit?"hitShock .5s ease-out, procMonster .45s ease-out infinite":"procMonster .45s ease-out infinite"):(inBattle?"bob 4.6s ease-in-out infinite":"none"))}}>
      <div style={{width:"100%",borderRadius:18,overflow:"hidden",boxShadow:inBattle?(isWon?`0 0 0 3px #4ade80, 0 0 40px #4ade8060`:`0 0 0 2px ${familyColor}59, 0 0 26px ${familyColor}47`):"0 0 0 2px rgba(255,255,255,.12)",opacity:isWon?0.6:1,transition:"filter .3s",filter:isWon?"brightness(.5) saturate(.3)":"none"}}>{renderMonster ? renderMonster(180, monster) : <MonsterSVG id={monster?.id} size={180}/>}</div>
      <div style={{width:"88%"}}>
        <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:3}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,fontWeight:800,textShadow:"0 2px 6px #000"}}>
            <div style={{display:"flex",alignItems:"center",gap:4,minWidth:0,overflow:"hidden"}}>
              <b style={{color:"#fff",fontSize:12.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inBattle?battle.monsterName:monster?.name}{isWon&&" 💀"}</b>
              {monster?.variant?(()=>{const v=VARIANT_LABEL[monster.variant];if(!v)return null;return(<span style={{fontSize:8,fontWeight:900,padding:"1px 5px",borderRadius:4,color:v.color,background:v.bg,border:`1px solid ${v.color}55`,whiteSpace:"nowrap"}}>{v.label}</span>)})():null}
            </div>
            {(()=>{const t=TIER_LABEL[monster?.tier]||{};return(<span style={{fontSize:9,fontWeight:900,padding:"1px 6px",borderRadius:4,color:t.color,background:t.bg||"transparent",border:`1px solid ${t.color}44`,whiteSpace:"nowrap"}}>{t.label||monster?.tier||"?"}</span>)})()}
          </div>
          {isWon&&<div style={{fontSize:11,fontWeight:900,color:"#4ade80",textAlign:"center",textShadow:"0 2px 6px #000"}}>擊敗！</div>}
        </div>
        <div style={{height:7,borderRadius:99,background:"rgba(0,0,0,.55)",overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)"}}><div style={{width:`${hpPct}%`,height:"100%",borderRadius:99,background:isWon?"#4ade80":hpPct>60?"linear-gradient(90deg,#ff7a7a,#e03b3b)":hpPct>30?"linear-gradient(90deg,#fbbf24,#ea580c)":"linear-gradient(90deg,#f87171,#dc2626)",transition:"width .4s ease-out"}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:8.5,color:"#6b7a99",fontWeight:700,marginTop:2,fontVariantNumeric:"tabular-nums"}}><span>HP</span><span><b style={{color:inBattle?"#dce8fb":"#6b7a99"}}>{inBattle?battle.monsterHp.toLocaleString():"?"}</b> / {inBattle?battle.monsterMaxHp.toLocaleString():"?"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:8.5,color:"#6b7a99",fontWeight:700,marginTop:1,fontVariantNumeric:"tabular-nums"}}><span>ATK</span><span><b style={{color:inBattle?"#fca5a5":"#6b7a99"}}>{inBattle?battle.monsterAtk:monster?.atk||0}</b></span></div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:8.5,color:"#6b7a99",fontWeight:700,marginTop:1,fontVariantNumeric:"tabular-nums"}}><span>DEF</span><span><b style={{color:inBattle?"#93c5fd":"#6b7a99"}}>{inBattle?battle.monsterDef:monster?.def||0}</b></span></div>
      </div>
    </div>

    {/* 隊友 + 玩家 */}
    <div style={{position:"absolute",left:12,bottom:14,zIndex:4,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-start"}}>
      {allies.length>0&&(<div style={{width:180,display:"flex",flexWrap:"wrap",gap:7,background:"rgba(9,14,25,.4)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:7}}>
        {allies.map((mate,i)=>{const fx=(isProcessing&&animStep>=1&&animStep<=6)?teamFx[i]:null;const frameC=fx==="crit"?"#f5b942":fx==="miss"?"#555":(mate.isFront||mate.role==="front"?"#ffb454":"#7dd3fc");const critGlow=fx==="crit"?", 0 0 14px rgba(245,185,66,.85)":"";const missDim=fx==="miss";return(<div key={i} style={{position:"relative",width:38}}>
          <div style={{width:38,height:38,borderRadius:11,overflow:"hidden",boxShadow:`0 4px 10px rgba(0,0,0,.55), inset 0 0 0 2px ${frameC}${critGlow}`,filter:missDim?"grayscale(1) brightness(.45)":"none",transition:"box-shadow .2s, filter .2s",animation:fx?"teamAttack .6s ease-out":"none"}}><CatSVG catId={mate.catId} size={38}/></div>
          <div style={{height:4,borderRadius:99,background:"rgba(0,0,0,.6)",marginTop:3,overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)"}}><div style={{width:`${(mate.hp/mate.maxHp)*100}%`,height:"100%",background:"linear-gradient(90deg,#5ff0a3,#22b866)"}}/></div>
          <div style={{position:"absolute",top:-5,right:-5,width:17,height:17,borderRadius:99,display:"grid",placeItems:"center",fontSize:10,fontWeight:900,background:mate.done||mate.ready?"#22c866":"rgba(245,185,66,.2)",boxShadow:mate.done||mate.ready?"0 0 0 2px #0b1220":"0 0 0 2px rgba(245,185,66,.45)",color:mate.done||mate.ready?"#0a1f12":"#f5b942",animation:mate.done||mate.ready?"none":"admPulse 1.4s infinite"}}>{mate.done||mate.ready?"✓":"⏳"}</div>
          <div style={{position:"absolute",bottom:14,left:-4,fontSize:8,fontWeight:900,padding:"1px 4px",borderRadius:5,color:"#111",background:mate.isFront||mate.role==="front"?"#ffb454":"#7dd3fc"}}>{mate.isFront||mate.role==="front"?"前":"後"}</div>
        </div>)})}
      </div>)}

      {/* 玩家卡 */}
      {(()=>{const frame=FRAME_TIERS[player?.cardFrame||"none"]||FRAME_TIERS.none;const curAtk=inBattle?battle.playerAtk:(player?.atk||0);const curDef=inBattle?battle.playerDef:(player?.def||0);const atkUp=inBattle&&battle.playerAtk>(player?.atk||0);const defUp=inBattle&&battle.playerDef>(player?.def||0);const curArrow=(isProcessing&&animStep>=1&&animStep<=6)?battle.arrows[animStep-1]:null;const atkFrameC=curArrow?(curArrow.isCrit?"#f5b942":curArrow.score==="M"?"#555":frame.c):frame.c;const atkGlow=curArrow?.isCrit?"rgba(245,185,66,.75)":frame.glow;const cardAnim=curArrow?(curArrow.score==="M"?"playerMiss .5s ease-out":"playerAttack .5s ease-out"):(isProcessing&&animStep===8?"playerHurt .5s ease-out":"none");return(<div key={`pc-${isProcessing?animStep:"idle"}`} style={{width:214,background:"rgba(9,14,25,.62)",border:`2px solid ${atkFrameC}`,borderRadius:15,padding:"8px 10px",backdropFilter:"blur(8px)",boxShadow:`0 6px 18px rgba(0,0,0,.45), 0 0 ${curArrow?.isCrit?20:14}px ${atkGlow}`,animation:cardAnim}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:56,height:56,borderRadius:13,flexShrink:0,overflow:"hidden",boxShadow:`0 4px 12px rgba(0,0,0,.5), inset 0 0 0 2px ${frame.c}`}}><CatSVG catId={player?.catId||"diandian"} size={56}/></div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:14,fontWeight:900}}>{player?.name}<span style={{fontSize:8.5,fontWeight:900,color:"#241400",background:"#f5b942",borderRadius:5,padding:"1px 5px",letterSpacing:".05em"}}>你</span><span style={{fontSize:9.5,fontWeight:800,color:"#04222e",background:"#4cc9f0",borderRadius:5,padding:"1px 5px"}}>Lv.{player?.lv||"?"}</span></div>
            <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#9fb0cf",fontVariantNumeric:"tabular-nums",margin:"4px 0 3px"}}><StatGlyph type="hp" color="#5ff0a3" /><b style={{color:"#dce8fb"}}>{inBattle?battle.playerHp.toLocaleString():(player?.hp||0).toLocaleString()}</b> / {(player?.maxHp||0).toLocaleString()}</div>
            <div style={{height:8,borderRadius:99,background:"rgba(0,0,0,.55)",overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)"}}><div style={{width:`${playerHpPct}%`,height:"100%",borderRadius:99,background:playerHpPct>60?"linear-gradient(90deg,#5ff0a3,#22b866)":playerHpPct>30?"linear-gradient(90deg,#fbbf24,#ea580c)":"linear-gradient(90deg,#f87171,#dc2626)",transition:"width .4s ease-out"}}/></div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginTop:7}}>
          <div style={{flex:1,display:"flex",gap:6}}>
            <div style={{flex:1,background:"rgba(255,255,255,.05)",borderRadius:8,padding:"3px 7px",fontVariantNumeric:"tabular-nums"}}><span style={{fontSize:9,color:"#9fb0cf",fontWeight:700}}>ATK </span><b style={{fontSize:12,color:atkUp?"#5ff0a3":"#f4a3a3"}}>{curAtk}{atkUp?" ▲":""}</b></div>
            <div style={{flex:1,background:"rgba(255,255,255,.05)",borderRadius:8,padding:"3px 7px",fontVariantNumeric:"tabular-nums"}}><span style={{fontSize:9,color:"#9fb0cf",fontWeight:700}}>DEF </span><b style={{fontSize:12,color:defUp?"#5ff0a3":"#a3c4f4"}}>{curDef}{defUp?" ▲":""}</b></div>
          </div>
          {hasCat&&<div style={{display:"flex",alignItems:"center",gap:5,paddingLeft:6,borderLeft:"1px solid rgba(255,255,255,.1)"}} title={`${catName} · ${catTypeLabel}`}>
            <div style={{width:30,height:30,borderRadius:8,overflow:"hidden",flexShrink:0,boxShadow:`inset 0 0 0 2px ${catGlowColor}${catCurrentHP>0?"":"55"}`,filter:catCurrentHP<=0?"grayscale(1) brightness(.45)":"none"}}><CatSVG catId={catId} size={30}/></div>
            <div style={{minWidth:32}}><div style={{fontSize:8.5,fontWeight:900,color:catCurrentHP>0?"#c4b5fd":"#6b7280"}}>{catName}{catCurrentHP<=0?" 💀":""}</div><div style={{height:3,borderRadius:99,background:"rgba(0,0,0,.6)",overflow:"hidden",marginTop:2}}><div style={{width:`${(catCurrentHP||catMaxHP)/Math.max(1,catMaxHP)*100}%`,height:"100%",background:catCurrentHP>0?"linear-gradient(90deg,#a78bfa,#7c3aed)":"#555"}}/></div></div>
          </div>}
        </div>
      </div>)})()}
    </div>

    {/* 右側選單 */}
    <div style={{position:"absolute",zIndex:4,right:12,bottom:14,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
      {!inBattle&&<Btn label="開始戰鬥" primary onClick={handleStartBattle} icon={<span style={{fontSize:16,flexShrink:0}}>⚔️</span>}/>}
      {isPlaying&&<Btn label="射　擊" primary onClick={()=>dispatch({type:"START_SCORING",arrowsPerRound})} icon={<svg style={{width:16,height:16,flexShrink:0}} viewBox="0 0 24 24" fill="none" stroke="#241400" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>}/>}
      {isRoundRes&&<Btn label="下一回合" primary onClick={handleNextRound} icon={<span style={{fontSize:16,flexShrink:0}}>➡️</span>}/>}
      {(isWon||isLost)&&<Btn label="再來一次" primary onClick={handleReset} icon={<span style={{fontSize:16,flexShrink:0}}>🔄</span>}/>}
      <Btn label={usedPotionInfo?"已用藥水":"藥　水"} disabled={!inBattle||isScoring||!!usedPotionInfo} onClick={()=>setShowPotionPanel(true)} icon={<span style={{fontSize:16,flexShrink:0}}>{usedPotionInfo?.icon||"🧪"}</span>}/>
      {inBattle&&<Btn label="重置" onClick={handleReset} icon={<span style={{fontSize:16,flexShrink:0}}>↺</span>}/>}
    </div>

    {/* ── 藥水面板 ── */}
    {showPotionPanel&&inBattle&&(<div style={{position:"absolute",inset:0,zIndex:12,background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{background:"linear-gradient(180deg,#101a2e,#0b1220)",borderTop:"1px solid rgba(255,255,255,.12)",borderRadius:"22px 22px 0 0",padding:"14px 14px 20px",boxShadow:"0 -20px 50px rgba(0,0,0,.6)",maxHeight:"70%",overflowY:"auto",animation:"rise .28s cubic-bezier(.2,.9,.3,1)"}}>
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <button onClick={()=>setPotionTab("carry")} style={{flex:1,padding:"8px 0",borderRadius:10,border:potionTab==="carry"?"1px solid #22c866":"1px solid rgba(255,255,255,.12)",background:potionTab==="carry"?"rgba(34,200,102,.18)":"rgba(255,255,255,.05)",color:potionTab==="carry"?"#4ade80":"#9fb0cf",fontWeight:900,fontSize:12,cursor:"pointer"}}>🧪 攜帶型</button>
          <button onClick={()=>setPotionTab("throw")} style={{flex:1,padding:"8px 0",borderRadius:10,border:potionTab==="throw"?"1px solid #f87171":"1px solid rgba(255,255,255,.12)",background:potionTab==="throw"?"rgba(248,113,113,.18)":"rgba(255,255,255,.05)",color:potionTab==="throw"?"#f87171":"#9fb0cf",fontWeight:900,fontSize:12,cursor:"pointer"}}>🔪 投擲型</button>
          <button onClick={()=>setShowPotionPanel(false)} style={{padding:"8px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:"#6b7a99",fontWeight:800,fontSize:12,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {(potionTab==="carry"?carryPotions:throwPotions).map(p=>(<button key={p.id} onClick={()=>potionTab==="carry"?useCarryPotion(p):useThrowPotion(p)} disabled={!!usedPotionInfo} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(255,255,255,.08)",background:usedPotionInfo?"rgba(255,255,255,.02)":"rgba(255,255,255,.05)",cursor:usedPotionInfo?"not-allowed":"pointer",opacity:usedPotionInfo?0.4:1,textAlign:"left",width:"100%",transition:"all .12s"}} onMouseEnter={e=>{if(!usedPotionInfo)e.currentTarget.style.background="rgba(255,255,255,.1)";}} onMouseLeave={e=>{if(!usedPotionInfo)e.currentTarget.style.background="rgba(255,255,255,.05)";}}>
            <span style={{fontSize:20}}>{p.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:900,color:"#eef3fc"}}>{p.name}<span style={{fontSize:9,fontWeight:700,marginLeft:6,color:p.rarity==="uncommon"?"#4ade80":p.rarity==="rare"?"#60a5fa":"#9fb0cf"}}>{p.rarity==="common"?"普通":p.rarity==="uncommon"?"高級":"稀有"}</span></div>
              <div style={{fontSize:10,color:"#9fb0cf",marginTop:1}}>{p.effectText}</div>
            </div>
            <span style={{fontSize:10,fontWeight:800,color:usedPotionInfo?"#6b7a99":"#f5b942"}}>{usedPotionInfo?"已用":"使用"}</span>
          </button>))}
        </div>
      </div>
    </div>)}

    {/* ── 計分覆蓋層 ── */}
    {isScoring&&(<div style={{position:"absolute",inset:0,zIndex:10,background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{background:"linear-gradient(180deg,#101a2e,#0b1220)",borderTop:"1px solid rgba(255,255,255,.12)",borderRadius:"22px 22px 0 0",padding:"16px 16px 20px",boxShadow:"0 -20px 50px rgba(0,0,0,.6)",animation:"rise .28s cubic-bezier(.2,.9,.3,1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:900,color:battle.arrows.length>=arrowsPerRound?"#f5b942":"#eef3fc"}}>{battle.arrows.length>=arrowsPerRound?"✅ 6 箭已輸入，確認無誤後送出":`輸入第 ${battle.arrowIdx+1} 箭分數`}</div>
          <div style={{fontSize:11,color:"#9fb0cf"}}>{Math.min(battle.arrows.length,arrowsPerRound)} / {arrowsPerRound} 箭</div>
        </div>
        {scoreInput==="target"&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:10}}><TargetFace arrows={battle.arrows} onPick={battle.arrows.length<arrowsPerRound?handleScore:undefined}/><div style={{fontSize:11,color:"#9fb0cf",marginTop:4}}>👆 點靶面對應環數計分</div></div>)}
        <div style={{display:"flex",gap:6,marginBottom:12,minHeight:36,alignItems:"center"}}>
          {Array.from({length:arrowsPerRound}).map((_,i)=>{const a=battle.arrows[i];return(<div key={i} style={{flex:1,height:34,borderRadius:9,border:a?(a.isCrit?"1px solid #fbbf24":"1px solid rgba(255,255,255,.2)"):(i===battle.arrowIdx?"2px solid #f5b942":"1px dashed rgba(255,255,255,.16)"),display:"grid",placeItems:"center",fontSize:14,fontWeight:900,color:a?"#eaf6ff":(i===battle.arrowIdx?"#f5b942":"#6b7a99"),background:a?(a.isCrit?"rgba(251,191,36,.18)":"rgba(255,255,255,.08)"):(i===battle.arrowIdx?"rgba(245,185,66,.12)":"rgba(255,255,255,.03)"),fontVariantNumeric:"tabular-nums",boxShadow:i===battle.arrowIdx?"0 0 0 2px rgba(245,185,66,.3)":"none"}}>{a?a.score:(i===battle.arrowIdx?"▼":"")}</div>)})}
        </div>
        {scoreInput==="keypad"&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,opacity:battle.arrows.length>=arrowsPerRound?0.35:1,pointerEvents:battle.arrows.length>=arrowsPerRound?"none":"auto"}}>
          {scoreKeys.map(k=>(<button key={k} onClick={()=>handleScore(k)} style={{height:46,borderRadius:11,border:k==="X"?"1px solid rgba(245,185,66,.4)":k==="M"?"1px solid rgba(239,83,80,.4)":"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:k==="X"?"#f5b942":k==="M"?"#f87171":"#eef3fc",fontSize:18,fontWeight:800,cursor:"pointer",fontVariantNumeric:"tabular-nums",transition:"transform .1s, background .1s"}} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.11)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";}} onMouseDown={e=>{e.currentTarget.style.transform="scale(.93)";}} onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";}}>{k}</button>))}
        </div>}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={handleUndo} disabled={battle.arrows.length===0} style={{flex:"0 0 auto",padding:"0 16px",height:46,borderRadius:11,border:"1px solid rgba(255,255,255,.14)",background:"rgba(255,255,255,.05)",color:battle.arrows.length===0?"#5a6b8a":"#cbd6ea",fontSize:14,fontWeight:800,cursor:battle.arrows.length===0?"not-allowed":"pointer"}}>⌫ 刪除上一箭</button>
          <button onClick={handleSubmit} disabled={battle.arrows.length<arrowsPerRound} style={{flex:1,height:46,borderRadius:11,border:"none",background:battle.arrows.length>=arrowsPerRound?"linear-gradient(180deg,#ffcf5a,#f5a623)":"rgba(255,255,255,.06)",color:battle.arrows.length>=arrowsPerRound?"#3a2600":"#5a6b8a",fontSize:16,fontWeight:900,cursor:battle.arrows.length>=arrowsPerRound?"pointer":"not-allowed",boxShadow:battle.arrows.length>=arrowsPerRound?"0 6px 18px rgba(245,166,35,.4)":"none",transition:"transform .1s"}} onMouseDown={e=>{if(battle.arrows.length>=arrowsPerRound)e.currentTarget.style.transform="scale(.97)";}} onMouseUp={e=>{e.currentTarget.style.transform="scale(1)";}}>{battle.arrows.length>=arrowsPerRound?"🏹 送出這一回合":`再輸入 ${arrowsPerRound-battle.arrows.length} 箭`}</button>
        </div>
      </div>
    </div>)}

    {/* 貓貓協戰 */}
    {isProcessing&&animStep===7&&<div key="cat-step" style={{position:"absolute",inset:0,zIndex:9,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",animation:"defFade .25s ease-out"}}>
      <div style={{background:"rgba(6,10,18,.85)",border:`1px solid ${catGlowColor}66`,borderRadius:16,padding:"12px 24px",boxShadow:`0 0 30px ${catGlowColor}44`,animation:"pop .3s cubic-bezier(.2,.9,.3,1)",textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:900,color:"#fff",marginBottom:2}}>🐱 {catName} 協戰攻擊！</div>
        <div style={{fontSize:12,color:catGlowColor,fontWeight:700}}>造成 {Math.round(catATK*0.8)} 傷害</div>
      </div>
    </div>}

    {/* 怪物反擊 */}
    {isProcessing&&animStep===8&&<div key="counter-step" style={{position:"absolute",inset:0,zIndex:9,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",animation:"defFade .25s ease-out"}}>
      <div style={{background:"rgba(30,10,10,.88)",border:"1px solid rgba(239,83,80,.5)",borderRadius:16,padding:"12px 24px",boxShadow:"0 0 30px rgba(239,83,80,.3)",animation:"pop .3s cubic-bezier(.2,.9,.3,1)",textAlign:"center"}}>
        <div style={{fontSize:14,fontWeight:900,color:"#f87171",marginBottom:2}}>💥 怪物反擊！</div>
        <div style={{fontSize:12,color:"#ffc4c2",fontWeight:700}}>{(player?.name||"")} 受到 {battle.counterDmg} 傷害</div>
      </div>
    </div>}

    {/* 回合前事件 */}
    {roundEvent&&isPlaying&&(<div onClick={()=>setRoundEvent(null)} style={{position:"absolute",inset:0,zIndex:11,background:"rgba(4,7,13,.5)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:260,textAlign:"center",background:"linear-gradient(180deg,#141f36,#0c1424)",border:`1px solid ${roundEvent.color}66`,borderRadius:18,padding:"22px 18px",boxShadow:`0 20px 60px rgba(0,0,0,.6), 0 0 34px ${roundEvent.color}33`,animation:"pop .26s cubic-bezier(.2,.9,.3,1)"}}>
        <div style={{fontSize:11,fontWeight:800,color:"#9fb0cf",letterSpacing:".1em",marginBottom:6}}>回合開始前 · 特殊事件</div>
        <div style={{fontSize:44,marginBottom:6}}>{roundEvent.icon}</div>
        <div style={{fontSize:20,fontWeight:900,color:roundEvent.color,marginBottom:6}}>{roundEvent.title}</div>
        <div style={{fontSize:12,color:"#c7d3e6",lineHeight:1.6,marginBottom:16}}>{roundEvent.desc}</div>
        <button onClick={()=>setRoundEvent(null)} style={{width:"100%",padding:11,borderRadius:11,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${roundEvent.color},${roundEvent.color}bb)`,color:"#0b1220",fontSize:14,fontWeight:900,letterSpacing:".05em"}}>了解，開始這回合</button>
      </div>
    </div>)}

    {/* ── 回合結果 ── */}
    {isRoundRes&&(<div style={{position:"absolute",inset:0,zIndex:10,background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{background:"linear-gradient(180deg,#101a2e,#0b1220)",borderTop:"1px solid rgba(255,255,255,.12)",borderRadius:"22px 22px 0 0",padding:"16px 16px 20px",boxShadow:"0 -20px 50px rgba(0,0,0,.6)",animation:"rise .28s cubic-bezier(.2,.9,.3,1)"}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:900,color:"#eef3fc",marginBottom:6}}>🏹 第 {battle.round} 回合 結算</div>
          <div style={{display:"flex",justifyContent:"center",gap:24}}>
            <div><div style={{fontSize:10,color:"#9fb0cf",fontWeight:700}}>造成傷害</div><div style={{fontSize:24,fontWeight:900,color:"#ffd27a",fontVariantNumeric:"tabular-nums"}}>{battle.roundDmg}</div></div>
            <div style={{width:1,background:"rgba(255,255,255,.1)"}}/>
            <div><div style={{fontSize:10,color:"#9fb0cf",fontWeight:700}}>爆擊</div><div style={{fontSize:24,fontWeight:900,color:"#fbbf24",fontVariantNumeric:"tabular-nums"}}>🔥{battle.roundCrits}</div></div>
            <div style={{width:1,background:"rgba(255,255,255,.1)"}}/>
            <div><div style={{fontSize:10,color:"#9fb0cf",fontWeight:700}}>反擊</div><div style={{fontSize:24,fontWeight:900,color:"#ff7a7a",fontVariantNumeric:"tabular-nums"}}>-{battle.counterDmg}</div></div>
          </div>
        </div>
        <button onClick={handleNextRound} style={{width:"100%",padding:13,borderRadius:11,background:"linear-gradient(135deg,#f7c65a,#e79a1e)",color:"#241400",fontSize:16,fontWeight:900,border:"none",cursor:"pointer",letterSpacing:".06em"}}>下一回合 ➡️</button>
      </div>
    </div>)}

    {/* ── 勝利 ── */}
    {isWon&&(<div style={{position:"absolute",inset:0,zIndex:10,background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:280,background:"linear-gradient(180deg,#0f2a1e,#0a1f14)",border:"1px solid rgba(74,222,128,.35)",borderRadius:18,padding:"28px 20px",boxShadow:"0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(74,222,128,.15)",animation:"pop .24s cubic-bezier(.2,.9,.3,1)",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:10}}>🏆</div>
        <div style={{fontSize:22,fontWeight:900,color:"#4ade80",marginBottom:6}}>戰鬥勝利！</div>
        <div style={{fontSize:12,color:"#9fb0cf",lineHeight:1.6,marginBottom:16}}>花了 <b style={{color:"#dbe6f8"}}>{battle.round}</b> 回合擊敗了 <b style={{color:"#dbe6f8"}}>{battle.monsterName}</b><br/>總傷害：<b style={{color:"#ffd27a"}}>{battle.totalDmgAllRounds}</b></div>
        <button onClick={handleReset} style={{width:"100%",padding:12,borderRadius:11,background:"linear-gradient(135deg,#4ade80,#22b866)",color:"#0a1f14",fontSize:15,fontWeight:900,border:"none",cursor:"pointer",letterSpacing:".06em"}}>🔄 再戰一次</button>
      </div>
    </div>)}

    {/* ── 敗北 ── */}
    {isLost&&(<div style={{position:"absolute",inset:0,zIndex:10,background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:280,background:"linear-gradient(180deg,#2a0f0f,#1a0a0a)",border:"1px solid rgba(239,83,80,.35)",borderRadius:18,padding:"28px 20px",boxShadow:"0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(239,83,80,.15)",animation:"pop .24s cubic-bezier(.2,.9,.3,1)",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:10}}>💀</div>
        <div style={{fontSize:22,fontWeight:900,color:"#f87171",marginBottom:6}}>戰鬥敗北...</div>
        <div style={{fontSize:12,color:"#9fb0cf",lineHeight:1.6,marginBottom:16}}>在第 <b style={{color:"#dbe6f8"}}>{battle.round}</b> 回合被 <b style={{color:"#dbe6f8"}}>{battle.monsterName}</b> 擊倒<br/>怪物還剩 <b style={{color:"#f87171"}}>{battle.monsterHp.toLocaleString()}</b> HP</div>
        <button onClick={handleReset} style={{width:"100%",padding:12,borderRadius:11,background:"linear-gradient(135deg,#f87171,#dc2626)",color:"#fff",fontSize:15,fontWeight:900,border:"none",cursor:"pointer",letterSpacing:".06em"}}>🔄 重來一次</button>
      </div>
    </div>)}

    <style>{`@keyframes bob{50%{transform:translateY(-8px)}}@keyframes rise{from{transform:translateY(60px);opacity:0}}@keyframes pop{from{transform:scale(.9);opacity:0}}@keyframes msgIn{from{transform:translateX(-20px);opacity:0}}@keyframes admPulse{50%{opacity:.4}}@keyframes wonShake{0%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}100%{transform:rotate(0)}}@keyframes introArc{from{opacity:0;transform:translateX(-90px) scale(.6)}to{opacity:1;transform:translateX(0) scale(1)}}@keyframes introMon{from{opacity:0;transform:translateX(90px) scale(.6)}to{opacity:1;transform:translateX(0) scale(1)}}@keyframes introVs{0%{opacity:0;transform:scale(.2) rotate(-18deg)}55%{transform:scale(1.3) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}@keyframes introStart{from{opacity:0;transform:translateY(18px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes introCat{from{opacity:0;transform:translateX(-30px) scale(.5) rotate(-12deg)}to{opacity:1;transform:translateX(0) scale(1) rotate(0)}}@keyframes defFade{from{opacity:0}to{opacity:1}}@keyframes defMon{0%{filter:brightness(1)}20%{filter:brightness(3.5) drop-shadow(0 0 40px #ef4444)}100%{filter:brightness(.1) grayscale(.8) drop-shadow(0 0 6px #555)}}@keyframes defBadge{0%{opacity:0;transform:scale(2.2) rotate(-20deg)}55%{opacity:1;transform:scale(.92) rotate(6deg)}100%{opacity:1;transform:scale(1) rotate(-8deg)}}@keyframes defVictory{0%{opacity:0;transform:scale(.3) rotate(-12deg)}55%{transform:scale(1.2) rotate(3deg)}100%{opacity:1;transform:scale(1) rotate(0)}}@keyframes defStats{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes catPulse{50%{filter:drop-shadow(0 0 6px var(--cat-glow,#a78bfa))}}@keyframes catCry{0%{opacity:0;transform:scale(.3) translateY(8px)}55%{opacity:1;transform:scale(1.2) translateY(-2px)}100%{opacity:1;transform:scale(1) translateY(0)}}@keyframes catParticle{0%{opacity:0;transform:scale(0) translateY(10px) rotate(0deg)}50%{opacity:1;transform:scale(1.3) translateY(-15px) rotate(180deg)}100%{opacity:0;transform:scale(.5) translateY(-30px) rotate(360deg)}}@keyframes procMonster{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px) rotate(-2deg)}75%{transform:translateX(6px) rotate(2deg)}}@keyframes dmgFloat{0%{opacity:0;transform:translateY(6px) scale(.6)}25%{opacity:1;transform:translateY(-6px) scale(1.15)}100%{opacity:0;transform:translateY(-38px) scale(1)}}@keyframes critFlash{0%{opacity:0}30%{opacity:1}100%{opacity:0}}@keyframes hitShock{0%{filter:brightness(1)}15%{filter:brightness(2.6) drop-shadow(0 0 18px #fff)}100%{filter:brightness(1)}}@keyframes playerAttack{0%{transform:translateY(0)}35%{transform:translateY(-14px)}100%{transform:translateY(0)}}@keyframes playerMiss{0%,100%{transform:translateY(0);opacity:1}40%{transform:translateY(3px);opacity:.65}}@keyframes playerHurt{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}45%{transform:translateX(6px)}70%{transform:translateX(-3px)}}@keyframes teamAttack{0%{transform:translateY(0)}40%{transform:translateY(-10px)}100%{transform:translateY(0)}}`}</style>
  </div>);
});

export { PHASE, initBattle, battleReducer, TargetFace, computeUnlocked };
export default BattleScreen;
