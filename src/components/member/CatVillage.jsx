// src/components/member/CatVillage.jsx
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  collectVillageResources, upgradeVillageBuilding, initVillageIfNeeded,
  exchangeVillageMaterial, exchangeMaterialsForChest,
  subscribeCardMarket, listCardForSale, buyCardListing, cancelCardListing,
  subscribeVillageMarketConfig,
} from "../../lib/db";
import { CAT_CARD_MAP } from "../../lib/catCardData";
import { subscribeMyCats, upgradeCatEquip } from "../../lib/catDb";
import {
  CATS, getBondLevel,
  CAT_EQUIP_SLOTS, CAT_EQUIP_GRADE_NAMES, CAT_EQUIP_GRADE_COLORS, CAT_EQUIP_GRADE_BG,
  CAT_EQUIP_MAX_PLUS, calcForgeCost, catEquipLevel,
} from "../../lib/catData";
import { catLevelFromXP } from "../../lib/catLevel";
import { sfxSuccess, sfxEpic, sfxTap, sfxVillageCollect, sfxVillageBuild, sfxVillageExchange } from "../../lib/sound";
import {
  BUILDINGS, BUILDING_LIST, getVillageLevel, getBuildingStage,
  getProductionRate, getUpgradeRequirements, canUpgrade,
  calcPendingResources, RESOURCE_NAMES, DEFAULT_VILLAGE,
  UNLOCK_REQS, isBuildingUnlocked, TIERED_RESOURCES, getResourceKey,
} from "../../lib/villageData";
import GachaMachine from "./GachaMachine";
import CouncilHall  from "./CouncilHall";

// 手繪風配色常數
const C = {
  bg:       "linear-gradient(180deg,#FDF6EC,#F0E8D8)",
  card:     "rgba(255,255,255,0.88)",
  border:   "#E0CDB5",
  brown:    "#5C3D2E",
  mid:      "#9B7B6A",
  muted:    "#C4A899",
  sage:     "#6B8E5E",
  lock:     "rgba(218,205,190,0.45)",
  lockBd:   "#D8C4B0",
  shadow:   "0 2px 8px rgba(100,70,50,0.10)",
};

const CAT_DAILY_QUOTES = {
  daming:   ["今天要好好守護這個村莊！","你放心，老大我看著呢。","別偷懶，繼續採集！","村莊就交給我了，你去打怪吧。"],
  gege:     ["早安！今天也一起加油喔！","有我在，什麼都不怕。","你最近進步很多喔。","來，先深呼吸，再出發。"],
  meimei:   ["今天也有很多箭要射！","快快快，趕快去採集！","我剛剛看到一個大寶箱！","今天的天氣超適合升級！"],
  niuniu:   ["規則就是規則，不能破例。","升級需求都確認過了嗎？","按照計畫走，不要亂。","效率，效率，還是效率。"],
  haji:     ["……（瞌睡中）zZ","夢裡有好多魚乾……","等等，我再睡一下下。","箭場的風，最適合午睡了。"],
  baobao:   ["你回來啦！我好想你！","弓袋裡好暖，能抱一下嗎？","今天要一起去採集嗎？","村莊有我陪，不孤單喔！"],
  youyou:   ["慢慢走，才能看清楚路。","我看過了，這棟建築還能再升。","一步一步，終會到達頂點。","不用急，今天的任務剛剛好。"],
  xiaoan:   ["（有一點點緊張……）","我、我會努力的！我不怕！","嚇了一跳，但還是繼續吧！","只要一起，就不害怕了。"],
  diandian: ["村莊的靈氣今天特別旺……","我看見了什麼，但說不出口。","箭露在流動，感覺到了嗎？","黑夜裡，最清楚前路。"],
};

// ── 秘書貓 Header ─────────────────────────────────────────────
function SecretaryCat({ cat }) {
  const catInfo = cat ? CATS[cat.catId] : null;
  if (!catInfo) return null;
  const bondLv = getBondLevel(cat.bond || 0);
  const quotes = CAT_DAILY_QUOTES[cat.catId] || ["今天也要加油喔！"];
  const quote  = quotes[Math.floor(Date.now() / 86400000) % quotes.length];

  return (
    <div className="flex items-center gap-3 px-4 py-2.5"
      style={{ background: "rgba(255,255,255,0.72)", borderBottom: `1px solid ${C.border}` }}>
      {/* 貓咪頭像 */}
      <div style={{ position:"relative", width:46, height:46, flexShrink:0 }}>
        <img
          src={`/cats/portraits/${cat.catId}.webp`}
          alt={catInfo.name}
          style={{ width:46, height:46, borderRadius:"50%", objectFit:"cover",
            border:`2px solid ${C.sage}`, background: catInfo.palette?.light || "#f5e6d0" }}
          onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
        />
        <div style={{ display:"none", width:46, height:46, borderRadius:"50%",
          background: catInfo.palette?.light || "#f5e6d0",
          alignItems:"center", justifyContent:"center", fontSize:22,
          border:`2px solid ${C.sage}` }}>🐱</div>
        <div style={{
          position:"absolute", bottom:-3, right:-3,
          background: C.sage, borderRadius:8, padding:"1px 5px",
          fontSize:9, fontWeight:900, color:"white",
        }}>Lv.{bondLv}</div>
      </div>
      {/* 文字 */}
      <div className="flex-1 min-w-0">
        <div className="font-black text-[11px]" style={{ color: C.muted }}>秘書貓</div>
        <div className="font-black text-sm leading-tight" style={{ color: C.brown }}>{catInfo.name}</div>
      </div>
      {/* 台詞氣泡 */}
      <div className="flex-1 rounded-2xl px-3 py-2 text-[11px] italic leading-snug"
        style={{ background:"rgba(255,255,255,0.85)", border:`1px solid ${C.border}`, color: C.mid, maxWidth:160 }}>
        「{quote}」
      </div>
    </div>
  );
}

// ── 全景圖（可橫移） ─────────────────────────────────────────
function PanoramaView({ villageLevel }) {
  const lv  = Math.max(1, Math.min(20, villageLevel || 1));
  const pad = String(lv).padStart(2, "0");
  const src = `/ui/village/panorama-lv${pad}.webp`;

  return (
    <div className="overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
      <div style={{ width: "750px", height: "370px", position: "relative", flexShrink: 0 }}>
        <img
          src={src}
          alt={`村莊 Lv${lv}`}
          style={{ width: "750px", height: "370px", objectFit: "cover", display: "block" }}
          onError={e => { e.target.style.display = "none"; }}
        />
        <div style={{
          position: "absolute", top: 10, left: 12,
          background: "rgba(60,35,15,0.62)", backdropFilter: "blur(6px)",
          borderRadius: "20px", padding: "4px 14px",
          color: "#FFF8F0", fontWeight: 900, fontSize: "13px",
        }}>
          🏡 村莊 Lv.{lv}
        </div>
      </div>
    </div>
  );
}

// ── 資源採集列 ───────────────────────────────────────────────
function ResourceBar({ resources, pending, onCollect, collecting, nextCollectSec, collectedResult }) {
  const arrowdew = (resources?.arrowdew || 0);
  const hasPending = Object.values(pending || {}).some(v => v > 0);
  const pendingArrow = pending?.arrowdew || 0;

  const timeStr = useMemo(() => {
    if (nextCollectSec <= 0) return null;
    const h = Math.floor(nextCollectSec / 3600);
    const m = Math.floor((nextCollectSec % 3600) / 60);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  }, [nextCollectSec]);

  const collectedItems = useMemo(() => {
    if (!collectedResult) return [];
    return Object.entries(collectedResult).map(([key, amt]) => {
      if (key === 'gachaCoins') return { key, name: '扭蛋代幣', tier: null, amt };
      if (key.includes('_t')) {
        const [res, t] = key.split('_t');
        return { key, name: RESOURCE_NAMES[res] || res, tier: `T${t}`, amt };
      }
      return { key, name: RESOURCE_NAMES[key] || key, tier: null, amt };
    });
  }, [collectedResult]);

  return (
    <>
      <div className="px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(255,255,255,0.6)", borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 flex-1">
          <img src="/ui/village/resource-arrowdew.webp" alt="箭露"
            style={{ width: 22, height: 22, mixBlendMode: "multiply", objectFit: "contain" }}
            onError={e => { e.target.style.display="none"; }} />
          <div>
            <div className="font-black text-sm" style={{ color: C.brown }}>{arrowdew.toLocaleString()}</div>
            <div className="text-[10px]" style={{ color: C.muted }}>箭露</div>
          </div>
          {hasPending && pendingArrow > 0 && (
            <div className="text-xs font-bold" style={{ color: C.sage }}>+{pendingArrow.toLocaleString()}</div>
          )}
        </div>
        <button
          onClick={onCollect}
          disabled={collecting || !hasPending}
          className="px-4 py-2 rounded-xl font-black text-sm transition-all active:scale-95"
          style={{
            background: hasPending
              ? "linear-gradient(135deg,#7CBF70,#5A9E50)"
              : C.lockBd,
            color: hasPending ? "white" : C.muted,
            cursor: hasPending ? "pointer" : "default",
            boxShadow: hasPending ? "0 2px 6px rgba(90,158,80,0.35)" : "none",
          }}>
          {collecting ? "採集中…" : hasPending ? "✦ 採集" : (timeStr ? `${timeStr}後` : "已採集")}
        </button>
      </div>
      {collectedItems.length > 0 && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "rgba(50,28,10,0.93)", borderRadius: 18, padding: "12px 18px",
          color: "white", zIndex: 9999, maxWidth: "92vw", minWidth: 200,
          boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
        }}>
          <div className="text-[11px] font-black mb-2 text-center" style={{ color: "#FFD580", letterSpacing: 1 }}>
            ✦ 採集成功！
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {collectedItems.map(({ key, name, tier, amt }) => (
              <div key={key} style={{
                background: "rgba(255,255,255,0.10)", borderRadius: 10,
                padding: "4px 10px", display: "flex", alignItems: "center", gap: 5,
              }}>
                <span className="text-[12px] font-bold">{name}</span>
                {tier && <span className="text-[9px] font-bold" style={{ color: "#FFD580" }}>{tier}</span>}
                <span className="text-[13px] font-black" style={{ color: "#7CBF70" }}>+{amt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── 建築卡片 ─────────────────────────────────────────────────
function BuildingCard({ buildingId, level, resources, onClick }) {
  const b     = BUILDINGS[buildingId];
  const stage = getBuildingStage(level);
  const rate  = getProductionRate(buildingId, level);
  const check = canUpgrade(buildingId, { [buildingId]: level }, resources);
  const maxed = level >= 20;

  const statusColor = maxed ? C.muted : check.ok ? C.sage : "#D4933A";
  const statusText  = maxed ? "MAX" : check.ok ? "可升級" : "缺材料";
  const imgSrc = `/ui/village/building-${buildingId}-stage${stage}.webp`;

  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden active:scale-95 transition-transform text-left"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#F5EBD8" }}>
        <img
          src={imgSrc} alt={b.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
        <div style={{
          display: "none", position: "absolute", inset: 0,
          alignItems: "center", justifyContent: "center", fontSize: "36px",
        }}>{b.emoji}</div>
        <div style={{
          position: "absolute", top: 5, right: 5,
          background: "rgba(60,35,15,0.60)", borderRadius: "8px",
          padding: "1px 7px", color: "#FFF8F0", fontWeight: 900, fontSize: "10px",
        }}>Lv.{level}</div>
      </div>
      <div className="p-2.5">
        <div className="font-black text-xs leading-tight" style={{ color: C.brown }}>{b.name}</div>
        <div className="text-[10px] mt-0.5" style={{ color: C.mid }}>{b.resourceName} {rate}/hr</div>
        <div className="mt-1.5 text-[10px] font-bold" style={{ color: statusColor }}>● {statusText}</div>
      </div>
    </button>
  );
}

// ── 鎖定建築卡片 ─────────────────────────────────────────────
function LockedBuildingCard({ buildingId }) {
  const b = BUILDINGS[buildingId];
  const imgSrc = `/ui/village/building-${buildingId}-stage1.webp`;

  let hint = "";
  if (buildingId === 'market') {
    hint = "海港或獵場 Lv2";
  } else {
    const req = UNLOCK_REQS[buildingId];
    if (req) {
      hint = Object.entries(req)
        .map(([id, lv]) => `${BUILDINGS[id].name} Lv${lv}`)
        .join(" 且 ");
    }
  }

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden text-left"
      style={{ border: `1px solid ${C.lockBd}`, background: "#EDE0CE" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
        {/* stage1 圖片：灰階 + 半透明暗罩 */}
        <img src={imgSrc} alt={b.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
            filter: "grayscale(1) brightness(0.55)" }}
          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
        {/* emoji fallback */}
        <div style={{ display: "none", position: "absolute", inset: 0,
          alignItems: "center", justifyContent: "center",
          fontSize: 28, filter: "grayscale(1)", opacity: 0.3 }}>{b.emoji}</div>
        {/* 🔒 中央 */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
        }}>
          <div style={{ fontSize: 22 }}>🔒</div>
          <div style={{
            fontSize: 9, fontWeight: 900, color: "#FFF8F0",
            background: "rgba(60,35,15,0.65)", borderRadius: 8,
            padding: "2px 7px", textAlign: "center", maxWidth: "90%",
          }}>{hint}</div>
        </div>
      </div>
      <div className="p-2.5" style={{ background: C.lock }}>
        <div className="font-black text-xs leading-tight" style={{ color: C.muted }}>{b.name}</div>
        <div className="text-[9px] mt-0.5" style={{ color: C.lockBd }}>🔒 尚未解鎖</div>
      </div>
    </div>
  );
}

// ── 卡片掛賣面板 ─────────────────────────────────────────────
const PRICE_TYPES = [
  { type:"arrowdew",  icon:"💧", label:"箭露",   min:10,  max:9999 },
  { type:"gachaToken",icon:"🎰", label:"扭蛋幣", min:1,   max:100  },
  { type:"card",      icon:"🃏", label:"重複卡", min:1,   max:5    },
];

function CardMarketPanel({ catCards, memberId, memberName }) {
  const [tab, setTab]         = useState("browse");
  const [listings, setListings]     = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [busy, setBusy]       = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selCardId, setSelCardId]   = useState(null);
  const [priceType, setPriceType]   = useState("arrowdew");
  const [priceAmount, setPriceAmount] = useState(50);
  // 卡片交換流程：選擇要提供的卡片
  const [buyTarget, setBuyTarget]     = useState(null);
  const [offeredCardId, setOfferedCardId] = useState(null);

  useEffect(() => {
    const unsub = subscribeCardMarket(all => {
      setListings(all.filter(l => l.sellerId !== memberId));
      setMyListings(all.filter(l => l.sellerId === memberId));
    });
    return unsub;
  }, [memberId]); // eslint-disable-line

  const dupCards = Object.entries(catCards || {})
    .filter(([,cnt]) => (cnt || 0) >= 2)
    .map(([id, cnt]) => ({ id, cnt, ...CAT_CARD_MAP[id] }))
    .filter(c => c.name);

  async function handleList() {
    if (!selCardId || busy) return;
    setBusy(true);
    sfxTap();
    try {
      await listCardForSale(memberId, memberName, selCardId, CAT_CARD_MAP[selCardId], priceType, priceAmount);
      setShowForm(false); setSelCardId(null);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function handleBuy(listing, offered = null) {
    if (busy) return;
    setBusy(true);
    try {
      await buyCardListing(memberId, memberName, listing, offered);
      sfxSuccess();
      setBuyTarget(null);
      setOfferedCardId(null);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function handleCancel(listing) {
    if (busy) return;
    setBusy(true);
    try { await cancelCardListing(memberId, listing.id, listing.cardId); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  const curPT = PRICE_TYPES.find(p => p.type === priceType);

  return (
    <div className="px-5 pb-4">
      <div className="text-xs font-bold mb-2" style={{ color: C.mid }}>🃏 卡片掛賣市集</div>
      <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.border}` }}>
        {[["browse","🛍️ 瀏覽"],["mine","📋 我的"]].map(([id,lb]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2 text-[11px] font-bold transition-colors"
            style={{ background: tab===id ? C.brown : "rgba(255,255,255,0.5)", color: tab===id ? "#FFF8F0" : C.mid }}>
            {lb}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <div>
          {listings.length === 0 ? (
            <div className="text-center py-6 text-[11px]" style={{ color: C.muted }}>目前沒有掛賣的卡片</div>
          ) : (
            <>
              {/* 卡片圖片網格 */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, maxHeight:320, overflowY:"auto" }}>
                {listings.map(l => {
                  const pt = PRICE_TYPES.find(p => p.type === l.priceType);
                  const isCardExchange = l.priceType === "card";
                  const isSelected = buyTarget?.id === l.id;
                  return (
                    <div key={l.id}
                      style={{
                        borderRadius:10,
                        overflow:"hidden",
                        border: `2px solid ${isSelected ? C.brown : C.border}`,
                        background: l.cardBg || "rgba(255,255,255,0.8)",
                        cursor:"pointer",
                      }}
                      onClick={() => {
                        if (isCardExchange) { setBuyTarget(isSelected ? null : l); setOfferedCardId(null); }
                        else { handleBuy(l); }
                      }}>
                      {/* 卡片圖片 */}
                      <div style={{ position:"relative", paddingTop:"140%" }}>
                        <img
                          src={`/cats/cat-cards/${l.cardId}.webp`}
                          alt={l.cardName}
                          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
                          onError={e => { e.currentTarget.style.display="none"; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display="flex"; }}
                        />
                        <div style={{ position:"absolute", inset:0, display:"none", alignItems:"center", justifyContent:"center", fontSize:28 }}>
                          {l.cardEmoji}
                        </div>
                      </div>
                      {/* 資訊列 */}
                      <div style={{ padding:"4px 5px 5px" }}>
                        <div style={{ fontSize:8, fontWeight:800, color:C.brown, lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.cardName}</div>
                        <div style={{ fontSize:7, color:C.mid }}>{l.sellerName}</div>
                        <div style={{ fontSize:7, fontWeight:700, color:C.brown, marginBottom:3 }}>
                          {isCardExchange ? "🃏 換卡" : `${pt?.icon} ${l.priceAmount}`}
                        </div>
                        <div style={{
                          textAlign:"center", fontSize:8, fontWeight:800,
                          padding:"2px 0", borderRadius:5,
                          background: isSelected ? C.brown : C.sage,
                          color:"white",
                        }}>
                          {busy && isSelected ? "…" : isSelected ? "收起" : isCardExchange ? "交換" : "購買"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 卡片交換展開區 */}
              {buyTarget && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.75)", border: `1px solid ${C.border}` }}>
                  <div className="text-[10px] font-bold mb-2" style={{ color: C.mid }}>
                    交換「{buyTarget.cardName}」— 選擇你要提供的重複卡片
                  </div>
                  {dupCards.length === 0 ? (
                    <div className="text-[10px] text-center py-1" style={{ color: C.muted }}>你目前沒有重複卡片</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {dupCards.map(c => (
                        <button key={c.id} onClick={() => setOfferedCardId(c.id)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold active:scale-95"
                          style={{
                            background: offeredCardId === c.id ? C.brown : (c.bg || "#eee"),
                            color: offeredCardId === c.id ? "#FFF8F0" : C.brown,
                            border: `1px solid ${offeredCardId === c.id ? C.brown : C.border}`,
                          }}>
                          {c.emoji} {c.name} ×{c.cnt}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleBuy(buyTarget, offeredCardId)}
                    disabled={!offeredCardId || busy}
                    className="w-full py-1.5 rounded-lg text-[10px] font-bold active:scale-95"
                    style={{
                      background: offeredCardId ? C.sage : C.lockBd,
                      color: offeredCardId ? "white" : C.muted,
                    }}>
                    {busy ? "交換中…" : offeredCardId ? `確認交換（提供 ${CAT_CARD_MAP[offeredCardId]?.emoji || ""} ${CAT_CARD_MAP[offeredCardId]?.name || offeredCardId}）` : "請先選擇要提供的卡片"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {myListings.length === 0 ? (
            <div className="text-[10px] text-center py-2" style={{ color: C.muted }}>尚無掛賣中的卡片</div>
          ) : myListings.map(l => {
            const pt = PRICE_TYPES.find(p => p.type === l.priceType);
            return (
              <div key={l.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: l.cardBg || "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                <span className="text-2xl shrink-0">{l.cardEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black truncate" style={{ color: C.brown }}>{l.cardName}</div>
                  <div className="text-[10px]" style={{ color: C.mid }}>{pt?.icon} {l.priceAmount} {pt?.label}</div>
                </div>
                <button onClick={() => handleCancel(l)} disabled={busy}
                  className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95 shrink-0"
                  style={{ background: "#C0533A", color: "white" }}>下架</button>
              </div>
            );
          })}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} disabled={dupCards.length === 0}
              className="mt-1 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
              style={{ background: dupCards.length > 0 ? "#D4933A" : C.lockBd, color: dupCards.length > 0 ? "white" : C.muted }}>
              {dupCards.length > 0 ? `＋ 掛賣卡片（${dupCards.length} 種重複可選）` : "暫無重複卡片可掛賣"}
            </button>
          ) : (
            <div className="rounded-xl p-3 mt-1" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}` }}>
              <div className="text-[10px] font-bold mb-2" style={{ color: C.mid }}>選擇卡片（需有重複）</div>
              <div className="flex flex-wrap gap-1.5 mb-3 max-h-20 overflow-y-auto">
                {dupCards.map(c => (
                  <button key={c.id} onClick={() => setSelCardId(c.id)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold active:scale-95"
                    style={{ background: selCardId===c.id ? C.brown : (c.bg||"#eee"),
                      color: selCardId===c.id ? "#FFF8F0" : C.brown,
                      border: `1px solid ${selCardId===c.id ? C.brown : C.border}` }}>
                    {c.emoji} {c.name} ×{c.cnt}
                  </button>
                ))}
              </div>
              {selCardId && (
                <>
                  <div className="text-[10px] font-bold mb-1.5" style={{ color: C.mid }}>定價方式</div>
                  <div className="flex gap-1.5 mb-2">
                    {PRICE_TYPES.map(pt => (
                      <button key={pt.type}
                        onClick={() => { setPriceType(pt.type); setPriceAmount(pt.min); }}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold active:scale-95"
                        style={{ background: priceType===pt.type ? C.brown : "rgba(255,255,255,0.5)",
                          color: priceType===pt.type ? "#FFF8F0" : C.mid,
                          border: `1px solid ${C.border}` }}>
                        {pt.icon} {pt.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <input type="number" value={priceAmount}
                      onChange={e => setPriceAmount(Math.max(curPT?.min||1, Math.min(curPT?.max||9999, Number(e.target.value))))}
                      className="flex-1 rounded-lg px-3 py-1.5 text-sm font-bold border text-center outline-none"
                      style={{ borderColor: C.border, color: C.brown, background: "rgba(255,255,255,0.85)" }} />
                    <span className="text-[10px] shrink-0" style={{ color: C.muted }}>{curPT?.label}</span>
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setShowForm(false); setSelCardId(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold"
                  style={{ background: C.lockBd, color: C.muted }}>取消</button>
                <button onClick={handleList} disabled={!selCardId || busy}
                  className="flex-1 py-2 rounded-lg text-xs font-bold active:scale-95"
                  style={{ background: selCardId ? C.sage : C.lockBd, color: selCardId ? "white" : C.muted }}>
                  {busy ? "掛賣中…" : "確認掛賣"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 升級 Modal ───────────────────────────────────────────────
function UpgradeModal({ buildingId, level, resources, onUpgrade, onClose, upgrading, memberId, memberName, catCards, battleExchange, onExchangeDone }) {
  const b         = BUILDINGS[buildingId];
  const stage     = getBuildingStage(level);
  const nextStage = getBuildingStage(level + 1);
  const nextLv    = level + 1;
  const req       = nextLv <= 20 ? getUpgradeRequirements(buildingId, nextLv) : null;
  const check     = canUpgrade(buildingId, { [buildingId]: level }, resources);
  const curRate   = getProductionRate(buildingId, level);
  const nextRate  = getProductionRate(buildingId, nextLv);
  const imgSrc    = `/ui/village/building-${buildingId}-stage${stage}.webp`;
  const stageUp   = nextStage !== stage;
  const nextImgSrc = stageUp ? `/ui/village/building-${buildingId}-stage${nextStage}.webp` : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: "rgba(80,50,30,0.55)" }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-3xl overflow-hidden"
        style={{ background: "linear-gradient(180deg,#FDF6EC,#F5EBD8)", maxHeight: "88vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* 大圖預覽 */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#EDE0CE", flexShrink: 0 }}>
          <img src={imgSrc} alt={b.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }} />
          <div style={{ display: "none", position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", fontSize: 64 }}>
            {b.emoji}
          </div>
          {/* 等級角標 */}
          <div style={{
            position: "absolute", top: 12, left: 14,
            background: "rgba(60,35,15,0.65)", backdropFilter: "blur(6px)",
            borderRadius: 20, padding: "4px 14px",
            color: "#FFF8F0", fontWeight: 900, fontSize: 14,
          }}>Lv.{level}</div>
          {/* 關閉按鈕 */}
          <button onClick={onClose} style={{
            position: "absolute", top: 10, right: 12,
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(60,35,15,0.55)", color: "#FFF8F0",
            fontSize: 16, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer",
          }}>✕</button>
          {/* 段位提升預告 */}
          {stageUp && nextImgSrc && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(to top, rgba(107,142,94,0.85), transparent)",
              padding: "28px 14px 10px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ color: "#F0FFE8", fontSize: 11, fontWeight: 900 }}>✨ 升至 Lv.{nextLv} 將解鎖新外觀！</span>
              <div style={{ width: 44, height: 33, borderRadius: 6, overflow: "hidden", border: "2px solid #A0C898", flexShrink: 0 }}>
                <img src={nextImgSrc} alt="下一段位"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={e => { e.target.style.display = "none"; }} />
              </div>
            </div>
          )}
        </div>

        {/* 內容區 */}
        <div className="px-5 pt-4 pb-8">
          <div className="flex items-baseline justify-between mb-1">
            <div className="font-black text-xl" style={{ color: C.brown }}>{b.emoji} {b.name}</div>
            <div className="text-xs" style={{ color: C.muted }}>Lv.{level} → {nextLv <= 20 ? nextLv : "MAX"}</div>
          </div>
          <div className="text-xs font-bold mb-4" style={{ color: C.sage }}>
            產出：{curRate}/hr {nextLv <= 20 ? `→ ${nextRate}/hr` : "（已滿）"}
          </div>

          {level >= 20 ? (
            <div className="text-center py-4 text-sm" style={{ color: C.muted }}>🏆 已達最高等級 Lv.20</div>
          ) : req ? (
            <>
              <div className="text-xs font-bold mb-2 tracking-wider" style={{ color: C.mid }}>升級需求</div>

              {/* 箭露 */}
              <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-2"
                style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2">
                  <span>💧</span>
                  <span className="text-sm" style={{ color: C.brown }}>箭露</span>
                </div>
                <div>
                  <span className="font-black text-sm"
                    style={{ color: (resources?.arrowdew || 0) >= req.arrowdew ? C.sage : "#C0533A" }}>
                    {req.arrowdew.toLocaleString()}
                  </span>
                  <span className="text-xs ml-1.5" style={{ color: C.muted }}>/ {(resources?.arrowdew || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* 材料 */}
              {req.materials.map((mat, i) => {
                const resKey = getResourceKey(mat.resource, mat.tier);
                const have = Math.floor(resources?.[resKey] || 0);
                const ok   = have >= mat.count;
                return (
                  <div key={i} className="flex items-center justify-between rounded-xl px-4 py-3 mb-2"
                    style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <img src={`/ui/village/resource-${mat.resource}${mat.tier}.webp`} alt=""
                        style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 4 }}
                        onError={e => { e.target.style.display = "none"; }} />
                      <span className="text-sm" style={{ color: C.brown }}>{RESOURCE_NAMES[mat.resource]} T{mat.tier}</span>
                    </div>
                    <div className="font-black text-sm" style={{ color: ok ? C.sage : "#C0533A" }}>
                      {mat.count} <span className="font-normal text-xs" style={{ color: C.muted }}>/ {have}</span>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={onUpgrade}
                disabled={!check.ok || upgrading}
                className="w-full py-4 rounded-2xl font-black text-base mt-3 transition-all active:scale-95"
                style={{
                  background: check.ok
                    ? "linear-gradient(135deg,#7CBF70,#5A9E50)"
                    : C.lockBd,
                  color: check.ok ? "white" : C.muted,
                  boxShadow: check.ok ? "0 3px 10px rgba(90,158,80,0.35)" : "none",
                }}>
                {upgrading ? "升級中…" : check.ok ? `⬆ 升級至 Lv.${nextLv}` : check.reason}
              </button>
            </>
          ) : null}

          {/* 市集專屬：兌換面板 + 卡片市集 */}
          {buildingId === 'market' && (
            <>
              <div style={{ height: 1, background: C.border, margin: "0 0 0" }} />
              <MarketExchangePanel resources={resources} memberId={memberId} onDone={onExchangeDone} battleExchange={battleExchange} />
              <div style={{ height: 1, background: C.border, margin: "0 0 16px" }} />
              <CardMarketPanel catCards={catCards} memberId={memberId} memberName={memberName} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 資源總覽列 ───────────────────────────────────────────────
const TIERED_LIST = ['ore','melon','fish','meat','driedfish','can','potion','fur'];
const RES_EMOJI   = { ore:'⛏️', melon:'🌿', fish:'⚓', meat:'🏕️', driedfish:'🛒', can:'📦', potion:'⚗️', fur:'🎰' };

function ResourceRow({ resources, gachaCoins }) {
  const hasTiered = TIERED_LIST.some(res =>
    [1,2,3,4,5].some(t => (resources?.[`${res}_t${t}`] || 0) > 0)
  );
  return (
    <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="text-[10px] font-bold mb-1.5" style={{ color: C.mid }}>村莊資源</div>
      {/* 特殊資源 */}
      <div className="flex gap-4 mb-2">
        {[['archer','🏹','射手','resource-archer1.webp'],['gachaToken','🎰','扭蛋幣',null]].map(([k,em,lb,imgFile]) => (
          <div key={k} className="flex items-center gap-1">
            {imgFile ? (
              <img src={`/ui/village/${imgFile}`} alt={em}
                style={{ width: 20, height: 20, objectFit: "contain", borderRadius: 4 }}
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="inline"; }} />
            ) : null}
            <span style={{ display: imgFile ? "none" : "inline", fontSize: 16 }}>{em}</span>
            <span className="font-bold text-xs" style={{ color: C.brown }}>{k === 'gachaToken' ? (gachaCoins || 0) : Math.floor(resources?.[k] || 0)}</span>
            <span className="text-[10px]" style={{ color: C.muted }}>{lb}</span>
          </div>
        ))}
      </div>
      {/* 分 tier 材料 */}
      {hasTiered ? (
        <div className="flex flex-col gap-1">
          {TIERED_LIST.map(res => {
            const tiers = [1,2,3,4,5].map(t => ({ t, count: Math.floor(resources?.[`${res}_t${t}`] || 0) })).filter(x => x.count > 0);
            if (!tiers.length) return null;
            return (
              <div key={res} className="flex items-center gap-2">
                <span className="text-[10px] shrink-0" style={{ color: C.mid, width: 52 }}>
                  {RES_EMOJI[res]} {RESOURCE_NAMES[res]}
                </span>
                <div className="flex gap-2">
                  {tiers.map(({ t, count }) => (
                    <div key={t} className="flex items-center gap-0.5">
                      <img src={`/ui/village/resource-${res}${t}.webp`} style={{ width: 18, height: 18, objectFit: "contain", borderRadius: 3 }}
                        onError={e => { e.target.style.display = 'none'; }} />
                      <span className="text-[10px] font-bold" style={{ color: C.brown }}>T{t}:{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[10px]" style={{ color: C.muted }}>採集後材料將在此顯示</div>
      )}
    </div>
  );
}

const BATTLE_EXCHANGE = [
  // 六種族材料包（各自消耗對應建築的 T1 村莊資源）
  { type:'iron', family:'ghost',     icon:'👻', label:'鬼怪族材料包',   costs:[{ resource:'ore',       tier:1, count:30 }] },
  { type:'iron', family:'mountain',  icon:'🏔️', label:'山林族材料包',  costs:[{ resource:'melon',     tier:1, count:30 }] },
  { type:'iron', family:'exam',      icon:'📝', label:'考試族材料包',   costs:[{ resource:'fish',      tier:1, count:30 }] },
  { type:'iron', family:'insect',    icon:'🦂', label:'毒蟲族材料包',   costs:[{ resource:'meat',      tier:1, count:30 }] },
  { type:'iron', family:'workplace', icon:'💼', label:'職場族材料包',   costs:[{ resource:'driedfish', tier:1, count:30 }] },
  { type:'iron', family:'temple',    icon:'⛩️', label:'西方怪物材料包', costs:[{ resource:'can',       tier:1, count:30 }] },
  // 藥水箱、怪物卡包、黃金寶箱
  { type:'potion',   icon:'🧪', label:'藥水箱',   costs:[{ resource:'melon', tier:1, count:20 }, { resource:'fish',  tier:1, count:15 }] },
  { type:'card_pack',icon:'🃏', label:'怪物卡包',  costs:[{ resource:'ore',   tier:2, count: 8 }, { resource:'driedfish', tier:1, count:20 }] },
  { type:'gold',     icon:'🎁', label:'黃金寶箱',  costs:[{ resource:'ore',   tier:2, count:15 }, { resource:'fish',  tier:2, count:10 }] },
];
const RES_CN = { ore:'礦物', melon:'瓜瓜', fish:'鮮魚', meat:'動物肉', driedfish:'小魚乾', can:'貓罐頭', potion:'藥水', fur:'貓毛' };

// ── 市集兌換面板 ─────────────────────────────────────────────
function MarketExchangePanel({ resources, memberId, onDone, battleExchange: bx }) {
  const effectiveBX = bx || BATTLE_EXCHANGE;
  const [busy, setBusy] = useState(false);
  const [justGot, setJustGot] = useState(null);

  async function doBattleExchange(chestType, costs, family) {
    if (busy) return;
    setBusy(true);
    sfxVillageExchange();
    try {
      await exchangeMaterialsForChest(memberId, chestType, costs, family || null);
      setJustGot(chestType + (family || ""));
      setTimeout(() => setJustGot(null), 2000);
      onDone?.();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function doExchange(resource, fromTier, direction) {
    if (busy) return;
    const fromKey = `${resource}_t${fromTier}`;
    const have = Math.floor(resources?.[fromKey] || 0);
    if (direction === 'up' && have < 5) { alert('需要 5 個才能升階'); return; }
    if (direction === 'down' && have < 1) { alert('數量不足'); return; }
    setBusy(true);
    sfxVillageExchange();
    try {
      await exchangeVillageMaterial(memberId, resource, fromTier, direction);
      onDone?.();
    } catch(e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="px-5 pb-4">
      {/* ── 市集兌換 ── */}
      <div className="text-xs font-bold mb-2" style={{ color: C.mid }}>🛒 村莊市集兌換</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>消耗村莊材料，換取各族材料包、藥水箱、怪物卡包、黃金寶箱（到背包開箱）</div>
      <div className="flex flex-col gap-2 mb-4">
        {effectiveBX.map(ex => {
          const canAfford = ex.costs.every(({ resource, tier, count }) =>
            Math.floor(resources?.[`${resource}_t${tier}`] || 0) >= count
          );
          const gotThis = justGot === ex.type + (ex.family || "");
          return (
            <div key={ex.type} className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg">{ex.icon}</span>
                  <span className="text-xs font-bold" style={{ color: C.brown }}>{ex.label}</span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  {ex.costs.map(({ resource, tier, count }) => {
                    const have = Math.floor(resources?.[`${resource}_t${tier}`] || 0);
                    return (
                      <span key={`${resource}${tier}`} className="text-[10px] font-bold"
                        style={{ color: have >= count ? C.sage : "#C0533A" }}>
                        {RES_CN[resource]}T{tier}×{count}（{have}）
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                disabled={!canAfford || busy}
                onClick={() => doBattleExchange(ex.type, ex.costs, ex.family)}
                className="text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all ml-2"
                style={{
                  background: gotThis ? "#5A9E50" : canAfford ? "#D4933A" : C.lockBd,
                  color: canAfford ? "white" : C.muted,
                  minWidth: 64, textAlign: "center", flexShrink: 0,
                }}>
                {gotThis ? "✓ 取得！" : "兌換"}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: 12 }} />

      {/* ── 村莊材料換算 ── */}
      <div className="text-xs font-bold mb-2" style={{ color: C.mid }}>材料換算（村莊材料）</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>升階：T(n)×5 → T(n+1)×1　降階：T(n)×1 → T(n-1)×3</div>
      {TIERED_LIST.map(res => {
        const tiers = [1,2,3,4,5].map(t => ({ t, count: Math.floor(resources?.[`${res}_t${t}`] || 0) }));
        const hasSome = tiers.some(x => x.count > 0);
        if (!hasSome) return null;
        return (
          <div key={res} className="mb-3">
            <div className="text-[10px] font-bold mb-1" style={{ color: C.brown }}>
              {RES_EMOJI[res]} {RESOURCE_NAMES[res]}
            </div>
            <div className="flex flex-col gap-1">
              {tiers.map(({ t, count }) => (
                <div key={t} className="flex items-center justify-between rounded-xl px-3 py-1.5"
                  style={{ background: "rgba(255,255,255,0.6)", border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-1.5">
                    <img src={`/ui/village/resource-${res}${t}.webp`} style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 4 }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <span className="text-xs font-bold" style={{ color: C.brown }}>T{t}</span>
                    <span className="text-xs" style={{ color: C.mid }}>×{count}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {t < 5 && (
                      <button disabled={count < 5 || busy} onClick={() => doExchange(res, t, 'up')}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
                        style={{ background: count >= 5 ? C.sage : C.lockBd, color: count >= 5 ? 'white' : C.muted }}>
                        ×5→T{t+1}
                      </button>
                    )}
                    {t > 1 && (
                      <button disabled={count < 1 || busy} onClick={() => doExchange(res, t, 'down')}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg active:scale-95"
                        style={{ background: count >= 1 ? "#D4933A" : C.lockBd, color: count >= 1 ? 'white' : C.muted }}>
                        ×1→T{t-1}×3
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 資源鍵顯示名稱 ───────────────────────────────────────────
function formatResKey(key) {
  const BASE = { ore:"礦物",meat:"動物肉",driedfish:"小魚乾",melon:"瓜瓜",fish:"鮮魚",potion:"貓薄荷藥水",fur:"貓毛",arrowdew:"箭露" };
  const parts = key.split("_t");
  return parts[1] ? `${BASE[parts[0]] || parts[0]} T${parts[1]}` : (BASE[key] || key);
}

// ── 鍛造面板 ─────────────────────────────────────────────────
function ForgePanel({ profile, resources }) {
  const [forging, setForging] = useState(false);
  const [forgeMsg, setForgeMsg] = useState(null);

  const equippedCat = profile?.equippedCat;
  if (!equippedCat?.catId) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.mid, textAlign:"center", padding:32 }}>
        <div>
          <div style={{ fontSize:40, marginBottom:12 }}>🐱</div>
          <div style={{ fontSize:14, fontWeight:"bold" }}>請先在「我的貓」裝備一隻貓咪</div>
          <div style={{ fontSize:12, marginTop:4 }}>才能使用鍛造功能</div>
        </div>
      </div>
    );
  }

  const { catId, name, equip = {} } = equippedCat;
  const catXP   = equippedCat.catXP || 0;
  const catLevel = catLevelFromXP(catXP);

  async function handleForge(slotId) {
    if (forging || !profile?.id) return;
    const slotData = equip[slotId] || { grade: "普通", plusLevel: 0 };
    const cost = calcForgeCost(slotId, slotData.grade, slotData.plusLevel);
    if (!cost) return;

    for (const [key, amount] of Object.entries(cost)) {
      if ((resources[key] || 0) < amount) {
        setForgeMsg(`材料不足：${formatResKey(key)} (需 ${amount})`);
        setTimeout(() => setForgeMsg(null), 2500);
        return;
      }
    }

    const gIdx = CAT_EQUIP_GRADE_NAMES.indexOf(slotData.grade);
    let newGrade    = slotData.grade;
    let newPlusLevel = slotData.plusLevel;
    if (slotData.plusLevel < CAT_EQUIP_MAX_PLUS) {
      newPlusLevel = slotData.plusLevel + 1;
    } else {
      newGrade    = CAT_EQUIP_GRADE_NAMES[gIdx + 1];
      newPlusLevel = 0;
    }

    setForging(true);
    const res = await upgradeCatEquip(profile.id, catId, slotId, newGrade, newPlusLevel, cost);
    setForging(false);

    if (res.ok) {
      sfxSuccess();
      setForgeMsg(newPlusLevel === 0
        ? `✨ 裝備升階！→ ${newGrade}`
        : `🔨 強化成功！+${newPlusLevel}`
      );
    } else {
      setForgeMsg("鍛造失敗，請再試");
    }
    setTimeout(() => setForgeMsg(null), 2500);
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
      {/* 標頭 */}
      <div style={{ textAlign:"center", marginBottom:14, padding:"10px 0" }}>
        <div style={{ fontWeight:"bold", color:C.brown, fontSize:16 }}>🐱 {name} 的鍛造間</div>
        <div style={{ color:C.mid, fontSize:11, marginTop:2 }}>貓貓 Lv.{catLevel} · 累積 {catXP} XP</div>
      </div>

      {/* 提示訊息 */}
      {forgeMsg && (
        <div style={{ background:"rgba(255,255,255,0.92)", border:`1px solid ${C.border}`, borderRadius:10,
          padding:"8px 14px", marginBottom:12, textAlign:"center", color:C.brown, fontWeight:"bold", fontSize:13 }}>
          {forgeMsg}
        </div>
      )}

      {/* 裝備格 */}
      {CAT_EQUIP_SLOTS.map(slot => {
        const slotData = equip[slot.id] || { grade: "普通", plusLevel: 0 };
        const gIdx     = Math.max(0, CAT_EQUIP_GRADE_NAMES.indexOf(slotData.grade));
        const cost     = calcForgeCost(slot.id, slotData.grade, slotData.plusLevel);
        const canAfford = cost ? Object.entries(cost).every(([k,v]) => (resources[k]||0) >= v) : false;
        const isMaxed  = !cost;
        const lv       = catEquipLevel(slotData.grade, slotData.plusLevel);
        const bonus    = (gIdx * 10 + 1) + (slotData.plusLevel || 0);
        const statLabel = slot.stat === "hp"
          ? `HP +${bonus * 5}`
          : slot.stat === "atk" ? `ATK +${bonus}` : `DEF +${bonus}`;
        const nextLabel = isMaxed ? "MAX"
          : slotData.plusLevel < CAT_EQUIP_MAX_PLUS
            ? `強化 +${slotData.plusLevel + 1}`
            : `升階 → ${CAT_EQUIP_GRADE_NAMES[gIdx + 1]}`;
        const gradeColor = CAT_EQUIP_GRADE_COLORS[gIdx] || C.mid;
        const gradeBg    = CAT_EQUIP_GRADE_BG[gIdx]    || "rgba(156,163,175,0.1)";

        return (
          <div key={slot.id} style={{
            background: gradeBg, borderRadius:12, padding:"12px 14px", marginBottom:9,
            border:`1.5px solid ${gradeColor}44`, display:"flex", alignItems:"center", gap:10,
          }}>
            <div style={{ fontSize:26, width:38, textAlign:"center", flexShrink:0 }}>{slot.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <span style={{ fontWeight:"bold", color:C.brown, fontSize:13 }}>{slot.label}</span>
                <span style={{ fontSize:10, fontWeight:800, color:"white", background:gradeColor, borderRadius:6, padding:"1px 6px" }}>
                  Lv.{lv}
                </span>
              </div>
              <div style={{ fontSize:11, color:gradeColor, fontWeight:"bold" }}>
                {slotData.grade} +{slotData.plusLevel}
              </div>
              <div style={{ fontSize:11, color:C.mid }}>{statLabel}</div>
              {cost && (
                <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>
                  {Object.entries(cost).map(([k,v]) => {
                    const have = Math.floor(resources[k] || 0);
                    const ok   = have >= v;
                    return (
                      <span key={k} style={{ color: ok ? C.sage : "#ef4444", marginRight:6 }}>
                        {formatResKey(k)} ×{v}({have})
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              disabled={isMaxed || forging || !canAfford}
              onClick={() => handleForge(slot.id)}
              style={{
                padding:"7px 11px", borderRadius:8, fontSize:11, fontWeight:"bold", flexShrink:0,
                background: isMaxed ? "#e5e7eb" : canAfford ? C.sage : "#e5e7eb",
                color: isMaxed || !canAfford ? C.muted : "#fff",
                border:"none", cursor: isMaxed || !canAfford ? "not-allowed" : "pointer",
                opacity: forging ? 0.7 : 1,
              }}
            >
              {forging ? "…" : nextLabel}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── 主元件 ───────────────────────────────────────────────────
export default function CatVillage({ catCards, gachaCoins, initialTab = "village" }) {
  const { profile } = useAuth();
  const [tab, setTab]               = useState(initialTab);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [collecting, setCollecting] = useState(false);
  const [upgrading, setUpgrading]   = useState(false);
  const [localVillage, setLocalVillage] = useState(null);
  const [collectedResult, setCollectedResult] = useState(null);

  const village    = localVillage || profile?.village || DEFAULT_VILLAGE;
  const buildings  = village.buildings || DEFAULT_VILLAGE.buildings;
  const resources  = village.resources || DEFAULT_VILLAGE.resources;
  const villageLevel = getVillageLevel(buildings);

  const [marketConfig, setMarketConfig] = useState(null);
  const [myCats, setMyCats] = useState({});

  useEffect(() => {
    if (profile?.id && !profile?.village) {
      initVillageIfNeeded(profile.id, profile?.village).catch(() => {});
    }
  }, [profile?.id]); // eslint-disable-line

  useEffect(() => {
    const unsub = subscribeVillageMarketConfig(setMarketConfig);
    return unsub;
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMyCats(profile.id, setMyCats);
    return unsub;
  }, [profile?.id]); // eslint-disable-line

  const secretaryCat = useMemo(() => {
    const cats = Object.values(myCats);
    if (!cats.length) return null;
    return cats.reduce((best, c) => (c.bond || 0) > (best.bond || 0) ? c : best, cats[0]);
  }, [myCats]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const { pending, hours } = useMemo(
    () => calcPendingResources(village),
    [village, tick] // eslint-disable-line
  );

  const nextCollectSec = useMemo(() => {
    const lastMs = village?.lastCollectedAt?.toMillis?.() || (Date.now() - hours * 3600000);
    return Math.max(0, Math.floor((lastMs + 8 * 3600000 - Date.now()) / 1000));
  }, [village, hours]);

  async function handleCollect() {
    if (collecting || !profile?.id) return;
    sfxVillageCollect();
    setCollecting(true);
    try {
      const res = await collectVillageResources(profile.id, village);
      if (res.resources) {
        setLocalVillage(prev => ({
          ...(prev || village),
          resources: res.resources,
          lastCollectedAt: { toMillis: () => Date.now() },
        }));
      }
      if (res.collected && Object.keys(res.collected).length > 0) {
        setCollectedResult(res.collected);
        setTimeout(() => setCollectedResult(null), 3500);
      }
    } catch (e) {
      alert("採集失敗：" + e.message);
    } finally {
      setCollecting(false);
    }
  }

  async function handleUpgrade(buildingId) {
    if (upgrading || !profile?.id) return;
    sfxVillageBuild();
    setUpgrading(true);
    try {
      const currentLevel = buildings[buildingId] || 1;
      const stageChanges = getBuildingStage(currentLevel) !== getBuildingStage(currentLevel + 1);
      const res = await upgradeVillageBuilding(profile.id, buildingId, village);
      if (stageChanges) sfxEpic(); else sfxSuccess();
      setLocalVillage(prev => ({
        ...(prev || village),
        buildings: { ...(prev?.buildings || buildings), [buildingId]: res.newLevel },
        resources: res.resources,
      }));
      setSelectedBuilding(null);
    } catch (e) {
      alert("升級失敗：" + e.message);
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: C.bg }}>

      {/* 頁籤 */}
      <div className="flex shrink-0" style={{ background: "#FDF6EC", borderBottom: `1px solid ${C.border}` }}>
        {[["village","🏡 村莊"],["gacha","🎰 扭蛋"],["council","🏛️ 議會廳"],["forge","🔨 鍛造"],["cardmarket","🛒 市集"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-3 text-sm font-black transition-colors"
            style={{
              color: tab === id ? C.brown : C.muted,
              borderBottom: tab === id ? `2.5px solid ${C.sage}` : "2.5px solid transparent",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "gacha" && (
        <GachaMachine catCards={catCards} gachaCoins={gachaCoins} onCoinsUpdated={() => {}} />
      )}

      {tab === "council" && (
        <CouncilHall
          profile={profile}
          village={localVillage || profile?.village}
          onBack={() => setTab("village")}
        />
      )}

      {tab === "forge" && (
        <ForgePanel
          profile={profile}
          resources={resources}
        />
      )}

      {tab === "cardmarket" && (
        <div className="flex-1 overflow-y-auto">
          <CardMarketPanel
            catCards={catCards}
            memberId={profile?.id}
            memberName={profile?.nickname || profile?.name || "射手"}
          />
        </div>
      )}

      {tab === "village" && (
        <>
          <PanoramaView villageLevel={villageLevel} />

          <SecretaryCat cat={secretaryCat} />

          <ResourceBar
            resources={resources}
            pending={pending}
            onCollect={handleCollect}
            collecting={collecting}
            nextCollectSec={nextCollectSec}
            collectedResult={collectedResult}
          />

          <ResourceRow resources={resources} gachaCoins={gachaCoins} />

          {/* 建築網格 */}
          <div className="px-4 py-3 flex-1">
            {(() => {
              const unlockedIds = BUILDING_LIST.filter(id => isBuildingUnlocked(id, buildings));
              return (
                <>
                  <div className="text-[10px] font-bold mb-2" style={{ color: C.mid }}>
                    已解鎖 {unlockedIds.length} / 9 棟建築
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {BUILDING_LIST.map(id =>
                      isBuildingUnlocked(id, buildings) ? (
                        <BuildingCard
                          key={id}
                          buildingId={id}
                          level={buildings[id] || 1}
                          resources={resources}
                          onClick={() => { sfxTap(); setSelectedBuilding(id); }}
                        />
                      ) : (
                        <LockedBuildingCard key={id} buildingId={id} buildings={buildings} />
                      )
                    )}
                  </div>

                  {/* 村莊等級說明 */}
                  <div className="mt-4 rounded-2xl px-4 py-3 text-center"
                    style={{ background: "rgba(255,255,255,0.55)", border: `1px solid ${C.border}` }}>
                    <div className="text-xs" style={{ color: C.mid }}>村莊等級 = 已解鎖建築平均等級</div>
                    <div className="text-xs mt-1" style={{ color: C.brown }}>
                      目前：{unlockedIds.reduce((s,id) => s + (buildings[id]||1), 0)} / {unlockedIds.length * 20} 總級 → Lv.{villageLevel}
                    </div>
                  </div>

                </>
              );
            })()}
          </div>
        </>
      )}

      {/* 升級 Modal */}
      {selectedBuilding && (
        <UpgradeModal
          buildingId={selectedBuilding}
          level={buildings[selectedBuilding] || 1}
          resources={resources}
          onUpgrade={() => handleUpgrade(selectedBuilding)}
          onClose={() => setSelectedBuilding(null)}
          upgrading={upgrading}
          memberId={profile?.id}
          memberName={profile?.nickname || profile?.name || "射手"}
          catCards={catCards}
          battleExchange={marketConfig?.battleExchange || BATTLE_EXCHANGE}
          onExchangeDone={() => setLocalVillage(null)}
        />
      )}
    </div>
  );
}
