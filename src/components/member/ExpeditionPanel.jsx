// src/components/member/ExpeditionPanel.jsx — 探險隊 2.0（事件路線／投資／士氣／動畫 UI）
// spec：docs/second_brain/expedition-v2-spec.md
import { useState, useEffect, useRef, useMemo } from "react";
import { CATS, CAT_TYPE_MAP } from "../../lib/catData";
import { catLevelFromXP } from "../../lib/catLevel";
import { startExpedition, collectExpedition, resolveExpeditionEvent } from "../../lib/db";
import { busyCatIdSet } from "../../lib/catAssignment";
import {
  EXPEDITION_MISSIONS, calcExpeditionRewards, fmtCountdown,
  calcCatFullStats, catPowerMult, buildExpeditionRewardEntries,
  EXPEDITION_MATERIAL_BOOST, EXPEDITION_CATXP_CAP,
} from "../../lib/expeditionData";
import {
  getExpeditionEventById, generateExpeditionRoute, eventCountForTier,
  resolveExpeditionEventChoice, aggregateExpeditionRewards,
  calcMoraleDecay, calcInvestCost, totalArcherCost, EXPEDITION_INVEST,
  EXPEDITION_LOOT_RATES,
} from "../../lib/expeditionEvents";
import CatVillageNavArt from "./CatVillageNavArt";

const TYPE_LABEL = { attack: "⚔️ 攻擊型", defense: "🛡️ 防禦型", allround: "💚 治癒型" };
const TYPE_COLOR = { attack: "#f87171", defense: "#60a5fa", allround: "#a78bfa" };
const TIER_COLOR = ["", "#9ca3af", "#4ade80", "#60a5fa", "#a78bfa", "#fbbf24"];

const RES_CN   = { fur:"貓毛", potion:"貓薄荷藥水", arrowdew:"箭露", gachaToken:"扭蛋幣", archer:"射手", ore:"礦物", melon:"瓜瓜", fish:"鮮魚", meat:"動物肉", driedfish:"小魚乾", can:"貓罐頭" };
const RES_ICON = { fur:"🐾", potion:"🍵", arrowdew:"💧", gachaToken:"🎰", archer:"🏹", ore:"⛏️", melon:"🍈", fish:"🐟", meat:"🍖", driedfish:"🐠", can:"🥫" };

const clampMorale = v => Math.max(0, Math.min(100, Math.round(v)));

// 防禦：route 曾被 Firestore 欄位路徑寫壞成 map（{0:{...}}），一律正規化成陣列
const toRouteArray = r => (Array.isArray(r) ? r : []);

// 事件獎勵描述（選擇按鈕上顯示）
function fmtEventEntries(entries) {
  return (entries || []).map((entry, i) => {
    if (entry.key === "material") {
      return `${RES_ICON[entry.resource] || "📦"} ${RES_CN[entry.resource] || entry.resource} T? ×${entry.min}~${entry.max}`;
    }
    if (entry.special === "catBond") return `💛 羈絆 +${entry.min}~${entry.max}`;
    return `${RES_ICON[entry.special] || "✨"} ${RES_CN[entry.special] || entry.special} ${entry.min}~${entry.max}`;
  }).join("、");
}

// ── 事件卡 Modal（途中遭遇，可解可不解）──────────────────────
function ExpeditionEventModal({ event, catId, catName, missionTier, onChoose, onSkip, resolving }) {
  const [picked, setPicked] = useState(null); // { choice, outcome }
  const catInfo = CATS[catId];

  if (!event) return null;

  const handlePick = (choiceIdx) => {
    if (picked || resolving) return;
    const outcome = resolveExpeditionEventChoice(event, choiceIdx, missionTier || 1);
    setPicked({ choice: choiceIdx, outcome });
    setTimeout(() => onChoose(choiceIdx, outcome), 1400);
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/95 text-white backdrop-blur"
      role="dialog" aria-modal="true" aria-labelledby="expedition-event-title">
      <style>{`
        @keyframes expEventIn {
          0% { opacity: 0; transform: translateY(30px) scale(.92) rotate(-1deg); }
          60% { opacity: 1; transform: translateY(-6px) scale(1.02) rotate(.4deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
        }
        @keyframes expEventShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @keyframes expFloatUp {
          from { opacity: 0; transform: translateY(18px) scale(.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes expSuccessBurst {
          0% { opacity: 0; transform: scale(.4); }
          50% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        .exp-event-card { animation: expEventIn .5s cubic-bezier(.2,.85,.25,1) both; }
        .exp-event-shake { animation: expEventShake .4s ease-in-out; }
        .exp-float { animation: expFloatUp .45s ease-out both; }
        .exp-burst { animation: expSuccessBurst .5s cubic-bezier(.2,.85,.25,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .exp-event-card, .exp-event-shake, .exp-float, .exp-burst { animation: none !important; }
        }
      `}</style>
      <div className="min-h-full px-4 py-8 flex justify-center bg-[radial-gradient(circle_at_top,rgba(167,139,250,.22),transparent_45%)]">
        <div className="exp-event-card w-full max-w-md overflow-hidden rounded-3xl border border-violet-400/40 bg-gradient-to-b from-violet-950/95 to-slate-950/95 shadow-2xl">
          {/* 頭部：事件 emoji＋名稱 */}
          <div className="relative overflow-hidden border-b border-white/10 px-5 pb-4 pt-6 text-center">
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "url(/ui/cat-village/explore-map.png)", backgroundSize: "cover", backgroundPosition: "center" }} />
            <div className="relative">
              <div className="text-[10px] font-black tracking-[.24em] text-violet-300">途中遭遇 · 事件卡</div>
              <div className="exp-burst mt-2 text-6xl drop-shadow-[0_8px_18px_rgba(167,139,250,.5)]">{event.emoji}</div>
              <h2 id="expedition-event-title" className="mt-2 text-xl font-black text-violet-50">{event.name}</h2>
              <p className="mx-auto mt-2 max-w-[300px] text-xs font-bold leading-relaxed text-violet-200/75">{event.desc}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <img src={`/cats/portraits/${catId}.webp`} alt={catName}
                  className="h-9 w-9 rounded-full border-2 border-violet-400 object-cover shadow-lg" />
                <span className="text-xs font-black text-violet-200">{catName} 正在面對這個抉擇…</span>
              </div>
            </div>
          </div>

          {/* 選擇區 */}
          <div className="space-y-3 p-5">
            {!picked ? (
              <>
                {event.choices.map((choice, i) => (
                  <button key={i} type="button" onClick={() => handlePick(i)} disabled={resolving}
                    className="w-full rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[.98]"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1.5px solid rgba(255,255,255,0.14)",
                    }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-white">{choice.label}</span>
                      {choice.type === "gamble"
                        ? <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300 border border-amber-500/30">
                            🎲 {Math.round(choice.rate * 100)}% 成功
                          </span>
                        : <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/30">
                            ✓ 穩定
                          </span>}
                    </div>
                    <div className="mt-1.5 text-[11px] font-bold leading-relaxed text-violet-200/70">
                      {choice.type === "gamble"
                        ? `成功：${fmtEventEntries(choice.success)}` + (choice.morale ? ` ・💛 士氣+${choice.morale}` : "")
                        : (fmtEventEntries(choice.reward) || "好好休息") + (choice.morale ? ` ・💛 士氣+${choice.morale}` : "")}
                    </div>
                  </button>
                ))}
                <button type="button" onClick={onSkip} disabled={resolving}
                  className="w-full rounded-xl px-4 py-2.5 text-center text-xs font-black text-slate-400 hover:text-slate-200 transition-colors">
                  🚶 跳過這個事件（不會有獎勵，也不會有損失）
                </button>
              </>
            ) : (
              <div className="py-6 text-center">
                {picked.outcome.success ? (
                  <>
                    <div className="exp-burst text-6xl">🎉</div>
                    <div className="mt-3 text-lg font-black text-emerald-300">成功！</div>
                    <div className="exp-float mt-2 flex flex-wrap justify-center gap-2">
                      {Object.entries(picked.outcome.rewards || {}).map(([key, count]) => {
                        const m = /^([a-z]+)_t([1-5])$/.exec(key);
                        return (
                          <span key={key} className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200 border border-emerald-500/30">
                            {m ? `${RES_ICON[m[1]]} ${RES_CN[m[1]]} T${m[2]} +${count}` : `${RES_ICON[key] || "✨"} ${RES_CN[key] || key} +${count}`}
                          </span>
                        );
                      })}
                      {picked.outcome.moraleDelta > 0 && (
                        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-200 border border-amber-500/30">💛 士氣 +{picked.outcome.moraleDelta}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="exp-burst text-6xl">😿</div>
                    <div className="mt-3 text-lg font-black text-slate-300">什麼都沒發生…</div>
                    <div className="mt-2 text-xs font-bold text-slate-400">沒有收穫，但也沒有損失。繼續旅程吧！</div>
                  </>
                )}
                <div className="mt-4 text-[10px] font-bold text-slate-500">獎勵將在旅程結束時一起結算…</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 探險結果（沿用既有寶箱慶祝＋整合投資/士氣資訊）────────────
const REWARD_KIND_LABEL = {
  material: e => `T${e.tier} 材料`,
  special: () => "特殊獎勵",
  chest: () => "寶箱・前往背包開啟",
  goods: () => "商店商品・可上架販售",
};

function ExpeditionRewardResult({ result, onClose }) {
  const mission = EXPEDITION_MISSIONS.find(item => item.tier === result.missionTier);
  const entries = buildExpeditionRewardEntries(result.rewards);
  const materials = entries.filter(entry => entry.kind === "material");
  const specials = entries.filter(entry => entry.kind !== "material");

  const renderRewardCard = (entry, index) => (
    <div key={entry.key} className="expedition-reward-card" style={{ animationDelay: `${520 + index * 90}ms` }}>
      <div className="h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center bg-black/20 border border-amber-200/20">
        {entry.image ? (
          <img src={entry.image} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <span className="text-2xl" aria-hidden="true">{entry.icon}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-black text-sm text-amber-50 truncate">{entry.name}</div>
        <div className="text-[11px] font-bold text-amber-200/70">{(REWARD_KIND_LABEL[entry.kind] || REWARD_KIND_LABEL.special)(entry)}</div>
      </div>
      <div className="text-xl font-black text-white tabular-nums">×{entry.count.toLocaleString()}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/95 text-white" role="dialog" aria-modal="true" aria-labelledby="expedition-result-title">
      <style>{`
        @keyframes expeditionChestOpen {
          0% { opacity: 0; transform: translateY(18px) scale(.72); filter: brightness(.7); }
          55% { opacity: 1; transform: translateY(-8px) scale(1.08); filter: brightness(1.45); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: brightness(1); }
        }
        @keyframes expeditionRewardReveal {
          from { opacity: 0; transform: translateY(14px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .expedition-result-chest { animation: expeditionChestOpen .72s cubic-bezier(.2,.85,.25,1) both; }
        .expedition-reward-card {
          opacity: 0;
          animation: expeditionRewardReveal .42s ease-out both;
          display: flex;
          align-items: center;
          gap: .75rem;
          min-width: 0;
          border-radius: 1rem;
          padding: .75rem;
          background: linear-gradient(135deg, rgba(120,53,15,.7), rgba(51,65,85,.78));
          border: 1px solid rgba(253,230,138,.22);
          box-shadow: 0 10px 24px rgba(0,0,0,.22);
        }
        @media (prefers-reduced-motion: reduce) {
          .expedition-result-chest, .expedition-reward-card { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>
      <div className="min-h-full px-4 py-7 flex justify-center bg-[radial-gradient(circle_at_top,rgba(245,158,11,.24),transparent_42%)]">
        <div className="w-full max-w-xl flex flex-col items-center">
          <div className="text-xs font-black tracking-[.24em] text-amber-300">探險隊凱旋</div>
          <h2 id="expedition-result-title" className="mt-2 text-2xl font-black text-center text-amber-50">{result.catName} 帶回寶藏！</h2>
          <div className="mt-1 text-sm font-bold text-slate-300">T{result.missionTier} {mission?.label || "探險任務"}</div>
          {result.tags && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {result.tags.map(tag => (
                <span key={tag} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-black text-amber-200 border border-white/10">{tag}</span>
              ))}
            </div>
          )}
          <div className="relative mt-5 h-36 w-52 flex items-center justify-center expedition-result-chest">
            {mission?.image ? <img src={mission.image} alt="" className="absolute h-32 w-32 object-contain opacity-40 blur-[1px]" /> : null}
            <div className="absolute h-24 w-24 rounded-full bg-amber-300/25 blur-2xl" />
            <span className="relative text-7xl drop-shadow-[0_8px_18px_rgba(245,158,11,.55)]" aria-hidden="true">🎁</span>
            <img src={`/cats/portraits/${result.catId}.webp`} alt={result.catName}
              className="absolute -bottom-1 -right-1 h-16 w-16 rounded-full object-cover border-4 border-amber-300 shadow-xl" />
          </div>
          <div className="mt-3 w-full">
            <div className="mb-2 text-xs font-black text-amber-300">📦 採集材料</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {materials.length ? materials.map(renderRewardCard) : <div className="text-xs text-slate-400 px-2">這次沒有採集到材料…</div>}
            </div>
          </div>
          {specials.length > 0 && (
            <div className="mt-5 w-full">
              <div className="mb-2 text-xs font-black text-fuchsia-300">✨ 特別收穫</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {specials.map((entry, index) => renderRewardCard(entry, materials.length + index))}
              </div>
            </div>
          )}
          <button type="button" onClick={onClose}
            className="mt-7 min-h-12 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-base font-black text-white shadow-lg shadow-amber-950/50 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
            收下獎勵
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 射手消耗列 ──────────────────────────────────────────────
function ArcherCostRow({ archerCost, villageRes }) {
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(archerCost).map(([key, need]) => {
        const have = Math.floor(villageRes?.[key] || 0);
        const ok = have >= need;
        const tier = Number(key.replace("archer_t", ""));
        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="font-black" style={{ color: TIER_COLOR[tier] }}>T{tier} 射手</span>
            <span className="ml-auto font-black" style={{ color: ok ? "#86efac" : "#f87171" }}>{have} / {need}</span>
          </div>
        );
      })}
    </div>
  );
}

function RewardPreview({ mission, catData }) {
  const { catATK } = calcCatFullStats(catData || {});
  const mult = catPowerMult(catATK);
  // 與 calcExpeditionRewards 一致：材料 = 隨機量 × 貓倍率 × 全域材料倍率(×4)
  const matMult = mult * EXPEDITION_MATERIAL_BOOST;
  const catResources = ["fur", "potion"];
  const matResources = ["ore", "melon", "fish", "meat", "driedfish", "can"];
  const catRewards = mission.baseRewards.filter(r => catResources.includes(r.resource));
  const matRewards = mission.baseRewards.filter(r => matResources.includes(r.resource));
  return (
    <div className="flex flex-col gap-0.5">
      {/* 貓 XP／羈絆（固定，與結算一致） */}
      {(mission.catXP > 0 || mission.catBond > 0) && (
        <div className="text-[10px] font-bold" style={{ color: "#a78bfa" }}>
          ⭐ 貓咪經驗 +{Math.min(EXPEDITION_CATXP_CAP, Math.round(mission.catXP * mult))}
          {mission.catBond > 0 ? ` ・💛 羈絆 +${mission.catBond}` : ""}
        </div>
      )}
      {catRewards.map((r, i) => (
        <div key={i} className="flex items-center gap-1 text-[11px]">
          <span className="font-black" style={{ color: r.resource === "fur" ? "#fbbf24" : "#a78bfa" }}>
            {RES_ICON[r.resource]} {RES_CN[r.resource]} T{r.tier}
          </span>
          <span className="ml-auto" style={{ color: "#86efac" }}>{Math.max(1, Math.round(r.min * matMult))}–{Math.round(r.max * matMult)}</span>
        </div>
      ))}
      {matRewards.length > 0 && (
        <div style={{ marginTop: 2, display: "flex", flexWrap: "wrap", gap: 3 }}>
          {matRewards.map((r, i) => (
            <span key={i} style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "1px 5px", color: "rgba(255,255,255,0.6)" }}>
              {RES_ICON[r.resource]} T{r.tier} ×{Math.max(1, Math.round(r.min * matMult))}~{Math.round(r.max * matMult)}
            </span>
          ))}
        </div>
      )}
      {mission.bonusChance?.arrowdew > 0 && (
        <div className="text-[10px]" style={{ color: "#fbbf24" }}>💧 箭露 {Math.round(mission.bonusChance.arrowdew * 100)}% 機率（{mission.bonusAmount?.arrowdew?.[0]}~{mission.bonusAmount?.arrowdew?.[1]}）</div>
      )}
      {mission.bonusChance?.gachaToken > 0 && (
        <div className="text-[10px]" style={{ color: "#fbbf24" }}>🎰 扭蛋幣 {Math.round(mission.bonusChance.gachaToken * 100)}% 機率（{mission.bonusAmount?.gachaToken?.[0]}~{mission.bonusAmount?.gachaToken?.[1]}）</div>
      )}
      {/* 探險戰利品機率（投資倍率加成） */}
      {(() => {
        const rates = EXPEDITION_LOOT_RATES[mission.tier] || EXPEDITION_LOOT_RATES[1];
        const pct = v => `${(v * 100).toFixed(v >= 0.01 ? 0 : 1)}%`;
        return (
          <div className="mt-1.5 space-y-0.5 border-t border-white/10 pt-1.5">
            <div className="text-[10px] font-black" style={{ color: "#c084fc" }}>🎁 探險戰利品（投資加成）</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px]" style={{ color: "rgba(255,255,255,0.65)" }}>
              <span>📦 材料寶箱 {pct(rates.material)}</span>
              <span>🐾 族系寶箱 {pct(rates.family)}</span>
              <span>💰 金幣寶箱 {pct(rates.coin)}</span>
              <span>🏪 商店商品 {pct(rates.goods)}</span>
              <span>🃏 卡包 {pct(rates.cardPack)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── 單個槽位卡片（含路線圖／士氣條／事件提示）────────────────
function SlotCard({ slotIdx, expedition, myCats, now, onSelect, isActive, onCollect, collecting, onResolveEvent }) {
  // 空槽
  if (!expedition) {
    return (
      <button onClick={() => onSelect(slotIdx)}
        className={`relative isolate min-h-[116px] w-full overflow-hidden rounded-2xl border p-3.5 text-left transition-all cursor-pointer active:scale-[.98] ${
          isActive ? "border-amber-300 shadow-[0_0_18px_rgba(251,191,36,.28)] ring-2 ring-amber-300/35" : "border-amber-100/15 hover:border-amber-300/40"
        }`}>
        <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-r from-[#1b0e06]/95 via-[#251309]/80 to-[#39200e]/40" />
        <span className="relative flex min-h-[88px] items-center gap-3">
          <CatVillageNavArt name="tasks" size={64} />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black tracking-[.18em] text-amber-300">EXPEDITION {slotIdx + 1}</span>
            <span className="mt-1 block text-base font-black text-amber-50">空閒的探險席位</span>
            <span className="mt-1 block text-[11px] font-bold text-amber-100/65">{isActive ? "正在規劃這次旅程…" : "選擇貓咪與目的地，展開新探險"}</span>
          </span>
          <span className={`grid h-9 w-9 place-items-center rounded-full text-xl font-black ${isActive ? "bg-amber-300 text-amber-950" : "bg-white/10 text-amber-100"}`}>＋</span>
        </span>
      </button>
    );
  }

  const endsAt = expedition.endsAt?.toMillis?.() || 0;
  const startedAt = expedition.startedAt?.toMillis?.() || (endsAt - (expedition.hours || 1) * 3600000);
  const totalDuration = Math.max(1, endsAt - startedAt);
  const msLeft = endsAt - now;
  const isDone = msLeft <= 0;
  const progressPct = isDone ? 100 : Math.min(100, Math.max(0, Math.round(((totalDuration - msLeft) / totalDuration) * 100)));
  const elapsedHours = Math.max(0, Math.min(expedition.hours || 0, (now - startedAt) / 3600000));

  const expMission = EXPEDITION_MISSIONS.find(m => m.tier === expedition.missionTier);
  const expCatInfo = CATS[expedition.catId];
  const catData = myCats[expedition.catId];
  const catLv = catData ? catLevelFromXP(catData.catXP || 0) : "?";

  const invest = EXPEDITION_INVEST[expedition.invest] || EXPEDITION_INVEST[1];
  const route = toRouteArray(expedition.route);
  const effectiveMorale = clampMorale((expedition.morale ?? 100) - calcMoraleDecay(expedition.missionTier, elapsedHours));
  const moraleColor = effectiveMorale >= 70 ? "#34d399" : effectiveMorale >= 40 ? "#fbbf24" : "#f87171";
  // 可解事件：進度已到、尚未解決
  const pendingEventIdx = route.findIndex(r => r.id && !r.resolved && progressPct >= r.at * 100);
  const resolvedCount = route.filter(r => r.resolved).length;

  return (
    <div className={`relative isolate min-h-[132px] w-full overflow-hidden rounded-2xl border p-3.5 transition-all shadow-md ${
      isDone ? "border-emerald-400/60 shadow-emerald-950/50" : "border-violet-400/35 shadow-violet-950/50"
    } ${pendingEventIdx >= 0 ? "ring-2 ring-amber-400/60" : ""}`}>
      <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className={`absolute inset-0 ${isDone ? "bg-gradient-to-r from-emerald-950/95 via-slate-950/80 to-emerald-950/35" : "bg-gradient-to-r from-violet-950/95 via-slate-950/80 to-violet-950/35"}`} />
      <img src={expMission?.image} alt="" className="absolute -bottom-8 -right-3 h-44 w-44 object-contain opacity-65 drop-shadow-2xl" />

      <div className="relative flex items-start gap-3">
        <img src={`/cats/portraits/${expedition.catId}.webp`} alt={expedition.catName}
          className={`h-14 w-14 shrink-0 rounded-2xl object-cover border-2 shadow-lg ${isDone ? "border-emerald-400" : "border-violet-400"}`} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black tracking-[.16em] text-amber-300">探險槽 {slotIdx + 1} · T{expedition.missionTier}</div>
          <div className="mt-0.5 truncate text-base font-black text-white">{expCatInfo?.name || expedition.catName}</div>
          <div className="text-[11px] font-bold text-white/60">Lv.{catLv} · {expMission?.label || "探險任務"}</div>
          {/* 投資＋事件徽章 */}
          <div className="mt-1 flex flex-wrap gap-1">
            {expedition.invest > 1 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-black text-amber-200 border border-amber-500/30">
                {invest.emoji} 投資 ×{invest.mult}
              </span>
            )}
            {route.length > 0 && (
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-black text-violet-200 border border-violet-500/30">
                🎒 事件 {resolvedCount}/{route.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 旅程路線圖（檢查點＋事件點） */}
      {route.length > 0 && (
        <div className="relative mt-2.5 max-w-[85%]">
          <div className="relative h-1.5 w-full rounded-full bg-black/40" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: isDone ? "linear-gradient(90deg,#10B981,#34D399)" : "linear-gradient(90deg,#8B5CF6,#EC4899)" }} />
            {route.map((r, i) => {
              const reached = progressPct >= r.at * 100;
              const done = !!r.resolved;
              return (
                <span key={i} className="absolute -top-[5px]" style={{ left: `calc(${r.at * 100}% - 6px)` }}
                  title={done ? "已解決" : reached ? (r.id ? "遇到事件！" : "路過") : "前方檢查點"}>
                  <span style={{
                    display: "inline-block", width: 13, height: 13, borderRadius: "50%",
                    background: done ? "#34d399" : reached && r.id ? "#fbbf24" : reached ? "#8B5CF6" : "rgba(255,255,255,0.25)",
                    border: done ? "2px solid #10B981" : reached && r.id ? "2px solid #f59e0b" : "2px solid rgba(255,255,255,0.35)",
                    boxShadow: reached && r.id && !done ? "0 0 10px rgba(251,191,36,0.8)" : "none",
                    animation: reached && r.id && !done ? "expPointPulse 1.2s ease-in-out infinite" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8,
                  }}>
                    {done ? "✓" : reached && r.id ? "⭐" : ""}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative mt-2 max-w-[85%] space-y-1">
        <div className="flex justify-between text-[10px] font-black">
          <span className={isDone ? "text-emerald-300" : "text-violet-200"}>{isDone ? "探險完成，可以領取" : `旅程進度 ${progressPct}%`}</span>
          {!isDone && <span className="font-mono text-white/65">{fmtCountdown(msLeft)}</span>}
        </div>
        {/* 士氣條 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black text-amber-200/80">💛 士氣</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/45" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${effectiveMorale}%`, background: moraleColor, boxShadow: `0 0 6px ${moraleColor}` }} />
          </div>
          <span className="text-[9px] font-black font-mono" style={{ color: moraleColor }}>{effectiveMorale}</span>
        </div>
      </div>

      {/* 事件觸發提示（可解可不解） */}
      {pendingEventIdx >= 0 && !isDone && (
        <button onClick={() => onResolveEvent(slotIdx, pendingEventIdx)}
          className="relative mt-2 min-h-9 w-full max-w-[85%] rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-500/25 px-3 text-xs font-black text-amber-200 shadow-md active:scale-[.98]"
          style={{ animation: "expEventHint 1.4s ease-in-out infinite" }}>
          🎒 途中遭遇「{getExpeditionEventById(route[pendingEventIdx].id)?.name || "事件"}」！點我解決
        </button>
      )}

      {isDone && (
        <button onClick={() => onCollect(slotIdx)} disabled={collecting}
          className="relative mt-2 min-h-10 w-full max-w-[85%] rounded-xl border border-emerald-200/40 bg-gradient-to-r from-emerald-500 to-teal-500 px-3 font-black text-sm text-white shadow-md shadow-emerald-950/50 active:scale-[.98]">
          {collecting ? "領取中…" : "開啟探險寶箱"}
        </button>
      )}

      <style>{`
        @keyframes expPointPulse {
          0%,100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
        @keyframes expEventHint {
          0%,100% { box-shadow: 0 0 0 rgba(251,191,36,0); }
          50% { box-shadow: 0 0 12px rgba(251,191,36,0.55); }
        }
        @media (prefers-reduced-motion: reduce) {
          .expPointPulse, .expEventHint { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── 主面板 ──────────────────────────────────────────────────
export default function ExpeditionPanel({ profile, myCats = {} }) {
  const [activeSlot, setActiveSlot] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [investTier, setInvestTier] = useState(1);
  const [sending, setSending] = useState(false);
  const [collecting, setCollecting] = useState({});
  const [msg, setMsg] = useState("");
  const [rewardResult, setRewardResult] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null); // { slotIdx, eventIdx }
  const [resolving, setResolving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const villageRes = profile?.village?.resources || {};

  // 向後兼容：支援舊的單一 expedition 欄位
  const rawExpeditions = profile?.expeditions || {};
  const expeditions = Object.keys(rawExpeditions).length > 0
    ? rawExpeditions
    : (profile?.expedition ? { 0: profile.expedition } : {});

  // 可派遣：持有且沒有在任何地方工作
  const busyCatIds = busyCatIdSet(profile);
  const availableCats = Object.values(myCats).filter(c => !busyCatIds.has(c.catId));

  const mission = selectedTier ? EXPEDITION_MISSIONS.find(m => m.tier === selectedTier) : null;
  const selCatData = selectedCat ? myCats[selectedCat] : null;
  const selCatInfo = selectedCat ? CATS[selectedCat] : null;
  const selCatLevel = selCatData ? catLevelFromXP(selCatData.catXP || 0) : 1;
  const selCatStats = selCatData ? calcCatFullStats(selCatData) : { catATK: 10, catHP: 200, catDEF: 10 };

  // 投資後總花費與追加花費（六檔皆只追加射手，不使用箭露）
  const totalCost = useMemo(() => (mission ? totalArcherCost(mission.archerCost, investTier) : {}), [mission, investTier]);
  const investExtra = useMemo(() => (mission ? calcInvestCost(mission.archerCost, investTier) : { arrowdew: 0, archerCost: {} }), [mission, investTier]);
  const canDispatch = !!(mission && selectedCat
    && Object.entries(totalCost).every(([key, need]) => Math.floor(villageRes[key] || 0) >= need));

  function showMsg(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 4000);
  }

  function handleSelectSlot(idx) {
    if (activeSlot === idx) {
      setActiveSlot(null); setSelectedCat(null); setSelectedTier(null); setInvestTier(1);
    } else {
      setActiveSlot(idx); setSelectedCat(null); setSelectedTier(null); setInvestTier(1);
    }
  }

  async function handleDispatch() {
    if (!canDispatch || sending || activeSlot === null) return;
    setSending(true);
    const route = generateExpeditionRoute(selectedTier);
    const result = await startExpedition(
      profile.id, activeSlot, selectedCat, selCatInfo?.name || selectedCat,
      selectedTier, mission.hours, totalCost, investTier, investExtra.arrowdew, route,
    );
    setSending(false);
    if (result.ok) {
      const investLabel = investTier > 1 ? `（${EXPEDITION_INVEST[investTier].emoji} 投資）` : "";
      showMsg(`✅ ${selCatInfo?.name} 出發了！${mission.hours}小時後回來${investLabel}`);
      setActiveSlot(null); setSelectedCat(null); setSelectedTier(null); setInvestTier(1);
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }

  // 解決事件（可解可不解）
  async function handleResolveEvent(slotIdx, eventIdx, choiceIdx, outcome) {
    if (resolving) return;
    setResolving(true);
    const exp = expeditions[slotIdx];
    const currentMorale = exp?.morale ?? 100;
    const moraleAfter = clampMorale(currentMorale + (outcome.moraleDelta || 0));
    const result = await resolveExpeditionEvent(profile.id, slotIdx, eventIdx, outcome, moraleAfter);
    setResolving(false);
    setActiveEvent(null);
    if (!result.ok) showMsg(`❌ ${result.reason}`);
    // profile 由 useAuth onSnapshot 即時同步，槽位卡自動更新
  }

  async function handleCollect(slotIdx) {
    if (collecting[slotIdx]) return;
    const exp = expeditions[slotIdx];
    if (!exp) return;
    const catData = myCats[exp.catId] || {};
    const base = calcExpeditionRewards(exp.missionTier, catData);
    const resolvedEvents = toRouteArray(exp.route).map(r => r.resolved).filter(Boolean);
    const startedAt = exp.startedAt?.toMillis?.() || (exp.endsAt?.toMillis?.() - (exp.hours || 1) * 3600000);
    const elapsedHours = Math.max(0, Math.min(exp.hours || 0, (now - startedAt) / 3600000));
    const moraleFinal = clampMorale((exp.morale ?? 100) - calcMoraleDecay(exp.missionTier, elapsedHours));
    const invest = exp.invest || 1;
    const rewards = aggregateExpeditionRewards(base, resolvedEvents, invest, moraleFinal);
    setCollecting(prev => ({ ...prev, [slotIdx]: true }));
    const result = await collectExpedition(profile.id, slotIdx, rewards, exp.catId);
    setCollecting(prev => ({ ...prev, [slotIdx]: false }));
    if (result.ok) {
      const tags = [];
      if (invest > 1) tags.push(`${EXPEDITION_INVEST[invest].emoji} 投資 ×${EXPEDITION_INVEST[invest].mult}`);
      if (resolvedEvents.length > 0) tags.push(`🎒 事件 ×${resolvedEvents.length}`);
      if (moraleFinal >= 90) tags.push("💛 士氣高昂");
      setRewardResult({
        rewards,
        catId: exp.catId,
        catName: CATS[exp.catId]?.name || exp.catName || exp.catId,
        missionTier: exp.missionTier,
        tags,
      });
    } else {
      showMsg(`❌ ${result.reason}`);
    }
  }      const activeEventData = activeEvent
    ? {
        slotIdx: activeEvent.slotIdx,
        eventIdx: activeEvent.eventIdx,
        event: getExpeditionEventById(toRouteArray(expeditions[activeEvent.slotIdx]?.route)[activeEvent.eventIdx]?.id) || null,
        catId: expeditions[activeEvent.slotIdx]?.catId,
        catName: CATS[expeditions[activeEvent.slotIdx]?.catId]?.name || expeditions[activeEvent.slotIdx]?.catName || "",
        tier: expeditions[activeEvent.slotIdx]?.missionTier || 1,
      }
    : null;

  return (
    <div className="px-3 pb-20 pt-3 text-white">
      {msg && (
        <div style={{ background: "#14532d", borderRadius: 10, padding: "9px 13px", marginBottom: 12, fontWeight: 800, fontSize: 13, whiteSpace: "pre-line" }}>
          {msg}
        </div>
      )}

      {rewardResult ? (
        <ExpeditionRewardResult result={rewardResult} onClose={() => setRewardResult(null)} />
      ) : null}

      {activeEventData?.event ? (
        <ExpeditionEventModal
          event={activeEventData.event}
          catId={activeEventData.catId}
          catName={activeEventData.catName}
          missionTier={activeEventData.tier}
          resolving={resolving}
          onChoose={(choiceIdx, outcome) => handleResolveEvent(activeEventData.slotIdx, activeEventData.eventIdx, choiceIdx, outcome)}
          onSkip={() => setActiveEvent(null)}
        />
      ) : null}

      {/* 標頭 */}
      <div className="relative isolate mb-4 min-h-[178px] overflow-hidden rounded-3xl border border-amber-300/30 shadow-2xl" style={{ animation: "expHeaderIn .5s ease-out both" }}>
        <img src="/ui/cat-village/explore-map.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#160b04]/95 via-[#241207]/65 to-transparent" />
        <div className="relative flex min-h-[178px] items-center gap-3 p-5">
          <CatVillageNavArt name="tasks" size={78} />
          <div>
            <div className="text-[10px] font-black tracking-[.24em] text-amber-300">CAT EXPEDITION</div>
            <div className="mt-1 text-2xl font-black text-amber-50">貓貓探險隊</div>
            <div className="mt-2 max-w-[250px] text-xs font-bold leading-relaxed text-amber-100/75">
              派出最多三隻空閒貓咪探索村莊物資。旅途中會遇到各種事件，解決它們獲得額外收穫！
            </div>
            <div className="mt-2 text-[10px] font-bold text-amber-300/75">
              事件可解可不解・六檔投資追加射手・可帶回寶箱與商店商品
            </div>
          </div>
        </div>
        <style>{`
          @keyframes expHeaderIn {
            from { opacity: 0; transform: translateY(-14px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>

      <div className="mb-2 flex items-end justify-between px-1">
        <div>
          <div className="text-sm font-black text-amber-50">探險席位</div>
          <div className="text-[10px] font-bold text-amber-100/50">點擊空席位開始安排任務</div>
        </div>
        <div className="rounded-full border border-amber-300/20 bg-amber-950/35 px-2.5 py-1 text-[10px] font-black text-amber-200">
          {Object.values(expeditions).filter(Boolean).length} / 3 出發中
        </div>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[0, 1, 2].map(idx => (
          <SlotCard
            key={idx}
            slotIdx={idx}
            expedition={expeditions[idx] || null}
            myCats={myCats}
            now={now}
            onSelect={handleSelectSlot}
            isActive={activeSlot === idx}
            onCollect={handleCollect}
            collecting={!!collecting[idx]}
            onResolveEvent={(slot, eventIdx) => setActiveEvent({ slotIdx: slot, eventIdx })}
          />
        ))}
      </div>

      {/* 派遣設定表單 */}
      {activeSlot !== null && (
        <div className="rounded-3xl p-4 bg-slate-900/90 border border-purple-500/30 shadow-xl space-y-4 backdrop-blur-md" style={{ animation: "expFormIn .35s ease-out both" }}>
          <style>{`
            @keyframes expFormIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="font-black text-sm text-purple-300 flex items-center gap-1.5">
              <span>🚩</span> 探險槽 {activeSlot + 1} — 派遣任務佈署
            </div>
            <button type="button" onClick={() => handleSelectSlot(activeSlot)} className="text-xs text-slate-400 hover:text-white">✕ 關閉</button>
          </div>

          {/* Step 1：選貓 */}
          <div>
            <div className="text-xs font-black text-purple-300 mb-2 flex items-center justify-between">
              <span>① 選擇隊長貓咪</span>
              <span className="text-[10px] text-slate-400">可派遣：{availableCats.length} 隻</span>
            </div>
            {availableCats.length === 0 ? (
              <div className="text-slate-400 text-xs p-4 text-center bg-black/30 rounded-2xl border border-white/5 space-y-1">
                <div>😿 沒有空閒的貓咪可以派遣</div>
                <div className="text-[10px] text-slate-500">（所有貓咪正在陪練、地下城發掘或探險中）</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableCats.map(cat => {
                  const info = CATS[cat.catId];
                  const realType = CAT_TYPE_MAP[cat.catId] || cat.type || "allround";
                  const lv = catLevelFromXP(cat.catXP || 0);
                  const isSelected = selectedCat === cat.catId;
                  return (
                    <button key={cat.catId} type="button" onClick={() => setSelectedCat(isSelected ? null : cat.catId)}
                      className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 active:scale-95 relative overflow-hidden ${
                        isSelected ? "bg-purple-900/60 border-purple-300 ring-2 ring-purple-400/50 shadow-lg shadow-purple-950/80" : "bg-slate-950/70 border-white/10 hover:border-purple-400/40 hover:bg-slate-800/50"
                      }`}>
                      <img src={`/cats/portraits/${cat.catId}.webp`} alt={info?.name || cat.catId}
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-400/50 shadow-md" />
                      <div className="font-black text-xs text-white truncate max-w-full">{info?.name || cat.catId}</div>
                      <div className="text-[10px] font-black" style={{ color: TYPE_COLOR[realType] || "#9ca3af" }}>{TYPE_LABEL[realType] || "—"}</div>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Lv.{lv}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 選中貓咪戰力 */}
          {selCatData && selCatInfo && (
            <div className="rounded-2xl p-3 bg-purple-950/40 border border-purple-500/30 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-black text-purple-200">
                  <span>🐾 {selCatInfo.name}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Lv.{selCatLevel}</span>
                </div>
                <span className="text-[11px] font-black text-amber-300">× {catPowerMult(selCatStats.catATK).toFixed(2)} 探險獎勵倍率</span>
              </div>
              <div className="flex gap-3 text-[11px] font-bold pt-1 border-t border-purple-500/20">
                <span className="text-red-400">⚔️ 攻擊 {selCatStats.catATK}</span>
                <span className="text-blue-400">🛡️ 防禦 {selCatStats.catDEF}</span>
                <span className="text-emerald-400">❤️ HP {selCatStats.catHP}</span>
              </div>
            </div>
          )}

          {/* Step 2：選任務 */}
          <div>
            <div className="text-xs font-black text-purple-300 mb-2">② 選擇任務難度</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EXPEDITION_MISSIONS.map(m => {
                const isSelected = selectedTier === m.tier;
                const costOk = Object.entries(m.archerCost).every(([k, need]) => Math.floor(villageRes[k] || 0) >= need);
                return (
                  <button key={m.tier} onClick={() => setSelectedTier(isSelected ? null : m.tier)}
                    style={{
                      background: isSelected ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${isSelected ? "rgba(167,139,250,0.6)" : costOk ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.3)"}`,
                      borderRadius: 14, padding: "11px 13px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isSelected ? 8 : 0 }}>
                      <img src={m.image} alt="" style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 13, color: "white" }}>T{m.tier} {m.label}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                          {m.hours >= 24 ? `${m.hours / 24}天` : `${m.hours}小時`} · 途中事件 ×{eventCountForTier(m.tier)} · {costOk ? "✓ 射手足夠" : "⚠ 射手不足"}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: costOk ? "#4ade80" : "#f87171", fontWeight: 800 }}>{costOk ? "可派遣" : "不足"}</div>
                    </div>
                    {isSelected && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>消耗射手</div>
                          <ArcherCostRow archerCost={m.archerCost} villageRes={villageRes} />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>預期獎勵 {selCatData ? `(ATK ${selCatStats.catATK})` : ""}</div>
                          <RewardPreview mission={m} catData={selCatData} />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3：投資選擇（六檔，只追加射手） */}
          <div>
            <div className="text-xs font-black text-purple-300 mb-1 flex items-center justify-between">
              <span>③ 投資補給（可選，追加報酬）</span>
              <span className="text-[10px] text-slate-400">追加各階射手・可帶回寶箱與商店商品</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(t => {
                const inv = EXPEDITION_INVEST[t];
                const isSelected = investTier === t;
                const extra = calcInvestCost(mission?.archerCost || {}, t);
                const archerOk = Object.entries(extra.archerCost).every(([k, need]) => Math.floor(villageRes[k] || 0) >= need);
                const canAfford = t === 1 || archerOk;
                return (
                  <button key={t} type="button" onClick={() => setInvestTier(t)} disabled={!canAfford}
                    className={`relative rounded-2xl border p-2.5 text-center transition-all active:scale-95 ${
                      isSelected ? "border-amber-300 bg-amber-500/15 ring-2 ring-amber-400/50 shadow-lg shadow-amber-950/60" : "border-white/10 bg-white/[.03] hover:border-amber-400/40"
                    } ${!canAfford ? "opacity-45" : ""}`}>
                    <div className="text-2xl">{inv.emoji}</div>
                    <div className="mt-1 text-xs font-black text-white">{inv.label}</div>
                    <div className="text-[10px] font-black text-amber-300">獎勵 ×{inv.mult}</div>
                    {t === 1 ? (
                      <div className="mt-1 text-[9px] font-bold text-slate-400">不追加花費</div>
                    ) : (
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(extra.archerCost).map(([k, need]) => (
                          <div key={k} className="text-[9px] font-bold text-slate-400">
                            T{k.replace("archer_t", "")} 射手 +{need}
                          </div>
                        ))}
                        {t === 6 && <div className="text-[9px] font-black text-amber-300">👑 保底族系寶箱</div>}
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-[10px] font-black text-amber-950">✓</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 派遣按鈕（顯示總花費） */}
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[11px] font-bold text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>💰 總花費</span>
              <span className="font-black text-amber-200">
                {investTier > 1 ? `${EXPEDITION_INVEST[investTier].emoji} 投資 ×${EXPEDITION_INVEST[investTier].mult}` : "標準派遣（無追加）"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {Object.entries(totalCost).map(([key, need]) => {
                const have = Math.floor(villageRes[key] || 0);
                const ok = have >= need;
                const tier = Number(key.replace("archer_t", ""));
                return (
                  <span key={key} style={{ color: ok ? "#86efac" : "#f87171" }}>
                    T{tier} 射手 {have}/{need}
                  </span>
                );
              })}
            </div>
          </div>
          <button onClick={handleDispatch} disabled={!canDispatch || sending}
            style={{
              width: "100%", padding: "15px 0", borderRadius: 16, fontWeight: 900, fontSize: 16, border: "none",
              cursor: canDispatch ? "pointer" : "not-allowed",
              background: canDispatch ? "linear-gradient(90deg,#7c3aed,#a78bfa)" : "rgba(255,255,255,0.07)",
              color: canDispatch ? "white" : "rgba(255,255,255,0.25)",
            }}>
            {sending
              ? "派遣中…"
              : !selectedCat ? "請先選擇貓咪"
              : !selectedTier ? "請選擇任務難度"
              : !canDispatch ? "射手不足"
              : `🚀 派遣 ${selCatInfo?.name} 出發！`}
          </button>
        </div>
      )}
    </div>
  );
}
