// src/components/cat/CatCollection.jsx — 貓貓陪練系統主頁
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeMyCats, claimStarterCat, setCatType,
  equipCat, unequipCat, unlockChapter, addBlessing,
} from "../../lib/catDb";
import {
  CATS, CAT_IDS, CAT_TYPES, CAT_TYPE_MAP, CAT_SKILL_GROUPS, CAT_BUILD_PROFILES, getCatChapters,
  getBondLevel, getBondProgress, BOND_THRESHOLDS, CHAPTER_BOND_LV,
  CAT_EQUIP_SLOTS, CAT_EQUIP_GRADE_NAMES, CAT_EQUIP_GRADE_COLORS, CAT_EQUIP_GRADE_BG,
  catEquipEnhancement, calcCatSkillChance, calcCatSkillEffect,
} from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
import { getLevelStyle } from "../../lib/archerLevel";
import CatSVG from "./CatSVG";

// ── 羈絆條 ──────────────────────────────────────────────────
function BondBar({ bond }) {
  const { lv, pct, toNext } = getBondProgress(bond);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-indigo-300 font-bold">羈絆 Lv.{lv}</span>
        {toNext > 0
          ? <span className="text-slate-400">距離下一級 {toNext} 點</span>
          : <span className="text-amber-300 font-bold">MAX</span>}
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-700"
          style={{ width: `${pct}%` }}/>
      </div>
      <div className="text-xs text-slate-500 mt-0.5 font-mono">{bond} / {BOND_THRESHOLDS[lv + 1] || "MAX"}</div>
    </div>
  );
}

// ── 章節列表 ────────────────────────────────────────────────
function ChapterList({ catId, catData, bondLevel, unlockedChs, onReadChapter }) {
  const cat       = CATS[catId];
  const chapters  = getCatChapters(catId, cat?.isDeceased);

  return (
    <div className="space-y-2">
      {chapters.map(ch => {
        const isUnlocked = unlockedChs?.includes(ch.ch);
        const bondNeeded = CHAPTER_BOND_LV[ch.ch] ?? 10;
        const canUnlock  = bondLevel >= bondNeeded && !isUnlocked;
        const locked     = bondLevel < bondNeeded && !isUnlocked;

        return (
          <div key={ch.ch}
            className={`rounded-2xl border px-4 py-3 transition-all ${
              ch.isMemorial
                ? "border-indigo-400/40 bg-indigo-900/20"
                : isUnlocked
                  ? "border-white/15 bg-white/5"
                  : locked
                    ? "border-white/5 bg-white/3 opacity-50"
                    : "border-amber-400/40 bg-amber-500/10"
            }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">
                {ch.isMemorial ? "🌈" : isUnlocked ? "📖" : locked ? "🔒" : "✨"}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold truncate ${ch.isMemorial ? "text-indigo-300" : "text-white"}`}>
                  第 {ch.ch} 章：{ch.title}
                </div>
                {locked && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    需要羈絆 Lv.{bondNeeded}（差 {BOND_THRESHOLDS[bondNeeded] - (catData?.bond || 0)} 點）
                  </div>
                )}
                {canUnlock && (
                  <div className="text-xs text-amber-300 font-bold mt-0.5">✨ 可解鎖！</div>
                )}
              </div>
              {(isUnlocked || canUnlock) && (
                <button
                  onClick={() => onReadChapter(ch)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    canUnlock
                      ? "bg-amber-500 text-white"
                      : "bg-white/10 text-slate-300"
                  }`}>
                  {canUnlock ? "解鎖" : "閱讀"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 章節閱讀器 ──────────────────────────────────────────────
function ChapterReader({ catId, chapter, memberName, memberId, onClose, onUnlocked }) {
  const [blessing, setBlessing]   = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const cat = CATS[catId];

  async function handleUnlock() {
    setLoading(true);
    await unlockChapter(memberId, catId, chapter.ch);
    setLoading(false);
    onUnlocked(chapter.ch);
  }

  async function handleBlessing() {
    if (!blessing.trim()) return;
    setLoading(true);
    await addBlessing(memberId, memberName, catId, blessing.trim());
    setSubmitted(true);
    setLoading(false);
  }

  const isUnlocked = !chapter.canUnlock;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* 插圖區（AI 插圖預留位置）*/}
        <div className="shrink-0 h-48 flex items-center justify-center relative"
          style={{ background: "linear-gradient(180deg, #1e1b4b, #0f172a)" }}>
          <div className="flex flex-col items-center gap-3 opacity-60">
            <CatSVG catId={catId} size={80} deceased={cat?.isDeceased}/>
            <div className="text-slate-500 text-xs">插圖即將呈現</div>
          </div>
          {chapter.isMemorial && (
            <div className="absolute inset-0 bg-indigo-900/30 flex items-end justify-center pb-4">
              <div className="text-indigo-300 text-xs font-bold">🌈 紀念章節</div>
            </div>
          )}
        </div>

        {/* 故事內容 */}
        <div className="flex-1 px-5 py-5 space-y-4"
          style={{ background: "linear-gradient(180deg, #0f172a, #1e293b)" }}>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">第 {chapter.ch} 章</div>
            <div className={`text-xl font-black ${chapter.isMemorial ? "text-indigo-300" : "text-white"}`}>
              {chapter.title}
            </div>
          </div>

          {/* 故事文字（留白，等內容填入）*/}
          {chapter.story ? (
            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {chapter.story}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-slate-500 text-sm">
              故事內容即將登場…<br/>
              <span className="text-xs">（作者正在整理 {cat?.name} 的冒險回憶）</span>
            </div>
          )}

          {/* 貓咪內心獨白 */}
          {chapter.thought && (
            <div className="bg-indigo-900/30 border border-indigo-400/30 rounded-2xl px-4 py-3">
              <div className="text-xs text-indigo-400 font-bold mb-1">💭 {cat?.name} 的心聲</div>
              <div className="text-sm text-indigo-200 italic leading-relaxed">「{chapter.thought}」</div>
            </div>
          )}

          {/* 懸念結尾 */}
          {chapter.cliffhanger && (
            <div className="text-right text-xs text-slate-400 italic pr-2">
              {chapter.cliffhanger}<br/>
              <span className="text-slate-600">（待續…）</span>
            </div>
          )}

          {/* 第 11 章：祝福留言 */}
          {chapter.isMemorial && !submitted && (
            <div className="bg-indigo-900/30 border border-indigo-400/30 rounded-2xl p-4 space-y-3">
              <div className="text-sm text-indigo-300 font-bold">💌 留下你的祝福</div>
              <div className="text-xs text-slate-400">
                {cat?.name} 已化為天使，在彩虹橋的另一端繼續守護大家。
                留下你對牠的祝福，讓牠知道你沒有忘記。
              </div>
              <textarea
                value={blessing}
                onChange={e => setBlessing(e.target.value)}
                placeholder={`對 ${cat?.name} 說些什麼…`}
                maxLength={150}
                rows={3}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 resize-none"/>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{blessing.length}/150</span>
                <button onClick={handleBlessing} disabled={!blessing.trim() || loading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40 active:scale-95">
                  {loading ? "送出中…" : "💌 送出祝福"}
                </button>
              </div>
            </div>
          )}
          {chapter.isMemorial && submitted && (
            <div className="text-center text-indigo-300 text-sm font-bold py-3">
              ✨ 祝福已送達彩虹橋的另一端
            </div>
          )}
        </div>
      </div>

      {/* 底部按鈕 */}
      <div className="shrink-0 px-4 pb-6 pt-3 space-y-2"
        style={{ background: "#0f172a" }}>
        {chapter.canUnlock && (
          <button onClick={handleUnlock} disabled={loading}
            className="w-full py-3 rounded-2xl font-black text-amber-900 bg-amber-400 active:scale-95 disabled:opacity-40">
            {loading ? "解鎖中…" : `✨ 解鎖《第 ${chapter.ch} 章》`}
          </button>
        )}
        <button onClick={onClose}
          className="w-full py-3 rounded-2xl text-slate-400 text-sm bg-white/5 border border-white/10">
          關閉
        </button>
      </div>
    </div>
  );
}

// ── 貓咪詳情頁 ──────────────────────────────────────────────
function CatDetail({ catId, catData, equippedCat, onBack, memberId, memberName, onEquipChange, onOpenForge }) {
  const cat = CATS[catId];
  const catFixedType = CAT_TYPE_MAP[catId] || catData?.type || "allround";
  const [readCh,    setReadCh]    = useState(null);
  const [updating,  setUpdating]  = useState(false);
  const [unlockedChs, setUnlockedChs] = useState(catData?.unlockedChs || [1]);

  const bondLevel  = getBondLevel(catData?.bond || 0);
  const isEquipped = equippedCat?.catId === catId;

  const combat = calcCatCombatStats({ ...catData, type: catFixedType }, catId);
  const { catLevel, catHP, catATK, catDEF, profile: buildProfile } = combat;
  const levelHPBonus = (catLevel - 1) * 5;
  const levelAtkDefBonus = Math.floor(catLevel / 5);
  const bondTierMult = 1 + (bondLevel * 0.01);
  const CAT_THEME_COLORS = {
    baobao:   { hex: "#c084fc", rgb: "192, 132, 252" }, // 寶寶 - 紫色 (Purple)
    daming:   { hex: "#f43f5e", rgb: "244, 63, 94" },  // 大娘 - 玫瑰粉 (Sakura/Rose)
    diandian: { hex: "#64748b", rgb: "100, 116, 139" }, // 顛顛 - 鋼鐵灰 (Steel Gray)
    gege:     { hex: "#10b981", rgb: "16, 185, 129" },  // 哥哥 - 翡翠綠 (Green)
    haji:     { hex: "#06b6d4", rgb: "6, 182, 212" },   // 哈吉 - 青綠色 (Cyan)
    meimei:   { hex: "#84cc16", rgb: "132, 204, 22" },  // 妹妹 - 萊姆綠 (Lime)
    niuniu:   { hex: "#f97316", rgb: "249, 115, 22" },  // 妞妞 - 烈陽橘 (Orange)
    xiaoan:   { hex: "#6366f1", rgb: "99, 102, 241" },  // 小安 - 靛藍色 (Indigo)
    youyou:   { hex: "#0ea5e9", rgb: "14, 165, 233" },  // 悠悠 - 天空藍 (Sky Blue)
  };

  const themeColor = CAT_THEME_COLORS[catId] || { hex: "#6366f1", rgb: "99, 102, 241" };
  const glowShadow = `0 0 25px rgba(${themeColor.rgb}, 0.5), inset 0 0 12px rgba(${themeColor.rgb}, 0.25)`;
  const glowBorder = `3px solid ${themeColor.hex}`;

  const skillGroup = CAT_SKILL_GROUPS[catId] || "heal";
  const activeChance = calcCatSkillChance(catLevel, bondLevel, catId);
  const activeChancePct = (activeChance * 100).toFixed(1);
  const bl = bondLevel || 0;
  const skillPower = CAT_BUILD_PROFILES[catId]?.skillPower || 1;

  let activeSkillName = "";
  let activeSkillDesc = "";
  let activeSkillDetails = "";

  if (skillGroup === "heal") {
    activeSkillName = "💚 貓之治癒術 (Active Heal)";
    const minHeal = Math.round((10 + catLevel * 0.5 + bl * 5) * 0.7 * skillPower);
    const maxHeal = Math.round((10 + catLevel * 0.5 + bl * 5) * 1.0 * skillPower);
    activeSkillDesc = "回合結束後，有機率為射手回復生命值。";
    activeSkillDetails = `當前效果：回復 +${minHeal} ～ +${maxHeal} HP`;
  } else if (skillGroup === "counter") {
    activeSkillName = "🛡️ 喵喵盾格擋 (Active Block)";
    const pct = Math.min(60, 10 + catLevel * 0.1 + bl * 2);
    activeSkillDesc = "受到傷害時，有機率架起護盾，按比例直接減免該次受到的傷害。";
    activeSkillDetails = `當前效果：該次受傷減免 +${pct.toFixed(0)}% 傷害`;
  } else {
    activeSkillName = "💥 喵喵爪擊 (Active Claw)";
    const minDmg = Math.round((15 + catLevel * 0.7 + bl * 6) * 0.7 * skillPower);
    const maxDmg = Math.round((15 + catLevel * 0.7 + bl * 6) * 1.0 * skillPower);
    activeSkillDesc = "射手射擊後，有機率對敵人追加一次爪擊，造成物理傷害。";
    activeSkillDetails = `當前效果：追加造成約 +${minDmg} ～ +${maxDmg} 點傷害`;
  }

  async function handleEquip() {
    setUpdating(true);
    if (isEquipped) {
      await unequipCat(memberId);
    } else {
      await setCatType(memberId, catId, catFixedType);
      // 一隻貓只能在一個地方工作：被 guard 擋下（挖掘/遠征/建築中）要提示，不能當作裝備成功
      const res = await equipCat(memberId, catId, catFixedType);
      if (res && res.ok === false) { alert(res.reason || "這隻貓正在別處工作，無法擔任戰鬥夥伴"); setUpdating(false); return; }
    }
    onEquipChange();
    setUpdating(false);
  }

  function handleChapterRead(ch) {
    const canUnlock = !unlockedChs.includes(ch.ch) && bondLevel >= (CHAPTER_BOND_LV[ch.ch] ?? 10);
    setReadCh({ ...ch, canUnlock });
  }

  function handleUnlocked(chNum) {
    setUnlockedChs(prev => [...prev, chNum]);
    setReadCh(prev => prev ? { ...prev, canUnlock: false } : null);
  }

  const hudStyle = {
    background: "rgba(15, 23, 42, 0.45)",
    border: "1px solid rgba(99, 102, 241, 0.15)",
    backdropFilter: "blur(8px)",
    borderRadius: "20px",
    padding: "16px",
  };

  return (
    <>
      {readCh && (
        <ChapterReader
          catId={catId}
          chapter={readCh}
          memberId={memberId}
          memberName={memberName}
          onClose={() => setReadCh(null)}
          onUnlocked={handleUnlocked}
        />
      )}

      <div className="relative w-full bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col" style={{ minHeight: "100%" }}>
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-indigo-500/20 bg-slate-900/40 backdrop-blur-md">
          <button onClick={onBack} className="text-slate-400 text-sm font-black hover:text-white transition-all">← 返回</button>
          <span className="font-black text-lg flex-1 text-slate-200">{cat?.name}</span>
          {isEquipped && <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-3 py-1 rounded-full font-black shadow-[0_0_8px_rgba(99,102,241,0.2)]">陪練中 ⚔️</span>}
        </div>

        {/* 主體區 */}
        <div className="p-4 w-full">
          <style>{`
            .rpg-layout {
              display: flex;
              gap: 20px;
              align-items: flex-start;
              width: 100%;
            }
            .rpg-left {
              width: 440px;
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .rpg-right {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            @media (max-width: 850px) {
              .rpg-layout {
                flex-direction: column;
              }
              .rpg-left, .rpg-right {
                width: 100%;
              }
            }
            @keyframes card-shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            .shimmer-card::after {
              content: "";
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background: linear-gradient(
                110deg,
                transparent 30%,
                rgba(255, 255, 255, 0.05) 42%,
                rgba(255, 255, 255, 0.15) 50%,
                rgba(255, 255, 255, 0.05) 58%,
                transparent 70%
              );
              background-size: 200% 100%;
              animation: card-shimmer 3.5s infinite linear;
              pointer-events: none;
              mix-blend-mode: overlay;
              z-index: 10;
            }
            .scale-on-hover {
              transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
            }
            .scale-on-hover:hover {
              transform: scale(1.04) translateY(-3px);
            }
          `}</style>

          <div className="rpg-layout">
            
            {/* ── 左欄：立繪、裝備 ── */}
            <div className="rpg-left">
              {/* 貓咪展示卡 - 改為精美橫向卡片與流光特效 */}
              <div style={hudStyle} className="flex flex-row items-center gap-5 p-4 relative overflow-hidden">
                {/* 左側：大立繪卡片 */}
                <div className="shrink-0 relative group shimmer-card scale-on-hover" style={{
                  width: 170, height: 220,
                  borderRadius: "18px",
                  border: glowBorder,
                  background: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
                  boxShadow: glowShadow,
                  overflow: "hidden",
                  cursor: "pointer"
                }}>
                  {/* 動態流光特效背景 */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-color-dodge animate-pulse"
                    style={{
                      background: `radial-gradient(circle, ${themeColor.hex} 0%, transparent 80%)`
                    }}
                  />
                  <img
                    src={`/cards/worldboss/cat_${catId}.webp`}
                    alt={cat?.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{
                      filter: cat?.isDeceased ? "grayscale(100%) opacity(60%)" : "none",
                    }}
                  />
                </div>

                {/* 右側：名字、類型、個性與說明 */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  <div className="font-black text-2xl text-slate-100 flex items-center gap-2 tracking-wide">
                    {cat?.name}
                  </div>
                  
                  {/* 類型標籤 */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <span className="text-[11px] font-black px-2.5 py-1 rounded-full border shadow-sm flex items-center gap-1.5"
                      style={{
                        borderColor: `rgba(${themeColor.rgb}, 0.4)`,
                        backgroundColor: `rgba(${themeColor.rgb}, 0.15)`,
                        color: themeColor.hex,
                      }}>
                      {CAT_TYPES[catFixedType]?.icon} {CAT_TYPES[catFixedType]?.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold px-2 py-1 bg-slate-900/60 rounded-md border border-slate-700/40">
                      {cat?.color}
                    </span>
                  </div>

                  <div className="mt-4 text-xs leading-relaxed text-slate-300 font-medium">
                    <span className="text-[10px] text-indigo-400 font-bold block mb-1">🎭 性格特質</span>
                    <span className="italic">「{cat?.personality}」</span>
                  </div>

                  {cat?.isDeceased && (
                    <div className="mt-4 w-fit text-[10px] text-indigo-300 font-black bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.2)]">
                      🌈 已化為天使夥伴
                    </div>
                  )}
                </div>
              </div>

              {/* 裝備按鈕 */}
              <button onClick={handleEquip} disabled={updating}
                className="w-full py-3.5 rounded-2xl font-black text-base transition-all active:scale-[0.98] disabled:opacity-40 shadow-lg"
                style={{
                  border: "1px solid rgba(99, 102, 241, 0.4)",
                  background: isEquipped ? "rgba(30, 41, 59, 0.7)" : "linear-gradient(135deg, #4F46E5, #7C3AED)",
                  color: "#FFFFFF",
                  boxShadow: isEquipped ? "none" : "0 4px 15px rgba(99, 102, 241, 0.35)",
                }}>
                {updating ? "處理中…" : isEquipped ? "📯 卸下陪練" : `⚔️ 攜帶 ${cat?.name} 陪練`}
              </button>

              {/* 裝備強化列表 */}
              <div style={hudStyle}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-slate-300 font-black flex items-center gap-1.5">
                    <span>🏹 伴侶專屬裝備</span>
                  </div>
                  {onOpenForge && (
                    <button onClick={onOpenForge}
                      className="text-[10px] font-bold text-amber-300 border border-amber-400/30 px-2 py-1 rounded-lg active:scale-95 transition-all hover:bg-amber-400/10">
                      🔨 前往鍛造鋪
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {CAT_EQUIP_SLOTS.map(slot => {
                    const e     = catData?.equip?.[slot.id];
                    const gIdx  = e ? CAT_EQUIP_GRADE_NAMES.indexOf(e.grade) : 0;
                    const color = CAT_EQUIP_GRADE_COLORS[gIdx >= 0 ? gIdx : 0];
                    const bg    = CAT_EQUIP_GRADE_BG[gIdx >= 0 ? gIdx : 0];
                    const enhancement = catEquipEnhancement(e?.grade || "普通", e?.plusLevel || 0);
                    return (
                      <div key={slot.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-700/30 transition-all hover:bg-slate-800/40"
                        style={{ background: bg || "rgba(30, 41, 59, 0.2)" }}>
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-700/60 shrink-0 bg-slate-950 flex items-center justify-center">
                          <img
                            src={slot.image}
                            alt={slot.label}
                            className="w-full h-full object-cover"
                            onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
                          />
                          <span className="hidden w-full h-full items-center justify-center text-xs text-slate-400 font-bold">
                            {slot.icon}
                          </span>
                        </div>
                        <span className="text-xs text-slate-200 font-medium flex-1">{slot.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ background: color }}>
                            +{enhancement}
                          </span>
                          <span className="text-[10px] font-bold" style={{ color }}>{e?.grade || "普通"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── 右欄：狀態、技能、故事 ── */}
            <div className="rpg-right">
              {/* 羈絆 */}
              <div style={hudStyle}>
                <BondBar bond={catData?.bond || 0}/>
                <div className="text-[10px] text-slate-400 mt-2.5 leading-normal border-t border-slate-700/30 pt-2 font-bold">
                  💡 增加羈絆管道：野外戰鬥 +1 / 冒險地下城 +2 / 組隊大廳 +2 / 世界王挑戰 +3
                </div>
              </div>

              {/* 屬性 */}
              <div style={hudStyle}>
                <div className="flex items-center justify-between mb-3.5 border-b border-indigo-500/10 pb-2">
                  <span className="text-xs font-black text-slate-200">⚔️ 當前戰鬥能力值</span>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 900,
                    padding: "2px 8px",
                    borderRadius: "99px",
                    display: "inline-flex",
                    alignItems: "center",
                    ...getLevelStyle(catLevel)
                  }}>
                    Lv.{catLevel}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-900/60 border border-indigo-500/15 rounded-xl py-2.5 shadow-inner text-center">
                    <div className="text-xl">❤️</div>
                    <div className="text-sm font-black text-emerald-400 mt-1">{catHP}</div>
                    <div className="text-[10px] text-slate-400 font-bold">HP</div>
                  </div>
                  <div className="bg-slate-900/60 border border-indigo-500/15 rounded-xl py-2.5 shadow-inner text-center">
                    <div className="text-xl">⚔️</div>
                    <div className="text-sm font-black text-rose-400 mt-1">{catATK}</div>
                    <div className="text-[10px] text-slate-400 font-bold">ATK</div>
                  </div>
                  <div className="bg-slate-900/60 border border-indigo-500/15 rounded-xl py-2.5 shadow-inner text-center">
                    <div className="text-xl">🛡️</div>
                    <div className="text-sm font-black text-sky-400 mt-1">{catDEF}</div>
                    <div className="text-[10px] text-slate-400 font-bold">DEF</div>
                  </div>
                </div>
                
                <div className="mt-4 text-center text-[10px] text-slate-400 font-bold border-t border-indigo-500/10 pt-3">
                  💡 貓貓等級加成：HP +{levelHPBonus} / ATK +{levelAtkDefBonus} / DEF +{levelAtkDefBonus}
                </div>
              </div>

              {/* 固有配點與修正 */}
              <div style={hudStyle} className="space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                  <span className="text-xs font-black text-slate-200">🏷️ 固有配點與修正</span>
                  <span className="text-xs font-black" style={{ color: CAT_TYPES[catFixedType]?.color }}>
                    {CAT_TYPES[catFixedType]?.icon} {CAT_TYPES[catFixedType]?.label}
                  </span>
                </div>
                <div className="text-xs font-black text-amber-200 bg-slate-900/50 rounded-xl p-3 border border-indigo-500/20 shadow-sm">
                  <div className="text-xs font-black">🎯 {buildProfile.title}</div>
                  <div className="mt-1 text-[11px] text-slate-300 font-medium leading-relaxed">
                    {buildProfile.trait}
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                    <div className="rounded-lg bg-black/35 py-1 text-emerald-300">HP ×{buildProfile.allocation.hp.toFixed(2)}</div>
                    <div className="rounded-lg bg-black/35 py-1 text-rose-300">ATK ×{buildProfile.allocation.atk.toFixed(2)}</div>
                    <div className="rounded-lg bg-black/35 py-1 text-sky-300">DEF ×{buildProfile.allocation.def.toFixed(2)}</div>
                  </div>
                </div>
                {bondTierMult > 1.0 && (
                  <div className="text-[11px] text-amber-300 font-bold text-center">
                    ✨ 羈絆共鳴加成：貓貓主屬性能力提升 +{bondLevel}%（×{bondTierMult.toFixed(2)}）！
                  </div>
                )}
                <div className="text-[10px] text-slate-500 leading-relaxed font-bold border-t border-indigo-500/10 pt-2 text-center">
                  {CAT_TYPES[catFixedType]?.desc}
                </div>
              </div>

              {/* 主動戰鬥技能說明 */}
              <div style={hudStyle}>
                <div className="text-xs font-black text-slate-200 mb-3 border-b border-indigo-500/10 pb-2">⚔️ 主動戰鬥技能</div>
                <div className="bg-[#1E293B]/60 border border-indigo-500/25 rounded-xl p-3">
                  <div className="text-xs font-black text-indigo-300">{activeSkillName}</div>
                  <div className="text-[11px] text-slate-300 mt-1">{activeSkillDesc}</div>
                  <div className="text-[11px] font-black text-amber-300 mt-2">{activeSkillDetails}</div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-700/60 pt-2 text-[10px] text-slate-400 font-bold">
                    <span>目前觸發機率</span>
                    <span className="text-indigo-200">{activeChancePct}%</span>
                  </div>
                  <div className="mt-2 text-[9px] text-slate-500 leading-normal border-t border-slate-700/30 pt-1.5">
                    * 觸發率隨等級與羈絆成長（基礎 5% + 每級 0.05% + 每級羈絆 1%），上限 35%。個體天賦與特質會進一步調整觸發率與技能強度。
                  </div>
                </div>
              </div>

              {/* 技能樹 */}
              <div style={hudStyle}>
                <div className="text-xs font-black text-slate-200 mb-3 border-b border-indigo-500/10 pb-2">⚡ 羈絆里程碑效果</div>
                <div className="space-y-2">
                  {CAT_TYPES[catFixedType]?.skills.map((sk, i) => {
                    const unlocked = bondLevel >= sk.bond;
                    const isCurrent = bondLevel === sk.bond;

                    // 計算並組裝實際機制效果文字
                    let mechanicsText = "";
                    if (sk.bond === 0) {
                      mechanicsText = `🔓 核心解鎖：啟用貓咪的主動戰鬥技能，獲得初始基礎觸發機率！`;
                    } else if (sk.isSkill) {
                      const mult = sk.bond === 25 ? "1.25" : "1.50";
                      const typeDesc = catFixedType === "attack"
                        ? `攻擊型主屬性 (ATK) 修正提升至 ×${mult} 倍`
                        : catFixedType === "defense"
                          ? `防禦型主屬性 (HP/DEF) 修正提升至 ×${mult} 倍`
                          : `全能型全屬性 (HP/ATK/DEF) 修正提升至 ×${mult} 倍`;
                      mechanicsText = `🔥 里程碑突破：${typeDesc}！`;
                    } else {
                      const statDesc = catFixedType === "attack"
                        ? "主動技能追加傷害額外成長"
                        : catFixedType === "defense"
                          ? "主動技能防禦減免率增長 +2%"
                          : "主動技能治療效果增長 +5 HP";
                      mechanicsText = `✨ 成長提升：${statDesc}，且技能基礎觸發率成長 +1%！`;
                    }

                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                        unlocked
                          ? sk.isSkill
                            ? "bg-indigo-950/40 border-indigo-500/40 text-indigo-200"
                            : isCurrent
                              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-200"
                              : "bg-slate-900/50 border-slate-700/60"
                          : "opacity-35 bg-transparent border-dashed border-indigo-500/10"
                      }`}>
                        <span className="text-sm w-5 text-center font-bold mt-0.5">
                          {unlocked ? (sk.isSkill ? "✨" : "✓") : "🔒"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-black text-xs ${sk.isSkill ? "text-indigo-300" : "text-slate-300"}`}>
                            {sk.name} <span className="text-[10px] text-slate-500 font-bold ml-1">(羈絆等級 {sk.bond})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 leading-relaxed font-medium italic">「{sk.desc}」</div>
                          <div className="text-[10px] font-black text-amber-300 mt-1.5 bg-slate-950/30 px-2.5 py-1 rounded border border-indigo-500/10 block w-fit">
                            ⚔️ 戰鬥效果：{mechanicsText}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 shrink-0 ${
                          unlocked ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" : "text-slate-600"
                        }`}>
                          Lv.{sk.bond}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 冒險故事 */}
              <div style={hudStyle}>
                <div className="text-xs font-black text-slate-200 mb-3 border-b border-indigo-500/10 pb-2">📖 冒險故事</div>
                <div className="space-y-2">
                  <ChapterList
                    catId={catId}
                    catData={catData}
                    bondLevel={bondLevel}
                    unlockedChs={unlockedChs}
                    onReadChapter={handleChapterRead}
                  />
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </>
  );
}

// ── 主頁面 ──────────────────────────────────────────────────
export default function CatCollection({ onBack, onOpenBook, onOpenForge }) {
  const { profile } = useAuth();
  const [myCats,    setMyCats]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [selCat,    setSelCat]    = useState(null);
  const [claiming,  setClaiming]  = useState(false);
  const [claimMsg,  setClaimMsg]  = useState("");
  const [equipped,  setEquipped]  = useState(profile?.equippedCat || null);

  const memberId   = profile?.id;
  const memberName = profile?.nickname || profile?.name || "射手";

  useEffect(() => {
    if (!memberId) return;
    const unsub = subscribeMyCats(memberId, cats => {
      setMyCats(cats);
      setLoading(false);
    });
    return () => unsub();
  }, [memberId]);

  useEffect(() => {
    setEquipped(profile?.equippedCat || null);
  }, [profile?.equippedCat]);

  async function handleClaimStarter() {
    setClaiming(true);
    setClaimMsg("");
    const res = await claimStarterCat(memberId);
    if (res.ok) {
      setClaimMsg(`🎉 領取成功！歡迎來到貓小隊！`);
    } else {
      setClaimMsg(res.reason);
    }
    setClaiming(false);
  }

  const ownedCount = Object.keys(myCats).length;

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        載入中…
      </div>
    );
  }

  // 詳情頁
  if (selCat) {
    return (
      <CatDetail
        catId={selCat}
        catData={myCats[selCat]}
        equippedCat={equipped}
        memberId={memberId}
        memberName={memberName}
        onBack={() => setSelCat(null)}
        onEquipChange={() => setEquipped(profile?.equippedCat || null)}
        onOpenForge={onOpenForge}
      />
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
        {onBack && <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>}
        <span className="font-black text-lg flex-1">🐱 貓貓陪練</span>
        {onOpenBook && (
          <button onClick={onOpenBook}
            className="text-xs text-indigo-300 border border-indigo-400/30 px-2 py-1 rounded-lg">
            📖 故事本
          </button>
        )}
        <span className="text-xs text-slate-400">{ownedCount} / {CAT_IDS.length} 隻</span>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4 w-full">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-black text-white">九隻貓，九種配點</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            上排是治癒型、中排是攻擊型、下排是防禦型。同類貓仍有不同的 HP／ATK／DEF 配點與固有特性，不再只有外觀差異。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-500/10 px-1 py-2 text-[10px] font-bold text-emerald-300">💚 治癒型<br/>續戰支援</div>
            <div className="rounded-xl bg-rose-500/10 px-1 py-2 text-[10px] font-bold text-rose-300">⚔️ 攻擊型<br/>追加傷害</div>
            <div className="rounded-xl bg-sky-500/10 px-1 py-2 text-[10px] font-bold text-sky-300">🛡️ 防禦型<br/>減傷格擋</div>
          </div>
        </section>

        {/* 裝備中的貓 */}
        {equipped && myCats[equipped.catId] && (
          <div className="bg-indigo-900/30 border border-indigo-400/30 rounded-2xl px-4 py-3 flex items-center gap-3">
            <CatSVG catId={equipped.catId} size={44}/>
            <div className="flex-1">
              <div className="text-xs text-indigo-300 font-bold mb-0.5">目前陪練</div>
              <div className="font-black">{equipped.name}</div>
              <div className="text-xs text-slate-400">{CAT_TYPES[equipped.type]?.label} — 羈絆 {myCats[equipped.catId]?.bond || 0}</div>
            </div>
            <button onClick={() => setSelCat(equipped.catId)}
              className="text-xs text-indigo-300 border border-indigo-400/30 px-2 py-1 rounded-lg">
              詳情
            </button>
          </div>
        )}

        {/* 沒有貓 → 領取提示 */}
        {ownedCount === 0 && (
          <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-5 text-center space-y-3">
            <div className="text-5xl">🐱</div>
            <div className="font-black text-amber-300">還沒有貓咪夥伴</div>
            <div className="text-xs text-slate-400">領取你的第一隻貓，開始你們的冒險故事</div>
            {claimMsg && <div className="text-sm text-emerald-400 font-bold">{claimMsg}</div>}
            <button onClick={handleClaimStarter} disabled={claiming}
              className="w-full py-3 rounded-2xl font-black bg-amber-500 text-amber-900 active:scale-95 disabled:opacity-40">
              {claiming ? "領取中…" : "🎁 免費領取一隻隨機貓咪"}
            </button>
          </div>
        )}

        {/* 貓咪圖鑑格 */}
        <div className="grid grid-cols-3 gap-3">
          {CAT_IDS.map(catId => {
            const cat    = CATS[catId];
            const owned  = !!myCats[catId];
            const bond   = myCats[catId]?.bond || 0;
            const isEq   = equipped?.catId === catId;

            return (
              <button key={catId}
                onClick={() => owned && setSelCat(catId)}
                disabled={!owned}
                className={`rounded-2xl border p-3 flex flex-col items-center gap-2 transition-all active:scale-95 disabled:opacity-30 ${
                  isEq
                    ? "border-indigo-400 bg-indigo-900/30"
                    : owned
                      ? "border-white/15 bg-white/5"
                      : "border-white/5 bg-white/3"
                }`}>
                <CatSVG catId={catId} size={52} deceased={cat?.isDeceased && owned}/>
                <div className="text-center">
                  <div className="text-xs font-black text-white">{cat?.name}</div>
                  <div className="text-[10px] text-slate-500">{cat?.color}</div>
                  <div className="text-[10px] font-bold" style={{ color: CAT_TYPES[CAT_TYPE_MAP[catId]]?.color }}>
                    {CAT_TYPES[CAT_TYPE_MAP[catId]]?.icon} {CAT_TYPES[CAT_TYPE_MAP[catId]]?.label}
                  </div>
                  {owned && (
                    <div className="text-[10px] text-indigo-300 font-bold">羈絆 {bond}</div>
                  )}
                  {isEq && (
                    <div className="text-[10px] text-indigo-300 font-bold">陪練中</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 取得方式說明 */}
        {ownedCount < CAT_IDS.length && (
          <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs text-slate-400 space-y-1">
            <div className="font-bold text-slate-300 mb-1">如何獲得更多貓咪</div>
            <div>🐱 開啟貓貓箱（世界王、地下城、成就獎勵）</div>
            <div>🎁 集齊全部 9 隻後，重複開箱轉換為羈絆經驗值</div>
          </div>
        )}
      </div>
    </div>
  );
}
