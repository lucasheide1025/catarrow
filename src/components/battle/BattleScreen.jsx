// src/components/battle/BattleScreen.jsx
// 新一代統一戰鬥 UI 元件 — props-driven，支援單人/組隊/地下城/世界王

import { useState, useReducer, useMemo, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import MonsterSVG from "../MonsterSVG";
import CatSVG from "../cat/CatSVG";
import { PlayerAvatar } from "../shared/PlayerAvatar";
import { resolveHitPart } from "../../lib/monsterData";
import { calcStandardArrowDmg, calcStandardCounter } from "../../lib/damage";
import { scoreToValue } from "../../lib/score";

import { CAT_SKILL_GROUPS, calcCatSkillChance, calcCatSkillEffect } from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
import { playBattleSound } from "../../lib/battleSound";
import BattleSoundIndicator from "../shared/BattleSoundIndicator";

// Event overlays must survive a BattleScreen remount (for example after a
// Firestore room update); otherwise the same round event is shown twice.
const displayedPartyEventTokens = new Set();
import { sfxTap } from "../../lib/sound";
import { TargetFaceInput } from "../shared/TargetFaceOverlay";
import { getTargetScoreLabels } from "../../lib/targetFace";
import { getMonsterScheduledAbility } from "../../lib/monsterSkillSchedule";
import { mergeCombatStatus, resolveSoloMonsterAbility } from "../../lib/soloMonsterAbilityEngine";
import { getSpecializationEffect } from "../../lib/equipmentSpecializationEngine";
import { getEquipSpecializations } from "../../lib/equipSpecializationDb";
import { addRoundArrows, subscribeCardCollection } from "../../lib/db";
import { getBreakRuleText } from "../../lib/combatSkillEngine";
import { calcCardCombatEffectsFromCollection } from "../../lib/cardTalents";
import { useAuth } from "../../hooks/useAuth";
import { createBattleScreenSnapshot, restoreBattleScreenSnapshot } from "../../lib/battleScreenSnapshot";

function StatGlyph({ type, color }) {
  const path = type === "hp" ? <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /> : type === "atk" ? <><path d="m14 5 5 5-9 9-5-5 9-9Z" /><path d="m4 20 3-3" /></> : <><path d="M12 3 19 6v5c0 4.5-3 7-7 10-4-3-7-5.5-7-10V6l7-3Z" /><path d="M9 12h6M12 9v6" /></>;
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>;
}

function BattlePlayerPortrait({ player, size }) {
  return player?.avatarId
    ? <PlayerAvatar avatarId={player.avatarId} size={size} />
    : <CatSVG catId={player?.catId || "diandian"} size={size} />;
}

function BattleIntroPortrait({ player, size, renderPlayer }) {
  const wbFrame = player?.battleCosmetics?.wbFrame;
  const frameColor = wbFrame?.color || "rgba(255,255,255,.22)";
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
      <div style={{ width:size, height:size, borderRadius:16, overflow:"hidden", border:`3px solid ${frameColor}`, boxShadow:wbFrame ? `0 0 18px ${frameColor}aa` : "0 4px 14px rgba(0,0,0,.5)" }}>
        {renderPlayer ? renderPlayer(size, player) : <BattlePlayerPortrait player={player} size={size} />}
      </div>
      {wbFrame && <div style={{ maxWidth:112, padding:"2px 6px", borderRadius:6, color:frameColor, background:`${frameColor}20`, border:`1px solid ${frameColor}88`, fontSize:9, fontWeight:900, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{wbFrame.title}</div>}
    </div>
  );
}

function ConsumableIcon({ potion, size = 24 }) {
  if (!potion?.asset || !Number.isFinite(potion?.spriteIndex)) {
    return <span style={{ width:size, height:size, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:size * 0.72 }}>{potion?.icon || "🧪"}</span>;
  }
  const col = potion.spriteIndex % 6;
  const row = Math.floor(potion.spriteIndex / 6);
  return <span aria-hidden="true" style={{ width:size, height:size, flexShrink:0, display:"inline-block", backgroundImage:`url(${potion.asset})`, backgroundRepeat:"no-repeat", backgroundSize:"600% 500%", backgroundPosition:`${col * 20}% ${row * 25}%` }} />;
}

function ExternalBattleDemo({ demo, catId }) {
  if (!demo) return null;
  const eventKey = String(demo.key).replace(/[^a-zA-Z0-9]/g, "");
  if (demo.type === "arrow") return <style key={demo.key}>{`@keyframes wbPlayerCardAttack${eventKey}{0%,100%{transform:translateY(0)}45%{transform:translateY(-30px)}}div[style*="min-width: 214px"]{animation:wbPlayerCardAttack${eventKey} .55s ease-out !important}`}</style>;
  if (demo.type === "counter") return <><style key={demo.key}>{`@keyframes wbPlayerCardHurt${eventKey}{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}@keyframes wbBossCounterSwing${eventKey}{0%,100%{transform:translateY(0)}45%{transform:translateY(44px)}}div[style*="min-width: 214px"]{animation:wbPlayerCardHurt${eventKey} .55s ease-out !important}`}</style><div key={`counter-dmg-${demo.key}`} style={{position:"absolute",zIndex:10,left:"18%",bottom:"26%",pointerEvents:"none",fontSize:24,fontWeight:900,color:"#fecaca",textShadow:"0 2px 8px #000",animation:"dmgFloat .85s ease-out forwards"}}> -{demo.damage} HP</div></>;
  if (demo.type === "cat") return <div key={demo.key} style={{ position:"absolute", inset:0, zIndex:8, pointerEvents:"none", overflow:"hidden" }}>
    <style>{`@keyframes wbCatCenterAttack{0%{opacity:0;transform:translate(-50%,40px) scale(.75)}18%{opacity:1}58%{opacity:1;transform:translate(-50%,-70px) scale(1.08)}100%{opacity:0;transform:translate(-50%,-82px) scale(.8)}}`}</style>
    <div style={{ position:"absolute", left:"50%", bottom:"36%", width:64, height:64, animation:"wbCatCenterAttack .9s ease-out forwards", filter:"drop-shadow(0 0 10px rgba(244,114,182,.9))" }}><CatSVG catId={catId || "diandian"} size={64}/></div>
    <div style={{ position:"absolute", left:"calc(50% + 42px)", bottom:"42%", minWidth:116, padding:"7px 10px", borderRadius:11, background:"rgba(18,12,35,.94)", border:`1px solid ${demo.skillTriggered ? "#fbbf24" : "#c4b5fd"}`, boxShadow:`0 0 16px ${demo.skillTriggered ? "rgba(251,191,36,.5)" : "rgba(196,181,253,.35)"}`, color:"#fff", fontSize:11, fontWeight:900, animation:"pop .25s ease-out" }}><div>🐾 貓咪協戰</div><div style={{ color:"#fda4af", marginTop:2 }}>造成 {demo.damage} 傷害</div><div style={{ color:demo.skillTriggered ? "#fcd34d" : "#cbd5e1", marginTop:2 }}>{demo.skillTriggered ? `✨ ${demo.skillLabel || "技能發動"}` : "一般攻擊"}</div></div>
  </div>;
  return null;
}

function MonsterVariantFx({ variant }) {
  const animationStyles = <style>{`@keyframes weakSweat{0%,100%{opacity:0;transform:translateY(-5px) scale(.7)}30%,68%{opacity:.88}86%{opacity:0;transform:translateY(18px) scale(1)}}@keyframes strongFlame{from{transform:translateY(2px) scale(.78);opacity:.45}to{transform:translateY(-7px) scale(1.08);opacity:.94}}@keyframes bossGoldPulse{0%,100%{opacity:.42;transform:scale(.92)}50%{opacity:.9;transform:scale(1.08)}}@keyframes bossSparkle{0%,100%{opacity:.1;transform:translateY(3px) scale(.65)}50%{opacity:1;transform:translateY(-6px) scale(1)}}`}</style>;
  if (variant === "weak") return <>{animationStyles}<div aria-hidden="true" style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"visible" }}>
    {[{left:"24%",top:"18%",delay:"0s"},{left:"70%",top:"29%",delay:".55s"},{left:"40%",top:"9%",delay:"1.1s"}].map((drop, index) => <span key={index} style={{ position:"absolute", ...drop, width:8, height:12, borderRadius:"70% 70% 70% 25%", transform:"rotate(45deg)", background:"linear-gradient(135deg,#e0f7ff,#38bdf8)", boxShadow:"0 1px 5px rgba(56,189,248,.72)", animation:`weakSweat 1.7s ${drop.delay} ease-in-out infinite` }} />)}
  </div></>;
  if (variant === "strong") return <>{animationStyles}<div aria-hidden="true" style={{ position:"absolute", inset:-10, pointerEvents:"none", display:"flex", alignItems:"flex-end", justifyContent:"space-around", overflow:"visible" }}>
    {[0,1,2,3,4].map(index => <span key={index} style={{ width:8 + (index % 2) * 3, height:18 + (index % 3) * 5, borderRadius:"70% 70% 70% 30%", transform:"rotate(45deg)", background:"linear-gradient(145deg,#fde68a 0%,#fb923c 48%,#ef4444 100%)", boxShadow:"0 0 8px rgba(249,115,22,.8)", animation:`strongFlame ${.75 + index * .1}s ${index * .12}s ease-in-out infinite alternate` }} />)}
  </div></>;
  if (variant === "boss") return <>{animationStyles}<div aria-hidden="true" style={{ position:"absolute", inset:-20, pointerEvents:"none", borderRadius:"50%", background:"radial-gradient(circle,rgba(255,245,157,.24) 0%,rgba(250,204,21,.16) 40%,transparent 70%)", filter:"blur(1px) drop-shadow(0 0 12px rgba(250,204,21,.65))", animation:"bossGoldPulse 2.8s ease-in-out infinite" }} />{[{left:"20%",top:"15%",delay:"0s"},{left:"75%",top:"33%",delay:".7s"},{left:"55%",top:"4%",delay:"1.25s"}].map((spark,index)=><span key={index} style={{position:"absolute",...spark,width:5,height:5,borderRadius:"50%",background:"#fff7b2",boxShadow:"0 0 8px #facc15",animation:`bossSparkle 1.8s ${spark.delay} ease-in-out infinite`}} />)}</>;
  return null;
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
  activeStatuses:[], lastAbilityResolution:null,
  // 招牌技能戰場狀態（signatureAbilityEngine）：怪物護盾/減傷、延遲攻擊、風險標記/挑戰加成
  monsterShield:0, monsterReducePct:0, monsterReduceRound:0, pendingDelayedMult:0, hqMarkPct:0, nextRoundDmgBuffPct:0,
  // 裝備專精（每 slot 一條啟用）：{ weapon:{trackId,level}|null, armor:..., accessory:... }
  equipSpec:null, monsterBossTagged:false,
  // 卡片天賦+族系套裝彙總（cardTalents.calcCardCombatEffects;null=未載入/訪客）
  cardFx:null,
};

function effectivePlayerStat(state, stat) {
  const base = stat === "atk" ? state.playerAtk : state.playerDef;
  const statusId = stat === "atk" ? "atkDown" : "defDown";
  const reduction = (state.activeStatuses || []).find(status => status.id === statusId)?.strength || 0;
  return Math.max(0, base * (1 - reduction / 100));
}

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
      const mMaxHp=Math.round((monster.maxHp ?? monster.hp)*diff.hp);const mHp=Math.min(mMaxHp,Math.round(monster.hp*diff.hp));const mAtk=Math.round(monster.atk*diff.atk);const mDef=Math.round(monster.def*diff.def);
      // 飾品「營養」：開場加最大 HP（equipmentSpecializationEngine）
      const equipSpec=action.equipSpec||null;
      const nutritionHp=equipSpec?.accessory?.trackId==="nutrition"?getSpecializationEffect("nutrition",equipSpec.accessory.level).maxHpFlat:0;
      const basePlayerMaxHp=(action.playerMaxHp||initBattle.playerMaxHp);
      const basePlayerHp=action.playerHp||action.playerMaxHp||initBattle.playerHp;
      // 卡片天賦/套裝：威嚇/破防（常駐壓怪物面板）、開場護盾
      const cardFx=action.cardFx||null;
      const fxAtk=cardFx?.monsterAtkDownPct?Math.max(1,Math.round(mAtk*(1-cardFx.monsterAtkDownPct/100))):mAtk;
      const fxDef=cardFx?.monsterDefDownPct?Math.max(0,Math.round(mDef*(1-cardFx.monsterDefDownPct/100))):mDef;
      const openShield=cardFx?.openingShieldPct?Math.round((basePlayerMaxHp+nutritionHp)*cardFx.openingShieldPct/100):0;
      return{...initBattle,phase:PHASE.INTRO,battleMode:battleMode||"score",monsterHp:mHp,monsterMaxHp:mHp,monsterAtk:fxAtk,monsterDef:fxDef,monsterName:monster.name,monsterFamily:monster.family,playerHp:basePlayerHp+nutritionHp,playerMaxHp:basePlayerMaxHp+nutritionHp,playerAtk:action.playerAtk||initBattle.playerAtk,playerDef:action.playerDef||initBattle.playerDef,potionShield:openShield,
      equipSpec,cardFx,monsterBossTagged:!!(monster.bossTagged||(monster.encounter&&monster.encounter!=="normal")),
      messages:[action.hideMonsterStats?`⚔️ 戰鬥開始！對上 ${monster.name}`:`⚔️ 戰鬥開始！對上 ${monster.name}（HP:${mHp} ATK:${mAtk} DEF:${mDef}）`,battleMode==="zombie"?"🧟 殭屍靶模式：分數決定命中部位，高部位倍率最高 ×3.0！":"🎯 分數靶模式：每箭依環數計算傷害。"]};
    }
    case"SCORE_ARROW":{
      if(state.arrowIdx>=action.arrowsPerRound)return state;
      const{score,battleMode,displayLabel}=action;const isX=score==="X";const numScore=isX?10:(score==="M"?0:score);const isZombie=battleMode==="zombie";
      let part=null,partMult=1.0,newUnlocked=new Set(state.unlockedParts||[]);
      if(isZombie){part=resolveHitPart(numScore,newUnlocked,isX);if(part){partMult=part.mult;if(part.id==="chest"){newUnlocked.add("chest");newUnlocked.add("heart");newUnlocked.add("lung");}if(part.id==="belly"){newUnlocked.add("belly");newUnlocked.add("kidney");}if(part.id==="groin"){newUnlocked.add("groin");newUnlocked.add("balls");}}}
      // 武器專精「破甲」：無視怪物防禦 X%（傷害公式吃 effDef）
      const wSpec=state.equipSpec?.weapon;
      let monDef=state.monsterDef;
      if(wSpec?.trackId==="armorBreak")monDef=Math.max(0,monDef*(1-getSpecializationEffect("armorBreak",wSpec.level).defenseIgnorePct/100));
      // 卡片天賦「穿甲」與專精破甲疊加
      if(state.cardFx?.armorPiercePct)monDef=Math.max(0,monDef*(1-state.cardFx.armorPiercePct/100));
      let dmg=action.previewDamage===false?0:calcStandardArrowDmg(numScore,effectivePlayerStat(state,"atk"),monDef,partMult,score);
      let extraCrit=false;
      if(dmg>0){
        // 武器專精「精準」（高品質命中）/「獵王」（王類）
        if(wSpec?.trackId==="precision"&&(isX||numScore>=8))dmg=Math.round(dmg*(1+getSpecializationEffect("precision",wSpec.level).highQualityDamagePct/100));
        if(wSpec?.trackId==="bossHunter"&&state.monsterBossTagged)dmg=Math.round(dmg*(1+getSpecializationEffect("bossHunter",wSpec.level).bossDamagePct/100));
        // 卡片天賦/套裝：傷害/高品質/對王加成、連擊爆擊率
        const fx=state.cardFx;
        if(fx?.damagePct)dmg=Math.round(dmg*(1+fx.damagePct/100));
        if(fx?.hqDamagePct&&(isX||numScore>=8))dmg=Math.round(dmg*(1+fx.hqDamagePct/100));
        if(fx?.bossDamagePct&&state.monsterBossTagged)dmg=Math.round(dmg*(1+fx.bossDamagePct/100));
        if(fx?.critRatePct&&!isX&&numScore>0&&Math.random()<fx.critRatePct/100){extraCrit=true;dmg=Math.round(dmg*1.3);}
        // 招牌自身減傷（期限內）→ 高品質標記加成（8環+/X）→ 挑戰完成加成
        if(state.monsterReducePct&&(state.monsterReduceRound||0)>=state.round)dmg=Math.max(1,Math.round(dmg*(1-state.monsterReducePct/100)));
        if(state.hqMarkPct&&(isX||numScore>=8))dmg=Math.round(dmg*(1+state.hqMarkPct/100));
        if(state.nextRoundDmgBuffPct)dmg=Math.round(dmg*(1+state.nextRoundDmgBuffPct/100));
      }
      const isCrit=action.previewDamage===false?false:(isZombie?(part&&part.mult>=1.8):(isX||extraCrit));
      const newArrows=[...state.arrows,{score,displayLabel:displayLabel||score,dmg,isCrit,part:isZombie?part:null}];
      return{...state,arrows:newArrows,arrowIdx:state.arrowIdx+1,unlockedParts:isZombie?newUnlocked:(state.unlockedParts||new Set()),lastArrowDmg:dmg,lastArrowCrit:isCrit,lastArrowPart:isZombie&&part?`${part.icon} ${part.name} ×${part.mult}`:(numScore===0?"脫靶":(isX?"X環":`${numScore}環`))};
    }
    case"UNDO_ARROW":{
      if(state.arrows.length===0)return state;const newArrows=state.arrows.slice(0,-1);const last=newArrows[newArrows.length-1];
      return{...state,arrows:newArrows,arrowIdx:newArrows.length,unlockedParts:computeUnlocked(newArrows),lastArrowDmg:last?last.dmg:0,lastArrowCrit:last?last.isCrit:false,lastArrowPart:last?(last.part?`${last.part.icon} ${last.part.name} ×${last.part.mult}`:""):""};
    }
    case"SUBMIT_ROUND":{
      const{skipCounter,counterReduce}=action;const totalDmg=state.arrows.reduce((s,a)=>s+a.dmg,0);const crits=state.arrows.filter(a=>a.isCrit).length;
      const reso=action.abilityResolution||null;
      // 多重狀態合併（同名刷新/最多3種/同能力40% cap 由 mergeCombatStatus 保證）;lowerStatDown 動態挑較低能力（天平裁界）
      const aSpec=state.equipSpec?.armor;
      const immunityEffect=aSpec?.trackId==="immunity"?getSpecializationEffect("immunity",aSpec.level):null;
      const fxSubmit=state.cardFx||{};
      const incomingList=(reso?.statuses&&reso.statuses.length?reso.statuses:(reso?.status?[reso.status]:[])).map(st=>{
        let next=st;
        if(next.id==="lowerStatDown"){const stat=state.playerAtk<=state.playerDef?"atk":"def";next={...next,id:`${stat}Down`,stat};}
        // 防具專精「免疫」：先降強度、再縮回合、最低 1 回合（PRD 順序）
        if(immunityEffect)next={...next,
          strength:typeof next.strength==="number"?Math.max(0,Math.round(next.strength*(1-immunityEffect.statusStrengthReductionPct/100)*10)/10):next.strength,
          duration:Math.max(1,(next.duration||1)-immunityEffect.statusDurationReduction)};
        // 鬼怪套裝：異常強度/持續再削（cardTalents）
        if(fxSubmit.statusStrengthReductionPct&&typeof next.strength==="number")next={...next,strength:Math.max(0,Math.round(next.strength*(1-fxSubmit.statusStrengthReductionPct/100)*10)/10)};
        if(fxSubmit.statusDurationReduction)next={...next,duration:Math.max(1,(next.duration||1)-fxSubmit.statusDurationReduction)};
        return next;
      });
      let activeStatuses=state.activeStatuses||[];
      for(const st of incomingList){
        activeStatuses=mergeCombatStatus(activeStatuses,st);
        activeStatuses=activeStatuses.map(status=>status.id===st.id?{...status,expiresAfterRound:state.round+(status.duration||1)}:status);
      }
      const poison=(state.activeStatuses||[]).find(status=>status.id==="poison"&&(status.expiresAfterRound||0)>=state.round);
      // 毒蟲套裝：毒傷減免（50=減半,100=免疫）
      const poisonMult=Math.max(0,1-(fxSubmit.poisonResistPct||0)/100);
      const poisonDamage=poison?Math.min(Math.max(0,state.playerHp-1),Math.ceil(state.playerMaxHp*(poison.strength||0)/100*poisonMult)):0;
      const statusState={...state,activeStatuses};
      // 反擊：招牌有傷害積木時「取代」標準反擊（含穿甲/破盾;倍率已含破解減幅）
      const effDef=effectivePlayerStat(statusState,"def");
      const skillMult=reso?.skillDamageMult||0;
      const baseCounter=skipCounter===true?0:calcStandardCounter(state.monsterAtk,skillMult>0?effDef*(1-(reso?.pierceDefPct||0)/100):effDef);
      const rawCounter=skillMult>0?Math.round(baseCounter*skillMult):baseCounter;
      // 上回合延遲攻擊（倍率已含當時破解減幅）本回合落地
      const delayedExtra=state.pendingDelayedMult?Math.round(calcStandardCounter(state.monsterAtk,effDef)*state.pendingDelayedMult):0;
      const shieldBase=Math.min(state.potionShield||0,state.monsterAtk*2);
      const shieldAbsorb=Math.round(shieldBase*(1-(skillMult>0?(reso?.pierceShieldPct||0):0)/100));
      // 防具專精「堅韌」（常駐減傷）/「守勢」（HP≤35% 時減傷）：套在破解減幅之後、護盾之前（PRD 19 順序）
      let armorReducePct=0;
      if(aSpec?.trackId==="tenacity")armorReducePct=getSpecializationEffect("tenacity",aSpec.level).finalDamageReductionPct;
      else if(aSpec?.trackId==="guard"&&state.playerMaxHp>0&&state.playerHp/state.playerMaxHp<=0.35)armorReducePct=getSpecializationEffect("guard",aSpec.level).finalDamageReductionPct;
      armorReducePct=Math.min(80,armorReducePct+(fxSubmit.damageReductionPct||0)); // 卡片天賦「堅盾」疊加
      const armoredCounter=Math.round(rawCounter*(1-armorReducePct/100));
      const armoredDelayed=Math.round(delayedExtra*(1-armorReducePct/100));
      const pendingCounter=Math.max(0,Math.round(armoredCounter*(1-(counterReduce||0)/100)-shieldAbsorb))+armoredDelayed;
      // 有限反射：本回合玩家輸出 n%,單次上限最大HP 15%,不致死
      const reflectDamage=reso?.selfReflectPct?Math.min(Math.round(totalDmg*reso.selfReflectPct/100),Math.round(state.playerMaxHp*0.15)):0;
      // 怪物自身效果（護盾/減傷,完全破解時 resolver 已歸零）
      const monsterShield=reso?.selfShieldMaxHpPct?Math.max(state.monsterShield||0,Math.round(state.monsterMaxHp*reso.selfShieldMaxHpPct/100)):(state.monsterShield||0);
      const keepReduce=(state.monsterReduceRound||0)>state.round;
      const monsterReducePct=reso?.selfReductionPct||(keepReduce?state.monsterReducePct:0);
      const monsterReduceRound=reso?.selfReductionPct?state.round+(reso.selfReductionDuration||1):(keepReduce?state.monsterReduceRound:0);
      const monsterHeal=reso?.monsterHealMaxHpPct?Math.round(state.monsterMaxHp*reso.monsterHealMaxHpPct/100):0;
      return{...state,playerHp:Math.max(1,state.playerHp-poisonDamage-reflectDamage),monsterHp:Math.min(state.monsterMaxHp,state.monsterHp+monsterHeal),activeStatuses,lastAbilityResolution:reso,roundDmg:totalDmg,roundCrits:crits,totalDmgAllRounds:(state.totalDmgAllRounds||0)+totalDmg,pendingCounter,counterDmg:pendingCounter,
        pendingDelayedMult:reso?.delayedMult||0,monsterShield,monsterReducePct,monsterReduceRound,
        hqMarkPct:reso?.hqMarkPct||0,nextRoundDmgBuffPct:reso?.challenge?.damageBuffPct||0,
        phase:PHASE.PROCESSING};
    }
    case"HIT_MONSTER":{const shield=state.monsterShield||0;const absorbed=Math.min(shield,action.dmg||0);return{...state,monsterShield:shield-absorbed,monsterHp:Math.max(0,state.monsterHp-((action.dmg||0)-absorbed))};}
    case"MONSTER_DIED":return{...state,phase:PHASE.VICTORY_ANIM,messages:[...state.messages,`💀 ${state.monsterName} 被擊倒！`,`🏹 第${state.round}回合：${state.roundDmg} 傷害（${state.roundCrits} 爆擊）`]};
    case"APPLY_COUNTER":{
      let n=Math.max(0,state.playerHp-(state.pendingCounter||0));
      const extraMsgs=[];
      // 飾品專精「睡飽」：回合末回復;倒地不觸發（不可復活）
      const acc=state.equipSpec?.accessory;
      if(n>0&&acc?.trackId==="wellRested"){
        const heal=getSpecializationEffect("wellRested",acc.level).endRoundHeal;
        if(heal>0){n=Math.min(state.playerMaxHp,n+heal);extraMsgs.push(`😴 睡飽專精：回復 ${heal} HP`);}
      }
      // 卡片天賦「汲取」/山林套裝：回合末回復（倒地不觸發）
      if(n>0&&state.cardFx?.endRoundHeal){
        const heal=Math.round(state.cardFx.endRoundHeal);
        if(heal>0){n=Math.min(state.playerMaxHp,n+heal);extraMsgs.push(`🌿 卡片加護：回復 ${heal} HP`);}
      }
      return{...state,playerHp:n,phase:n<=0?PHASE.LOST:state.phase,messages:[...state.messages,`🏹 第${state.round}回合：${state.roundDmg} 傷害（${state.roundCrits} 爆擊）`,`💥 怪物反擊：${state.pendingCounter} 傷害`,...extraMsgs]};}
    case"PARTY_COUNTER_HIT":{const n=Math.max(0,state.playerHp-(action.dmg||0));return{...state,playerHp:n,messages:[...state.messages,`💥 怪物反擊：${action.dmg||0} 傷害`]};}
    // 權威端已把技能結果組成一行敘述（partyDb.buildAbilityMessage），這裡只負責推進訊息列
    case"PUSH_MESSAGE":{if(!action.text)return state;return{...state,messages:[...state.messages,action.text]};}
    case"CARRY_BUFF":{const{atkAdd,defAdd,heal,shieldHp,buffMsgs,name}=action;return{...state,playerAtk:state.playerAtk+(atkAdd||0),playerDef:state.playerDef+(defAdd||0),playerHp:Math.min(state.playerMaxHp,state.playerHp+(heal||0)),potionShield:Math.max(state.potionShield||0,shieldHp||0),messages:[...state.messages,...(buffMsgs||[`⚗️ ${name||"藥水"} 效果發動！`])]};}
    case"THROW_DMG":{const shield=state.monsterShield||0;const absorbed=Math.min(shield,action.dmg||0);const dmg=(action.dmg||0)-absorbed;const nhp=Math.max(0,state.monsterHp-dmg);return{...state,monsterShield:shield-absorbed,monsterHp:nhp,phase:nhp<=0?PHASE.VICTORY_ANIM:state.phase,messages:[...state.messages,action.msg||`🔪 投擲傷害：${dmg}`]};}
    case"DEBUFF_MONSTER":{const{monAtkPct,monDefPct,msg}=action;return{...state,monsterAtk:monAtkPct?Math.max(1,Math.round(state.monsterAtk*(1-monAtkPct/100))):state.monsterAtk,monsterDef:monDefPct?Math.max(0,Math.round(state.monsterDef*(1-monDefPct/100))):state.monsterDef,messages:[...state.messages,msg||`🧴 怪物被削弱！`]};}
    case"HEAL":{const h=Math.min(state.playerMaxHp,state.playerHp+(action.amount||0));return{...state,playerHp:h,messages:[...state.messages,`💚 回復 ${action.amount} HP`]};}
    case"START_PLAYING":return{...state,phase:PHASE.PLAYING};
    case"SHOW_WON":return{...state,phase:PHASE.WON};
    case"NEXT_PHASE":return state.phase===PHASE.PROCESSING?{...state,phase:PHASE.ROUND_RES}:state;
    case"NEXT_ROUND":{const nextRound=state.round+1;return{...state,phase:PHASE.PLAYING,round:nextRound,arrowIdx:0,arrows:[],roundDmg:0,roundCrits:0,counterDmg:0,lastArrowDmg:0,lastArrowCrit:false,lastArrowPart:"",lastAbilityResolution:null,activeStatuses:(state.activeStatuses||[]).filter(status=>(status.expiresAfterRound||0)>=nextRound)};}
    case"SYNC_EXTERNAL":return{...state,playerHp:action.playerHp,playerMaxHp:action.playerMaxHp,playerAtk:action.playerAtk,playerDef:action.playerDef,monsterHp:action.monsterHp,monsterMaxHp:action.monsterMaxHp,monsterAtk:action.monsterAtk,monsterDef:action.monsterDef};
    case"RESTORE_SNAPSHOT":return{...initBattle,...action.battle};
    case"EXTERNAL_MESSAGE":return{...state,messages:[...state.messages,action.message].slice(-4)};
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

function partyEventEffectText(event) {
  const effect = event?.effect || {};
  const items = [];
  if (effect.archerATK) items.push(`射手傷害 ${effect.archerATK > 0 ? "+" : ""}${effect.archerATK}%`);
  if (effect.extraDmg) items.push(`怪物立即受到 ${effect.extraDmg} 傷害`);
  if (effect.monsterHP) items.push(`怪物生命 ${effect.monsterHP > 0 ? "+" : ""}${effect.monsterHP}`);
  if (effect.archerHP) items.push(`全隊生命 ${effect.archerHP > 0 ? "+" : ""}${effect.archerHP}`);
  if (effect.healArcher) items.push(`全隊回復 ${effect.healArcher} HP`);
  if (effect.skipCounter) items.push("本回合怪物無法反擊");
  return items.length ? items.join("・") : "本回合戰場條件已生效";
}

// ══════════════════════════════════════════════════════════════
// 主元件
// ══════════════════════════════════════════════════════════════
const BattleScreen = forwardRef(function BattleScreen(props, ref) {
  const {
    player, monster, battleMode="score", scoreInput="keypad", targetFormat="full_110", difficulty={hp:1,atk:1,def:1}, hideMonsterStats=false,
    arrowsPerRound=6, allies=[], cat=null, potions=[], bgImage, onBattleEnd, onShootingAbandon, onPotionUsed, hideStandaloneResult=false,
    autoStart=false, scoringMode=false, onSubmit, fullScreen=false, renderMonster, renderPlayer,
    partyMode=false, partySubmitted=false, partyRound, partyRoundEvent=null, partyEventToken=null, onLeaveBattle,
    partyRole, partyRearChoice, onPartyRearChoice,
    partyMembers=[], partyIsHost=false, partyProcessing=false, onForceSkipMember,
    partyAllReady=false, partyReadyCountdown=0, onConfirmPartyRound,
    partyResolution=null, partyResolutionKey=0, partyPlayerId, partyMonsterMaxHp=0, partyAbilityPreview=null,
    partyResult=null, onConfirmPartyResult, autoConfirmPartyResult=false,
    externalBattle=false, externalRoundKey=0, externalLocked=false, externalDemo=null, battleId=null,
    initialBattleSnapshot=null, onBattleSnapshot,
  } = props;

  // ─── 內部狀態 ───
  const [battle, dispatch] = useReducer(battleReducer, initBattle);

  // 裝備專精：載入每個 slot 的啟用專精（訪客/未解鎖＝null,全程無感）
  const { profile: authedProfile } = useAuth();
  const [equipSpec, setEquipSpec] = useState(null);
  // 卡片天賦＋族系套裝彙總（裝備卡變動即重算）
  const [cardFx, setCardFx] = useState(null);
  useEffect(() => {
    if (!authedProfile?.id) { setCardFx(null); return undefined; }
    return subscribeCardCollection(authedProfile.id, collection => {
      try { setCardFx(calcCardCombatEffectsFromCollection(collection)); } catch { setCardFx(null); }
    });
  }, [authedProfile?.id]);
  useEffect(() => {
    let cancelled = false;
    if (!authedProfile?.id) { setEquipSpec(null); return undefined; }
    getEquipSpecializations(authedProfile.id).then(spec => {
      if (cancelled) return;
      const pick = slot => {
        const trackId = spec[slot].activeTrackId;
        const level = trackId ? spec[slot].tracks[trackId]?.level || 0 : 0;
        return trackId && level > 0 ? { trackId, level } : null;
      };
      setEquipSpec({ weapon: pick("weapon"), armor: pick("armor"), accessory: pick("accessory") });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [authedProfile?.id]);
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
  const [selectedAlly, setSelectedAlly] = useState(null);
  const [partyAction, setPartyAction] = useState(null);
  const [partyMonsterHp, setPartyMonsterHp] = useState(null);
  const [partyPhase, setPartyPhase] = useState(null);
  const [showPartyRoundEvent, setShowPartyRoundEvent] = useState(false);
  const [showPartyKnockdown, setShowPartyKnockdown] = useState(false);
  const [showPartyDefeat, setShowPartyDefeat] = useState(false);
  const [partyHistory, setPartyHistory] = useState([]);
  const [partyAbilityTelegraph, setPartyAbilityTelegraph] = useState(null);
  const seenPartyAbilityPreview = useRef(null);
  // Raw archery capture is deliberately separate from the combat reducer.
  // It is only returned to the caller when this battle completes.
  const shootingEndsRef = useRef([]);
  const currentShootingEndRef = useRef([]);
  // A reconnect may mount after Firestore has already persisted `partyResult`.
  // Start unresolved so the persisted mini-round log still plays from
  // `monsterHPBefore`; only the animation effect may mark it complete.
  const [completedPartyResolutionKey, setCompletedPartyResolutionKey] = useState(0);
  const seenPartyResolutionKey = useRef(0);
  const seenPartyRoundEvent = useRef(null);
  const confirmedPartyLossKey = useRef(0);
  const autoConfirmedPartyResultKey = useRef(0);
  const [soloAbilityTelegraph, setSoloAbilityTelegraph] = useState(null);
  // 技能「發動結算」演出：SUBMIT_ROUND 後顯示 2.6 秒（名稱+破解結果+附加效果）
  const [skillFx, setSkillFx] = useState(null);
  useEffect(() => {
    const reso = battle.lastAbilityResolution;
    if (!reso) return undefined;
    setSkillFx(reso);
    const t = setTimeout(() => setSkillFx(null), 2600);
    return () => clearTimeout(t);
  }, [battle.lastAbilityResolution]);
  // 組隊/地下城：技能由權威端（processDungeonRound）結算，成員端只播演出。
  // room log 的 ability 欄位轉成與單人相同的 skillFx 形狀，共用同一組蓋版 UI。
  const seenPartyAbilityKey = useRef(null);
  useEffect(() => {
    // 兩種來源：地下城（partyResolution.ability，已在權威端算好每人傷害）
    //           組隊打怪（partyResolution.monsterAbility = { scheduled, resolved, targetId }）
    const dungeon = partyResolution?.ability;
    const party = partyResolution?.monsterAbility;
    const resolvedKey = dungeon?.resolvedKey || party?.resolved?.resolvedKey;
    if (!resolvedKey || seenPartyAbilityKey.current === resolvedKey) return undefined;
    seenPartyAbilityKey.current = resolvedKey;

    // 組隊打怪的技能傷害是「乘進本回合反擊」的，沒有獨立數字；
    // 直接取本回合我實際被扣的血當作看得見的損害，玩家才知道技能造成了什麼。
    const myCounter = (partyResolution?.playerLog || []).find(p => p.id === partyPlayerId)?.ctr || 0;
    const info = dungeon ? {
      name: dungeon.name,
      outcome: { level: dungeon.breakLevel },
      statuses: dungeon.statusesByMember?.[partyPlayerId] || [],
      selfShieldMaxHpPct: dungeon.monsterEffect?.shieldHp > 0 ? 1 : 0,
      delayedMult: dungeon.monsterEffect?.delayedMult || 0,
      partyDamage: dungeon.damageByMember?.[partyPlayerId] || 0,
    } : {
      name: party.resolved?.name || party.scheduled?.name || "怪物技能",
      summary: party.scheduled?.summary || null,
      outcome: party.resolved?.outcome || null,
      statuses: party.resolved?.statuses || [],
      selfShieldMaxHpPct: party.resolved?.selfShieldMaxHpPct || 0,
      delayedMult: party.resolved?.delayedMult || 0,
      // 只有被鎖定的人才顯示傷害；未被鎖定者本回合的扣血來自一般反擊
      partyDamage: (!party.targetId || party.targetId === partyPlayerId) ? myCounter : 0,
    };
    setSkillFx(info);
    // 同步寫進左上角戰鬥訊息列，讓玩家事後也能回看這回合怪物做了什麼
    if (partyResolution?.abilityMessage) {
      dispatch({ type:"PUSH_MESSAGE", text:partyResolution.abilityMessage });
    }
    const timer = setTimeout(() => setSkillFx(null), 2600);
    return () => clearTimeout(timer);
  }, [partyResolution, partyPlayerId]);
  const resolvedSoloAbilityKeys = useRef(new Set());
  const restoredInitialSnapshot = useRef(false);

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
  const externalArrowDemo = externalBattle && externalDemo?.type === "arrow" ? externalDemo : null;
  const externalMonsterHitDemo = externalBattle && ["arrow", "cat"].includes(externalDemo?.type) ? externalDemo : null;
  const externalCounterDemo = externalBattle && externalDemo?.type === "counter" ? externalDemo : null;
  const externalCounterAnimation = externalCounterDemo ? `wbBossCounterSwing${String(externalCounterDemo.key).replace(/[^a-zA-Z0-9]/g, "")}` : "none";
  const showBattleUI = isPlaying||isScoring||isProcessing||isRoundRes||isVictoryAnim||isWon||isLost;
  const partyControlsLocked = partyMode && (
    partySubmitted || partyProcessing || (partyResolutionKey > 0 && completedPartyResolutionKey !== partyResolutionKey)
  );
  // autoStart 會在 effect 才 dispatch START；首次 paint 先渲染 VS 覆蓋層，避免閃出一幀戰鬥底圖。
  const showIntro = isIntro || (autoStart && !inBattle);

  // ─── 進場動畫 ⏱ ───
  useEffect(()=>{if(!isIntro)return;if(hasCat){const fx=CAT_INTRO_EFFECTS[skillGroup]||CAT_INTRO_EFFECTS.heal;playBattleSound("cat_intro",{catName,typeLabel:fx.label,typeIcon:fx.icon});playBattleSound("cat_type_sound",{skillGroup});}const t=setTimeout(()=>dispatch({type:"START_PLAYING"}),2500);return()=>clearTimeout(t);},[isIntro,dispatch,hasCat,catName,skillGroup]);

  // Party submissions are server-authoritative.  Leave the score drawer as
  // soon as the player sends their arrows so the shared resolution can own
  // the screen instead of exposing an empty next-round keypad.
  useEffect(()=>{
    if(partyMode && partySubmitted && isScoring) dispatch({type:"START_PLAYING"});
  },[partyMode,partySubmitted,isScoring]);

  useEffect(()=>{
    const key = partyRoundEvent ? (partyEventToken || `${partyRound || 1}:${partyRoundEvent.id}`) : null;
    if(!partyMode || (partyRound || 1) <= 1 || !isPlaying || !key || seenPartyRoundEvent.current === key || displayedPartyEventTokens.has(key)) return;
    seenPartyRoundEvent.current = key;
    displayedPartyEventTokens.add(key);
    setShowPartyRoundEvent(true);
    const timer = setTimeout(()=>setShowPartyRoundEvent(false), 3200);
    return ()=>clearTimeout(timer);
  },[partyMode,isPlaying,partyRound,partyRoundEvent?.id]);

  useEffect(()=>{
    if(partyMode||!isPlaying||!battleId||!monster?.signatureSkillId){setSoloAbilityTelegraph(null);return;}
    const scheduled=getMonsterScheduledAbility(monster,battle.round);
    if(!scheduled){setSoloAbilityTelegraph(null);return;}
    const key=`${battleId}:${battle.round}:${scheduled.skillId}`;
    if(!resolvedSoloAbilityKeys.current.has(key))setSoloAbilityTelegraph({...scheduled,key,round:battle.round});
  },[partyMode,isPlaying,battleId,monster,battle.round]);

  useEffect(()=>{
    if(!partyMode || partyResult!=="win" || completedPartyResolutionKey!==partyResolutionKey) return;
    setShowPartyKnockdown(true);
    playBattleSound("victory_fanfare",{monsterName:monster?.name||"怪物",round:partyRound||1,roundDmg:partyResolution?.totalDmg||0});
    const timer=setTimeout(()=>{
      setShowPartyKnockdown(false);
      playBattleSound("victory_cheer",{});
      if (autoConfirmPartyResult && partyIsHost && autoConfirmedPartyResultKey.current !== partyResolutionKey) {
        autoConfirmedPartyResultKey.current = partyResolutionKey;
        onConfirmPartyResult?.();
      }
    },3000);
    return()=>clearTimeout(timer);
  },[partyMode,partyResult,completedPartyResolutionKey,partyResolutionKey,monster?.name,partyRound,partyResolution?.totalDmg,autoConfirmPartyResult,partyIsHost,onConfirmPartyResult]);

  useEffect(()=>{
    if(!partyMode || partyResult!=="lose" || completedPartyResolutionKey!==partyResolutionKey || confirmedPartyLossKey.current===partyResolutionKey) return;
    setShowPartyDefeat(true);
    playBattleSound("defeat_sigh",{monsterName:monster?.name||"怪物",round:partyRound||1});
    const timer=setTimeout(()=>{
      setShowPartyDefeat(false);
      if(autoConfirmPartyResult && partyIsHost && confirmedPartyLossKey.current!==partyResolutionKey){
        confirmedPartyLossKey.current=partyResolutionKey;
        onConfirmPartyResult?.();
      }
    },3200);
    return()=>clearTimeout(timer);
  },[partyMode,partyResult,completedPartyResolutionKey,partyResolutionKey,partyIsHost,onConfirmPartyResult,monster?.name,partyRound,autoConfirmPartyResult]);

  // 技能預告是「下一回合」的資訊，必須等本回合演出完全結束才亮，否則會蓋在動畫上搶戲。
  // 兩道閘門：①本回合逐段演出播完（completedPartyResolutionKey 追上 partyResolutionKey）；
  //          ②技能發動蓋版（skillFx）已收掉。兩者都過了才等於「回合真的結束、下一回合開始前」。
  useEffect(()=>{
    if(!partyMode||!partyAbilityPreview)return;
    if(partyResolutionKey>0&&completedPartyResolutionKey!==partyResolutionKey)return;
    if(skillFx)return;
    const key=`${partyAbilityPreview.round}:${partyAbilityPreview.skillId}:${partyAbilityPreview.targetId||"team"}`;
    if(seenPartyAbilityPreview.current===key)return;
    seenPartyAbilityPreview.current=key;
    setPartyAbilityTelegraph({...partyAbilityPreview,key});
  },[partyMode,partyAbilityPreview,partyResolutionKey,completedPartyResolutionKey,skillFx]);

  // ─── 回合前事件 🎲 ───
  // 2026-07-18 使用者指示：取消每回合突發事件（此為改版時的「示意」佔位彈窗,ROUND_EVENTS 保留資料供未來正式事件系統使用）
  useEffect(()=>{ void ROUND_EVENTS; void setRoundEvent; },[partyMode,externalBattle,isPlaying,battle.round,dispatch]);

  // ─── 擊倒動畫 ⏱ ───
  useEffect(()=>{if(!isVictoryAnim)return;playBattleSound("victory_fanfare",{monsterName:battle.monsterName,round:battle.round,roundDmg:battle.roundDmg});const t=setTimeout(()=>{playBattleSound("victory_cheer",{});dispatch({type:"SHOW_WON"});},3000);return()=>clearTimeout(t);},[isVictoryAnim,dispatch,battle.monsterName,battle.round,battle.roundDmg]);

  // ─── 勝利回呼 ⏱ ───
  useEffect(()=>{if(!isWon||!onBattleEnd)return;const shootingEnds=shootingEndsRef.current.map(end=>end.slice());const arrowScores=shootingEnds.flat().map(arrow=>arrow.label);onBattleEnd("won",{rounds:battle.round,totalDamage:battle.totalDmgAllRounds||battle.roundDmg,crits:battle.roundCrits,arrows:arrowScores.length,arrowScores,shootingEnds,playerHp:battle.playerHp,monsterHp:battle.monsterHp});},[isWon,onBattleEnd,battle]);

  // ─── 敗北音效 + 回呼 ⏱ ───
  useEffect(()=>{if(!isLost)return;playBattleSound("defeat_sigh",{monsterName:battle.monsterName,playerName:player?.name||"",round:battle.round});if(onBattleEnd){const shootingEnds=shootingEndsRef.current.map(end=>end.slice());const arrowScores=shootingEnds.flat().map(arrow=>arrow.label);onBattleEnd("lost",{rounds:battle.round,totalDamage:battle.totalDmgAllRounds||battle.roundDmg,crits:battle.roundCrits,arrows:arrowScores.length,arrowScores,shootingEnds,playerHp:battle.playerHp,monsterHp:battle.monsterHp});}},[isLost,battle,player?.name,onBattleEnd]);

  function delay(ms){return new Promise(r=>setTimeout(r,ms));}

  // 組隊結算只使用伺服器寫入的 log，絕不在前端預先猜測傷害。
  // 所有客戶端都會看到同一個順序：房主先手、隊友依序、最後怪物反擊。
  useEffect(()=>{
    if(!partyMode || !partyResolution?.miniRounds?.length || partyResolutionKey===seenPartyResolutionKey.current)return;
    seenPartyResolutionKey.current=partyResolutionKey;
    let cancelled=false;
    const run=async()=>{
      setCompletedPartyResolutionKey(0);
      setPartyHistory([]);
      setPartyMonsterHp(partyResolution.monsterHPBefore ?? null);
      for(const mini of partyResolution.miniRounds){
        if(cancelled)return;
        if(mini.isCounter){
          // Counter damage is resolved per survivor.  Showing a single team total
          // hid the actual target and made every hit look identical.
          const individualTargets=(mini.playerLog||[]).filter(p=>p.ctr>0).map(p=>({id:p.id,dmg:p.ctr,crit:!!p.ctrCrit,hitPart:p.hitPart||null}));
          for(const target of individualTargets){
            if(cancelled)return;
            const targetName=partyMembers.find(member=>member.id===target.id)?.name||"隊員";
            playBattleSound("monster_counter",{monsterName:monster?.name||"怪物",counterDmg:target.dmg});
            const hitName=target.hitPart?.name||"身體";
            setPartyHistory(prev=>[...prev,`💥 ${monster?.name||"怪物"} 命中${targetName}${hitName}・-${target.dmg}${target.crit?"（爆擊）":""}`].slice(-4));
            setPartyPhase({type:"counter",title:"怪物反擊",detail:`${targetName}${hitName}承受 ${target.dmg} 傷害`,icon:"💥"});
            setPartyAction({type:"counter",targets:[target]});
            if (target.id === partyPlayerId) dispatch({ type:"PARTY_COUNTER_HIT", dmg:target.dmg });
            await delay(target.crit?1600:1100);
          }
          const legacyCounterAnimation = false;
          const targets=(mini.playerLog||[]).filter(p=>p.ctr>0).map(p=>({id:p.id,dmg:p.ctr,crit:!!p.ctrCrit}));
          if(legacyCounterAnimation && targets.length){const counterDmg=targets.reduce((sum,target)=>sum+target.dmg,0);const detail=targets.map(target=>`${partyMembers.find(member=>member.id===target.id)?.name||"隊員"} -${target.dmg}${target.crit?"（爆擊）":""}`).join("・");playBattleSound("monster_counter",{monsterName:monster?.name||"怪物",counterDmg});setPartyHistory(prev=>[...prev,`💥 ${monster?.name||"怪物"} 反擊・${detail}`].slice(-4));setPartyPhase({type:"counter",title:"怪物反擊",detail,icon:"💥"});setPartyAction({type:"counter",targets});await delay(2200);}
        }else if(mini.isSupport){
          const supports=mini.playerLog||[];
          const isHeal=mini.supportKind!=="buff";
          const healTotal=supports.reduce((sum,item)=>sum+(item.heal||0),0);
          const detail=supports.map(item=>isHeal?`${item.name} 回復 ${item.heal||0} HP`:`${item.name} 提升前衛攻擊 ${item.buffPct||0}%`).join("・");
          playBattleSound("cat_attack",{catName:isHeal?"後衛治療":"後衛協攻",skillGroup:isHeal?"heal":"atk"});
          setPartyHistory(prev=>[...prev,isHeal?`💚 後衛治療・前衛共回復 ${healTotal} HP`:`🏹 後衛協攻・提升前衛攻擊`].slice(-4));
          setPartyPhase({type:"support",title:isHeal?"後衛治療":"後衛協攻",detail:detail||"後衛為前衛提供支援。",icon:isHeal?"💚":"🏹"});
          setPartyAction({type:"support",supportKind:isHeal?"heal":"buff",supports});
          await delay(isHeal?3000:1900);
        }else if(mini.isCat){
          const skillUser=(mini.playerLog||[]).find(p=>p.skillTriggered);
          playBattleSound("cat_attack",{catName:"全體貓貓",skillGroup:"atk"});
          setPartyHistory(prev=>[...prev,`🐾 全體貓貓協戰・造成 ${mini.totalDmg||0} 傷害`].slice(-4));
          setPartyPhase({type:"cat",title:"貓貓一起攻擊",detail:skillUser ? `${skillUser.name} 發動 ${skillUser.skillName || "貓貓技能"}` : "全體貓貓掌支援・本回合未觸發技能",icon:"🐾"});
          const catDamage=mini.totalDmg||0;
          setPartyAction({type:"cat",damage:catDamage,cats:mini.playerLog||[]});
          setPartyMonsterHp(prev=>Math.max(0,(prev ?? partyResolution.monsterHPBefore ?? 0)-catDamage));
          await delay(2500);
        }else{
          const attackers=(mini.playerLog||[]).filter(attacker=>attacker && (attacker.id || attacker.name));
          if(!attackers.length)continue;
          for(const attacker of attackers){
            if(cancelled)return;
          const arrows=attacker.arrowBreakdown||[];
          const misses=arrows.filter(a=>a.label==="M"||!(a.dmg>0)).length;
          const roleLabel=attacker.role==="rear"?"後衛":"前衛";
          playBattleSound("arrow_flight",{arrowIdx:1,monsterName:monster?.name||"怪物"});
          const playerDamage=attacker.dmg ?? 0;
          playBattleSound("arrow_hit",{dmg:playerDamage,isCrit:(attacker.crits||0)>0});
          setPartyHistory(prev=>[...prev,`${(attacker.crits||0)>0?"💥":"🏹"} ${roleLabel}・${attacker.name||"射手"} 攻擊・${playerDamage} 傷害`].slice(-4));
          setPartyPhase({type:"attack",title:`${roleLabel}・${attacker.name || "隊員"} 攻擊`,detail:(attacker.crits||0)>0?"爆擊命中！":"箭矢命中怪物",icon:(attacker.crits||0)>0?"💥":"🏹"});
          // 同一射手連續出手時必須先卸載前一段特效，否則 CSS animation 只會播第一下。
          setPartyAction(null);
          await delay(40);
          if(cancelled)return;
          setPartyAction({type:"attack",actionKey:`${partyResolutionKey}:${mini.miniRound || 0}:${attacker.id}`,attackerId:attacker.id,role:attacker.role||"front",damage:playerDamage,critical:(attacker.crits||0)>0,misses,dim:arrows.length>0&&misses>=Math.ceil(arrows.length/2)});
          setPartyMonsterHp(prev=>Math.max(0,(prev ?? partyResolution.monsterHPBefore ?? 0)-playerDamage));
          await delay((attacker.crits||0)>0?2500:1100);
          }
        }
      }
      const ability=partyResolution.monsterAbility;
      if(ability?.scheduled){
        const breakLabels={full:"完全破解",major:"大幅破解",partial:"部分破解",none:"破解失敗"};
        const outcome=ability.resolved?.outcome?.level;
        const target=partyMembers.find(member=>member.id===ability.targetId);
        const status=ability.resolved?.status;
        const statusLabels={poison:"中毒",atkDown:"攻擊弱化",defDown:"防禦弱化"};
        const detail=ability.resolved
          ? `${target?`目標：${target.name}・`:""}${breakLabels[outcome]||"技能已結算"}${status?`・附加 ${statusLabels[status.id]||status.id} ${status.duration} 回合`:"・異常效果已取消"}`
          : (ability.reason==="signature_effect_not_structured"?"招牌技能已展示；個別效果將依正式技能資料啟用。":"技能已結算");
        setPartyHistory(prev=>[...prev,`⚡ ${ability.scheduled.name}・${breakLabels[outcome]||"發動"}`].slice(-4));
        setPartyPhase({type:"ability",title:`${ability.scheduled.enhanced?"強化・":""}${ability.scheduled.name}`,detail,icon:"⚡"});
        await delay(2200);
      }
      for(const fallen of partyResolution.demotedMembers||[]){
        if(cancelled)return;
        setPartyHistory(prev=>[...prev,`🛡️ ${fallen.name} 被擊倒，轉為後衛`].slice(-4));
        setPartyPhase({type:"fallen",title:"前衛被擊倒",detail:`${fallen.name} 已轉為後衛，下一回合可選擇支援方式。`,icon:"🛡️"});
        await delay(2400);
      }
      if(!cancelled){
        setPartyAction(null);
        setPartyPhase(null);
        setCompletedPartyResolutionKey(partyResolutionKey);
      }
    };
    run();
    return()=>{cancelled=true;};
  },[partyMode,partyResolutionKey,arrowsPerRound]);

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

  const shownMonsterHp=partyMonsterHp??battle.monsterHp;
  const shownMonsterMaxHp=partyMode&&partyMonsterMaxHp>0?partyMonsterMaxHp:battle.monsterMaxHp;
  const hpPct=inBattle?(shownMonsterHp/Math.max(1,shownMonsterMaxHp))*100:100;
  const playerHpPct=inBattle?(battle.playerHp/battle.playerMaxHp)*100:100;
  const scoreKeys=getTargetScoreLabels(targetFormat);

  // ─── 貓貓戰吼 ───
  const catBattleCry=useMemo(()=>{if(!hasCat)return "";const cries=CAT_BATTLE_CRIES[skillGroup]||CAT_BATTLE_CRIES.heal;return cries[Math.floor(Math.random()*cries.length)];},[hasCat,skillGroup]);

  // ─── handleStartBattle（必須在 useImperativeHandle 之前，避免 TDZ）───
  const handleStartBattle=useCallback(()=>{shootingEndsRef.current=[];currentShootingEndRef.current=[];resolvedSoloAbilityKeys.current.clear();setSoloAbilityTelegraph(null);dispatch({type:"START",monster,diff:difficulty,battleMode,hideMonsterStats,equipSpec,cardFx,playerHp:player?.hp||initBattle.playerHp,playerMaxHp:player?.maxHp||initBattle.playerMaxHp,playerAtk:player?.atk||initBattle.playerAtk,playerDef:player?.def||initBattle.playerDef});if(hasCat)setCatCurrentHP(catMaxHP);},[monster,difficulty,battleMode,hideMonsterStats,equipSpec,cardFx,player?.hp,player?.maxHp,player?.atk,player?.def,hasCat,catMaxHP]);

  // ─── 回呼 ───
  const handleScore=useCallback((input)=>{if(!isScoring)return;const landing=typeof input==="object"?input:null;const label=landing?.label??input;const normalized=scoreToValue(label,targetFormat);const score=label==="X"?"X":normalized===0?"M":String(normalized);sfxTap();currentShootingEndRef.current.push({label,landing});dispatch({type:"SCORE_ARROW",score,displayLabel:label,battleMode,arrowsPerRound,previewDamage:!partyMode});},[isScoring,battleMode,arrowsPerRound,partyMode,targetFormat]);
  const handleUndo=useCallback(()=>{if(!isScoring)return;currentShootingEndRef.current.pop();dispatch({type:"UNDO_ARROW"});},[isScoring]);
  const handleSubmit=useCallback(()=>{if(!isScoring||battle.arrows.length<arrowsPerRound)return;if(partyMode&&partyRole==="rear"&&!partyRearChoice)return;const rawEnd=currentShootingEndRef.current.slice();if(rawEnd.length)shootingEndsRef.current.push(rawEnd);currentShootingEndRef.current=[];if(onSubmit){onSubmit(battle.arrows.map(a=>{const s=a.score;return s==="X"?10:s==="M"?0:Number(s)||0;}));if(partyMode)return;if(externalBattle){dispatch({type:"START_PLAYING"});return;}dispatch({type:"RESET",playerHp:player?.hp||initBattle.playerHp,playerMaxHp:player?.maxHp||initBattle.playerMaxHp,playerAtk:player?.atk||initBattle.playerAtk,playerDef:player?.def||initBattle.playerDef});setSkipBigRound(false);setCounterReducePct(0);setUsedPotionInfo(null);setShowPotionPanel(false);return;}/* 單機 standalone 路徑：每回合送出即累積箭數（今日+終身;MonsterBattle 舊 submitRound 已不在此流程） */
if(authedProfile?.id&&battle.arrows.length){addRoundArrows(authedProfile.id,battle.arrows.length,{accountType:authedProfile?.accountType||"official"}).catch(()=>{});}
let abilityResolution=null;if(battleId&&monster?.signatureSkillId){const ability=resolveSoloMonsterAbility({battleId,monster,round:battle.round,arrows:battle.arrows.map(a=>a.score),targetFmt:targetFormat,monsterHpRatio:battle.monsterMaxHp>0?battle.monsterHp/battle.monsterMaxHp:1});const key=ability.resolved?.resolvedKey||soloAbilityTelegraph?.key;if(key&&!resolvedSoloAbilityKeys.current.has(key)){resolvedSoloAbilityKeys.current.add(key);abilityResolution=ability.resolved?{...ability.resolved,name:ability.resolved.name||ability.scheduled?.name||"怪物技能"}:null;}}setSoloAbilityTelegraph(null);dispatch({type:"SUBMIT_ROUND",skipCounter:skipBigRound,counterReduce:counterReducePct,arrowsPerRound,abilityResolution});},[isScoring,battle.arrows,battle.round,battle.monsterHp,battle.monsterMaxHp,skipBigRound,counterReducePct,arrowsPerRound,onSubmit,partyMode,partyRole,partyRearChoice,externalBattle,player?.hp,player?.maxHp,player?.atk,player?.def,battleId,monster,soloAbilityTelegraph,targetFormat,authedProfile?.id]);
  const handleNextRound=useCallback(()=>{dispatch({type:"NEXT_ROUND"});setSkipBigRound(false);setCounterReducePct(0);setUsedPotionInfo(null);},[]);
  const handleReset=useCallback(()=>{dispatch({type:"RESET",playerHp:player?.hp||initBattle.playerHp,playerMaxHp:player?.maxHp||initBattle.playerMaxHp,playerAtk:player?.atk||initBattle.playerAtk,playerDef:player?.def||initBattle.playerDef});setSkipBigRound(false);setCounterReducePct(0);setUsedPotionInfo(null);setShowPotionPanel(false);setCatCurrentHP(0);setCatMsg(null);setCatSkillActive(null);setRoundEvent(null);setTeamFx([]);},[player?.hp,player?.maxHp,player?.atk,player?.def]);
  const handleLeave=useCallback(()=>{const didLeave=onLeaveBattle?.();if(didLeave===false)return;const shootingEnds=[...shootingEndsRef.current.map(end=>end.slice())];if(currentShootingEndRef.current.length)shootingEnds.push(currentShootingEndRef.current.slice());onShootingAbandon?.({shootingEnds,arrowScores:shootingEnds.flat().map(arrow=>arrow.label),rounds:battle.round,totalDamage:battle.totalDmgAllRounds||battle.roundDmg,monsterHp:battle.monsterHp});},[onShootingAbandon,onLeaveBattle,battle]);

  // ─── 暴露 startBattle ───
  useImperativeHandle(ref,()=>({startBattle:handleStartBattle}),[handleStartBattle]);

  // ─── 自動啟動（MonsterBattle 等外部元件用）───
  useEffect(()=>{
    if(!initialBattleSnapshot || restoredInitialSnapshot.current) return;
    restoredInitialSnapshot.current=true;
    try{
      const restored=restoreBattleScreenSnapshot(initialBattleSnapshot);
      resolvedSoloAbilityKeys.current=new Set(restored.resolvedAbilityKeys);
      shootingEndsRef.current=restored.shootingEnds;
      currentShootingEndRef.current=[];
      dispatch({type:"RESTORE_SNAPSHOT",battle:restored.battle});
    }catch(error){
      console.warn("Unable to restore battle screen snapshot",error);
      handleStartBattle();
    }
  },[initialBattleSnapshot,handleStartBattle]);

  // 自動開場：每隻怪只觸發一次。
  // handleStartBattle 的依賴含 monster/difficulty，而呼叫端（DungeonBattleRoom 等）是用行內物件字面值傳的，
  // 父層每次 render 都會產生新參考 → 若直接依賴它，父層一 re-render 就重新 dispatch START，
  // 畫面會不斷跳回 VS 開場（無限迴圈）。改用怪物 id 當閘門，換怪時才會重新開場。
  const autoStartedForRef=useRef(null);
  useEffect(()=>{
    if(!autoStart||initialBattleSnapshot)return;
    const key=monster?.id??"default";
    if(autoStartedForRef.current===key)return;
    autoStartedForRef.current=key;
    handleStartBattle();
  },[autoStart,initialBattleSnapshot,handleStartBattle,monster?.id]);

  useEffect(()=>{
    if(partyMode||externalBattle||!battleId||!onBattleSnapshot) return;
    if(![PHASE.PLAYING,PHASE.SCORING,PHASE.ROUND_RES].includes(battle.phase)) return;
    onBattleSnapshot(createBattleScreenSnapshot({
      battle,
      resolvedAbilityKeys:[...resolvedSoloAbilityKeys.current],
      shootingEnds:shootingEndsRef.current,
    }));
  },[battle,battleId,onBattleSnapshot,partyMode,externalBattle]);

  // A caller may start below full HP (opening throw potions) while retaining
  // the selected difficulty's original maximum HP. Preserve both values.
  useEffect(()=>{
    if(!autoStart || battle.phase!==PHASE.INTRO || partyMode || externalBattle) return;
    dispatch({type:"SYNC_EXTERNAL",playerHp:player?.hp||0,playerMaxHp:player?.maxHp||0,playerAtk:player?.atk||0,playerDef:player?.def||0,monsterHp:monster?.hp||0,monsterMaxHp:monster?.maxHp||monster?.hp||0,monsterAtk:monster?.atk||0,monsterDef:monster?.def||0});
  },[autoStart,battle.phase,partyMode,externalBattle,player?.hp,player?.maxHp,player?.atk,player?.def,monster?.hp,monster?.maxHp,monster?.atk,monster?.def]);

  useEffect(()=>{
    if(!externalBattle || !inBattle) return;
    dispatch({type:"SYNC_EXTERNAL",playerHp:player?.hp||0,playerMaxHp:player?.maxHp||0,playerAtk:player?.atk||0,playerDef:player?.def||0,monsterHp:monster?.hp||0,monsterMaxHp:monster?.maxHp||monster?.hp||0,monsterAtk:monster?.atk||0,monsterDef:monster?.def||0});
  },[externalBattle,inBattle,player?.hp,player?.maxHp,player?.atk,player?.def,monster?.hp,monster?.maxHp,monster?.atk,monster?.def]);
  useEffect(()=>{
    if(!externalBattle || !externalDemo?.message) return;
    dispatch({type:"EXTERNAL_MESSAGE",message:externalDemo.message});
  },[externalBattle,externalDemo?.key]);
  const seenExternalRound = useRef(externalRoundKey);
  useEffect(()=>{
    if(!externalBattle || externalRoundKey===seenExternalRound.current) return;
    seenExternalRound.current=externalRoundKey;
    dispatch({type:"NEXT_ROUND"});
  },[externalBattle,externalRoundKey]);

  // 組隊回合由房間狀態主導。新回合到來時強制重置內部計分狀態
  // NEXT_ROUND 只清空箭矢/傷害/phase，不 reset 整個戰鬥。
  const lastPartyRoundRef = useRef(null);
  useEffect(()=>{
    if(!partyMode || !partyRound) return;
    if (lastPartyRoundRef.current === partyRound) return;
    lastPartyRoundRef.current = partyRound;
    if (partyRound <= 1) return; // skip initial mount - autoStart handles round 1
    dispatch({type:"NEXT_ROUND"});
  },[partyMode, partyRound]);

  // ─── 計分模式（PartyBattleRoom 等外部元件用）───
  useEffect(()=>{if(scoringMode)dispatch({type:"START_SCORING",arrowsPerRound});},[scoringMode,arrowsPerRound]);

  // ─── 計分模式提交 ───
  const handleScoringSubmit=useCallback(()=>{if(!isScoring||battle.arrows.length<arrowsPerRound)return;if(partyMode&&partyRole==="rear"&&!partyRearChoice)return;if(onSubmit)onSubmit(battle.arrows.map(a=>a.score));},[isScoring,battle.arrows,arrowsPerRound,onSubmit,partyMode,partyRole,partyRearChoice]);

  // ─── 藥水 ───
  function useCarryPotion(potion){
    if(usedPotionInfo||battle.phase===PHASE.SCORING||partyControlsLocked)return;
    const e=potion.effect||{};let atkAdd=0,defAdd=0,heal=0,shieldHp=0;const msgs=[];
    if(e.hpPct){heal=Math.round(battle.playerMaxHp*e.hpPct/100);msgs.push(`💚 ${potion.icon} ${potion.name}：回復 ${heal} HP`);}
    if(e.atkPct){atkAdd=Math.round(battle.playerAtk*e.atkPct/100);msgs.push(`⚔️ ${potion.icon} ${potion.name}：ATK +${e.atkPct}%`);}
    if(e.defPct){defAdd=Math.round(battle.playerDef*e.defPct/100);msgs.push(`🛡️ ${potion.icon} ${potion.name}：DEF +${e.defPct}%`);}
    if(e.shieldPct){shieldHp=Math.round(battle.playerMaxHp*e.shieldPct/100);msgs.push(`🫧 ${potion.icon} ${potion.name}：獲得 ${shieldHp} 護盾`);}
    if(e.regenPct){heal+=Math.round(battle.playerMaxHp*e.regenPct/100);msgs.push(`🌱 ${potion.icon} ${potion.name}：回 ${e.regenPct}%/回合`);}
    if(e.dmgPct&&e.defPenaltyPct){atkAdd=Math.round(battle.playerAtk*e.dmgPct/100);defAdd=-Math.round(battle.playerDef*e.defPenaltyPct/100);msgs.push(`🔥 ${potion.icon} ${potion.name}：傷害 +${e.dmgPct}%，DEF -${e.defPenaltyPct}%`);}
    dispatch({type:"CARRY_BUFF",atkAdd,defAdd,heal,shieldHp,buffMsgs:msgs,name:potion.name});
    setUsedPotionInfo({icon:potion.icon,name:potion.name,effectText:potion.effectText,potion});setShowPotionPanel(false);setPoofKey(k=>k+1);
    if(onPotionUsed)onPotionUsed(potion.id);
  }
  function useThrowPotion(potion){
    if(usedPotionInfo||battle.phase===PHASE.SCORING||partyControlsLocked)return;
    const e=potion.effect||{};let dmg=0;const msgs=[];
    if(e.throwDmg)dmg+=e.throwDmg;if(e.throwPct)dmg+=Math.round(battle.monsterMaxHp*e.throwPct);if(e.atkDamagePct)dmg+=Math.round(battle.playerAtk*e.atkDamagePct/100);
    if(e.throwDmgMin&&e.throwDmgMax)dmg+=e.throwDmgMin+Math.floor(Math.random()*(e.throwDmgMax-e.throwDmgMin+1));
    if(dmg>0)dispatch({type:"THROW_DMG",dmg,msg:`🔪 ${potion.icon} ${potion.name}：${dmg} 傷害！`});
    if(e.monAtkPct)dispatch({type:"DEBUFF_MONSTER",monAtkPct:e.monAtkPct,msg:`🌫️ ${potion.icon} ${potion.name}：怪物 ATK -${e.monAtkPct}%！`});
    if(e.monDefPct)dispatch({type:"DEBUFF_MONSTER",monDefPct:e.monDefPct,msg:`🧴 ${potion.icon} ${potion.name}：怪物 DEF -${e.monDefPct}%！`});
    if(e.skipRound==="big"){setSkipBigRound(true);msgs.push(`🕸️ ${potion.icon} ${potion.name}：下次反擊跳過！`);}
    if(e.counterReducePct){setCounterReducePct(p=>Math.min(70,p+e.counterReducePct));msgs.push(`💨 ${potion.icon} ${potion.name}：反擊傷害 -${e.counterReducePct}%！`);}
    if(msgs.length>0)dispatch({type:"CARRY_BUFF",atkAdd:0,defAdd:0,heal:0,shieldHp:0,buffMsgs:msgs});
    setUsedPotionInfo({icon:potion.icon,name:potion.name,effectText:potion.effectText,potion});setShowPotionPanel(false);setPoofKey(k=>k+1);
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
        {scoreInput==="target"&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:10}}><TargetFaceInput fmtId={targetFormat} radius={92} arrowLabels={battle.arrows.map(a=>a.score)} arrowsPerRound={arrowsPerRound} onArrow={handleScore} /><div style={{fontSize:11,color:"#9fb0cf",marginTop:4}}>點靶面對應環數計分</div></div>)}
        {partyMode&&partyRole==="rear"&&!partyRearChoice&&<div style={{marginBottom:10,padding:"9px",borderRadius:10,background:"rgba(14,55,78,.42)",border:"1px solid rgba(125,211,252,.42)"}}><div style={{fontSize:11,fontWeight:900,color:"#bae6fd",marginBottom:7}}>後衛支援選擇</div><div style={{display:"flex",gap:7}}><button type="button" onClick={()=>onPartyRearChoice?.("heal")} style={{flex:1,padding:"7px 4px",borderRadius:8,border:"1px solid rgba(52,211,153,.48)",background:"rgba(16,185,129,.16)",color:"#6ee7b7",fontSize:11,fontWeight:900,cursor:"pointer"}}>💚 支援治療</button><button type="button" onClick={()=>onPartyRearChoice?.("dmg")} style={{flex:1,padding:"7px 4px",borderRadius:8,border:"1px solid rgba(251,146,60,.48)",background:"rgba(251,146,60,.16)",color:"#fdba74",fontSize:11,fontWeight:900,cursor:"pointer"}}>🏹 支援強化</button></div></div>}
        <div style={{display:"flex",gap:6,marginBottom:12,minHeight:36,alignItems:"center"}}>
          {Array.from({length:arrowsPerRound}).map((_,i)=>{const a=battle.arrows[i];return(<div key={i} style={{flex:1,height:34,borderRadius:9,border:a?(a.isCrit?"1px solid #fbbf24":"1px solid rgba(255,255,255,.2)"):(i===battle.arrowIdx?"2px solid #f5b942":"1px dashed rgba(255,255,255,.16)"),display:"grid",placeItems:"center",fontSize:14,fontWeight:900,color:a?"#eaf6ff":(i===battle.arrowIdx?"#f5b942":"#6b7a99"),background:a?(a.isCrit?"rgba(251,191,36,.18)":"rgba(255,255,255,.08)"):(i===battle.arrowIdx?"rgba(245,185,66,.12)":"rgba(255,255,255,.03)"),fontVariantNumeric:"tabular-nums",boxShadow:i===battle.arrowIdx?"0 0 0 2px rgba(245,185,66,.3)":"none"}}>{a?a.score:(i===battle.arrowIdx?"\u25bc":"")}</div>)})}
        </div>
        {scoreInput==="keypad"&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,opacity:battle.arrows.length>=arrowsPerRound?0.35:1,pointerEvents:battle.arrows.length>=arrowsPerRound?"none":"auto"}}>
          {scoreKeys.map(k=>(<button key={k} onClick={()=>handleScore(k)} style={{height:46,borderRadius:11,border:k==="X"?"1px solid rgba(245,185,66,.4)":k==="M"?"1px solid rgba(239,83,80,.4)":"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.05)",color:k==="X"?"#f5b942":k==="M"?"#f87171":"#eef3fc",fontSize:18,fontWeight:800,cursor:"pointer",fontVariantNumeric:"tabular-nums"}}>{k}</button>))}
        </div>}
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={handleUndo} disabled={battle.arrows.length===0} style={{flex:"0 0 auto",padding:"0 16px",height:46,borderRadius:11,border:"1px solid rgba(255,255,255,.14)",background:"rgba(255,255,255,.05)",color:battle.arrows.length===0?"#5a6b8a":"#cbd6ea",fontSize:14,fontWeight:800,cursor:battle.arrows.length===0?"not-allowed":"pointer"}}>刪除上一箭</button>
          <button onClick={handleScoringSubmit} disabled={battle.arrows.length<arrowsPerRound||(partyMode&&partyRole==="rear"&&!partyRearChoice)} style={{flex:1,height:46,borderRadius:11,border:"none",background:battle.arrows.length>=arrowsPerRound&&!(partyMode&&partyRole==="rear"&&!partyRearChoice)?"linear-gradient(180deg,#ffcf5a,#f5a623)":"rgba(255,255,255,.06)",color:battle.arrows.length>=arrowsPerRound&&!(partyMode&&partyRole==="rear"&&!partyRearChoice)?"#3a2600":"#5a6b8a",fontSize:16,fontWeight:900,cursor:battle.arrows.length>=arrowsPerRound&&!(partyMode&&partyRole==="rear"&&!partyRearChoice)?"pointer":"not-allowed",boxShadow:battle.arrows.length>=arrowsPerRound&&!(partyMode&&partyRole==="rear"&&!partyRearChoice)?"0 6px 18px rgba(245,166,35,.4)":"none"}}>{partyMode&&partyRole==="rear"&&!partyRearChoice?"先選擇後衛支援":battle.arrows.length>=arrowsPerRound?"送出這一回合":`再輸入 ${arrowsPerRound-battle.arrows.length} 箭`}</button>
        </div>
      </div>)}
    </div>);
  }

  const containerStyle = fullScreen
    ? {position:"relative",width:"100%",height:"100%",maxWidth:540,margin:"0 auto",overflow:"hidden",isolation:"isolate",userSelect:"none",background:"#0a1018"}
    : {position:"relative",width:380,maxWidth:"92vw",aspectRatio:"9/19",borderRadius:30,overflow:"hidden",boxShadow:"0 30px 70px rgba(0,0,0,.6), 0 0 0 8px #0a0e18, 0 0 0 9px rgba(255,255,255,.06)",isolation:"isolate",userSelect:"none",background:"#0a1018"};
  const partyCounterTargets=partyAction?.type==="counter"?partyAction.targets:[];
  // 只有實際造成傷害才觸發怪物受擊，不讓 M／零傷害動作把怪物持續搖晃。
  const partyMonsterHit=(partyAction?.type==="attack"||partyAction?.type==="cat")&&Number(partyAction?.damage)>0;
  return (<div style={{...containerStyle,animation:partyCounterTargets.length?"partyTeamShake .55s ease-out":"none"}}>
    {/* 背景 */}
    <img src={bgUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} onError={e=>{e.target.style.display="none"}} />
    <div style={{position:"absolute",inset:0,zIndex:1,pointerEvents:"none",background:"linear-gradient(180deg,rgba(4,7,13,.5),transparent 20%,transparent 55%,rgba(4,7,13,.72))"}}>
      <div style={{position:"absolute",inset:0,boxShadow:"inset 0 0 120px 20px rgba(0,0,0,.55)"}} />
    </div>

    {/* 頂部資訊列 */}
    <div style={{position:"absolute",top:0,left:0,right:0,zIndex:5,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"7px 14px",fontSize:11,fontWeight:800,letterSpacing:".02em",color:"#dbe6f8",background:"linear-gradient(180deg,rgba(6,10,18,.9),rgba(6,10,18,.35))",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
      <span style={{color:"#fff"}}>{battleMode==="zombie"?"🧟 殭屍靶":"🎯 分數靶"}</span>
      <span style={{color:"#6b7a99"}}>·</span>
      <span>第 <b style={{color:inBattle?"#f5b942":"#6b7a99",fontVariantNumeric:"tabular-nums"}}>{partyMode?(partyRound||1):(inBattle?battle.round:"—")}</b> 回合</span>
      <BattleSoundIndicator compact />
    </div>

    {/* ── VS 進場 ── */}
    {showIntro&&(<div style={{position:"absolute",inset:0,zIndex:20,background:"linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
      <div style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"0 18px"}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,minWidth:0,width:"min(47%,176px)"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:12,animation:"introArc .6s cubic-bezier(.34,1.56,.64,1) both"}}>
            <BattleIntroPortrait player={player} size={80} renderPlayer={renderPlayer} />
            {hasCat&&(()=>{const fx=CAT_INTRO_EFFECTS[skillGroup]||CAT_INTRO_EFFECTS.heal;const particles=Array.from({length:fx.particleCount});return(<div style={{marginBottom:-4,display:"flex",flexDirection:"column",alignItems:"center",gap:4,position:"relative",width:76,flexShrink:0}}>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:100,height:100,background:fx.bgGradient,borderRadius:"50%",animation:"introCat .5s .3s cubic-bezier(.34,1.56,.64,1) both",opacity:0,pointerEvents:"none"}}/>
              {particles.map((_,i)=><div key={i} style={{position:"absolute",left:`${30+Math.sin(i*1.2)*35}%`,top:`${25+Math.cos(i*0.9)*35}%`,fontSize:10,animation:`catParticle .8s ${.35+i*0.08}s cubic-bezier(.34,1.56,.64,1) both`,opacity:0,pointerEvents:"none",filter:`drop-shadow(0 0 3px ${fx.colors[i%fx.colors.length]})`}}>{fx.particle}</div>)}
              <div style={{animation:"introCat .5s .3s cubic-bezier(.34,1.56,.64,1) both",opacity:0,position:"relative",zIndex:1}}><div style={{width:44,height:44,borderRadius:11,overflow:"hidden",boxShadow:`0 0 0 2px ${catGlowColor}66, ${fx.borderGlow}`}}><CatSVG catId={catId} size={44}/></div></div>
              <div style={{fontSize:7,fontWeight:900,color:fx.colors[0],background:`${fx.colors[0]}22`,border:`1px solid ${fx.colors[0]}44`,borderRadius:6,padding:"1px 5px",animation:"introCat .5s .5s cubic-bezier(.34,1.56,.64,1) both",opacity:0,whiteSpace:"nowrap",zIndex:1}}>{fx.icon} {fx.label}</div>
              <div style={{width:"100%",minHeight:24,padding:"3px 5px",borderRadius:7,background:"rgba(10,15,30,.72)",fontSize:8,lineHeight:1.35,fontWeight:900,color:catGlowColor,textAlign:"center",textShadow:`0 0 6px ${catGlowColor}88`,animation:"catCry .4s .7s cubic-bezier(.34,1.56,.64,1) both",opacity:0,whiteSpace:"normal",overflowWrap:"anywhere",zIndex:1,letterSpacing:".02em"}}>{catBattleCry}</div>
            </div>)})()}
          </div>
          <div style={{maxWidth:"100%",fontSize:12,fontWeight:700,color:"#c4b5fd",textShadow:"0 0 8px #7c3aed",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",animation:"introArc .6s cubic-bezier(.34,1.56,.64,1) both"}}>{player?.name||""}</div>
        </div>
        <div style={{flexShrink:0,animation:"introVs .8s .4s cubic-bezier(.34,1.56,.64,1) both"}}><div style={{fontSize:38,fontWeight:900,color:"#fbbf24",textShadow:"0 0 24px #f59e0b, 0 0 48px #f59e0b"}}>VS</div></div>
        <div style={{minWidth:0,width:"min(34%,104px)",display:"flex",flexDirection:"column",alignItems:"center",gap:6,animation:"introMon .6s cubic-bezier(.34,1.56,.64,1) both"}}>
          <div style={{filter:"drop-shadow(0 0 16px #ef4444)"}}>{renderMonster ? renderMonster(80, monster) : <MonsterSVG id={monster?.id} size={80}/>}</div>
          <div style={{maxWidth:"100%",fontSize:12,fontWeight:700,color:"#fca5a5",textShadow:"0 0 8px #ef4444",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{battle.monsterName||monster?.name||""}</div>
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
      {partyMode&&partyHistory.length>0&&(<div style={{background:"rgba(6,10,20,.88)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"6px 9px",maxHeight:104,overflowY:"auto",display:"flex",flexDirection:"column",gap:2,pointerEvents:"auto",boxShadow:"0 4px 14px rgba(0,0,0,.55)"}}>{partyHistory.map((message,index)=><div key={`${partyResolutionKey}-${index}`} style={{fontSize:10.5,lineHeight:1.35,color:"#dce6f7",textShadow:"0 1px 2px rgba(0,0,0,.9)",animation:"msgIn .2s ease-out"}}>{message}</div>)}</div>)}
      {usedPotionInfo&&<div key={poofKey} style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(132,204,22,.4)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#bef264",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out"}}>⚗️ {usedPotionInfo.icon} <b>{usedPotionInfo.name}</b><span style={{color:"#9fb0cf",fontWeight:400,marginLeft:4}}>{usedPotionInfo.effectText}</span></div>}
      {!partyMode&&isScoring&&battle.lastArrowDmg>0&&(<div style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#dce6f7",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out"}}>
        {battle.battleMode==="zombie"&&battle.arrows.length>0&&battle.arrows[battle.arrows.length-1]?.part?(<><b>{battle.arrows[battle.arrows.length-1].part.icon} {battle.arrows[battle.arrows.length-1].part.name}</b>{' ×'}{battle.arrows[battle.arrows.length-1].part.mult}</>):(<>箭{battle.arrowIdx} · <b style={{color:"#ffd27a"}}>{battle.lastArrowPart}</b></>)}
        {' · '}<b style={{color:battle.lastArrowCrit?"#fbbf24":"#ff7a7a"}}>{battle.lastArrowDmg}</b>{battle.lastArrowCrit&&<span style={{color:"#fbbf24",fontWeight:900}}> 💥</span>}
      </div>)}
      {isRoundRes&&(<div style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#dce6f7",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out"}}>回合合計 · <b style={{color:"#ffd27a"}}>{battle.roundDmg}</b> 傷害{battle.roundCrits>0&&<span style={{color:"#fbbf24",fontWeight:900}}> 🔥×{battle.roundCrits}</span>}</div>)}
      {isRoundRes&&battle.counterDmg>0&&(<div style={{background:"rgba(9,14,25,.75)",border:"1px solid rgba(231,76,60,.4)",borderRadius:9,padding:"5px 9px",fontSize:11,lineHeight:1.3,color:"#ffc4c2",backdropFilter:"blur(7px)",boxShadow:"0 3px 10px rgba(0,0,0,.4)",animation:"msgIn .2s ease-out .2s both"}}>怪物反擊 · <b style={{color:"#ff7a7a"}}>-{battle.counterDmg}</b> HP</div>)}
    </div>}

    {false&&partyMode&&partyRole==="rear"&&!partyRearChoice&&<div style={{position:"absolute",zIndex:6,top:56,left:11,width:194,padding:8,borderRadius:11,background:"rgba(8,15,26,.9)",border:"1px solid rgba(125,211,252,.45)",boxShadow:"0 5px 16px rgba(0,0,0,.45)"}}>
      <div style={{fontSize:10,fontWeight:900,color:"#bae6fd",marginBottom:6}}>後衛本回合行動</div>
      <div style={{display:"flex",gap:5}}><button type="button" onClick={()=>onPartyRearChoice?.("heal")} style={{flex:1,border:"1px solid rgba(52,211,153,.45)",borderRadius:7,padding:"5px 2px",background:"rgba(16,185,129,.14)",color:"#6ee7b7",fontSize:10,fontWeight:900,cursor:"pointer"}}>🩺 治癒</button><button type="button" onClick={()=>onPartyRearChoice?.("dmg")} style={{flex:1,border:"1px solid rgba(251,146,60,.45)",borderRadius:7,padding:"5px 2px",background:"rgba(251,146,60,.14)",color:"#fdba74",fontSize:10,fontWeight:900,cursor:"pointer"}}>⚔️ 協攻</button></div>
    </div>}

    {/* 逐箭命中特效 */}
    {isProcessing&&animStep>=1&&animStep<=6&&battle.arrows[animStep-1]&&<div key={`dmg-${animStep}`} style={{position:"absolute",zIndex:6,top:60,right:"14%",pointerEvents:"none",fontSize:battle.arrows[animStep-1].isCrit?36:26,fontWeight:900,color:battle.arrows[animStep-1].isCrit?"#fbbf24":"#ff9a9a",textShadow:"0 2px 10px rgba(0,0,0,.85)",fontVariantNumeric:"tabular-nums",animation:"dmgFloat .8s ease-out forwards"}}>-{battle.arrows[animStep-1].dmg}{battle.arrows[animStep-1].isCrit?" 💥":""}</div>}
    {isProcessing&&animStep>=1&&animStep<=6&&battle.arrows[animStep-1]?.isCrit&&<div key={`flash-${animStep}`} style={{position:"absolute",inset:0,zIndex:5,pointerEvents:"none",background:"radial-gradient(circle at 72% 20%, rgba(251,191,36,.4), transparent 55%)",animation:"critFlash .45s ease-out forwards"}}/>}
    {partyAction?.type==="attack"&&<div key={`party-miss-${partyResolutionKey}-${partyAction.attackerId}`} style={{position:"absolute",zIndex:7,top:94,right:"14%",pointerEvents:"none",fontSize:11,fontWeight:900,color:"#d7e3f6",textShadow:"0 2px 6px rgba(0,0,0,.9)",animation:"dmgFloat .8s ease-out forwards"}}>脫靶 {partyAction.misses||0} 箭</div>}
    {partyMonsterHit&&<div key={`party-dmg-${partyResolutionKey}-${partyAction.type}-${partyAction.attackerId||"cat"}`} style={{position:"absolute",zIndex:6,top:60,right:"14%",pointerEvents:"none",fontSize:partyAction.critical?36:26,fontWeight:900,color:partyAction.critical?"#fbbf24":partyAction.type==="cat"?"#c4b5fd":"#ff9a9a",textShadow:"0 2px 10px rgba(0,0,0,.85)",fontVariantNumeric:"tabular-nums",animation:"dmgFloat .8s ease-out forwards"}}>-{partyAction.damage}{partyAction.critical?" 💥":""}</div>}
    {partyAction?.type==="attack"&&partyAction.critical&&<div key={`party-flash-${partyResolutionKey}`} style={{position:"absolute",inset:0,zIndex:5,pointerEvents:"none",background:"radial-gradient(circle at 72% 20%, rgba(251,191,36,.4), transparent 55%)",animation:"critFlash .45s ease-out forwards"}}/>}
    {partyAction?.type==="cat"&&<><div style={{position:"absolute",inset:0,zIndex:7,pointerEvents:"none",overflow:"hidden"}}>{[0,1,2,3].map(i=><span key={i} style={{position:"absolute",left:`${12+i*8}%`,top:`${57-i*7}%`,fontSize:30,animation:`catPawStrike 1.6s ${i*.16}s ease-out both`,filter:"drop-shadow(0 2px 5px rgba(0,0,0,.7))"}}>🐾</span>)}</div>{(partyAction.cats||[]).filter(catEntry=>catEntry.id!==partyPlayerId).map((catEntry,index)=><div key={`ally-cat-${catEntry.id}-${partyResolutionKey}`} style={{position:"absolute",zIndex:9,left:`${7+index*12}%`,top:`${54+index*7}%`,width:58,textAlign:"center",pointerEvents:"none",animation:`allyCatRush 1.75s ${index*.16}s cubic-bezier(.2,.8,.2,1) both`}}><div style={{width:46,height:46,margin:"0 auto",borderRadius:14,overflow:"hidden",border:"2px solid #f0abfc",boxShadow:"0 0 18px rgba(232,121,249,.95)"}}><CatSVG catId={catEntry.catId||"diandian"} size={46}/></div><div style={{marginTop:3,fontSize:9,fontWeight:900,color:"#f5d0fe",textShadow:"0 2px 5px #000",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{catEntry.name}</div><div style={{fontSize:10,fontWeight:900,color:"#fff",textShadow:"0 2px 5px #000"}}>協戰！</div></div>)}<div style={{position:"absolute",zIndex:12,left:"50%",top:"46%",transform:"translate(-50%,-50%)",width:"min(86%,330px)",pointerEvents:"none",textAlign:"center"}}><div style={{fontSize:15,fontWeight:900,color:"#eadcff",textShadow:"0 2px 8px #000",marginBottom:7}}>🐾 貓貓協戰</div><div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:6}}>{(partyAction.cats||[]).map((catEntry,index)=><div key={`${catEntry.id||index}-${partyResolutionKey}`} style={{width:102,padding:"6px 5px",borderRadius:10,background:"rgba(24,18,48,.94)",border:`1px solid ${catEntry.skillTriggered?"rgba(251,191,36,.8)":"rgba(196,181,253,.55)"}`,boxShadow:catEntry.skillTriggered?"0 0 16px rgba(251,191,36,.5)":"0 4px 14px rgba(0,0,0,.38)",animation:`pop .25s ${index*.13}s ease-out both`}}><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><div style={{width:28,height:28,borderRadius:9,overflow:"hidden"}}><CatSVG catId={catEntry.catId||"diandian"} size={28}/></div><div style={{minWidth:0,textAlign:"left"}}><b style={{display:"block",fontSize:9,color:"#f3e8ff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{catEntry.name||"貓貓"}</b><b style={{display:"block",fontSize:15,color:"#fff"}}>-{catEntry.dmg||0}</b></div></div><div style={{marginTop:4,fontSize:8,fontWeight:900,color:catEntry.skillTriggered?"#fcd34d":"#c4b5fd"}}>{catEntry.skillTriggered?`✨ ${catEntry.skillName||"技能發動"}`:"一般貓掌"}</div></div>)}</div></div></>}
    {partyAction?.type==="support"&&<div style={{position:"absolute",zIndex:11,left:"50%",top:"55%",transform:"translate(-50%,-50%)",display:"flex",gap:7,pointerEvents:"none"}}>{(partyAction.supports||[]).flatMap(item=>item.targets||[]).map((target,index)=>{const member=partyMembers.find(candidate=>candidate.id===target.id);const isHeal=partyAction.supportKind==="heal";return <div key={`${target.id}-${index}`} style={{width:78,padding:"6px 4px",borderRadius:10,textAlign:"center",background:isHeal?"rgba(16,185,129,.22)":"rgba(239,68,68,.20)",border:`1px solid ${isHeal?"#6ee7b7":"#fca5a5"}`,boxShadow:`0 0 18px ${isHeal?"rgba(52,211,153,.7)":"rgba(248,113,113,.7)"}`,animation:"pop .3s ease-out both"}}><div style={{width:30,height:30,margin:"0 auto",borderRadius:9,overflow:"hidden"}}>{member?.avatarId?<PlayerAvatar avatarId={member.avatarId} size={30}/>:<CatSVG catId={member?.catId||"diandian"} size={30}/>}</div><div style={{fontSize:9,fontWeight:900,color:"#fff",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{target.name}</div><div style={{fontSize:12,fontWeight:900,color:isHeal?"#6ee7b7":"#fca5a5"}}>{isHeal?`+${target.heal||0} HP`:`ATK +${(partyAction.supports||[]).find(entry=>(entry.targets||[]).some(entryTarget=>entryTarget.id===target.id))?.buffPct||0}%`}</div></div>})}</div>}
    {partyPhase&&partyPhase.type!=="attack"&&partyPhase.type!=="cat"&&<div key={`${partyResolutionKey}-${partyPhase.type}-${partyPhase.title}`} style={{position:"absolute",zIndex:10,left:"50%",top:"44%",transform:"translate(-50%,-50%)",width:"min(84%,310px)",pointerEvents:"none",textAlign:"center",animation:"pop .25s cubic-bezier(.2,.9,.3,1)"}}><div style={{background:"rgba(6,12,23,.9)",border:`1px solid ${partyPhase.type==="counter"?"rgba(248,113,113,.7)":partyPhase.type==="cat"?"rgba(196,181,253,.7)":"rgba(245,198,90,.7)"}`,borderRadius:15,padding:"13px 16px",boxShadow:"0 10px 32px rgba(0,0,0,.58)"}}><div style={{fontSize:25}}>{partyPhase.icon}</div><div style={{fontSize:16,fontWeight:900,color:"#f4f7ff",marginTop:2}}>{partyPhase.title}</div><div style={{fontSize:11,color:"#b9c7d9",marginTop:4}}>{partyPhase.detail}</div></div></div>}
    {showPartyKnockdown&&<div style={{position:"absolute",inset:0,zIndex:17,background:"linear-gradient(135deg,#0f172a,#1e1b4b,#0f172a)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,animation:"defFade .4s ease-out"}}><div style={{position:"relative",display:"inline-block"}}><div style={{animation:"defMon .2s ease-out both"}}>{renderMonster ? renderMonster(100, monster) : <MonsterSVG id={monster?.id} size={100}/>}</div><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",animation:"defBadge .5s .5s cubic-bezier(.34,1.56,.64,1) both",opacity:0,pointerEvents:"none"}}><div style={{fontSize:24,fontWeight:900,color:"#ef4444",border:"4px solid #ef4444",borderRadius:8,padding:"4px 14px",letterSpacing:4,textShadow:"0 0 12px #ef4444",boxShadow:"0 0 18px #ef444488",background:"rgba(0,0,0,.55)",transform:"rotate(-8deg)"}}>擊倒</div></div></div><div style={{animation:"defVictory .6s .8s cubic-bezier(.34,1.56,.64,1) both",opacity:0,textAlign:"center"}}><div style={{fontSize:28,fontWeight:900,color:"#fbbf24",textShadow:"0 0 32px #f59e0b",letterSpacing:4}}>💀 擊倒！</div><div style={{fontSize:13,color:"#94a3b8",marginTop:4}}>{monster?.name} 已無法再戰</div></div></div>}
    {showPartyDefeat&&<div style={{position:"absolute",inset:0,zIndex:17,background:"linear-gradient(135deg,rgba(33,8,12,.96),rgba(8,10,18,.97))",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,animation:"defFade .35s ease-out",textAlign:"center",padding:24}}><div style={{fontSize:58,animation:"hitShock .55s ease-out both"}}>💥</div><div style={{fontSize:28,fontWeight:900,color:"#f87171",textShadow:"0 0 28px rgba(239,68,68,.85)",letterSpacing:3}}>全員擊倒</div><div style={{fontSize:13,color:"#fecaca",lineHeight:1.6}}>怪物反擊結束，隊伍已無法繼續戰鬥。</div><div style={{fontSize:11,fontWeight:800,color:"#94a3b8"}}>正在進入戰鬥失敗結算…</div></div>}
    {partyMode&&partyResult==="win"&&!autoConfirmPartyResult&&!showPartyKnockdown&&completedPartyResolutionKey===partyResolutionKey&&<div style={{position:"absolute",inset:0,zIndex:16,background:"linear-gradient(145deg,#07170e,#123524,#07111d)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{width:"100%",maxWidth:310,textAlign:"center",background:"linear-gradient(180deg,#16412b,#091b12)",border:"1px solid rgba(74,222,128,.5)",borderRadius:18,padding:"23px 18px",boxShadow:"0 20px 60px rgba(0,0,0,.65)",animation:"pop .28s cubic-bezier(.2,.9,.3,1)"}}><div style={{fontSize:44}}>🏆</div><div style={{fontSize:20,fontWeight:900,color:"#6ef3a9",marginTop:3}}>怪物已擊敗</div><div style={{fontSize:12,color:"#c1d2e6",marginTop:8,lineHeight:1.55}}>完整戰鬥演出結束，確認後進入本次結算。</div>{partyIsHost?<button type="button" onClick={onConfirmPartyResult} style={{marginTop:17,width:"100%",padding:"11px 0",border:0,borderRadius:10,background:"linear-gradient(135deg,#f7c65a,#e79a1e)",color:"#2d1b00",fontSize:14,fontWeight:900,cursor:"pointer"}}>確認戰鬥結算</button>:<div style={{marginTop:16,fontSize:12,fontWeight:900,color:"#f5d06b"}}>等待房主確認結算</div>}</div></div>}
    {partyMode&&partyResult==="lose"&&!autoConfirmPartyResult&&!showPartyDefeat&&completedPartyResolutionKey===partyResolutionKey&&<div style={{position:"absolute",inset:0,zIndex:16,background:"rgba(20,5,8,.76)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{width:"100%",maxWidth:310,textAlign:"center",background:"linear-gradient(180deg,#42151a,#1d080c)",border:"1px solid rgba(248,113,113,.55)",borderRadius:18,padding:"23px 18px",boxShadow:"0 20px 60px rgba(0,0,0,.65)",animation:"pop .28s cubic-bezier(.2,.9,.3,1)"}}><div style={{fontSize:44}}>💥</div><div style={{fontSize:20,fontWeight:900,color:"#fca5a5",marginTop:3}}>隊伍無法繼續戰鬥</div><div style={{fontSize:12,color:"#fecaca",marginTop:8,lineHeight:1.55}}>完整戰鬥演出結束，請由房主確認本次結算。</div>{partyIsHost?<button type="button" onClick={onConfirmPartyResult} style={{marginTop:17,width:"100%",padding:"11px 0",border:0,borderRadius:10,background:"linear-gradient(135deg,#fb7185,#dc2626)",color:"#fff",fontSize:14,fontWeight:900,cursor:"pointer"}}>確認戰鬥結算</button>:<div style={{marginTop:16,fontSize:12,fontWeight:900,color:"#fda4af"}}>等待房主確認結算</div>}</div></div>}

    {/* 怪物 */}
    <ExternalBattleDemo demo={externalBattle ? externalDemo : null} catId={cat?.catId} />
    <div key={externalMonsterHitDemo ? `external-hit-${externalMonsterHitDemo.key}` : externalCounterDemo ? `external-counter-${externalCounterDemo.key}` : "monster"} style={{position:"absolute",zIndex:2,top:52,right:12,width:"min(42%, 190px)",display:"flex",flexDirection:"column",alignItems:"stretch",gap:7,filter:"drop-shadow(0 16px 26px rgba(0,0,0,.6))",animation:isWon?"wonShake .5s ease-out":(externalCounterDemo?`${externalCounterAnimation} .55s ease-out`:(externalMonsterHitDemo&&!(externalMonsterHitDemo.type==="arrow"&&externalMonsterHitDemo.isMiss)?(externalMonsterHitDemo.isCrit?"hitShock .5s ease-out, procMonster .45s ease-out":"procMonster .45s ease-out"):(partyMonsterHit?(partyAction.critical?"hitShock .5s ease-out, procMonster .45s ease-out":"procMonster .45s ease-out"):(isProcessing&&animStep>=1&&animStep<=6?(battle.arrows[animStep-1]?.isCrit?"hitShock .5s ease-out, procMonster .45s ease-out":"procMonster .45s ease-out"):"none"))))}}>
      <div style={{width:"100%",aspectRatio:"1",position:"relative",display:"grid",placeItems:"center",overflow:"visible",boxShadow:"none",opacity:isWon?0.6:1,transition:"filter .3s",filter:isWon?"brightness(.5) saturate(.3)":"none"}}><MonsterVariantFx variant={monster?.variant} />{renderMonster ? renderMonster(178, monster) : <MonsterSVG id={monster?.id} size={178}/>} {externalArrowDemo&&<div key={`external-dmg-${externalArrowDemo.key}`} style={{position:"absolute",zIndex:6,top:"10%",right:"-8%",pointerEvents:"none",fontSize:externalArrowDemo.isCrit?36:26,fontWeight:900,color:externalArrowDemo.isMiss?"#d7e3f6":externalArrowDemo.isCrit?"#fbbf24":"#ff9a9a",textShadow:"0 2px 10px rgba(0,0,0,.85)",fontVariantNumeric:"tabular-nums",animation:"dmgFloat .8s ease-out forwards"}}>{externalArrowDemo.isMiss?"MISS":`-${externalArrowDemo.damage}`}{externalArrowDemo.isCrit?" CRIT":""}</div>}</div>
      <div style={{width:"100%"}}>
        <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:3}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,fontWeight:800,textShadow:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:4,minWidth:0,overflow:"hidden"}}>
              <b style={{color:"#fff",fontSize:12.5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inBattle?battle.monsterName:monster?.name}{isWon&&" 💀"}</b>
            </div>
            {(()=>{const t=TIER_LABEL[monster?.tier]||{};return(<span style={{fontSize:9,fontWeight:900,padding:"1px 6px",borderRadius:4,color:t.color,background:t.bg||"transparent",border:`1px solid ${t.color}44`,whiteSpace:"nowrap"}}>{t.label||monster?.tier||"?"}</span>)})()}
          </div>
          {isWon&&<div style={{fontSize:11,fontWeight:900,color:"#4ade80",textAlign:"center",textShadow:"0 2px 6px #000"}}>擊敗！</div>}
        </div>
        {!hideMonsterStats&&<><div style={{height:8,borderRadius:99,background:"#020617",overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.3)"}}><div style={{width:`${hpPct}%`,height:"100%",borderRadius:99,background:isWon?"#4ade80":hpPct>60?"linear-gradient(90deg,#ff7a7a,#e03b3b)":hpPct>30?"linear-gradient(90deg,#fbbf24,#ea580c)":"linear-gradient(90deg,#f87171,#dc2626)",transition:"width .4s ease-out"}}/></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#e2e8f0",fontWeight:800,marginTop:3,fontVariantNumeric:"tabular-nums",textShadow:"none"}}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><StatGlyph type="hp" color="#5ff0a3" />HP</span><span><b style={{color:"#ffffff"}}>{inBattle?shownMonsterHp.toLocaleString():"?"}</b> / {inBattle?shownMonsterMaxHp.toLocaleString():"?"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#e2e8f0",fontWeight:800,marginTop:2,fontVariantNumeric:"tabular-nums",textShadow:"none"}}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><StatGlyph type="atk" color="#fca5a5" />ATK</span><span><b style={{color:"#fecaca"}}>{inBattle?battle.monsterAtk:monster?.atk||0}</b></span></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:10,color:"#e2e8f0",fontWeight:800,marginTop:2,fontVariantNumeric:"tabular-nums",textShadow:"none"}}><span style={{display:"inline-flex",alignItems:"center",gap:3}}><StatGlyph type="def" color="#93c5fd" />DEF</span><span><b style={{color:"#bfdbfe"}}>{inBattle?battle.monsterDef:monster?.def||0}</b></span></div></>}
      </div>
    </div>

    {/* 隊友 + 玩家 */}
    <div style={{position:"absolute",left:12,bottom:14,zIndex:4,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-start"}}>
      {allies.length>0&&(<div style={{width:180,display:"flex",flexWrap:"wrap",gap:7,background:"rgba(9,14,25,.4)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:7}}>
        {allies.map((mate,i)=>{const fx=(isProcessing&&animStep>=1&&animStep<=6)?teamFx[i]:null;const partyAttacking=partyAction?.type==="attack"&&partyAction.attackerId===mate.id;const partyHit=partyCounterTargets.find(target=>target.id===mate.id);const actionFx=partyAttacking?(partyAction.critical?"crit":partyAction.dim?"miss":"normal"):fx;const wbFrame=mate.battleCosmetics?.wbFrame;const frameC=actionFx==="crit"?"#f5b942":actionFx==="miss"?"#555":partyHit?.crit?"#ef4444":(wbFrame?.color||(mate.isFront||mate.role==="front"?"#ffb454":"#7dd3fc"));const critGlow=actionFx==="crit"?", 0 0 14px rgba(245,185,66,.85)":partyHit?.crit?", 0 0 16px rgba(239,68,68,.85)":wbFrame?`, 0 0 13px ${wbFrame.color}cc`:"";const missDim=actionFx==="miss";const counterAnim=partyHit?.crit?"partyCritHurt .9s ease-out":partyAction?.type==="counter"?"partyTeamShake .85s ease-out":"none";return(<button key={mate.id||i} type="button" onClick={()=>setSelectedAlly(mate)} title={`查看 ${mate.name} 狀態`} style={{position:"relative",width:38,padding:0,border:0,background:"transparent",cursor:"pointer",animation:counterAnim}}>
          <div style={{width:38,height:38,borderRadius:11,overflow:"hidden",boxShadow:`0 4px 10px rgba(0,0,0,.55), inset 0 0 0 2px ${frameC}${critGlow}`,filter:missDim?"grayscale(1) brightness(.45)":"none",transition:"box-shadow .2s, filter .2s",animation:actionFx?"teamAttack 1.25s ease-out":wbFrame?"wbFramePulse 1.7s ease-in-out infinite":"none"}}>{mate.avatarId ? <PlayerAvatar avatarId={mate.avatarId} size={38}/> : <CatSVG catId={mate.catId} size={38}/>}</div>
          {mate.battleCosmetics?.legendaryCount>0&&<span title={`傳說以上裝備 ${mate.battleCosmetics.legendaryCount} 件`} style={{position:"absolute",right:-4,bottom:13,width:15,height:15,borderRadius:99,display:"grid",placeItems:"center",fontSize:9,lineHeight:1,background:mate.battleCosmetics.highestLegendary==="mythic"?"#ec4899":"#f59e0b",color:"#fff",boxShadow:`0 0 0 2px #0b1220, 0 0 8px ${mate.battleCosmetics.highestLegendary==="mythic"?"#ec4899":"#f59e0b"}`}}>{mate.battleCosmetics.highestLegendary==="mythic"?"✦":"★"}</span>}
          <div style={{height:4,borderRadius:99,background:"rgba(0,0,0,.6)",marginTop:3,overflow:"hidden",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.14)"}}><div style={{width:`${(mate.hp/mate.maxHp)*100}%`,height:"100%",background:"linear-gradient(90deg,#5ff0a3,#22b866)"}}/></div>
          <div style={{position:"absolute",top:-5,right:-5,width:17,height:17,borderRadius:99,display:"grid",placeItems:"center",fontSize:10,fontWeight:900,background:mate.done||mate.ready?"#22c866":"rgba(245,185,66,.2)",boxShadow:mate.done||mate.ready?"0 0 0 2px #0b1220":"0 0 0 2px rgba(245,185,66,.45)",color:mate.done||mate.ready?"#0a1f12":"#f5b942",animation:mate.done||mate.ready?"none":"admPulse 1.4s infinite"}}>{mate.done||mate.ready?"✓":"⏳"}</div>
          <div style={{position:"absolute",bottom:14,left:-4,fontSize:8,fontWeight:900,padding:"1px 4px",borderRadius:5,color:"#111",background:mate.isFront||mate.role==="front"?"#ffb454":"#7dd3fc"}}>{mate.isFront||mate.role==="front"?"前":"後"}</div>
        </button>)})}
      </div>)}
      {selectedAlly&&<div style={{width:214,background:"rgba(7,12,22,.94)",border:`1px solid ${(selectedAlly.isFront||selectedAlly.role==="front")?"#ffb454":"#7dd3fc"}`,borderRadius:12,padding:"8px 10px",boxShadow:"0 8px 22px rgba(0,0,0,.55)",backdropFilter:"blur(8px)"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}><b style={{fontSize:13,color:"#f3f7ff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedAlly.name}</b><button type="button" onClick={()=>setSelectedAlly(null)} style={{border:0,background:"transparent",color:"#9fb0cf",cursor:"pointer",fontWeight:900}}>✕</button></div>
        <div style={{fontSize:10,color:"#c4b5fd",marginTop:2}}>🐱 {selectedAlly.catName||"攜帶貓貓"} · {(selectedAlly.isFront||selectedAlly.role==="front")?"前衛":"後衛"}</div>
        <div style={{display:"flex",gap:7,marginTop:6,fontSize:10,fontWeight:800,fontVariantNumeric:"tabular-nums"}}><span style={{color:"#5ff0a3"}}>HP {selectedAlly.hp||0}/{selectedAlly.maxHp||selectedAlly.maxHP||0}</span><span style={{color:"#f4a3a3"}}>ATK {selectedAlly.atk||0}</span><span style={{color:"#a3c4f4"}}>DEF {selectedAlly.def||0}</span></div>
        {selectedAlly.battleCosmetics?.wbFrame&&<div style={{marginTop:6,padding:"5px 7px",borderRadius:7,border:`1px solid ${selectedAlly.battleCosmetics.wbFrame.color}88`,background:`${selectedAlly.battleCosmetics.wbFrame.color}18`,fontSize:10,fontWeight:900,color:selectedAlly.battleCosmetics.wbFrame.color}}>👑 世界王稱號・{selectedAlly.battleCosmetics.wbFrame.title}</div>}
        {selectedAlly.battleCosmetics?.legendaryItems?.length>0&&<div style={{marginTop:5,fontSize:10,color:"#fcd34d",lineHeight:1.45}}>★ 傳說以上裝備：{selectedAlly.battleCosmetics.legendaryItems.map(item=>`${item.icon} ${item.name}`).join("、")}</div>}
        <div style={{fontSize:10,color:selectedAlly.done||selectedAlly.ready?"#5ff0a3":"#f5b942",marginTop:5}}>{selectedAlly.done||selectedAlly.ready?"✓ 本回合已送出分數":"⏳ 正在輸入本回合分數"}</div>
      </div>}

      {/* 玩家卡 */}
      {(()=>{const baseFrame=FRAME_TIERS[player?.cardFrame||"none"]||FRAME_TIERS.none;const wbColor=player?.battleCosmetics?.wbFrame?.color;const frame={...baseFrame,c:wbColor||baseFrame.c,glow:wbColor?`0 0 16px ${wbColor}aa`:baseFrame.glow};const curAtk=inBattle?battle.playerAtk:(player?.atk||0);const curDef=inBattle?battle.playerDef:(player?.def||0);const atkUp=inBattle&&battle.playerAtk>(player?.atk||0);const defUp=inBattle&&battle.playerDef>(player?.def||0);const curArrow=(isProcessing&&animStep>=1&&animStep<=6)?battle.arrows[animStep-1]:null;const selfAttacking=partyAction?.type==="attack"&&partyAction.attackerId===partyPlayerId;const selfHit=partyCounterTargets.find(target=>target.id===partyPlayerId);const partyFrameC=selfAttacking?(partyAction.critical?"#f5b942":partyAction.dim?"#555":frame.c):selfHit?.crit?"#ef4444":frame.c;const atkFrameC=curArrow?(curArrow.isCrit?"#f5b942":curArrow.score==="M"?"#555":frame.c):partyFrameC;const atkGlow=curArrow?.isCrit||selfAttacking&&partyAction.critical?"rgba(245,185,66,.75)":selfHit?.crit?"rgba(239,68,68,.75)":frame.glow;const cardAnim=curArrow?(curArrow.score==="M"?"playerMiss .5s ease-out":"playerAttack .5s ease-out"):(selfAttacking?(partyAction.dim?"playerMiss .5s ease-out":"playerAttack .5s ease-out"):(selfHit?.crit?"partyCritHurt .55s ease-out":(isProcessing&&animStep===8?"playerHurt .5s ease-out":"none")));return(<div key={`pc-${isProcessing?animStep:partyAction?.type||"idle"}`} style={{width:"fit-content",minWidth:214,maxWidth:"min(72vw, 310px)",background:"rgba(9,14,25,.62)",border:`2px solid ${atkFrameC}`,borderRadius:15,padding:"8px 10px",backdropFilter:"blur(8px)",boxShadow:`0 6px 18px rgba(0,0,0,.45), 0 0 ${curArrow?.isCrit||selfAttacking&&partyAction.critical?20:14}px ${atkGlow}`,filter:selfAttacking&&partyAction.dim?"grayscale(1) brightness(.52)":"none",animation:cardAnim}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:56,height:56,borderRadius:13,flexShrink:0,overflow:"hidden",boxShadow:`0 4px 12px rgba(0,0,0,.5), inset 0 0 0 2px ${frame.c}`}}>{renderPlayer ? renderPlayer(56, player) : <BattlePlayerPortrait player={player} size={56}/>}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,fontSize:14,fontWeight:900}}>{player?.name}<span style={{fontSize:8.5,fontWeight:900,color:"#241400",background:"#f5b942",borderRadius:5,padding:"1px 5px",letterSpacing:".05em"}}>你</span><span style={{fontSize:9.5,fontWeight:800,color:"#04222e",background:"#4cc9f0",borderRadius:5,padding:"1px 5px"}}>Lv.{player?.lv||"?"}</span></div>
            {player?.battleCosmetics?.wbFrame&&<div style={{marginTop:3,maxWidth:126,padding:"1px 5px",borderRadius:5,border:`1px solid ${player.battleCosmetics.wbFrame.color}88`,background:`${player.battleCosmetics.wbFrame.color}18`,color:player.battleCosmetics.wbFrame.color,fontSize:8.5,fontWeight:900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{player.battleCosmetics.wbFrame.title}</div>}
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
      {isPlaying&&<Btn label="射　擊" primary disabled={partyControlsLocked||showPartyRoundEvent} onClick={()=>dispatch({type:"START_SCORING",arrowsPerRound})} icon={<svg style={{width:16,height:16,flexShrink:0}} viewBox="0 0 24 24" fill="none" stroke="#241400" strokeWidth="2.2"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>}/>}
      {isRoundRes&&<Btn label="下一回合" primary onClick={handleNextRound} icon={<span style={{fontSize:16,flexShrink:0}}>➡️</span>}/>}
      {(isWon||isLost)&&<Btn label="再來一次" primary onClick={handleReset} icon={<span style={{fontSize:16,flexShrink:0}}>🔄</span>}/>}
      <Btn label={usedPotionInfo?"已用藥水":"藥　水"} disabled={!inBattle||isScoring||!!usedPotionInfo||partyControlsLocked} onClick={()=>setShowPotionPanel(true)} icon={usedPotionInfo?.potion ? <ConsumableIcon potion={usedPotionInfo.potion} size={18} /> : <span style={{fontSize:16,flexShrink:0}}>🧪</span>}/>
      {onLeaveBattle&&inBattle&&<Btn label="離開戰鬥" danger onClick={handleLeave} icon={<span style={{fontSize:16,flexShrink:0}}>↩</span>}/>}
      {!onLeaveBattle&&!partyMode&&inBattle&&<Btn label="重置" onClick={handleReset} icon={<span style={{fontSize:16,flexShrink:0}}>↺</span>}/>}
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
            <ConsumableIcon potion={p} size={28} />
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
        {partyMode&&partyRole==="rear"&&!partyRearChoice&&<div style={{marginBottom:10,padding:"10px",borderRadius:10,background:"rgba(14,55,78,.48)",border:"1px solid rgba(125,211,252,.5)"}}><div style={{fontSize:12,fontWeight:900,color:"#bae6fd",marginBottom:7}}>後衛本回合支援</div><div style={{fontSize:10,color:"#cbd5e1",marginBottom:8}}>請先選擇後衛行動，才可送出本回合分數。</div><div style={{display:"flex",gap:7}}><button type="button" onClick={()=>onPartyRearChoice?.("heal")} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"1px solid rgba(52,211,153,.48)",background:"rgba(16,185,129,.16)",color:"#6ee7b7",fontSize:11,fontWeight:900,cursor:"pointer"}}>💚 支援治療</button><button type="button" onClick={()=>onPartyRearChoice?.("dmg")} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"1px solid rgba(251,146,60,.48)",background:"rgba(251,146,60,.16)",color:"#fdba74",fontSize:11,fontWeight:900,cursor:"pointer"}}>🏹 支援強化</button></div></div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:14,fontWeight:900,color:battle.arrows.length>=arrowsPerRound?"#f5b942":"#eef3fc"}}>{battle.arrows.length>=arrowsPerRound?"✅ 6 箭已輸入，確認無誤後送出":`輸入第 ${battle.arrowIdx+1} 箭分數`}</div>
          <div style={{fontSize:11,color:"#9fb0cf"}}>{Math.min(battle.arrows.length,arrowsPerRound)} / {arrowsPerRound} 箭</div>
        </div>
        {scoreInput==="target"&&(<div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:10}}><TargetFaceInput fmtId={targetFormat} radius={112} arrowLabels={battle.arrows.map(a=>a.score)} arrowsPerRound={arrowsPerRound} onArrow={handleScore} /><div style={{fontSize:11,color:"#9fb0cf",marginTop:4}}>👆 點靶面對應環數計分</div></div>)}
        <div style={{display:"flex",gap:6,marginBottom:12,minHeight:36,alignItems:"center"}}>
          {Array.from({length:arrowsPerRound}).map((_,i)=>{const a=battle.arrows[i];return(<div key={i} style={{flex:1,height:34,borderRadius:9,border:a?(a.isCrit?"1px solid #fbbf24":"1px solid rgba(255,255,255,.2)"):(i===battle.arrowIdx?"2px solid #f5b942":"1px dashed rgba(255,255,255,.16)"),display:"grid",placeItems:"center",fontSize:14,fontWeight:900,color:a?"#eaf6ff":(i===battle.arrowIdx?"#f5b942":"#6b7a99"),background:a?(a.isCrit?"rgba(251,191,36,.18)":"rgba(255,255,255,.08)"):(i===battle.arrowIdx?"rgba(245,185,66,.12)":"rgba(255,255,255,.03)"),fontVariantNumeric:"tabular-nums",boxShadow:i===battle.arrowIdx?"0 0 0 2px rgba(245,185,66,.3)":"none"}}>{a?(a.displayLabel||a.score):(i===battle.arrowIdx?"▼":"")}</div>)})}
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

    {showPartyRoundEvent&&partyRoundEvent&&<div onClick={()=>setShowPartyRoundEvent(false)} style={{position:"absolute",inset:0,zIndex:14,background:"rgba(4,7,13,.64)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{width:"100%",maxWidth:285,textAlign:"center",background:"linear-gradient(180deg,#18243e,#0b1220)",border:"1px solid rgba(245,198,90,.55)",borderRadius:18,padding:"22px 18px",boxShadow:"0 20px 60px rgba(0,0,0,.62)",animation:"pop .26s cubic-bezier(.2,.9,.3,1)"}}><div style={{fontSize:43}}>{partyRoundEvent.icon||"⚡"}</div><div style={{fontSize:19,fontWeight:900,color:"#f5d06b",marginTop:4}}>{partyRoundEvent.title||"回合事件"}</div><div style={{fontSize:12,color:"#d3ddec",lineHeight:1.6,marginTop:7}}>{partyRoundEvent.desc}</div><div style={{marginTop:10,padding:"8px 10px",borderRadius:9,background:"rgba(245,198,90,.12)",border:"1px solid rgba(245,198,90,.32)",fontSize:12,fontWeight:900,color:"#fde68a"}}>本回合效果：{partyEventEffectText(partyRoundEvent)}</div><div style={{fontSize:10,color:"#8fa4c2",marginTop:12}}>效果已套用・點擊略過</div></div></div>}
    {partyMode&&partySubmitted&&<div style={{position:"absolute",inset:0,zIndex:11,background:"rgba(4,7,13,.52)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{width:"100%",maxWidth:300,background:"linear-gradient(180deg,#10251b,#0b1711)",border:"1px solid rgba(74,222,128,.4)",borderRadius:16,padding:"16px",boxShadow:"0 16px 40px rgba(0,0,0,.55)"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:23}}>✅</span><div><div style={{fontSize:15,fontWeight:900,color:"#5ff0a3"}}>本回合分數已送出</div><div style={{fontSize:10,color:"#b9c7d9",marginTop:2}}>等待所有存活隊員完成輸入。</div></div></div><div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>{partyMembers.map(member=>{const isReady=!!member.ready;const isAlive=member.alive!==false;const canSkip=partyIsHost&&isAlive&&!isReady&&!member.isSelf&&!partyProcessing;const status=!isAlive?"💀 已陣亡":member.skipped?"⏭ 本回合跳過":isReady?"✅ 已送出":"⏳ 輸入中";const statusColor=!isAlive?"#94a3b8":member.skipped?"#fbbf24":isReady?"#5ff0a3":"#f5d06b";return(<div key={member.id} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 8px",borderRadius:9,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)"}}><div style={{width:28,height:28,borderRadius:8,overflow:"hidden",flexShrink:0}}>{member.avatarId?<PlayerAvatar avatarId={member.avatarId} size={28}/>:<CatSVG catId={member.catId||"diandian"} size={28}/>}</div><div style={{minWidth:0,flex:1}}><div style={{fontSize:11,fontWeight:900,color:"#f3f7ff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{member.name}{member.isSelf?"（你）":""}<span style={{fontSize:8,marginLeft:5,padding:"1px 4px",borderRadius:4,color:"#15202e",background:(member.role||"front")==="front"?"#ffb454":"#7dd3fc"}}>{(member.role||"front")==="front"?"前衛":"後衛"}</span></div><div style={{fontSize:10,fontWeight:800,color:statusColor,marginTop:1}}>{status}</div></div>{canSkip&&<button type="button" onClick={()=>onForceSkipMember?.(member.id)} style={{padding:"5px 7px",borderRadius:7,border:"1px solid rgba(251,191,36,.5)",background:"rgba(245,158,11,.14)",color:"#fcd34d",fontSize:10,fontWeight:900,cursor:"pointer"}}>跳過</button>}</div>)})}</div>{partyAllReady&&<div style={{marginTop:12,padding:"9px 10px",borderRadius:10,background:"rgba(245,185,66,.12)",border:"1px solid rgba(245,185,66,.36)",textAlign:"center"}}><div style={{fontSize:13,fontWeight:900,color:"#fcd34d"}}>⚔️ 全員送出 · {partyReadyCountdown} 秒後開始結算</div>{partyIsHost&&<button type="button" disabled={partyProcessing} onClick={onConfirmPartyRound} style={{marginTop:7,width:"100%",padding:"8px 0",border:0,borderRadius:8,background:"linear-gradient(135deg,#f7c65a,#e79a1e)",color:"#2d1b00",fontSize:12,fontWeight:900,cursor:partyProcessing?"not-allowed":"pointer",opacity:partyProcessing?0.5:1}}>立即開始結算</button>}</div>}{partyIsHost&&!partyAllReady&&<div style={{fontSize:10,color:"#9fb0cf",lineHeight:1.45,marginTop:10}}>房主可跳過尚未輸入的存活隊員，直接進入本回合結算。</div>}</div></div>}

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

    {partyAbilityTelegraph&&isPlaying&&<div style={{position:"absolute",inset:0,zIndex:14,background:"rgba(4,7,13,.72)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div role="dialog" aria-modal="true" aria-label="組隊怪物技能預告" style={{width:"100%",maxWidth:310,textAlign:"center",background:"linear-gradient(180deg,#30172a,#0b1220)",border:"1px solid rgba(251,113,133,.62)",borderRadius:18,padding:"20px 17px",boxShadow:"0 20px 60px rgba(0,0,0,.65),0 0 34px rgba(244,63,94,.2)"}}>
        <div style={{fontSize:11,fontWeight:900,color:"#fda4af",letterSpacing:".12em"}}>第 {partyAbilityTelegraph.round} 回合・隊伍技能預告</div>
        <div style={{fontSize:38,marginTop:5}}>⚡</div>
        <div style={{fontSize:19,fontWeight:900,color:"#ffe4e6",marginTop:2}}>{partyAbilityTelegraph.enhanced?"強化・":""}{partyAbilityTelegraph.name}</div>
        {partyAbilityTelegraph.targetId?<div style={{fontSize:12,color:"#fecdd3",marginTop:8}}>鎖定目標：{partyMembers.find(member=>member.id===partyAbilityTelegraph.targetId)?.name||"存活前衛"}</div>:<div style={{fontSize:12,color:"#cbd5e1",marginTop:8}}>全隊共同破解此技能</div>}
        {partyAbilityTelegraph.summary&&<div style={{fontSize:12,color:"#d8deeb",lineHeight:1.55,marginTop:8}}>{partyAbilityTelegraph.summary}</div>}
        {partyAbilityTelegraph.counterSummary&&<div style={{fontSize:11,color:"#94a3b8",lineHeight:1.45,marginTop:6}}>🔍 破解方式：{partyAbilityTelegraph.counterSummary}</div>}
        <div style={{fontSize:11,color:"#6ee7b7",fontWeight:900,lineHeight:1.5,marginTop:9,padding:"9px",borderRadius:9,background:"rgba(16,185,129,.14)",border:"1px solid rgba(52,211,153,.35)"}}>🎯 {getBreakRuleText()}</div>
        <button onClick={()=>setPartyAbilityTelegraph(null)} style={{width:"100%",marginTop:14,padding:10,border:0,borderRadius:10,background:"linear-gradient(135deg,#fb7185,#e11d48)",color:"#fff",fontSize:13,fontWeight:900,cursor:"pointer"}}>了解，隊伍開始射擊</button>
      </div>
    </div>}

    {/* 💥 技能發動結算演出（破解結果一目了然） */}
    {skillFx&&(()=>{const lv=skillFx.outcome?.level;const tone=lv==="full"?{c:"#34d399",t:"🛡️ 完全破解！技能無效"}:lv==="major"?{c:"#38bdf8",t:"💪 高分破解！大幅削弱"}:lv==="partial"?{c:"#fbbf24",t:"👍 部分破解！效果減半"}:{c:"#f87171",t:"💢 未破解，全額生效"};
      return <div style={{position:"absolute",left:8,right:8,top:"18%",zIndex:14,pointerEvents:"none",display:"flex",justifyContent:"center"}}>
        <div className="fx-fade-up" style={{maxWidth:340,width:"100%",padding:"12px 16px",borderRadius:14,textAlign:"center",background:"rgba(4,7,13,.92)",border:`2px solid ${tone.c}`,boxShadow:`0 0 24px ${tone.c}55`}}>
          <div style={{fontSize:15,fontWeight:900,color:"#f5d0fe"}}>⚡ {battle.monsterName} 發動「{skillFx.name||"技能"}」</div>
          <div style={{fontSize:12,fontWeight:900,color:tone.c,marginTop:4}}>{tone.t}</div>
          {skillFx.summary&&<div style={{fontSize:11,color:"#cbd5e1",lineHeight:1.5,marginTop:5}}>{skillFx.summary}</div>}
          {skillFx.partyDamage>0&&<div style={{fontSize:12,fontWeight:900,color:"#fca5a5",marginTop:3}}>💥 你受到 {skillFx.partyDamage} 傷害</div>}
          {/* 附加狀態要寫出「實際扣了幾點」，只給百分比玩家無感 */}
          {(skillFx.statuses?.length?skillFx.statuses:skillFx.status?[skillFx.status]:[]).map((st,i)=>{
            const pct=typeof st.strength==="number"?st.strength:null;
            const base=st.id==="atkDown"?battle.playerAtk:st.id==="defDown"?battle.playerDef:st.id==="poison"?battle.playerMaxHp:null;
            const points=pct!==null&&Number.isFinite(base)?Math.round(base*pct/100):null;
            const suffix=points>0?(st.id==="poison"?`，每回合 -${points} HP`:`，-${points} 點`):"";
            return <div key={i} style={{fontSize:11,color:"#fca5a5",marginTop:2}}>
              🌀 {st.name||st.id}{pct!==null?` -${pct}%`:""}{suffix}（{st.duration||1} 回合）
            </div>;
          })}
          {skillFx.selfShieldMaxHpPct>0&&<div style={{fontSize:11,color:"#93c5fd",marginTop:2}}>🛡 怪物獲得護盾</div>}
          {skillFx.delayedMult>0&&<div style={{fontSize:11,color:"#fdba74",marginTop:2}}>⏳ 蓄力中：下回合追加攻擊！</div>}
          {skillFx.monsterHealMaxHpPct>0&&<div style={{fontSize:11,color:"#86efac",marginTop:2}}>💚 怪物回復 {skillFx.monsterHealMaxHpPct}% 最大生命</div>}
        </div>
      </div>;})()}
    {soloAbilityTelegraph&&isPlaying&&<div style={{position:"absolute",inset:0,zIndex:13,background:"rgba(4,7,13,.68)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div role="dialog" aria-modal="true" aria-label="怪物技能預告" style={{width:"100%",maxWidth:300,textAlign:"center",background:"linear-gradient(180deg,#241633,#0b1220)",border:"1px solid rgba(192,132,252,.58)",borderRadius:18,padding:"20px 17px",boxShadow:"0 20px 60px rgba(0,0,0,.62),0 0 34px rgba(168,85,247,.2)"}}>
        <div style={{fontSize:11,fontWeight:900,color:"#c4b5fd",letterSpacing:".12em"}}>第 {soloAbilityTelegraph.round} 回合・技能預告</div>
        <div style={{fontSize:38,marginTop:5}}>⚡</div>
        <div style={{fontSize:19,fontWeight:900,color:"#f5d0fe",marginTop:2}}>{soloAbilityTelegraph.enhanced?"強化・":""}{soloAbilityTelegraph.name}</div>
        {soloAbilityTelegraph.summary&&<div style={{fontSize:12,color:"#d8deeb",lineHeight:1.55,marginTop:8}}>{soloAbilityTelegraph.summary}</div>}
        {soloAbilityTelegraph.counterSummary&&<div style={{fontSize:10,color:"#94a3b8",lineHeight:1.45,marginTop:8}}>技能演出：{soloAbilityTelegraph.counterSummary}</div>}
        <div style={{fontSize:11,color:"#6ee7b7",fontWeight:900,lineHeight:1.5,marginTop:8,padding:"9px",borderRadius:9,background:"rgba(16,185,129,.14)",border:"1px solid rgba(52,211,153,.35)"}}>🎯 {getBreakRuleText()}</div>
        <button onClick={()=>setSoloAbilityTelegraph(null)} style={{width:"100%",marginTop:14,padding:10,border:0,borderRadius:10,background:"linear-gradient(135deg,#c084fc,#8b5cf6)",color:"#160b24",fontSize:13,fontWeight:900,cursor:"pointer"}}>了解，開始射擊</button>
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
          {battle.lastAbilityResolution&&<div style={{marginTop:10,padding:"8px 10px",borderRadius:9,background:"rgba(168,85,247,.12)",border:"1px solid rgba(192,132,252,.3)",fontSize:11,color:"#e9d5ff"}}>⚡ 技能破解：{{full:"完全破解",major:"大幅破解",partial:"部分破解",none:"破解失敗"}[battle.lastAbilityResolution.outcome?.level]||"已結算"}{battle.lastAbilityResolution.status?`・${battle.lastAbilityResolution.status.id==="poison"?"毒素":battle.lastAbilityResolution.status.id==="atkDown"?"攻擊降低":"防禦降低"} ${battle.lastAbilityResolution.status.strength}%`:"・異常已取消"}</div>}
        </div>
        <button onClick={handleNextRound} style={{width:"100%",padding:13,borderRadius:11,background:"linear-gradient(135deg,#f7c65a,#e79a1e)",color:"#241400",fontSize:16,fontWeight:900,border:"none",cursor:"pointer",letterSpacing:".06em"}}>下一回合 ➡️</button>
      </div>
    </div>)}

    {/* ── 勝利 ── */}
    {isWon&&!hideStandaloneResult&&(<div style={{position:"absolute",inset:0,zIndex:10,background:"rgba(4,7,13,.74)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
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

    <style>{`@keyframes bob{50%{transform:translateY(-8px)}}@keyframes rise{from{transform:translateY(60px);opacity:0}}@keyframes pop{from{transform:scale(.9);opacity:0}}@keyframes msgIn{from{transform:translateX(-20px);opacity:0}}@keyframes admPulse{50%{opacity:.4}}@keyframes wonShake{0%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}100%{transform:rotate(0)}}@keyframes introArc{from{opacity:0;transform:translateX(-90px) scale(.6)}to{opacity:1;transform:translateX(0) scale(1)}}@keyframes introMon{from{opacity:0;transform:translateX(90px) scale(.6)}to{opacity:1;transform:translateX(0) scale(1)}}@keyframes introVs{0%{opacity:0;transform:scale(.2) rotate(-18deg)}55%{transform:scale(1.3) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0)}}@keyframes introStart{from{opacity:0;transform:translateY(18px) scale(.85)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes introCat{from{opacity:0;transform:translateX(-30px) scale(.5) rotate(-12deg)}to{opacity:1;transform:translateX(0) scale(1) rotate(0)}}@keyframes defFade{from{opacity:0}to{opacity:1}}@keyframes defMon{0%{filter:brightness(1)}20%{filter:brightness(3.5) drop-shadow(0 0 40px #ef4444)}100%{filter:brightness(.1) grayscale(.8) drop-shadow(0 0 6px #555)}}@keyframes defBadge{0%{opacity:0;transform:scale(2.2) rotate(-20deg)}55%{opacity:1;transform:scale(.92) rotate(6deg)}100%{opacity:1;transform:scale(1) rotate(-8deg)}}@keyframes defVictory{0%{opacity:0;transform:scale(.3) rotate(-12deg)}55%{transform:scale(1.2) rotate(3deg)}100%{opacity:1;transform:scale(1) rotate(0)}}@keyframes defStats{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes catPulse{50%{filter:drop-shadow(0 0 6px var(--cat-glow,#a78bfa))}}@keyframes catCry{0%{opacity:0;transform:scale(.3) translateY(8px)}55%{opacity:1;transform:scale(1.2) translateY(-2px)}100%{opacity:1;transform:scale(1) translateY(0)}}@keyframes catParticle{0%{opacity:0;transform:scale(0) translateY(10px) rotate(0deg)}50%{opacity:1;transform:scale(1.3) translateY(-15px) rotate(180deg)}100%{opacity:0;transform:scale(.5) translateY(-30px) rotate(360deg)}}@keyframes procMonster{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px) rotate(-2deg)}75%{transform:translateX(6px) rotate(2deg)}}@keyframes dmgFloat{0%{opacity:0;transform:translateY(6px) scale(.6)}25%{opacity:1;transform:translateY(-6px) scale(1.15)}100%{opacity:0;transform:translateY(-38px) scale(1)}}@keyframes critFlash{0%{opacity:0}30%{opacity:1}100%{opacity:0}}@keyframes hitShock{0%{filter:brightness(1)}15%{filter:brightness(2.6) drop-shadow(0 0 18px #fff)}100%{filter:brightness(1)}}@keyframes playerAttack{0%{transform:translateY(0)}35%{transform:translateY(-14px)}100%{transform:translateY(0)}}@keyframes playerMiss{0%,100%{transform:translateY(0);opacity:1}40%{transform:translateY(3px);opacity:.65}}@keyframes playerHurt{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}45%{transform:translateX(6px)}70%{transform:translateX(-3px)}}@keyframes partyCritHurt{0%,100%{transform:translateX(0)}18%{transform:translateX(-9px)}38%{transform:translateX(8px)}58%{transform:translateX(-6px)}78%{transform:translateX(4px)}}@keyframes partyTeamShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}45%{transform:translateX(5px)}70%{transform:translateX(-3px)}}@keyframes teamAttack{0%{transform:translateY(0)}40%{transform:translateY(-10px)}100%{transform:translateY(0)}}@keyframes wbFramePulse{0%,100%{filter:brightness(1);transform:scale(1)}50%{filter:brightness(1.3) drop-shadow(0 0 5px currentColor);transform:scale(1.06)}}`}</style>
    <style>{`@keyframes catPawStrike{0%{opacity:0;transform:translate(-28px,42px) scale(.35) rotate(-25deg)}30%{opacity:1}72%{opacity:1;transform:translate(150px,-38px) scale(1.35) rotate(18deg)}100%{opacity:0;transform:translate(190px,-50px) scale(.6) rotate(36deg)}}@keyframes allyCatRush{0%{opacity:0;transform:translate(-48px,46px) scale(.45) rotate(-16deg)}25%{opacity:1}62%{opacity:1;transform:translate(140px,-44px) scale(1.18) rotate(8deg)}78%{transform:translate(158px,-50px) scale(.95) rotate(-4deg)}100%{opacity:0;transform:translate(182px,-56px) scale(.65) rotate(15deg)}}`}</style>
  </div>);
});

export { PHASE, initBattle, battleReducer, TargetFace, computeUnlocked };
export default BattleScreen;
