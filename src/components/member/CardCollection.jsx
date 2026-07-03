// src/components/member/CardCollection.jsx
// 怪物卡片收藏、升星、裝備

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeCardCollection, equipCard, unequipCard, upgradeCard, setMythicCardStat,
} from "../../lib/db";
import {
  TIER_CARD_BONUS, FAMILY_STAT, calcCardBonus, canUpgradeStar, getUpgradeCost,
  getCardStat, getStatLabel, MAX_EQUIPPED_CARDS,
} from "../../lib/monsterCards";

const STAT_OPTIONS = [
  { id: "hp",  label: "HP ❤️",  desc: "增加血量" },
  { id: "atk", label: "ATK ⚔️", desc: "增加攻擊" },
  { id: "def", label: "DEF 🛡️", desc: "增加防禦" },
];

function StarRow({ stars, max = 5 }) {
  return (
    <span className="text-yellow-400 text-xs">
      {"★".repeat(stars || 1)}{"☆".repeat(max - (stars || 1))}
    </span>
  );
}

export default function CardCollection() {
  const { profile } = useAuth();
  const [collection, setCollection] = useState({ cards: {}, equipped: [] });
  const [selected,   setSelected]   = useState(null); // monsterId of detail panel
  const [upgrading,  setUpgrading]  = useState(false);
  const [mythicPick, setMythicPick] = useState(null); // monsterId awaiting stat choice
  const [notice,     setNotice]     = useState("");
  const [filterTier, setFilterTier] = useState("all");

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeCardCollection(profile.id, setCollection);
    return unsub;
  }, [profile?.id]); // eslint-disable-line

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2500);
  }

  async function handleEquip(monsterId) {
    const res = await equipCard(profile.id, monsterId);
    if (!res.ok) showNotice(res.reason || "裝備失敗");
  }
  async function handleUnequip(monsterId) {
    await unequipCard(profile.id, monsterId);
  }
  async function handleUpgrade(monsterId) {
    setUpgrading(true);
    const res = await upgradeCard(profile.id, monsterId);
    setUpgrading(false);
    if (res.ok) showNotice(`✨ 升星成功！現在 ${res.newStars}★`);
    else showNotice(res.reason || "升星失敗");
  }
  async function handleMythicStat(monsterId, stat) {
    await setMythicCardStat(profile.id, monsterId, stat);
    setMythicPick(null);
    showNotice("✅ 屬性已設定！");
  }

  const cards      = collection.cards   || {};
  const equipped   = collection.equipped || [];
  const cardList   = Object.entries(cards)
    .map(([id, c]) => ({ ...c, monsterId: id }))
    .filter(c => filterTier === "all" || c.tier === filterTier)
    .sort((a, b) => {
      const tierOrder = ["mythic","boss","fierce","elite","rare","common"];
      return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
    });

  const equippedCards = equipped.map(id => cards[id]).filter(Boolean);
  const totalBonus    = equippedCards.reduce((acc, card) => {
    const stat = getCardStat(card);
    const val  = calcCardBonus(card.tier, card.stars);
    acc[stat]  = (acc[stat] || 0) + val;
    return acc;
  }, { hp: 0, atk: 0, def: 0 });

  const TIERS = ["all","mythic","boss","fierce","elite","rare","common"];

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      {/* 標題 & 加成總覽 */}
      <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
        <div className="text-xs font-black tracking-widest text-purple-200 mb-2">🃏 怪物卡片收藏</div>
        <div className="flex gap-2 text-xs">
          <span className="bg-white/20 px-2 py-1 rounded-full">❤️ +{totalBonus.hp}</span>
          <span className="bg-white/20 px-2 py-1 rounded-full">⚔️ +{totalBonus.atk}</span>
          <span className="bg-white/20 px-2 py-1 rounded-full">🛡️ +{totalBonus.def}</span>
          <span className="bg-white/10 px-2 py-1 rounded-full ml-auto">裝備 {equipped.length}/{MAX_EQUIPPED_CARDS}</span>
        </div>
      </div>

      {/* 提示通知 */}
      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl px-4 py-2 text-emerald-300 font-bold text-sm text-center">
          {notice}
        </div>
      )}

      {/* 已裝備 */}
      {equipped.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">已裝備</div>
          <div className="flex flex-wrap gap-2">
            {equippedCards.map(card => {
              if (!card) return null;
              const cfg  = TIER_CARD_BONUS[card.tier] || TIER_CARD_BONUS.common;
              const stat = getCardStat(card);
              const val  = calcCardBonus(card.tier, card.stars);
              return (
                <button key={card.monsterId}
                  onClick={() => handleUnequip(card.monsterId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-bold active:scale-95 transition-transform"
                  style={{ borderColor: cfg.color, background: cfg.color + "1f", color: cfg.color }}>
                  <span>{card.icon}</span>
                  <span>{card.name}</span>
                  <span><StarRow stars={card.stars} /></span>
                  <span className="text-gray-300">+{val} {getStatLabel(stat)}</span>
                  <span className="text-gray-500 text-[10px]">✕</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 階級篩選 */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {TIERS.map(t => {
          const cfg = t === "all" ? { label: "全部", color: "#6b7280" } : (TIER_CARD_BONUS[t] || {});
          return (
            <button key={t} onClick={() => setFilterTier(t)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-black border transition-all"
              style={filterTier === t
                ? { background: cfg.color, color: "white", borderColor: cfg.color }
                : { background: "rgba(255,255,255,0.06)", color: cfg.color, borderColor: cfg.color + "80" }}>
              {cfg.label || t}
            </button>
          );
        })}
      </div>

      {/* 卡片列表（條列式）*/}
      {cardList.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-4xl mb-3">🃏</div>
          還沒有卡片，打怪有 1% 機率掉落！
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {cardList.map(card => {
            const cfg        = TIER_CARD_BONUS[card.tier] || TIER_CARD_BONUS.common;
            const isEquipped = equipped.includes(card.monsterId);
            const stat       = getCardStat(card);
            const bonus      = calcCardBonus(card.tier, card.stars);
            const canUp      = canUpgradeStar(card.stars, card.duplicates);
            const upCost     = getUpgradeCost(card.stars);
            const needMythicStat = card.tier === "mythic" && !card.chosenStat;
            const isSelected = selected === card.monsterId;

            return (
              <div key={card.monsterId}
                className="rounded-2xl border transition-all"
                style={{
                  borderColor: isEquipped ? cfg.color : cfg.color + "40",
                  background:  isEquipped ? cfg.color + "1a" : "rgba(255,255,255,0.05)",
                }}>
                {/* 主列 */}
                <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer active:opacity-80"
                  onClick={() => setSelected(isSelected ? null : card.monsterId)}>
                  <span className="text-2xl shrink-0">{card.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm truncate" style={{ color: isEquipped ? cfg.color : "#e2e8f0" }}>
                        {card.name}
                      </span>
                      {isEquipped && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white shrink-0"
                          style={{ background: cfg.color }}>裝備中</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0"
                        style={{ background: cfg.color }}>{cfg.label}</span>
                      <StarRow stars={card.stars} />
                      {needMythicStat
                        ? <span className="text-[10px] text-amber-400 font-bold">⚠️ 選屬性</span>
                        : <span className="text-[10px] text-slate-400">+{bonus} {getStatLabel(stat)}</span>
                      }
                      {canUp && (
                        <span className="text-[9px] text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-400/30">
                          ✨ 可升星
                        </span>
                      )}
                      {card.duplicates > 0 && (
                        <span className="text-[9px] text-slate-400">重複×{card.duplicates}</span>
                      )}
                    </div>
                  </div>
                  {/* 快速裝備/卸下 */}
                  {!needMythicStat && (
                    <div onClick={e => e.stopPropagation()}>
                      {isEquipped ? (
                        <button onClick={() => handleUnequip(card.monsterId)}
                          className="shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 active:scale-95 transition-transform"
                          style={{ color: cfg.color, border:`1px solid ${cfg.color}60` }}>
                          卸下
                        </button>
                      ) : (
                        <button onClick={() => handleEquip(card.monsterId)}
                          disabled={equipped.length >= MAX_EQUIPPED_CARDS}
                          className="shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-30 active:scale-95 transition-transform"
                          style={{ background: cfg.color }}>
                          裝備
                        </button>
                      )}
                    </div>
                  )}
                  <span className="text-slate-500 text-xs shrink-0">{isSelected ? "▲" : "▼"}</span>
                </div>

                {/* 展開詳情 */}
                {isSelected && (
                  <div className="flex flex-col gap-2 px-3 pb-3 pt-1 border-t"
                    style={{ borderColor: cfg.color + "30" }}
                    onClick={e => e.stopPropagation()}>

                    {/* Mythic 選屬性 */}
                    {needMythicStat && (
                      <div className="flex flex-col gap-1">
                        <div className="text-xs font-black text-amber-300">選擇加成屬性（一次性）</div>
                        <div className="flex gap-1.5">
                          {STAT_OPTIONS.map(s => (
                            <button key={s.id}
                              onClick={() => handleMythicStat(card.monsterId, s.id)}
                              className="flex-1 px-2 py-2 rounded-xl bg-amber-500/10 border border-amber-400/40 text-amber-300 text-xs font-bold text-center active:scale-95">
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 升星按鈕 */}
                    {(card.stars || 1) < 5 && (
                      <button
                        onClick={() => handleUpgrade(card.monsterId)}
                        disabled={!canUp || upgrading}
                        className="w-full py-2 rounded-xl text-xs font-black transition-all active:scale-95 disabled:opacity-40"
                        style={canUp ? { background: cfg.color, color: "white" } : { background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}>
                        {canUp
                          ? `✨ 升星（消耗 ${upCost} 張）→ ${(card.stars||1)+1}★`
                          : `升星需 ${upCost} 張重複（現有 ${card.duplicates || 0}）`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
