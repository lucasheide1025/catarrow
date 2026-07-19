import { useState } from "react";

// 註：補給箱刻意不預先揭露內容（三個箱子外觀相同讓玩家猜），
// 因此原本的 TYPE_META／optionDetail 顯示函式已移除，避免留下會洩漏內容的死碼。

export default function DungeonBossRewardRoom({ claimId, envelope, memberId, onComplete }) {
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const needed = envelope?.choiceCount || 1;

  function toggle(optionId) {
    if (submitting) return;
    setError("");
    setSelected(current => {
      if (current.includes(optionId)) return current.filter(id => id !== optionId);
      if (current.length >= needed) return needed === 1 ? [optionId] : current;
      return [...current, optionId];
    });
  }

  async function submit() {
    if (submitting || selected.length !== needed) return;
    setSubmitting(true);
    setError("");
    try {
      const { claimDungeonBossChoices } = await import("../../lib/dungeonBossRewardDb");
      await claimDungeonBossChoices({ claimId, memberId, selectedOptionIds:selected });
      onComplete?.();
    } catch (reason) {
      setError(reason?.message || "獎勵領取失敗，請再試一次");
      setSubmitting(false);
    }
  }

  const fixed = envelope.fixedReward;
  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-7 text-white">
      <div className="mx-auto max-w-2xl">
        <header className="mb-5 rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-950/70 to-slate-900 p-5 shadow-2xl shadow-amber-950/30">
          <div className="text-xs font-black tracking-[0.22em] text-amber-300">BOSS REWARD</div>
          <h1 className="mt-2 text-2xl font-black">王房戰利品已封存</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">固定獎勵已安全入袋，再選擇 {needed} 個不同補給箱。</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl bg-black/25 p-3"><div className="text-slate-400">王怪素材</div><div className="mt-1 font-black text-amber-200">×{fixed.bossMaterial.quantity}</div></div>
            <div className="rounded-xl bg-black/25 p-3"><div className="text-slate-400">王之印記</div><div className="mt-1 font-black text-amber-200">×{fixed.bossMarks}</div></div>
            <div className="rounded-xl bg-black/25 p-3"><div className="text-slate-400">符文碎片</div><div className="mt-1 font-black text-cyan-200">×{fixed.runeFragment.count}</div></div>
            <div className="rounded-xl bg-black/25 p-3"><div className="text-slate-400">固定金幣</div><div className="mt-1 font-black text-yellow-200">{fixed.coins.toLocaleString()}</div></div>
          </div>
          {envelope.card ? <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-200">✨ 獲得怪物卡：{envelope.card.name}</div> : null}
        </header>

        <section aria-labelledby="boss-choice-title">
          <h2 id="boss-choice-title" className="mb-1 text-base font-black">選擇補給箱 <span className="text-sm text-slate-400">{selected.length}/{needed}</span></h2>
          {/* 三個箱子外觀完全相同、內容不預先揭露——玩家憑運氣挑（2026-07-19 使用者指示）。
              後端已 seeded-shuffle 順序且 id 改為位置索引，位置不會洩漏內容。 */}
          <p className="mb-3 text-xs text-slate-400">箱內容物未知，憑直覺挑選吧！開啟後才會揭曉。</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {envelope.choiceOptions.map((option, index) => {
              const active = selected.includes(option.id);
              return (
                <button key={option.id} type="button" aria-pressed={active}
                  aria-label={`神秘補給箱 ${index + 1}`} onClick={() => toggle(option.id)}
                  className={`min-h-36 rounded-2xl border p-4 text-center transition ${active ? "border-amber-300 bg-amber-400/15 ring-2 ring-amber-300/30" : "border-white/10 bg-white/5 hover:border-white/25"}`}>
                  <span className="block text-5xl" aria-hidden="true">{active ? "🎁" : "📦"}</span>
                  <span className="mt-3 block text-base font-black">神秘補給箱 {index + 1}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{active ? "已選擇" : "內容未知"}</span>
                </button>
              );
            })}
          </div>
        </section>

        {error ? <div role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
        <button type="button" onClick={submit} disabled={submitting || selected.length !== needed}
          className="mt-5 min-h-12 w-full rounded-2xl bg-amber-300 px-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
          {submitting ? "正在封存選擇…" : selected.length === needed ? "領取並查看遠征報告" : `還需選擇 ${needed - selected.length} 個箱子`}
        </button>
      </div>
    </main>
  );
}

