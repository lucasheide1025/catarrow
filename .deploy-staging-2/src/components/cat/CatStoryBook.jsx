// src/components/cat/CatStoryBook.jsx — 貓貓故事本
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeMyCats, unlockChapter, addBlessing } from "../../lib/catDb";
import {
  CATS, CAT_IDS, getCatChapters,
  getBondLevel, CHAPTER_BOND_LV,
} from "../../lib/catData";
import CatSVG from "./CatSVG";

// ── 章節閱讀器 ──────────────────────────────────────────────
function ChapterReader({ catId, chapter, memberName, memberId, onClose, onUnlocked }) {
  const [blessing,  setBlessing]  = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading,   setLoading]   = useState(false);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex-1 overflow-y-auto flex flex-col">
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

        <div className="flex-1 px-5 py-5 space-y-4"
          style={{ background: "linear-gradient(180deg, #0f172a, #1e293b)" }}>
          <div className="text-center">
            <div className="text-xs text-slate-500 mb-1">第 {chapter.ch} 章</div>
            <div className={`text-xl font-black ${chapter.isMemorial ? "text-indigo-300" : "text-white"}`}>
              {chapter.title}
            </div>
          </div>

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

          {chapter.thought && (
            <div className="bg-indigo-900/30 border border-indigo-400/30 rounded-2xl px-4 py-3">
              <div className="text-xs text-indigo-400 font-bold mb-1">💭 {cat?.name} 的心聲</div>
              <div className="text-sm text-indigo-200 italic leading-relaxed">「{chapter.thought}」</div>
            </div>
          )}

          {chapter.cliffhanger && (
            <div className="text-right text-xs text-slate-400 italic pr-2">
              {chapter.cliffhanger}<br/>
              <span className="text-slate-600">（待續…）</span>
            </div>
          )}

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

// ── 單隻貓章節列表 ───────────────────────────────────────────
function CatChapters({ catId, catData, memberId, memberName, onBack }) {
  const cat = CATS[catId];
  const [readCh,      setReadCh]      = useState(null);
  const [unlockedChs, setUnlockedChs] = useState(catData?.unlockedChs || [1]);
  const bondLevel = getBondLevel(catData?.bond || 0);
  const chapters  = getCatChapters(catId, cat?.isDeceased);

  function handleReadChapter(ch) {
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

      <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
          <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>
          <CatSVG catId={catId} size={32} deceased={cat?.isDeceased}/>
          <span className="font-black text-lg flex-1">{cat?.name} 的冒險</span>
          <span className="text-xs text-slate-400">{unlockedChs.length} / {chapters.length} 章</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-2">
          {chapters.map(ch => {
            const isUnlocked = unlockedChs.includes(ch.ch);
            const bondNeeded = CHAPTER_BOND_LV[ch.ch] ?? 10;
            const canUnlock  = bondLevel >= bondNeeded && !isUnlocked;
            const locked     = bondLevel < bondNeeded && !isUnlocked;

            return (
              <div key={ch.ch}
                className={`rounded-2xl border px-4 py-3 transition-all ${
                  ch.isMemorial
                    ? "border-indigo-400/40 bg-indigo-900/20"
                    : isUnlocked ? "border-white/15 bg-white/5"
                    : locked     ? "border-white/5 bg-white/3 opacity-50"
                    : "border-amber-400/40 bg-amber-500/10"
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {ch.isMemorial ? "🌈" : isUnlocked ? "📖" : locked ? "🔒" : "✨"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${ch.isMemorial ? "text-indigo-300" : "text-white"}`}>
                      第 {ch.ch} 章：{ch.title}
                    </div>
                    {locked && (
                      <div className="text-xs text-slate-500 mt-0.5">
                        需要羈絆 Lv.{bondNeeded}（差 {(CHAPTER_BOND_LV[bondNeeded] || 0) - (catData?.bond || 0)} 點）
                      </div>
                    )}
                    {canUnlock && (
                      <div className="text-xs text-amber-300 font-bold mt-0.5">✨ 可解鎖！</div>
                    )}
                  </div>
                  {(isUnlocked || canUnlock) && (
                    <button
                      onClick={() => handleReadChapter(ch)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 ${
                        canUnlock ? "bg-amber-500 text-white" : "bg-white/10 text-slate-300"
                      }`}>
                      {canUnlock ? "解鎖" : "閱讀"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── 故事本目錄（主頁面）────────────────────────────────────
export default function CatStoryBook({ onBack }) {
  const { profile } = useAuth();
  const [myCats,  setMyCats]  = useState({});
  const [loading, setLoading] = useState(true);
  const [selCat,  setSelCat]  = useState(null);

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

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-900 text-slate-400 text-sm">
        載入中…
      </div>
    );
  }

  if (selCat) {
    return (
      <CatChapters
        catId={selCat}
        catData={myCats[selCat]}
        memberId={memberId}
        memberName={memberName}
        onBack={() => setSelCat(null)}
      />
    );
  }

  const ownedCount = Object.keys(myCats).length;
  const totalRead  = Object.values(myCats).reduce((s, c) => s + (c?.unlockedChs?.length || 0), 0);

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/10">
        {onBack && <button onClick={onBack} className="text-slate-400 text-sm font-bold">← 返回</button>}
        <span className="font-black text-lg flex-1">📖 貓貓故事本</span>
        <span className="text-xs text-slate-400">已讀 {totalRead} 章</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-3">
        {ownedCount === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">📖</div>
            <div className="text-slate-400 text-sm">還沒有貓咪夥伴</div>
            <div className="text-xs text-slate-600">先去「貓貓陪練」領取一隻吧！</div>
          </div>
        ) : (
          CAT_IDS.map(catId => {
            const cat      = CATS[catId];
            const owned    = !!myCats[catId];
            const catData  = myCats[catId];
            const chapters = getCatChapters(catId, cat?.isDeceased);
            const readCount = catData?.unlockedChs?.length || 0;
            const pct = chapters.length > 0
              ? Math.min(100, (readCount / chapters.length) * 100)
              : 0;

            return (
              <button key={catId}
                onClick={() => owned && setSelCat(catId)}
                disabled={!owned}
                className={`w-full rounded-2xl border px-4 py-3 flex items-center gap-4 text-left transition-all active:scale-[0.98] ${
                  owned
                    ? "border-white/15 bg-white/5"
                    : "border-white/5 bg-white/3 opacity-30"
                }`}>
                <CatSVG catId={catId} size={48} deceased={cat?.isDeceased && owned}/>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white">{cat?.name}</div>
                  <div className="text-xs text-slate-400 mb-2">{cat?.color}</div>
                  {owned ? (
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden w-full max-w-[120px]">
                      <div className="h-full rounded-full bg-indigo-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}/>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600">尚未擁有</div>
                  )}
                </div>
                {owned && (
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-indigo-300">{readCount}</div>
                    <div className="text-[10px] text-slate-500">/ {chapters.length} 章</div>
                    {readCount < chapters.length ? (
                      <div className="text-[10px] text-amber-400 font-bold mt-0.5">繼續 →</div>
                    ) : (
                      <div className="text-[10px] text-emerald-400 font-bold mt-0.5">完讀 ✓</div>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
