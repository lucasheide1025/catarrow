// src/components/member/CardCollection.jsx
// 怪物卡片 + 世界王卡片收藏、升星、裝備

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeCardCollection, equipCard, unequipCard, upgradeCard, setMythicCardStat,
  setWorldBossCardStat, setActiveTitle, clearActiveTitle,
} from "../../lib/db";
import {
  TIER_CARD_BONUS, calcCardBonus, canUpgradeStar, getUpgradeCost,
  getCardStat, getStatLabel, MAX_EQUIPPED_PER_STAT, MAX_WB_EQUIPPED,
} from "../../lib/monsterCards";
import { WB_CARDS } from "../../lib/worldBossCards";
import { FAMILIES, MONSTERS } from "../../lib/monsterData";
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

const MONSTER_MAP = Object.fromEntries(MONSTERS.map(m => [m.id, m]));

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

function normalizeWbCard(key, card = {}) {
  return {
    ...(WB_CARDS[key] || {}),
    ...card,
    key,
    source: "wb",
    bossKey: card.bossKey || key,
    tier: "worldboss",
    stars: card.stars || 1,
  };
}

function WorldBossArt({ card, className = "" }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = [`/cards/worldboss/${card.bossKey || card.key}.webp`, card.artPath].filter(Boolean);
  if (sourceIndex < sources.length) {
    return <img className={className} src={sources[sourceIndex]} alt={card.name || "世界王"} draggable="false" onError={() => setSourceIndex(index => index + 1)} />;
  }
  return <span className={className} style={{ display: "grid", placeItems: "center", fontSize: 42 }}>{card.icon || "👑"}</span>;
}

function WorldBossRealCard({ card, equipped, selected, compact = false, activeTitle, onSelect, onEquip, onUnequip, onSetTitle, onPickStat }) {
  const stat = getCardStat(card);
  const bonus = calcCardBonus(card.tier, card.stars);
  const needStat = card.statMode === "choose" && !card.chosenStat;
  const frame = card.frameColor || "#facc15";
  const bg = card.bgColor || "#1c1917";

  return (
    <div
      className={`wb-real-card ${equipped ? "equipped" : ""} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      style={{ "--wb-frame": frame, "--wb-bg": bg }}
      onClick={onSelect}
    >
      <div className="wb-card-top">
        <span>{card.serial || "WB-000"}</span>
        <b>{card.rarity || "WORLD"}</b>
      </div>
      <div className="wb-card-art">
        <WorldBossArt card={card} className="wb-card-img" />
      </div>
      <div className="wb-card-name">
        <b>{card.name}</b>
        <span>{card.title}</span>
      </div>
      <div className="wb-card-statline">
        <span>{card.typeLabel || "世界王"}</span>
        <b>{needStat ? "待設定" : `+${bonus} ${getStatLabel(stat)}`}</b>
      </div>
      {!compact && (
        <>
          <div className="wb-card-params">
            <span>HP {Number(card.hp || 0).toLocaleString()}</span>
            <span>ATK {card.atk || 0}</span>
            <span>DEF {card.def || 0}</span>
          </div>
          <div className="wb-card-effect">{needStat ? "裝備前選擇此卡的戰鬥定位。" : card.effectText}</div>
          <div className="wb-card-lore">{card.lore || card.flavor}</div>
        </>
      )}
      {equipped && <div className="wb-card-equipped">裝備中{activeTitle ? " · 稱號" : ""}</div>}
    </div>
  );
}

function MonsterArt({ card, className = "" }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const id = card.key || card.monsterId;
  const sources = [`/cards/monsters/${id}.webp`, `/monsters/${id}.webp`];
  if (sourceIndex < sources.length) {
    return <img className={className} src={sources[sourceIndex]} alt={card.name || "怪物"} draggable="false" onError={() => setSourceIndex(index => index + 1)} />;
  }
  return <span className={className} style={{ display: "grid", placeItems: "center", fontSize: 38 }}>{card.icon || "🃏"}</span>;
}

function MonsterRealCard({ card, equipped, selected, compact = false, onSelect, onEquip, onUnequip, onUpgrade, onPickStat, upgrading }) {
  const cfg = TIER_CARD_BONUS[card.tier] || TIER_CARD_BONUS.common;
  const monster = MONSTER_MAP[card.key] || {};
  const family = FAMILIES[card.family || monster.family] || {};
  const stat = getCardStat(card);
  const bonus = calcCardBonus(card.tier, card.stars);
  const canUp = canUpgradeStar(card.stars, card.duplicates, card.tier);
  const upCost = getUpgradeCost(card.stars);
  const needStat = card.tier === "mythic" && !card.chosenStat;

  return (
    <div
      className={`monster-real-card ${equipped ? "equipped" : ""} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      style={{ "--card-frame": cfg.color, "--card-bg": cfg.bg || "#f8fafc" }}
      onClick={onSelect}
    >
      <div className="monster-card-top">
        <span>{family.icon || card.icon} {family.label || "怪物"}</span>
        <b>{cfg.label}</b>
      </div>
      <div className="monster-card-art">
        <MonsterArt card={card} className="monster-card-img" />
      </div>
      <div className="monster-card-name">
        <b>{card.name}</b>
        <StarRow stars={card.stars} />
      </div>
      <div className="monster-card-statline">
        <span>{needStat ? "待設定屬性" : `+${bonus} ${getStatLabel(stat)}`}</span>
        <b>重複 {card.duplicates || 0}</b>
      </div>
      {!compact && (
        <>
          <div className="monster-card-params">
            <span>HP {monster.hp || "-"}</span>
            <span>ATK {monster.atk || "-"}</span>
            <span>DEF {monster.def || "-"}</span>
          </div>
          <div className="monster-card-lore">{monster.desc || card.desc || "從怪物戰鬥中取得的收藏卡。"}</div>
        </>
      )}
      {equipped && <div className="monster-card-equipped">裝備中</div>}
    </div>
  );
}

export default function CardCollection() {
  const { profile } = useAuth();
  const [collection, setCollection] = useState({ cards: {}, wbCards: {}, equipped: [] });
  const [selected,   setSelected]   = useState(null); // "source:key"
  const [upgrading,  setUpgrading]  = useState(false);
  const [notice,     setNotice]     = useState("");
  const [filterCat,  setFilterCat]  = useState("all");
  const actionBarRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeCardCollection(profile.id, setCollection);
    return unsub;
  }, [profile?.id]); // eslint-disable-line

  // 點卡片後把底部動作列捲進畫面（block:"nearest" 避免整頁亂捲）
  useEffect(() => {
    if (selected && actionBarRef.current) {
      actionBarRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

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
    ...Object.entries(wbCards).map(([id, c]) => normalizeWbCard(id, c)),
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
    .map(e => normalizeWbCard(e.key, wbCards[e.key])).filter(c => c.name);

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

  const selectedCard = selected ? allCards.find(c => `${c.source}:${c.key}` === selected) : null;

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
              return (
                <MonsterRealCard
                  key={i}
                  card={card}
                  equipped
                  compact
                  onSelect={() => handleUnequip(card.key, "monster")}
                />
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
              <WorldBossRealCard
                key={i}
                card={card}
                equipped
                compact
                activeTitle={isTitle}
                onSelect={() => handleUnequip(card.key, "wb")}
              />
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
            const equipped_  = isEquipped(card.key, card.source);
            const selKey     = `${card.source}:${card.key}`;
            const isSelected = selected === selKey;
            const isWb       = card.source === "wb";

            if (isWb) {
              return (
                <WorldBossRealCard
                  key={selKey}
                  card={card}
                  equipped={equipped_}
                  selected={isSelected}
                  activeTitle={activeTitleBossKey === card.key}
                  onSelect={() => setSelected(isSelected ? null : selKey)}
                  onEquip={() => handleEquip(card.key, "wb")}
                  onUnequip={() => handleUnequip(card.key, "wb")}
                  onSetTitle={() => handleSetTitle(card.key)}
                  onPickStat={stat => handleStatPick(card.key, "wb", stat)}
                />
              );
            }
            return (
              <MonsterRealCard
                key={selKey}
                card={card}
                equipped={equipped_}
                selected={isSelected}
                onSelect={() => setSelected(isSelected ? null : selKey)}
                onEquip={() => handleEquip(card.key, "monster")}
                onUnequip={() => handleUnequip(card.key, "monster")}
                onUpgrade={() => handleUpgrade(card.key)}
                onPickStat={stat => handleStatPick(card.key, "monster", stat)}
                upgrading={upgrading}
              />
            );
          })}
        </div>
      )}

      {/* 底部動作列：點卡片後在這裡出現大顆的裝備/卸下/設為稱號/升星按鈕 */}
      {selectedCard && (() => {
        const sc = selectedCard;
        const isWbSel = sc.source === "wb";
        const equippedSel = isEquipped(sc.key, sc.source);
        const needStatSel = isWbSel ? (sc.statMode === "choose" && !sc.chosenStat) : (sc.tier === "mythic" && !sc.chosenStat);
        const isTitleSel = isWbSel && activeTitleBossKey === sc.key;
        const canUpSel = !isWbSel && canUpgradeStar(sc.stars, sc.duplicates, sc.tier);
        const upCostSel = getUpgradeCost(sc.stars);
        const btn = "flex-1 min-w-[92px] py-3 rounded-xl font-black text-sm border";
        return (
          <div ref={actionBarRef} className="rounded-2xl p-3 flex flex-col gap-2"
            style={{ background:"rgba(15,23,42,0.96)", border:"1px solid rgba(255,255,255,0.14)", boxShadow:"0 -6px 24px rgba(0,0,0,0.45)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-white font-black text-sm truncate">{isWbSel ? "👑 " : ""}{sc.name}</div>
                <div className="text-slate-400 text-[11px]">
                  {equippedSel ? "裝備中" : "未裝備"}{!isWbSel ? ` · 重複 ${sc.duplicates || 0}` : ""}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 text-lg px-2 flex-shrink-0">✕</button>
            </div>
            {needStatSel ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-slate-400 text-[11px]">裝備前先選擇這張卡的戰鬥定位：</div>
                <div className="flex gap-2">
                  {STAT_OPTIONS.map(s => (
                    <button key={s.id} className={`${btn} bg-indigo-500/25 text-indigo-200 border-indigo-400/40`}
                      onClick={() => handleStatPick(sc.key, sc.source, s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {equippedSel ? (
                  <button className={`${btn} bg-rose-500/20 text-rose-200 border-rose-400/40`}
                    onClick={() => handleUnequip(sc.key, sc.source)}>卸下</button>
                ) : (
                  <button className={`${btn} bg-emerald-500/25 text-emerald-100 border-emerald-400/40`}
                    onClick={() => handleEquip(sc.key, sc.source)}>裝備</button>
                )}
                {isWbSel && equippedSel && !isTitleSel && (
                  <button className={`${btn} bg-amber-500/25 text-amber-100 border-amber-400/40`}
                    onClick={() => handleSetTitle(sc.key)}>設為稱號</button>
                )}
                {canUpSel && (
                  <button disabled={upgrading} className={`${btn} bg-yellow-500/20 text-yellow-100 border-yellow-400/40 disabled:opacity-50`}
                    onClick={() => handleUpgrade(sc.key)}>升星（{upCostSel}張）</button>
                )}
                {!isWbSel && !canUpSel && (sc.stars || 1) < 5 && (
                  <div className="w-full text-slate-400 text-[11px] text-center pt-1">升星需 {upCostSel} 張重複卡</div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <style>{`
        .monster-real-card,
        .wb-real-card {
          position: relative;
          min-width: 0;
          aspect-ratio: 2.5 / 3.55;
          border-radius: 14px;
          padding: 8px;
          overflow: hidden;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(0,0,0,.28);
          transition: transform .16s ease, filter .16s ease, box-shadow .16s ease;
        }
        .monster-real-card {
          color: #f1f5f9;
          border: 3px solid var(--card-frame);
          background:
            radial-gradient(circle at 30% 12%, rgba(255,255,255,.10), transparent 34%),
            linear-gradient(155deg, #1e293b, #0f172a 55%, #020617);
        }
        .wb-real-card {
          color: #fff7ed;
          border: 3px solid var(--wb-frame);
          background:
            radial-gradient(circle at 30% 12%, rgba(250,204,21,.22), transparent 34%),
            linear-gradient(145deg, var(--wb-bg), #111827 46%, #030712);
        }
        .monster-real-card.selected,
        .wb-real-card.selected,
        .monster-real-card.equipped,
        .wb-real-card.equipped {
          transform: translateY(-2px);
          box-shadow: 0 18px 38px rgba(0,0,0,.36);
        }
        .wb-real-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(120deg, transparent, rgba(255,255,255,.34), transparent);
          background-size: 300% 300%;
          animation: wbHoloShift 3s ease infinite;
          pointer-events: none;
        }
        .monster-card-top,
        .wb-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          min-height: 18px;
          font-size: 8px;
          font-weight: 950;
          letter-spacing: .02em;
          position: relative;
          z-index: 1;
        }
        .monster-card-top b,
        .wb-card-top b {
          padding: 2px 5px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .monster-card-top b {
          background: var(--card-frame);
          color: white;
        }
        .wb-card-top b {
          background: rgba(250,204,21,.22);
          color: #fde68a;
          border: 1px solid rgba(250,204,21,.45);
        }
        .monster-card-art,
        .wb-card-art {
          height: 34%;
          margin: 6px 0;
          border-radius: 10px;
          display: grid;
          place-items: center;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }
        .monster-card-art {
          background: radial-gradient(circle, rgba(255,255,255,.14), rgba(0,0,0,.3));
          border: 1px solid rgba(255,255,255,.14);
        }
        .wb-card-art {
          background: radial-gradient(circle, rgba(255,255,255,.18), rgba(0,0,0,.28));
          border: 1px solid rgba(255,255,255,.2);
        }
        .monster-card-img,
        .wb-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 46%;
          filter: drop-shadow(0 8px 10px rgba(0,0,0,.28));
        }
        .monster-card-name,
        .wb-card-name {
          min-height: 34px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 1px;
          position: relative;
          z-index: 1;
        }
        .monster-card-name b,
        .wb-card-name b {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          line-height: 1.15;
        }
        .wb-card-name span {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #fde68a;
          font-size: 9px;
          font-weight: 900;
        }
        .monster-card-statline,
        .wb-card-statline,
        .monster-card-params,
        .wb-card-params {
          display: flex;
          justify-content: space-between;
          gap: 4px;
          position: relative;
          z-index: 1;
        }
        .monster-card-statline,
        .wb-card-statline {
          margin-top: 4px;
          padding: 5px 6px;
          border-radius: 8px;
          font-size: 9px;
          font-weight: 950;
        }
        .monster-card-statline {
          color: #e2e8f0;
          background: rgba(0,0,0,.3);
          border: 1px solid rgba(255,255,255,.1);
        }
        .wb-card-statline {
          color: #fef3c7;
          background: rgba(0,0,0,.28);
          border: 1px solid rgba(255,255,255,.12);
        }
        .monster-card-params,
        .wb-card-params {
          margin-top: 5px;
          font-size: 8px;
          font-weight: 900;
          opacity: .86;
        }
        .monster-card-lore,
        .wb-card-lore,
        .wb-card-effect {
          position: relative;
          z-index: 1;
          margin-top: 5px;
          border-radius: 8px;
          padding: 6px;
          font-size: 9px;
          line-height: 1.35;
        }
        .monster-card-lore {
          color: rgba(226,232,240,.8);
          background: rgba(0,0,0,.24);
        }
        .wb-card-effect {
          color: #fde68a;
          background: rgba(250,204,21,.12);
          border: 1px solid rgba(250,204,21,.22);
          font-weight: 900;
          text-align: center;
        }
        .wb-card-lore {
          color: rgba(255,247,237,.72);
          background: rgba(0,0,0,.22);
        }
        .monster-card-equipped,
        .wb-card-equipped {
          position: absolute;
          right: 8px;
          bottom: 8px;
          z-index: 2;
          padding: 3px 6px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 950;
        }
        .monster-card-equipped {
          color: #6ee7b7;
          background: rgba(16,185,129,.22);
          border: 1px solid rgba(16,185,129,.35);
        }
        .wb-card-equipped {
          color: #fde68a;
          background: rgba(0,0,0,.48);
          border: 1px solid rgba(250,204,21,.3);
        }
        .monster-card-actions,
        .wb-card-actions {
          position: relative;
          z-index: 3;
          display: grid;
          gap: 6px;
          grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
          margin-top: 7px;
        }
        .monster-card-actions button,
        .wb-card-actions button {
          min-height: 28px;
          border: 0;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
        }
        .monster-card-actions button {
          color: white;
          background: var(--card-frame);
        }
        .wb-card-actions button {
          color: #111827;
          background: #facc15;
        }
        .monster-card-upgrade-note {
          grid-column: 1 / -1;
          color: rgba(226,232,240,.68);
          text-align: center;
          font-size: 9px;
          font-weight: 800;
        }
        .monster-real-card.compact,
        .wb-real-card.compact {
          padding: 6px;
          border-width: 2px;
        }
        .monster-real-card.compact .monster-card-art,
        .wb-real-card.compact .wb-card-art {
          height: 45%;
          margin: 4px 0;
        }
        .monster-real-card.compact .monster-card-statline,
        .wb-real-card.compact .wb-card-statline,
        .monster-real-card.compact .monster-card-params,
        .wb-real-card.compact .wb-card-params,
        .monster-real-card.compact .monster-card-lore,
        .wb-real-card.compact .wb-card-lore,
        .wb-real-card.compact .wb-card-effect,
        .monster-real-card.compact .monster-card-equipped,
        .wb-real-card.compact .wb-card-equipped {
          display: none;
        }
        @keyframes wbHoloShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .wb-real-card::before { animation: none; }
        }
        @media (max-width: 380px) {
          .monster-real-card,
          .wb-real-card {
            padding: 7px;
          }
          .monster-card-name b,
          .wb-card-name b {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
