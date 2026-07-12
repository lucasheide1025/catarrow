// src/components/cat/CatCollection.jsx — 貓貓陪練系統主頁
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeMyCats, claimStarterCat, setCatType,
  equipCat, unequipCat, unlockChapter, addBlessing,
} from "../../lib/catDb";
import {
  CATS, CAT_IDS, CAT_TYPES, CAT_TYPE_MAP, getCatChapters,
  getBondLevel, getBondProgress, BOND_THRESHOLDS, CHAPTER_BOND_LV,
  CAT_EQUIP_SLOTS, CAT_EQUIP_GRADE_NAMES, CAT_EQUIP_GRADE_COLORS, CAT_EQUIP_GRADE_BG,
  catEquipEnhancement,
} from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
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
  const bondTierMult = catFixedType === "allround"
    ? 1 + bondLevel * 0.03
    : 1 + bondLevel * 0.05;

  async function handleEquip() {
    setUpdating(true);
    if (isEquipped) {
      await unequipCat(memberId);
    } else {
      await setCatType(memberId, catId, catFixedType);
      await equipCat(memberId, catId, catFixedType);
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

      <div className="relative h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
          <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>
          <span className="font-black text-lg flex-1">{cat?.name}</span>
          {isEquipped && <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-1 rounded-full font-bold">裝備中</span>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 space-y-4">
          {/* 貓咪展示 */}
          <div className="flex items-center gap-5 bg-white/5 border border-white/10 rounded-2xl p-4">
            <CatSVG catId={catId} size={80} deceased={cat?.isDeceased}/>
            <div className="flex-1">
              <div className="font-black text-xl">{cat?.name}</div>
              <div className="text-xs text-slate-400 mb-1">{cat?.color}</div>
              <div className="text-xs text-slate-300 leading-relaxed">{cat?.personality}</div>
              {cat?.isDeceased && (
                <div className="text-xs text-indigo-300 mt-1 font-bold">🌈 已化為天使</div>
              )}
            </div>
          </div>

          {/* 裝備按鈕（貓咪展示下方） */}
          <button onClick={handleEquip} disabled={updating}
            className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-40 ${
              isEquipped
                ? "bg-white/10 border border-white/20 text-slate-300"
                : "text-white shadow-xl"
            }`}
            style={!isEquipped ? { background: `linear-gradient(135deg, #4f46e5, #7c3aed)` } : {}}>
            {updating ? "處理中…" : isEquipped ? "卸下陪練" : `帶 ${cat?.name} 去冒險 🐱`}
          </button>

          {/* 羈絆 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <BondBar bond={catData?.bond || 0}/>
            <div className="text-xs text-slate-500 mt-2">一起戰鬥可增加羈絆：打怪+1 地下城+2 組隊+2 世界王+3</div>
          </div>

          {/* 能力值 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold mb-3">⚔️ 目前能力值（Lv.{catLevel}）</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-base">❤️</div>
                <div className="text-xs font-black text-green-300">{catHP}</div>
                <div className="text-[10px] text-slate-500">HP</div>
              </div>
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-base">⚔️</div>
                <div className="text-xs font-black text-red-300">{catATK}</div>
                <div className="text-[10px] text-slate-500">ATK</div>
              </div>
              <div className="bg-white/5 rounded-xl py-2">
                <div className="text-base">🛡️</div>
                <div className="text-xs font-black text-blue-300">{catDEF}</div>
                <div className="text-[10px] text-slate-500">DEF</div>
              </div>
            </div>
            {/* 固定類型標示 */}
            <div className="mt-3 text-center">
              <span className="text-[10px] text-slate-500">戰鬥類型：</span>
              <span className="text-xs font-black ml-1" style={{ color: CAT_TYPES[catFixedType]?.color }}>
                {CAT_TYPES[catFixedType]?.icon} {CAT_TYPES[catFixedType]?.label}
              </span>
              {bondTierMult > 1.0 && (
                <div className="text-[10px] text-amber-400 font-bold mt-1">
                  ✨ 羈絆加成：主屬性 ×{bondTierMult.toFixed(2)}
                </div>
              )}
              <div className="text-[10px] text-slate-600 mt-1 leading-relaxed">
                {CAT_TYPES[catFixedType]?.desc}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
              <div className="text-xs font-black text-amber-200">
                🎯 {buildProfile.title}
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-300">
                {buildProfile.trait}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="rounded-lg bg-black/20 py-1 text-emerald-300">HP ×{buildProfile.allocation.hp.toFixed(2)}</div>
                <div className="rounded-lg bg-black/20 py-1 text-rose-300">ATK ×{buildProfile.allocation.atk.toFixed(2)}</div>
                <div className="rounded-lg bg-black/20 py-1 text-sky-300">DEF ×{buildProfile.allocation.def.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* 裝備強化 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-400 font-bold">🏹 裝備強化</div>
              {onOpenForge && (
                <button onClick={onOpenForge}
                  className="text-[10px] font-bold text-amber-300 border border-amber-400/30 px-2 py-1 rounded-lg active:scale-95">
                  🔨 前往鍛造鋪
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {CAT_EQUIP_SLOTS.map(slot => {
                const e     = catData?.equip?.[slot.id];
                const gIdx  = e ? CAT_EQUIP_GRADE_NAMES.indexOf(e.grade) : 0;
                const color = CAT_EQUIP_GRADE_COLORS[gIdx >= 0 ? gIdx : 0];
                const bg    = CAT_EQUIP_GRADE_BG[gIdx >= 0 ? gIdx : 0];
                const enhancement = catEquipEnhancement(e?.grade || "普通", e?.plusLevel || 0);
                return (
                  <div key={slot.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border-t border-white/5"
                    style={{ background: bg }}>
                    <span className="text-sm w-5 text-center">{slot.icon}</span>
                    <span className="text-xs text-slate-300 flex-1">{slot.label}</span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md text-white" style={{ background: color }}>
                      +{enhancement}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color }}>{e?.grade || "普通"} +{enhancement}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 技能 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="text-xs text-slate-400 font-bold mb-3">⚡ 陪練技能 / 成長加成</div>
            <div className="space-y-1.5">
              {CAT_TYPES[catFixedType]?.skills.map((sk, i) => {
                const unlocked = bondLevel >= sk.bond;
                const isCurrent = bondLevel === sk.bond;
                // 羈絆里程碑技能效果標籤
                const skillEffect = sk.isSkill && sk.bond > 0
                  ? catFixedType === "attack"  ? `主屬性 ATK ×${(1 + sk.bond * 0.05).toFixed(2)}`
                  : catFixedType === "defense" ? `主屬性 HP/DEF ×${(1 + sk.bond * 0.05).toFixed(2)}`
                  : `全屬性 ×${(1 + sk.bond * 0.025).toFixed(2)}`
                  : null;
                return (
                  <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                    unlocked
                      ? sk.isSkill
                        ? "bg-indigo-500/15 border border-indigo-400/30"
                        : isCurrent
                          ? "bg-emerald-500/10 border border-emerald-400/20"
                          : "bg-white/4"
                      : "opacity-30"
                  }`}>
                    <span className="text-sm w-4 text-center">
                      {unlocked ? (sk.isSkill ? "✨" : "✓") : "🔒"}
                    </span>
                    <div className="flex-1">
                      <div className={`font-bold text-xs ${sk.isSkill ? "text-indigo-200" : "text-slate-300"}`}>
                        {sk.name}
                      </div>
                      {skillEffect && (
                        <div className="text-[10px] font-black text-amber-300 mt-0.5">
                          ⚔️ 技能效果：{skillEffect}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-400">{sk.desc}</div>
                    </div>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      unlocked ? "bg-white/10 text-slate-300" : "text-slate-600"
                    }`}>
                      Lv.{sk.bond}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 章節故事 */}
          <div className="space-y-2">
            <div className="text-xs text-slate-400 font-bold px-1">📖 冒險故事</div>
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
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
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

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">
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
