// src/components/member/cards/CardCollectionPrototype.jsx
// 卡片收藏「原型」容器：串接 catalog / collection / cardSeen 與各卡片元件。
// 不建立第二套全域狀態——collection 由 props 傳入（Codex 最後接線到 subscribeCardCollection）。
// 不替換現有 CardCollection.jsx。
//
// props:
//   memberId    : string
//   collection  : { cards:{[monsterId]}, wbCards:{[bossKey]}, equipped:[] }
//   onEquip?    : (view) => void
//   onUpgrade?  : (view) => void

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  CARD_CATALOG, FAMILIES, TIERS, matchL1, getGroup, mergeOwned,
} from "./cardCatalog";
import { FAMILY_STAT, canUpgradeStar, getCardStat, maxEquippedForStat, MAX_WB_EQUIPPED } from "../../../lib/monsterCards";
import { WB_CARDS } from "../../../lib/worldBossCards";
import { seedSeenIfFirstRun, isUnseen, markSeen, countUnseen } from "./cardSeen";
import CardFilterBar from "./CardFilterBar";
import CardGroupSection from "./CardGroupSection";
import CardMiniCell from "./CardMiniCell";
import CardDetailSheet from "./CardDetailSheet";
import TalentEffectPanel from "./TalentEffectPanel";
import { CARD_COLLECTION_MODES, selectAllFamilyTierGroups } from "./cardCollectionUi";

function getCardStatType(view) {
  const cardStat = getCardStat(view);
  if (cardStat) return cardStat;
  if (view.stat) return view.stat;
  if (view.chosenStat) return view.chosenStat;
  return FAMILY_STAT[view.family] || "atk";
}

// 世界王卡：從既有獨立來源衍生 view（不塞進怪物 catalog）
function wbViews(collection) {
  const owned = (collection && collection.wbCards) || {};
  return Object.entries(WB_CARDS || {}).map(([key, meta]) => {
    const has = !!owned[key];
    return {
      monsterId: `wb:${key}`, cardId: key, artKey: key,
      artSources: [`/cards/worldboss/${key}.webp`],
      availability: "existing", family: "worldboss", tier: "worldboss",
      encounter: "worldboss", role: "worldboss", source: "wb",
      name: (meta && meta.name) || "世界王卡",
      owned: has, stars: has ? (owned[key].stars || 1) : 0,
      duplicates: 0,
      // v2 世界王卡能力由 WB_CARDS 定義檔決定；舊收藏文件中的
      // stat/chosenStat 是 v1 遺留資料，不得覆蓋新版專屬被動。
      stat: null, chosenStat: null,
      statMode: meta?.statMode, title: meta?.title,
      version: meta?.version || 2,
      effects: meta?.effects || [],
      effectText: meta?.effectText || "",
      roleLabel: meta?.roleLabel || "戰術型",
      flavor: meta?.flavor || "",
      equipped: (collection?.equipped || []).some(item => typeof item !== "string" && item?.key === key && item?.source === "wb"),
      activeTitle: collection?.activeTitleBossKey === key,
    };
  });
}

const OWNED_KEYS_OF = collection => {
  const monster = Object.keys((collection && collection.cards) || {});
  const wb = Object.keys((collection && collection.wbCards) || {}).map(k => `wb:${k}`);
  return [...monster, ...wb];
};

function readSessionUi(memberId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(`card-collection-ui:${memberId || "guest"}`) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch { return {}; }
}

export default function CardCollectionPrototype({ memberId, collection = {}, collectionReady = true, onEquip, onUpgrade, onPickStat, onSetTitle }) {
  const initialUi = useMemo(() => readSessionUi(memberId), [memberId]);
  const [mode, setMode] = useState(() => CARD_COLLECTION_MODES.some(item => item.id === initialUi.mode) ? initialUi.mode : "deck");
  const [l1, setL1] = useState(() => initialUi.l1 || "all");
  // 預設全族/全 Tier：進頁先看「我的持有卡」彙總,點選族系×Tier 才進完整分組
  const [family, setFamily] = useState(() => initialUi.family || "");
  const [tier, setTier] = useState(() => initialUi.tier || TIERS[0]?.id || "");
  const [showUnowned, setShowUnowned] = useState(false);
  const [statFilter, setStatFilter] = useState("all"); // all | hp | atk | def
  const [ownedFilter, setOwnedFilter] = useState("all"); // all | owned | unowned
  const [upgradableOnly, setUpgradableOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [seenVersion, setSeenVersion] = useState(0); // markSeen 後 bump 觸發重算

  useEffect(() => {
    try { sessionStorage.setItem(`card-collection-ui:${memberId || "guest"}`, JSON.stringify({ mode, l1, family, tier })); } catch { /* unavailable */ }
  }, [memberId, mode, l1, family, tier]);

  // 首次 seed：把當下已持有卡標為已讀（寫入在 effect,不在 render）
  useEffect(() => {
    if (!memberId || !collectionReady) return;
    const ownedKeys = OWNED_KEYS_OF(collection);
    if (seedSeenIfFirstRun(memberId, ownedKeys)) setSeenVersion(v => v + 1);
  }, [memberId, collectionReady, collection]);

  const isNewFn = useCallback(
    view => !!(view.owned && memberId && isUnseen(memberId, view.monsterId)),
    [memberId, seenVersion],
  );

  const handleSeen = useCallback(monsterId => {
    if (!memberId) return;
    markSeen(memberId, monsterId);
    setSeenVersion(v => v + 1);
  }, [memberId]);

  // 篩選共用述詞
  const passExtra = useCallback(view => {
    if (statFilter && statFilter !== "all") {
      const st = getCardStatType(view);
      if (st !== statFilter) return false;
    }
    if (ownedFilter === "owned" && !view.owned) return false;
    if (ownedFilter === "unowned" && view.owned) return false;
    if (upgradableOnly && !(view.owned && canUpgradeStar(view.stars, view.duplicates, view.tier))) return false;
    if (newOnly && !isNewFn(view)) return false;
    return true;
  }, [statFilter, ownedFilter, upgradableOnly, newOnly, isNewFn]);

  // 各 L1 未讀數（owned + unseen）
  const l1Unread = useMemo(() => {
    const ownedIds = Object.keys((collection && collection.cards) || {});
    const unread = { all: 0, normal: 0, miniBoss: 0, bigBoss: 0, worldboss: 0 };
    ownedIds.forEach(id => {
      if (!isUnseen(memberId, id)) return;
      const entry = CARD_CATALOG.find(c => c.monsterId === id);
      if (!entry) return;
      unread.all += 1;
      if (entry.encounter === "normal") unread.normal += 1;
      else if (entry.encounter === "miniBoss") unread.miniBoss += 1;
      else if (entry.encounter === "boss") unread.bigBoss += 1;
    });
    const wbOwned = Object.keys((collection && collection.wbCards) || {});
    const wbUnread = countUnseen(memberId, wbOwned.map(k => `wb:${k}`));
    unread.worldboss = wbUnread; unread.all += wbUnread;
    return unread;
  }, [collection, memberId, seenVersion]);

  // ── 決定要渲染的分組（一次最多 6 張） ──
  const worldbossMode = l1 === "worldboss";
  const groupChosen = worldbossMode || Boolean(tier);

  const wbChunks = useMemo(() => {
    if (!worldbossMode) return [];
    const list = wbViews(collection).filter(passExtra);
    const chunks = [];
    for (let i = 0; i < list.length; i += 6) chunks.push(list.slice(i, i + 6));
    return chunks;
  }, [worldbossMode, collection, passExtra]);

  const monsterGroup = useMemo(() => {
    if (worldbossMode || !(family && tier)) return [];
    return getGroup(family, tier)
      .map(entry => mergeOwned(entry, collection))
      .filter(view => matchL1(view, l1))
      .filter(passExtra)
      .slice(0, 6);
  }, [worldbossMode, family, tier, l1, collection, passExtra]);

  const allFamilyGroups = useMemo(() => {
    if (worldbossMode || family || !tier) return [];
    const views = CARD_CATALOG
      .map(entry => mergeOwned(entry, collection))
      .filter(view => matchL1(view, l1))
      .filter(passExtra);
    return selectAllFamilyTierGroups(views, { tier, showUnowned });
  }, [worldbossMode, family, tier, l1, collection, passExtra, showUnowned]);

  const tierLabel = (TIERS.find(t => t.id === tier) || {}).label || "";
  const familyLabel = (FAMILIES.find(f => f.id === family) || {}).label || "";

  const chooseForSlot = slot => {
    setMode("catalog"); setOwnedFilter("all"); setShowUnowned(false); setUpgradableOnly(false); setNewOnly(false);
    setFamily(""); setTier(TIERS[0]?.id || "");
    if (slot === "wb") { setL1("worldboss"); setStatFilter("all"); }
    else { setL1("all"); setStatFilter(slot); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 12, paddingBottom: 32 }}>
      {/* 元件內嵌樣式：focus 樣式 + reduced-motion */}
      <style>{`
        .card-mini:focus-visible, .card-chip:focus-visible, .card-action:focus-visible, .card-sheet summary:focus-visible { outline: 3px solid #60a5fa; outline-offset: 2px; }
        .card-chip, .card-action, .card-mini { touch-action: manipulation; -webkit-tap-highlight-color: rgba(96,165,250,.2); }
        .card-chip:hover, .card-action:hover, .card-mini:hover { filter: brightness(1.12); }
        @media (prefers-reduced-motion: reduce) {
          .card-mini, .card-chip, .card-sheet { transition: none !important; animation: none !important; }
        }
      `}</style>

      <nav aria-label="卡片收藏模式" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,position:"sticky",top:0,zIndex:5,background:"#0b1220",padding:"6px 0"}}>
        {CARD_COLLECTION_MODES.map(item => <button key={item.id} type="button" data-card-mode={item.id} className="card-chip" aria-current={mode === item.id ? "page" : undefined} onClick={() => setMode(item.id)} style={{minHeight:44,padding:"10px 6px",borderRadius:12,border:`1px solid ${mode===item.id?"#818cf8":"rgba(255,255,255,.12)"}`,background:mode===item.id?"#4338ca":"rgba(255,255,255,.04)",color:"#fff",fontWeight:900}}>{item.label}</button>)}
      </nav>

      {/* 🎽 已裝備：HP / ATK / DEF / 世界王 四個獨立區塊，各自有上限（使用者拍板 2026-07-19）。
          分區塊而不是混在一起，是為了讓「哪一格還有空位」一眼看得出來 —— 之前 10 格混排，
          玩家根本不知道自己 HP 卡是不是裝滿了。 */}
      {mode === "deck" && (() => {
        const equippedItems = (collection?.equipped || []).map(item => typeof item === "string" ? { key: item, source: "monster" } : item);
        const views = equippedItems.map(item => {
          if (item.source === "wb") {
            const view = wbViews(collection).find(v => v.cardId === item.key);
            return view ? { ...view, _slot: "wb" } : null;
          }
          const entry = CARD_CATALOG.find(c => c.monsterId === item.key);
          if (!entry) return null;
          const merged = mergeOwned(entry, collection);
          return { ...merged, _slot: getCardStat(merged) };
        }).filter(Boolean);

        const SECTIONS = [
          { slot: "hp",  label: "❤️ HP",  color: "#6ee7b7", max: maxEquippedForStat("hp") },
          { slot: "atk", label: "⚔️ ATK", color: "#fdba74", max: maxEquippedForStat("atk") },
          { slot: "def", label: "🛡️ DEF", color: "#93c5fd", max: maxEquippedForStat("def") },
          { slot: "wb",  label: "👑 世界王", color: "#fcd34d", max: MAX_WB_EQUIPPED },
        ];

        return (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 900, color: "#6ee7b7", margin: 0 }}>🎽 裝備中</h3>
            {SECTIONS.map(sec => {
              const list = views.filter(v => v._slot === sec.slot);
              const full = list.length >= sec.max;
              return (
                <div key={sec.slot} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: sec.color }}>{sec.label}</span>
                    <span style={{ fontSize: 11, color: full ? "#fca5a5" : "#64748b" }}>
                      {list.length}/{sec.max}{full ? "（已滿）" : ""}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", maxWidth: 830, gap: 8 }}>
                    {list.map(view => <CardMiniCell key={`eq-${sec.slot}-${view.monsterId || view.cardId}`} view={view} onOpen={setSelected} />)}
                    {Array.from({ length:Math.max(0, sec.max - list.length) }, (_, index) => (
                      <button key={`empty-${sec.slot}-${index}`} type="button" className="card-chip" onClick={() => chooseForSlot(sec.slot)}
                        aria-label={`選擇 ${sec.slot === "wb" ? "世界王" : sec.slot.toUpperCase()} 卡片裝入第 ${list.length + index + 1} 格`}
                        style={{minHeight:96,borderRadius:12,border:"1px dashed rgba(148,163,184,.45)",background:"rgba(255,255,255,.025)",color:"#94a3b8",fontWeight:800,touchAction:"manipulation"}}>
                        <span aria-hidden="true" style={{display:"block",fontSize:22,marginBottom:4}}>＋</span>選擇卡片
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })()}

      {mode === "effects" && <section><h3 style={{color:"#e2e8f0",margin:"0 0 6px"}}>效果說明</h3><TalentEffectPanel collection={collection} /></section>}

      {mode === "catalog" && <CardFilterBar
        l1={l1} family={family} tier={tier} statFilter={statFilter} ownedFilter={ownedFilter}
        upgradableOnly={upgradableOnly} newOnly={newOnly} showUnowned={showUnowned} l1Unread={l1Unread}
        onL1={setL1} onFamily={value => {
          setFamily(value || "");
          if (!value) {
            setOwnedFilter("all");
            setShowUnowned(false);
          }
        }} onTier={setTier} onStatFilter={setStatFilter}
        onOwned={setOwnedFilter} onUpgradable={setUpgradableOnly} onNew={setNewOnly}
        onShowUnowned={setShowUnowned}
      />}

      {/* 世界王模式：分 6 張一組 */}
      {mode === "catalog" && worldbossMode && (
        wbChunks.length
          ? wbChunks.map((chunk, i) => (
              <CardGroupSection key={i} title={i === 0 ? "世界王卡" : ""} cards={chunk} isNewFn={isNewFn} onOpen={setSelected} />
            ))
          : <Empty text="沒有符合條件的世界王卡。" />
      )}

      {/* 怪物卡：單族顯示完整分組；全族只顯示單一 Tier，預設隱藏未取得。 */}
      {mode === "catalog" && !worldbossMode && (
        groupChosen
          ? (family
              ? (monsterGroup.length
                  ? <CardGroupSection title={`${familyLabel}族 · ${tierLabel}`} subtitle={`${monsterGroup.length}/6`} cards={monsterGroup} isNewFn={isNewFn} onOpen={setSelected} />
                  : <Empty text="此分組沒有符合條件的卡片。" />)
              : (allFamilyGroups.length
                  ? allFamilyGroups.map(group => {
                      const label = (FAMILIES.find(item => item.id === group.family) || {}).label || group.family;
                      return <CardGroupSection key={`${group.family}:${tier}`} title={`${label}族 · ${tierLabel}`} subtitle={`${group.cards.length}/6`} cards={group.cards} isNewFn={isNewFn} onOpen={setSelected} />;
                    })
                  : <Empty text="此 Tier 沒有符合條件的卡片。" />))
          : <Empty text="請先選擇 Tier。" />
      )}

      <CardDetailSheet
        view={selected}
        onClose={() => setSelected(null)}
        onSeen={handleSeen}
        onEquip={async view => { await onEquip?.(view); setSelected(null); setMode("deck"); requestAnimationFrame(() => document.querySelector('[data-card-mode="deck"]')?.focus()); }}
        onUpgrade={async view => { await onUpgrade?.(view); setSelected(null); }}
        onPickStat={async (view, stat) => { await onPickStat?.(view, stat); setSelected(null); }}
        onSetTitle={async view => { await onSetTitle?.(view); setSelected(null); }}
      />
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "#64748b", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🃏</div>
      {text}
    </div>
  );
}
