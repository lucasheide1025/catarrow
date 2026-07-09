// src/components/member/CardCollection.jsx
// 怪物卡片 + 世界王卡片收藏、升星、裝備

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeCardCollection, equipCard, unequipCard, upgradeCard, setMythicCardStat,
  setWorldBossCardStat, setActiveTitle, clearActiveTitle,
} from "../../lib/db";
import {
  TIER_CARD_BONUS, calcCardBonus, canUpgradeStar, getUpgradeCost,
  getCardStat, getStatLabel, MAX_EQUIPPED_PER_STAT, MAX_WB_EQUIPPED,
} from "../../lib/monsterCards";
import { sfxLevelUp, sfxBuff, sfxError } from "../../lib/sound";

const STAT_OPTIONS = [
  { id: "hp",  label: "HP ❤️",  desc: "增加血量" },
  { id: "atk", label: "ATK ⚔️", desc: "增加攻擊" },
  { id: "def", label: "DEF 🛡️", desc: "增加防禦" },
];

const CATEGORY_TABS = [
  { id: "all", label: "全部" },
  { id: "hp",  label: "HP ❤️" },
  { id: "atk", label: "ATK ⚔️" },
  { id: "def", label: "DEF 🛡️" },
  { id: "wb",  label: "世界王 👑" },
];

function StarRow({ stars, max = 5 }) {
  return (
    <span className="text-yellow-400 text-xs">
      {"★".repeat(stars || 1)}{"☆".repeat(max - (stars || 1))}
    </span>
  );
}

// equipped 相容讀取：舊格式字串 / 新格式 {key,source}
function normalizeEquipped(item) {
  return typeof item === "string" ? { key: item, source: "monster" } : item;
}

export default function CardCollection() {
  const { profile } = useAuth();
  const [collection, setCollection] = useState({ cards: {}, wbCards: {}, equipped: [] });
  const [selected,   setSelected]   = useState(null); // "source:key"
  const [upgrading,  setUpgrading]  = useState(false);
  const [notice,     setNotice]     = useState("");
  const [filterCat,  setFilterCat]  = useState("all");

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeCardCollection(profile.id, setCollection);
    return unsub;
  }, [profile?.id]); // eslint-disable-line

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2500);
  }

  async function handleEquip(key, source) {
    const res = await equipCard(profile.id, key, source);
    if (!res.ok) showNotice(res.reason || "裝備失敗");
  }
  async function handleUnequip(key, source) {
    await unequipCard(profile.id, key, source);
  }
  async function handleUpgrade(monsterId) {
    setUpgrading(true);
    const res = await upgradeCard(profile.id, monsterId);
    setUpgrading(false);
    if (res.ok) { sfxLevelUp(); showNotice(`✨ 升星成功！現在 ${res.newStars}★`); }
    else { sfxError(); showNotice(res.reason || "升星失敗"); }
  }
  async function handleStatPick(key, source, stat) {
    if (source === "wb") await setWorldBossCardStat(profile.id, key, stat);
    else await setMythicCardStat(profile.id, key, stat);
    sfxBuff();
    showNotice("✅ 屬性已設定！");
  }
  async function handleSetTitle(bossKey) {
    const res = await setActiveTitle(profile.id, bossKey);
    if (res.ok) showNotice("👑 稱號已設定！");
    else showNotice(res.reason || "設定失敗");
  }
  async function handleClearTitle() {
    await clearActiveTitle(profile.id);
    showNotice("已取消稱號");
  }

  const cards    = collection.cards   || {};
  const wbCards  = collection.wbCards || {};
  const equipped = (collection.equipped || []).map(normalizeEquipped);
  const activeTitleBossKey = collection.activeTitleBossKey || null;

  const isEquipped = (key, source) => equipped.some(e => e.key === key && e.source === source);

  // 合併卡片清單（怪物卡 + 世界王卡）
  const allCards = [
    ...Object.entries(cards).map(([id, c]) => ({ ...c, key: id, source: "monster" })),
    ...Object.entries(wbCards).map(([id, c]) => ({ ...c, key: id, source: "wb" })),
  ];

  const cardList = allCards
    .filter(c => {
      if (filterCat === "all") return true;
      if (filterCat === "wb")  return c.source === "wb";
      return getCardStat(c) === filterCat;
    })
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "wb" ? -1 : 1;
      const tierOrder = ["worldboss","mythic","boss","fierce","elite","rare","common"];
      return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier);
    });

  // 已裝備：怪物卡依 HP/ATK/DEF 分三欄，世界王卡獨立一列
  const equippedMonster = equipped.filter(e => e.source === "monster")
    .map(e => ({ ...cards[e.key], key: e.key, source: "monster" })).filter(c => c.name);
  const equippedWb = equipped.filter(e => e.source === "wb")
    .map(e => ({ ...wbCards[e.key], key: e.key, source: "wb" })).filter(c => c.name);

  const equipSlots = { hp: [], atk: [], def: [] };
  for (const c of equippedMonster) {
    const stat = getCardStat(c);
    if (equipSlots[stat]) equipSlots[stat].push(c);
  }

  const totalBonus = [...equippedMonster, ...equippedWb].reduce((acc, card) => {
    const stat = getCardStat(card);
    acc[stat] = (acc[stat] || 0) + calcCardBonus(card.tier, card.stars);
    return acc;
  }, { hp: 0, atk: 0, def: 0 });

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      {/* 標題 & 加成總覽 */}
      <div className="rounded-2xl p-4 text-white" style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
        <div className="text-xs font-black tracking-widest text-purple-200 mb-2">🃏 卡片收藏</div>
        <div className="flex gap-2 text-xs flex-wrap">
          <span className="bg-white/20 px-2 py-1 rounded-full">❤️ +{totalBonus.hp}</span>
          <span className="bg-white/20 px-2 py-1 rounded-full">⚔️ +{totalBonus.atk}</span>
          <span className="bg-white/20 px-2 py-1 rounded-full">🛡️ +{totalBonus.def}</span>
        </div>
        {activeTitleBossKey && wbCards[activeTitleBossKey] && (
          <div className="mt-2 text-xs bg-amber-400/20 border border-amber-300/40 text-amber-200 rounded-full px-3 py-1 inline-flex items-center gap-1.5 font-bold">
            👑 稱號中：{wbCards[activeTitleBossKey].title}
            <button onClick={handleClearTitle} className="text-amber-300/70 hover:text-amber-200">✕</button>
          </div>
        )}
      </div>

      {/* 提示通知 */}
      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl px-4 py-2 text-emerald-300 font-bold text-sm text-center">
          {notice}
        </div>
      )}

      {/* 已裝備：怪物卡三欄 HP/ATK/DEF */}
      <div className="grid grid-cols-3 gap-2">
        {["hp", "atk", "def"].map(stat => (
          <div key={stat} className="flex flex-col gap-1.5">
            <div className="text-[10px] font-black text-gray-400 text-center">
              {getStatLabel(stat)} {equipSlots[stat].length}/{MAX_EQUIPPED_PER_STAT}
            </div>
            {Array.from({ length: MAX_EQUIPPED_PER_STAT }).map((_, i) => {
              const card = equipSlots[stat][i];
              if (!card) {
                return <div key={i} className="aspect-[3/4] rounded-xl border border-dashed border-white/15 bg-white/[0.02]" />;
              }
              const cfg = TIER_CARD_BONUS[card.tier] || TIER_CARD_BONUS.common;
              return (
                <button key={i} onClick={() => handleUnequip(card.key, "monster")}
                  className="aspect-[3/4] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
                  style={{ borderColor: cfg.color, background: cfg.color + "1f" }}>
                  <span className="text-lg">{card.icon}</span>
                  <span className="text-[9px] font-bold truncate max-w-full px-1" style={{ color: cfg.color }}>{card.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 已裝備：世界王卡獨立欄位 */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] font-black text-amber-300">👑 世界王卡 {equippedWb.length}/{MAX_WB_EQUIPPED}</div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: MAX_WB_EQUIPPED }).map((_, i) => {
            const card = equippedWb[i];
            if (!card) {
              return <div key={i} className="aspect-[3/4] rounded-xl border border-dashed border-amber-400/25 bg-amber-400/[0.03]" />;
            }
            const isTitle = activeTitleBossKey === card.key;
            return (
              <div key={i} className="wb-holo-card aspect-[3/4] rounded-xl p-1.5 flex flex-col items-center justify-between relative">
                {isTitle && <span className="absolute top-1 right-1 text-[10px]">👑</span>}
                <span className="text-lg mt-1">{card.icon}</span>
                <span className="text-[9px] font-bold text-amber-100 truncate max-w-full px-1">{card.name}</span>
                <div className="flex gap-1 w-full">
                  <button onClick={() => handleUnequip(card.key, "wb")}
                    className="flex-1 text-[8px] font-bold py-0.5 rounded bg-white/10 text-white/80">卸下</button>
                  {!isTitle && (
                    <button onClick={() => handleSetTitle(card.key)}
                      className="flex-1 text-[8px] font-bold py-0.5 rounded bg-amber-400/20 text-amber-200">設稱號</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 分類籤 */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORY_TABS.map(t => (
          <button key={t.id} onClick={() => setFilterCat(t.id)}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-black border transition-all"
            style={filterCat === t.id
              ? { background: t.id === "wb" ? "#facc15" : "#6366f1", color: "white", borderColor: t.id === "wb" ? "#facc15" : "#6366f1" }
              : { background: "rgba(255,255,255,0.06)", color: "#94a3b8", borderColor: "rgba(255,255,255,0.15)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 卡片九宮格 */}
      {cardList.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          <div className="text-4xl mb-3">🃏</div>
          還沒有卡片，打怪有機率掉落！
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {cardList.map(card => {
            const cfg        = TIER_CARD_BONUS[card.tier] || TIER_CARD_BONUS.common;
            const equipped_  = isEquipped(card.key, card.source);
            const stat       = getCardStat(card);
            const bonus      = calcCardBonus(card.tier, card.stars);
            const canUp      = canUpgradeStar(card.stars, card.duplicates, card.tier);
            const upCost     = getUpgradeCost(card.stars);
            const needStat   = (card.tier === "mythic" && !card.chosenStat) ||
                                (card.source === "wb" && card.statMode === "choose" && !card.chosenStat);
            const selKey     = `${card.source}:${card.key}`;
            const isSelected = selected === selKey;
            const isWb       = card.source === "wb";

            return (
              <div key={selKey}
                className={`rounded-xl border-2 overflow-hidden flex flex-col ${isWb ? "wb-holo-card" : ""}`}
                style={isWb ? {} : {
                  borderColor: equipped_ ? cfg.color : cfg.color + "40",
                  background:  equipped_ ? cfg.color + "1a" : "rgba(255,255,255,0.05)",
                }}
                onClick={() => setSelected(isSelected ? null : selKey)}>
                <div className="aspect-square flex flex-col items-center justify-center gap-1 p-2 cursor-pointer">
                  <span className="text-3xl">{card.icon}</span>
                  <span className={`text-[10px] font-black text-center truncate max-w-full ${isWb ? "text-amber-100" : ""}`}
                    style={isWb ? {} : { color: equipped_ ? cfg.color : "#e2e8f0" }}>
                    {card.name}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ background: isWb ? "#facc15" : cfg.color }}>{isWb ? "世界王" : cfg.label}</span>
                  {!isWb && <StarRow stars={card.stars} />}
                  {equipped_ && <span className="text-[8px] font-black text-emerald-300">✓ 裝備中</span>}
                </div>

                {isSelected && (
                  <div className="flex flex-col gap-1.5 px-2 pb-2 pt-1 border-t border-white/10" onClick={e => e.stopPropagation()}>
                    {isWb && card.flavor && (
                      <div className="text-[9px] italic text-amber-200/70 text-center">「{card.flavor}」</div>
                    )}
                    {needStat ? (
                      <div className="flex flex-col gap-1">
                        <div className="text-[9px] font-black text-amber-300 text-center">選擇加成屬性</div>
                        <div className="flex gap-1">
                          {STAT_OPTIONS.map(s => (
                            <button key={s.id}
                              onClick={() => handleStatPick(card.key, card.source, s.id)}
                              className="flex-1 px-1 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-300 text-[9px] font-bold text-center active:scale-95">
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-[9px] text-center text-slate-300">+{bonus} {getStatLabel(stat)}</div>
                        {equipped_ ? (
                          <button onClick={() => handleUnequip(card.key, card.source)}
                            className="w-full py-1.5 rounded-lg text-[10px] font-bold bg-white/10 text-slate-300">卸下</button>
                        ) : (
                          <button onClick={() => handleEquip(card.key, card.source)}
                            className="w-full py-1.5 rounded-lg text-[10px] font-bold text-white"
                            style={{ background: isWb ? "#facc15" : cfg.color }}>裝備</button>
                        )}
                        {canUp && (
                          <button onClick={() => handleUpgrade(card.key)} disabled={upgrading}
                            className="w-full py-1.5 rounded-lg text-[10px] font-black text-white disabled:opacity-40"
                            style={{ background: cfg.color }}>
                            ✨ 升星（{upCost}張）
                          </button>
                        )}
                        {!isWb && !canUp && (card.stars || 1) < 5 && (
                          <div className="text-[8px] text-center text-slate-500">升星需 {upCost} 張重複（現有 {card.duplicates || 0}）</div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .wb-holo-card {
          background: linear-gradient(135deg, #78350f, #451a03 40%, #1c1917);
          border: 2px solid transparent;
          background-clip: padding-box;
          position: relative;
        }
        .wb-holo-card::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          padding: 2px;
          background: linear-gradient(120deg, #facc15, #f59e0b, #fde68a, #facc15);
          background-size: 300% 300%;
          animation: wbHoloShift 3s ease infinite;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          z-index: 0;
        }
        @keyframes wbHoloShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wb-holo-card::before { animation: none; }
        }
      `}</style>
    </div>
  );
}
