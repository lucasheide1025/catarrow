// src/components/member/CatVillage.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  collectVillageResources, upgradeVillageBuilding, initVillageIfNeeded,
  subscribeCardMarket, listCardForSale, buyCardListing, cancelCardListing, claimCardSaleProceeds,
  setBuildingAllocation, assignVillageWorker,
  setDisplayVillageLv,
} from "../../lib/db";
import { CAT_CARD_MAP, CAT_CARD_CATEGORIES } from "../../lib/catCardData";
import { albumXpFromCards } from "../../lib/catVillageAlbums";
import { subscribeMyCats, upgradeCatEquip } from "../../lib/catDb";
import {
  CATS, getBondLevel, CAT_TYPE_MAP,
  CAT_EQUIP_SLOTS, CAT_EQUIP_GRADE_NAMES, CAT_EQUIP_GRADE_COLORS, CAT_EQUIP_GRADE_BG,
  CAT_EQUIP_MAX_PLUS, calcForgeCost, catEquipEnhancement,
} from "../../lib/catData";
import { catLevelFromXP, catXPProgress } from "../../lib/catLevel";
import { getCatJob, CAT_JOB_LABELS } from "../../lib/catAssignment";
import { getLevelStyle } from "../../lib/archerLevel";
import { sfxSuccess, sfxEpic, sfxTap, sfxVillageCollect, sfxVillageBuild, sfxVillageExchange } from "../../lib/sound";
import {
  BUILDINGS, getVillageLevel, getBuildingStage,
  getProductionRate, getUpgradeRequirements, canUpgrade,
  calcPendingResources, RESOURCE_NAMES, DEFAULT_VILLAGE,
  TIERED_RESOURCES, getResourceKey,
  getWorkerCatMultiplier, getStageMultiplier, normalizeBuildingAllocation,
} from "../../lib/villageData";
import GachaMachine from "./GachaMachine";
import CatVillageNavArt from "./CatVillageNavArt";
import ShopSimulator from "./ShopSimulatorV3";
import { buildVillageCollectionResult } from "../../lib/villageCollectionResult";
import CouncilHall  from "./CouncilHall";
import VillageGoalBanner from "./VillageGoalBanner";
import VillageHomeScene, { VILLAGE_PLACES } from "./VillageHomeScene";
import { autoSpawnVillageGoal } from "../../lib/villageGoalDb";
import { craftPotion, subscribePotions } from "../../lib/db";
import { CARRY_POTIONS, THROW_POTIONS, RAID_POTIONS } from "../../lib/itemData";
import { calculateMaxCrafts } from "../../lib/consumableSystem";

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

// ── 貓咪工作抱怨留言庫 ───────────────────────────────────────
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
  // 瀏覽過濾：分類＋只看缺卡
  const [catFilter, setCatFilter]     = useState(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const [claimToast, setClaimToast] = useState("");
  const claimingRef = useRef(new Set());

  useEffect(() => {
    const unsub = subscribeCardMarket(all => {
      setListings(all.filter(l => l.sellerId !== memberId));
      const mine = all.filter(l => l.sellerId === memberId);
      setMyListings(mine);
      // 賣出但尚未請領的掛賣：自動幫賣家請領款項/交換卡片（見市集權限修正任務）
      mine.filter(l => l.status === "sold" && !l.sellerClaimed && !claimingRef.current.has(l.id))
        .forEach(l => {
          claimingRef.current.add(l.id);
          claimCardSaleProceeds(memberId, l.id).then(res => {
            if (res.ok) {
              const text = res.proceeds.type === "arrowdew" ? `箭露 ×${res.proceeds.amount}`
                : res.proceeds.type === "gachaToken" ? `扭蛋幣 ×${res.proceeds.amount}`
                : "交換卡片";
              setClaimToast(`🎉「${l.cardName}」已售出，收到 ${text}`);
              setTimeout(() => setClaimToast(""), 4000);
            }
          }).finally(() => claimingRef.current.delete(l.id));
        });
    });
    return unsub;
  }, [memberId]); // eslint-disable-line

  const dupCards = Object.entries(catCards || {})
    .filter(([,cnt]) => (cnt || 0) >= 2)
    .map(([id, cnt]) => ({ id, cnt, ...CAT_CARD_MAP[id] }))
    .filter(c => c.name);

  const collectedCount = Object.keys(catCards || {}).filter(id => (catCards[id] || 0) > 0).length;
  const totalCards = Object.keys(CAT_CARD_MAP).length;

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

  // 瀏覽過濾後的掛賣
  const visibleListings = listings.filter(l => {
    if (catFilter && l.cardCat !== catFilter) return false;
    if (onlyMissing && (catCards?.[l.cardId] || 0) > 0) return false;
    return true;
  });

  // 掛賣卡：我的擁有數量（0 = 缺這張）
  const ownedOf = cardId => (catCards?.[cardId] || 0);

  const priceLabel = l => {
    const pt = PRICE_TYPES.find(p => p.type === l.priceType);
    if (!pt) return "";
    return l.priceType === "card" ? "🃏 換卡" : `${pt.icon} ${l.priceAmount} ${pt.label}`;
  };

  return (
    <div className="px-5 pb-4">
      {claimToast && (
        <div className="mb-2 rounded-xl px-3 py-2 text-xs font-bold text-center"
          style={{ background: "rgba(74,222,128,0.15)", color: "#16a34a", border: "1px solid rgba(74,222,128,0.35)" }}>
          {claimToast}
        </div>
      )}

      {/* 標題＋收集統計 */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-black" style={{ color: C.brown }}>🃏 卡片掛賣市集</div>
        <div className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(92,61,46,0.08)", color: C.mid }}>
          ✅ 已收集 {collectedCount} / {totalCards}
        </div>
      </div>

      <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.border}` }}>
        {[["browse","🛍️ 瀏覽"],["mine","📋 我的"]].map(([id,lb]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2.5 text-xs font-bold transition-colors"
            style={{ background: tab===id ? C.brown : "rgba(255,255,255,0.5)", color: tab===id ? "#FFF8F0" : C.mid }}>
            {lb}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <div>
          {/* 過濾列：分類 chips ＋ 只看缺卡 */}
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button onClick={() => setCatFilter(null)}
              className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors"
              style={{ background: catFilter===null ? C.brown : "rgba(255,255,255,0.6)",
                color: catFilter===null ? "#FFF8F0" : C.mid, border: `1px solid ${C.border}` }}>
              全部
            </button>
            {Object.entries(CAT_CARD_CATEGORIES).map(([cat, info]) => (
              <button key={cat} onClick={() => setCatFilter(catFilter===cat ? null : cat)}
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors"
                style={{ background: catFilter===cat ? C.brown : "rgba(255,255,255,0.6)",
                  color: catFilter===cat ? "#FFF8F0" : C.mid, border: `1px solid ${C.border}` }}>
                {info.emoji} {info.label}
              </button>
            ))}
          </div>
          <label className="mb-3 flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer select-none"
            style={{ background: onlyMissing ? "rgba(211,147,58,0.18)" : "rgba(255,255,255,0.6)",
              color: onlyMissing ? "#9a6a1f" : C.mid, border: `1px solid ${onlyMissing ? "#D4933A" : C.border}` }}>
            <input type="checkbox" checked={onlyMissing}
              onChange={e => setOnlyMissing(e.target.checked)}
              className="accent-[#D4933A]" />
            🔴 只看我缺的
          </label>

          {visibleListings.length === 0 ? (
            <div className="text-center py-6 text-[11px]" style={{ color: C.muted }}>
              {listings.length === 0 ? "目前沒有掛賣的卡片" : "沒有符合條件的掛賣卡片"}
            </div>
          ) : (
            <>
              {/* 卡片網格（含擁有狀態） */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(0,1fr))", gap:8, maxHeight:360, overflowY:"auto", paddingRight:2 }}>
                {visibleListings.map(l => {
                  const owned = ownedOf(l.cardId);
                  const missing = owned === 0;
                  const isCardExchange = l.priceType === "card";
                  const isSelected = buyTarget?.id === l.id;
                  const catInfo = CAT_CARD_CATEGORIES[l.cardCat] || null;
                  return (
                    <div key={l.id}
                      style={{
                        borderRadius:12,
                        overflow:"hidden",
                        border: `2px solid ${isSelected ? C.brown : C.border}`,
                        background: l.cardBg || "rgba(255,255,255,0.8)",
                        cursor:"pointer",
                        boxShadow: "0 2px 6px rgba(100,70,50,0.08)",
                        transition: "all 0.15s",
                        transform: isSelected ? "translateY(-2px)" : "none",
                      }}
                      onClick={() => {
                        // 一律先展開確認區，避免誤買
                        setBuyTarget(isSelected ? null : l);
                        setOfferedCardId(null);
                      }}>
                      {/* 卡片圖片 */}
                      <div style={{ position:"relative", paddingTop:"120%" }}>
                        <img
                          src={`/cats/cat-cards/${l.cardId}.webp`}
                          alt={l.cardName}
                          loading="lazy"
                          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
                          onError={e => { e.currentTarget.style.display="none"; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display="flex"; }}
                        />
                        <div style={{ position:"absolute", inset:0, display:"none", alignItems:"center", justifyContent:"center", fontSize:32 }}>
                          {l.cardEmoji}
                        </div>
                        {/* 擁有狀態角標 */}
                        <div style={{
                          position:"absolute", top:5, left:5,
                          padding:"2px 7px", borderRadius:99, fontSize:9, fontWeight:900,
                          background: missing ? "#C0533A" : "rgba(34,120,70,0.92)",
                          color:"white", boxShadow:"0 1px 4px rgba(0,0,0,0.25)",
                        }}>
                          {missing ? "🔴 缺這張" : `✅ 已有 ×${owned}`}
                        </div>
                        {/* 分類角標 */}
                        {catInfo && (
                          <div style={{
                            position:"absolute", bottom:5, left:5,
                            padding:"1px 6px", borderRadius:99, fontSize:8, fontWeight:800,
                            background:"rgba(255,255,255,0.85)", color:C.mid,
                          }}>
                            {catInfo.emoji} {catInfo.label}
                          </div>
                        )}
                      </div>
                      {/* 資訊列（分層） */}
                      <div style={{ padding:"6px 7px 7px", background:"rgba(255,255,255,0.9)" }}>
                        <div style={{ fontSize:11, fontWeight:900, color:C.brown, lineHeight:1.25,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.cardName}</div>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:3 }}>
                          <span style={{ fontSize:10, fontWeight:900, color: isCardExchange ? "#9a6a1f" : "#2d6a4f" }}>
                            {priceLabel(l)}
                          </span>
                          {l.expiredAt && (() => {
                            const daysLeft = Math.ceil((l.expiredAt.seconds * 1000 - Date.now()) / 86400000);
                            return (
                              <span style={{ fontSize:8, color: daysLeft <= 1 ? "#ef4444" : C.muted }}>
                                ⏳ {daysLeft <= 0 ? "將下架" : `${daysLeft}天`}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize:8, color:C.mid, marginTop:1 }}>賣家：{l.sellerName}</div>
                        <div style={{
                          textAlign:"center", fontSize:10, fontWeight:900, marginTop:4,
                          padding:"4px 0", borderRadius:7,
                          background: isSelected ? C.brown : (isCardExchange ? "#D4933A" : C.sage),
                          color:"white",
                        }}>
                          {busy && isSelected ? "處理中…" : isSelected ? "收起" : isCardExchange ? "🔄 交換" : "🛒 購買"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 購買／交換確認區 */}
              {buyTarget && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.85)", border: `2px solid ${C.brown}`, boxShadow: C.shadow }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{buyTarget.cardEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black truncate" style={{ color: C.brown }}>{buyTarget.cardName}</div>
                      <div className="text-[10px] font-bold" style={{ color: ownedOf(buyTarget.cardId) ? "#2d6a4f" : "#C0533A" }}>
                        {ownedOf(buyTarget.cardId) > 0 ? `✅ 你已擁有 ×${ownedOf(buyTarget.cardId)}` : "🔴 你缺少這張卡片"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black" style={{ color: "#2d6a4f" }}>{priceLabel(buyTarget)}</div>
                      <div className="text-[9px]" style={{ color: C.muted }}>{buyTarget.sellerName}</div>
                    </div>
                  </div>

                  {buyTarget.priceType === "card" ? (
                    <>
                      <div className="text-[10px] font-bold mb-1.5" style={{ color: C.mid }}>
                        交換「{buyTarget.cardName}」— 選擇你要提供的重複卡片
                        {Array.isArray(buyTarget.sellerCardIds) && (
                          <span className="ml-1" style={{ color: "#9a6a1f" }}>（🔥 挑賣家缺的卡更容易成交）</span>
                        )}
                      </div>
                      {dupCards.length === 0 ? (
                        <div className="text-[10px] text-center py-1 mb-2" style={{ color: C.muted }}>你目前沒有重複卡片</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {/* 排序：🔥賣家缺 → 未知（舊掛賣）→ 賣家已有，減少捲動 */}
                          {dupCards
                            .map(c => ({
                              c,
                              sellerMissing: Array.isArray(buyTarget.sellerCardIds)
                                ? !buyTarget.sellerCardIds.includes(c.id)
                                : null, // 舊掛賣（無快照）→ 無法判斷
                            }))
                            .sort((a, b) => {
                              const rank = m => m.sellerMissing === true ? 0 : m.sellerMissing === null ? 1 : 2;
                              return rank(a) - rank(b);
                            })
                            .map(({ c, sellerMissing }) => {
                            return (
                              <button key={c.id} onClick={() => setOfferedCardId(c.id)}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold active:scale-95"
                                style={{
                                  background: offeredCardId === c.id ? C.brown : (c.bg || "#eee"),
                                  color: offeredCardId === c.id ? "#FFF8F0" : C.brown,
                                  border: `1px solid ${offeredCardId === c.id ? C.brown : C.border}`,
                                }}>
                                {c.emoji} {c.name} ×{c.cnt}
                                {sellerMissing !== null && (
                                  <span className="ml-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-black"
                                    style={{
                                      background: sellerMissing ? "rgba(34,120,70,0.15)" : "rgba(92,61,46,0.08)",
                                      color: sellerMissing ? "#2d6a4f" : C.muted,
                                    }}>
                                    {sellerMissing ? "🔥賣家缺" : "已有"}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mb-2 text-[10px] font-bold" style={{ color: C.mid }}>
                      購買後這張卡會加入你的收藏（{ownedOf(buyTarget.cardId) > 0 ? `目前 ×${ownedOf(buyTarget.cardId)}` : "目前 0 張"}）
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => { setBuyTarget(null); setOfferedCardId(null); }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold active:scale-95"
                      style={{ background: C.lockBd, color: C.muted }}>
                      取消
                    </button>
                    <button
                      onClick={() => handleBuy(buyTarget, buyTarget.priceType === "card" ? offeredCardId : null)}
                      disabled={(buyTarget.priceType === "card" && !offeredCardId) || busy}
                      className="flex-1 py-2 rounded-lg text-xs font-bold active:scale-95"
                      style={{
                        background: (buyTarget.priceType === "card" && !offeredCardId) ? C.lockBd : C.sage,
                        color: (buyTarget.priceType === "card" && !offeredCardId) ? C.muted : "white",
                      }}>
                      {busy ? "處理中…" : buyTarget.priceType === "card"
                        ? (offeredCardId
                            ? `確認交換（${CAT_CARD_MAP[offeredCardId]?.emoji || ""} ${CAT_CARD_MAP[offeredCardId]?.name || offeredCardId}`
                              + (Array.isArray(buyTarget.sellerCardIds) && !buyTarget.sellerCardIds.includes(offeredCardId) ? " 🔥賣家缺" : "") + "）"
                            : "請先選擇提供的卡片")
                        : `確認購買（${priceLabel(buyTarget)}）`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {/* 我的掛賣 */}
          <div className="mb-1 flex items-center justify-between">
            <div className="text-xs font-black" style={{ color: C.brown }}>我的掛賣</div>
            <div className="text-[10px]" style={{ color: C.muted }}>賣出後自動入帳</div>
          </div>
          {myListings.length === 0 ? (
            <div className="text-[11px] text-center py-3 rounded-xl" style={{ color: C.muted, background: "rgba(255,255,255,0.5)", border: `1px dashed ${C.border}` }}>
              尚無掛賣中的卡片
            </div>
          ) : myListings.map(l => {
            const pt = PRICE_TYPES.find(p => p.type === l.priceType);
            return (
              <div key={l.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                style={{ background: l.cardBg || "rgba(255,255,255,0.65)", border: `1px solid ${C.border}` }}>
                <span className="text-2xl shrink-0">{l.cardEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black truncate" style={{ color: C.brown }}>{l.cardName}</div>
                  <div className="text-[10px] font-bold" style={{ color: "#2d6a4f" }}>{pt?.icon} {l.priceAmount} {pt?.label}</div>
                </div>
                <button onClick={() => handleCancel(l)} disabled={busy}
                  className="text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 shrink-0"
                  style={{ background: "#C0533A", color: "white" }}>下架</button>
              </div>
            );
          })}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} disabled={dupCards.length === 0}
              className="mt-1 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
              style={{ background: dupCards.length > 0 ? "#D4933A" : C.lockBd, color: dupCards.length > 0 ? "white" : C.muted }}>
              {dupCards.length > 0 ? `＋ 掛賣卡片（${dupCards.length} 種重複可選）` : "暫無重複卡片可掛賣"}
            </button>
          ) : (
            <div className="rounded-xl p-3 mt-1" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}` }}>
              <div className="text-[10px] font-bold mb-2" style={{ color: C.mid }}>選擇卡片（需有重複）</div>
              <div className="flex flex-wrap gap-1.5 mb-3 max-h-24 overflow-y-auto">
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

// ── 產能分配設定 ─────────────────────────────────────────────
function AllocationSettings({ buildingId, level, allocations, memberId, onSaved }) {
  const building    = BUILDINGS[buildingId];
  const hasTier     = building && TIERED_RESOURCES.has(building.resource);
  const maxTier     = getBuildingStage(level);
  const stageMult   = getStageMultiplier(level);

  // 如果不是分層資源建築（如煉金室、扭蛋亭），不顯示分配 UI
  if (!hasTier) return null;

  const [editing, setEditing] = useState(false);
  const [alloc, setAlloc]     = useState(null);
  const [saving, setSaving]   = useState(false);

  // 讀取當前分配（或預設）
  const currentAlloc = normalizeBuildingAllocation(level, allocations[buildingId]);

  function startEdit() {
    setAlloc({ ...normalizeBuildingAllocation(level, allocations[buildingId]) });
    setEditing(true);
  }

  function adjust(tierStr, delta) {
    if (!alloc) return;
    const newVal = Math.max(0, Math.min(100, (alloc[tierStr] || 0) + delta));
    const oldVal = alloc[tierStr] || 0;
    const diff   = newVal - oldVal;
    if (diff === 0) return;

    const next = { ...alloc, [tierStr]: newVal };
    // remaining > 0 = 其他 tier 需要加總; remaining < 0 = 其他 tier 需要減總
    const others = Object.keys(next).filter(k => k !== tierStr && (next[k] || 0) > 0);
    if (others.length > 0) {
      let remaining = -diff;
      for (const k of others) {
        if (remaining === 0) break;
        const cur = next[k] || 0;
        if (remaining > 0) {
          // 本 tier 減少 → 其他 tier 增加
          const add = Math.min(100 - cur, remaining);
          next[k] = cur + add;
          remaining -= add;
        } else {
          // 本 tier 增加 → 其他 tier 減少
          const sub = Math.min(cur, -remaining);
          next[k] = cur - sub;
          remaining += sub;
        }
      }
    }
    // 確保總和 = 100（浮點補正）
    const sum = Object.values(next).reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      const diff2 = 100 - sum;
      const pos2 = Object.keys(next).filter(k => (next[k] || 0) > 0);
      if (pos2.length > 0) next[pos2[0]] = (next[pos2[0]] || 0) + diff2;
    }
    setAlloc(next);
  }

  async function saveAlloc() {
    if (!alloc || saving || !memberId) return;
    setSaving(true);
    await setBuildingAllocation(memberId, buildingId, alloc);
    setSaving(false);
    setEditing(false);
    onSaved?.(buildingId, alloc);
  }

  // 當前生效的分配（編輯中或已儲存）
  const displayAlloc = editing ? alloc : currentAlloc;
  const activeTiers  = [1,2,3,4,5].filter(t => (displayAlloc[String(t)] || 0) > 0);

  return (
    <div className="mt-4" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold" style={{ color: C.mid }}>
          🎛️ 產能分配 ×{stageMult.toFixed(1)}（T1~T{maxTier} 已解鎖）
        </div>
        {!editing && (
          <button onClick={startEdit}
            className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95"
            style={{ background: C.sage, color: "white" }}>
            ✏️ 調整
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-1.5">
          {activeTiers.map(t => (
            <div key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold"
              style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}` }}>
              <span style={{ color: C.brown }}>T{t}</span>
              <span style={{ color: C.sage }}>{displayAlloc[String(t)]}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {/* 2026-08-08：全部已解鎖 tier 都顯示（含 0%）——原本 pct=0 且槽滿時會把
              剛解鎖的 tier 列隱藏，玩家升到 9 級根本看不到 T3 可以分配。 */}
          {[1,2,3,4,5].slice(0, maxTier).map(t => {
            const pct = alloc?.[String(t)] || 0;
            return (
              <div key={t} className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold shrink-0" style={{ width: 24, color: C.brown }}>T{t}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: C.border, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: pct > 0 ? C.sage : C.lockBd,
                    borderRadius: 99, transition: "width .2s",
                  }} />
                </div>
                <span className="text-[10px] font-bold shrink-0" style={{ width: 30, textAlign: "right", color: C.brown }}>{pct}%</span>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => adjust(String(t), -10)}
                    className="w-6 h-6 rounded-md text-xs font-bold active:scale-90"
                    style={{ background: pct > 0 ? "rgba(192,83,58,0.15)" : C.lockBd, color: pct > 0 ? "#C0533A" : C.muted }}>-</button>
                  <button onClick={() => adjust(String(t), 10)}
                    className="w-6 h-6 rounded-md text-xs font-bold active:scale-90"
                    style={{ background: pct < 100 && activeTiers.length >= 1 ? "rgba(90,158,80,0.15)" : C.lockBd, color: pct < 100 ? C.sage : C.muted }}>+</button>
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 mt-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold"
              style={{ background: C.lockBd, color: C.muted }}>取消</button>
            <button onClick={saveAlloc} disabled={saving}
              className="flex-1 py-1.5 rounded-lg text-[10px] font-bold active:scale-95"
              style={{ background: C.sage, color: "white" }}>
              {saving ? "儲存中…" : "💾 儲存分配"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 貓咪駐紮工作設定 ─────────────────────────────────────────
function WorkerCatSettings({ buildingId, village, myCats, memberId, profile, onSaved }) {
  const currentWorkerId = village?.workers?.[buildingId] || null;
  const currentWorkerData = currentWorkerId ? myCats?.[currentWorkerId] : null;
  const currentWorkerInfo = currentWorkerId ? CATS[currentWorkerId] : null;
  const currentMult = getWorkerCatMultiplier(currentWorkerData);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 取得已被其他建築駐紮的貓咪
  const otherAssignedCatIds = new Set(
    Object.entries(village?.workers || {})
      .filter(([bId]) => bId !== buildingId)
      .map(([, cId]) => cId)
  );

  // 其他系統佔用的貓咪 IDs (陪練裝備中, 探險中, 地下城挖掘中)
  const equippedCatId     = profile?.equippedCat?.catId;
  const dungeonAssignedId = profile?.dungeonExcavation?.assignedCatId;
  const rawExpeditions    = profile?.expeditions || {};
  const expeditions       = Object.keys(rawExpeditions).length > 0 ? rawExpeditions : (profile?.expedition ? { 0: profile.expedition } : {});
  const onExpeditionCatIds = new Set(Object.values(expeditions).filter(Boolean).map(e => e.catId));

  // 取得目前空閒可指派的貓咪 (排除了：其他建築駐紮、陪練裝備中、遠征中、地下城挖掘中)
  const freeCats = Object.values(myCats || {}).filter(
    c => !otherAssignedCatIds.has(c.catId) &&
         c.catId !== equippedCatId &&
         !onExpeditionCatIds.has(c.catId) &&
         c.catId !== dungeonAssignedId
  );

  async function handleAssign(catId) {
    if (saving || !memberId) return;
    setSaving(true);
    sfxTap();
    const res = await assignVillageWorker(memberId, buildingId, catId);
    setSaving(false);
    if (res && res.ok === false) { alert(res.reason || "這隻貓正在別處工作"); return; }
    setEditing(false);
    onSaved?.(buildingId, catId);
  }

  return (
    <div className="mt-4" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-bold" style={{ color: C.mid }}>
          🐾 貓咪駐紮工作 {currentWorkerInfo ? `(+${Math.round((currentMult - 1) * 100)}% 產能)` : "(暫無駐紮)"}
        </div>
        <button onClick={() => setEditing(e => !e)}
          className="text-[10px] font-bold px-3 py-1 rounded-lg active:scale-95"
          style={{ background: editing ? C.lockBd : C.sage, color: editing ? C.muted : "white" }}>
          {editing ? "關閉" : currentWorkerInfo ? "⇄ 更換駐紮" : "＋ 派貓駐紮"}
        </button>
      </div>

      {/* 當前駐紮狀態 */}
      {!editing ? (
        currentWorkerInfo ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl border transition-all"
            style={{ background: "rgba(253,230,138,0.18)", borderColor: "rgba(245,158,11,0.3)" }}>
            <div className="flex items-center gap-2">
              <img src={`/cats/portraits/${currentWorkerId}.webp`} alt="" className="w-8 h-8 rounded-full object-cover border border-amber-400/50" />
              <div>
                <div className="text-xs font-black" style={{ color: C.brown }}>{currentWorkerInfo.name}</div>
                <div className="text-[10px]" style={{ color: C.mid }}>Lv.{catLevelFromXP(currentWorkerData?.catXP || 0)} · 產能加成 +{Math.round((currentMult - 1) * 100)}%</div>
              </div>
            </div>
            <button onClick={() => handleAssign(null)} disabled={saving}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 active:scale-95 border border-red-500/20">
              {saving ? "處理中…" : "解除駐紮"}
            </button>
          </div>
        ) : (
          <div className="text-center py-2.5 text-xs rounded-xl" style={{ background: "rgba(0,0,0,0.03)", color: C.muted }}>
            尚未指派貓咪駐紮，派遣貓咪駐紮可提高該建築的產量產速！
          </div>
        )
      ) : (
        /* 選貓面板 */
        <div className="space-y-2 pt-1">
          <div className="text-[10px] font-bold text-slate-500">選擇要派往本建築工作的貓咪：</div>
          {freeCats.length === 0 ? (
            <div className="text-[11px] text-center p-3 text-slate-400 bg-black/5 rounded-xl">
              😿 沒有空閒可指派的貓咪（全都在其他建築駐紮中）
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {freeCats.map(cat => {
                const info = CATS[cat.catId];
                const lv = catLevelFromXP(cat.catXP || 0);
                const mult = getWorkerCatMultiplier(cat);
                const isCurrent = cat.catId === currentWorkerId;
                return (
                  <button key={cat.catId}
                    type="button"
                    onClick={() => handleAssign(isCurrent ? null : cat.catId)}
                    disabled={saving}
                    className={`p-2 rounded-xl border flex items-center gap-2 text-left transition-all active:scale-95 ${
                      isCurrent
                        ? "bg-amber-500/20 border-amber-400 ring-1 ring-amber-400"
                        : "bg-white/80 border-slate-200 hover:border-amber-400/50"
                    }`}>
                    <img src={`/cats/portraits/${cat.catId}.webp`} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black truncate" style={{ color: C.brown }}>{info?.name || cat.catId}</div>
                      <div className="text-[9px] font-bold text-amber-700">+{(Math.round((mult - 1) * 100))}% 產能 (Lv.{lv})</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 升級 Modal ───────────────────────────────────────────────
function UpgradeModal({ buildingId, level, resources, onUpgrade, onClose, upgrading, memberId, memberName, catCards, onVillageUpdate = null, village, myCats, profile }) {
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

          {/* ── 產能分配 ── */}
          <AllocationSettings
            buildingId={buildingId}
            level={level}
            allocations={village?.allocations || {}}
            memberId={memberId}
            onSaved={(bid, newAlloc) => {
              if (typeof onVillageUpdate !== "function") return;
              onVillageUpdate(prev => {
                const base = prev || village;
                return { ...base, allocations: { ...(base?.allocations || {}), [bid]: newAlloc } };
              });
            }}
          />

          {/* ── 貓咪駐紮工作 ── */}
          <WorkerCatSettings
            buildingId={buildingId}
            village={village}
            myCats={myCats}
            memberId={memberId}
            profile={profile}
            onSaved={(bid, catId) => {
              if (typeof onVillageUpdate !== "function") return;
              onVillageUpdate(prev => {
                const base = prev || village;
                const nextWorkers = { ...(base?.workers || {}) };
                if (catId) nextWorkers[bid] = catId;
                else delete nextWorkers[bid];
                return { ...base, workers: nextWorkers };
              });
            }}
          />

          {/* 市集專屬：卡片市集 */}
          {buildingId === 'market' && (
            <>
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
const TIERED_LIST = ['ore','melon','fish','meat','driedfish','can','potion','fur','archer'];
const RES_EMOJI   = { ore:'⛏️', melon:'🌿', fish:'🐟', meat:'🥩', driedfish:'🐠', can:'🥫', potion:'🍵', fur:'🐾', archer:'🏹' };

// ── 資源倉庫（A+B+C：一頁看光＋tier 徽章＋生產來源＋分區收合）──
function ResourceRow({ resources, gachaCoins, buildings }) {
  // 生產來源（C）：哪些資源由建築生產、哪些由採集獲得
  const PRODUCER = {
    ore:       { kind: "building", id: "mine" },
    melon:     { kind: "building", id: "farm" },
    fish:      { kind: "building", id: "harbor" },
    meat:      { kind: "building", id: "hunting" },
    driedfish: { kind: "building", id: "market" },
    can:       { kind: "building", id: "warehouse" },
    archer:    { kind: "building", id: "archery" },
    potion:    { kind: "gather", label: "採集獲得" },
    fur:       { kind: "gather", label: "採集獲得" },
  };
  // 材料分區（B）：基礎材料常駐全開；特殊素材可收合
  const BASE_RES    = ["ore", "melon", "fish", "meat", "driedfish", "can"];
  const SPECIAL_RES = ["potion", "fur", "archer"];

  const TIER_BG = {
    1: { bg: "rgba(120, 80, 50, 0.08)",  color: "#784f32", border: "rgba(120, 80, 50, 0.2)" },
    2: { bg: "rgba(34, 197, 94, 0.08)",  color: "#166534", border: "rgba(34, 197, 94, 0.2)" },
    3: { bg: "rgba(59, 130, 246, 0.08)", color: "#1e40af", border: "rgba(59, 130, 246, 0.2)" },
    4: { bg: "rgba(147, 51, 234, 0.08)", color: "#6b21a8", border: "rgba(147, 51, 234, 0.2)" },
    5: { bg: "rgba(245, 158, 11, 0.12)", color: "#b45309", border: "rgba(245, 158, 11, 0.3)" },
  };

  const [showSpecial, setShowSpecial] = useState(true);

  const totalOf = res =>
    [1, 2, 3, 4, 5].reduce((s, t) => s + Math.floor(resources?.[`${res}_t${t}`] || 0), 0);
  const badgesOf = res => {
    const list = [];
    for (let t = 1; t <= 5; t++) {
      const count = Math.floor(resources?.[`${res}_t${t}`] || 0);
      if (count > 0) list.push({ t, count });
    }
    return list;
  };
  const specialSubtotal = SPECIAL_RES.reduce((s, res) => s + totalOf(res), 0);

  const renderCard = (res) => {
    const count  = totalOf(res);
    const badges = badgesOf(res);
    const producer = PRODUCER[res];
    const tier    = badges[0]?.t || 1;
    const cfg     = TIER_BG[tier];
    const producerLine = producer?.kind === "building"
      ? `🏛️ ${BUILDINGS[producer.id].name} Lv.${buildings?.[producer.id] || 1}`
      : `🧺 ${producer.label}`;
    return (
      <div key={res} className="flex flex-col justify-between rounded-2xl px-2.5 py-2 transition-all"
        style={{
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          opacity: count > 0 ? 1 : 0.55,
          minHeight: 74,
        }}>
        <div className="flex items-center justify-between gap-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span style={{ fontSize: 16 }}>{RES_EMOJI[res]}</span>
            <span className="text-xs font-black truncate" style={{ color: C.brown }}>{RESOURCE_NAMES[res]}</span>
          </div>
          <span className="text-sm font-black shrink-0" style={{ color: cfg.color, fontVariantNumeric: "tabular-nums" }}>
            {count.toLocaleString()}
          </span>
        </div>
        {/* 生產來源（C） */}
        <div className="mt-0.5 text-[9px] font-bold truncate" style={{ color: C.mid }}>
          {producerLine}
        </div>
        {/* tier 徽章（A：非零 tier 直接顯示，不用切頁籤） */}
        <div className="mt-1 flex flex-wrap gap-1">
          {badges.length ? badges.map(({ t, count: c }) => (
            <span key={t} className="rounded-md px-1.5 py-0.5 text-[9px] font-black"
              style={{ background: TIER_BG[t].bg, color: TIER_BG[t].color, border: `1px solid ${TIER_BG[t].border}` }}>
              T{t} {c.toLocaleString()}
            </span>
          )) : <span className="text-[9px] font-bold" style={{ color: C.muted }}>尚無庫存</span>}
        </div>
      </div>
    );
  };

  return (
    <section className="mx-4 mb-3 rounded-2xl px-4 py-3 shadow-sm"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div className="mb-2.5 flex items-center gap-1.5">
        <h2 className="text-sm font-black" style={{ color: C.brown }}>
          <span>📦</span> 村莊資源庫
        </h2>
      </div>

      {/* 貨幣條（常駐最上層） */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" }}>
          <span style={{ fontSize: 18 }}>💧</span>
          <div className="min-w-0">
            <div className="text-base font-black leading-none" style={{ color: C.brown, fontVariantNumeric: "tabular-nums" }}>
              {Math.floor(resources?.arrowdew || 0).toLocaleString()}
            </div>
            <div className="text-[10px] font-bold mt-0.5" style={{ color: C.mid }}>箭露</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" }}>
          <span style={{ fontSize: 18 }}>🎰</span>
          <div className="min-w-0">
            <div className="text-base font-black leading-none" style={{ color: C.brown, fontVariantNumeric: "tabular-nums" }}>
              {Math.floor(gachaCoins || 0).toLocaleString()}
            </div>
            <div className="text-[10px] font-bold mt-0.5" style={{ color: C.mid }}>扭蛋幣</div>
          </div>
        </div>
      </div>

      {/* 基礎材料（常駐全開） */}
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black" style={{ color: C.brown }}>
        <span>🧺</span> 基礎材料
        <span className="text-[10px] font-bold" style={{ color: C.mid }}>由村莊建築生產</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BASE_RES.map(renderCard)}
      </div>

      {/* 特殊素材（可收合，標題顯示合計） */}
      <button type="button" onClick={() => setShowSpecial(v => !v)}
        aria-expanded={showSpecial}
        className="mt-3 mb-1.5 flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 transition-all active:scale-[0.99]"
        style={{ background: "rgba(107,142,94,0.08)", border: "1px solid rgba(107,142,94,0.18)" }}>
        <span className="flex items-center gap-1.5 text-xs font-black" style={{ color: C.brown }}>
          <span>✨</span> 特殊素材
          <span className="text-[10px] font-bold" style={{ color: C.mid }}>升級與鍛造使用</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-black" style={{ color: C.sage, fontVariantNumeric: "tabular-nums" }}>
            合計 {specialSubtotal.toLocaleString()}
          </span>
          <span style={{ fontSize: 9, color: C.mid }}>{showSpecial ? "▲" : "▼"}</span>
        </span>
      </button>
      {showSpecial && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SPECIAL_RES.map(renderCard)}
        </div>
      )}
    </section>
  );
}

// ── 資源鍵顯示名稱 ───────────────────────────────────────────
function formatResKey(key) {
  const BASE = { ore:"礦物",meat:"動物肉",driedfish:"小魚乾",melon:"瓜瓜",fish:"鮮魚",can:"貓罐頭",potion:"貓薄荷藥水",fur:"貓毛",arrowdew:"箭露" };
  const parts = key.split("_t");
  return parts[1] ? `${BASE[parts[0]] || parts[0]} T${parts[1]}` : (BASE[key] || key);
}

// ── 鍛造面板 ─────────────────────────────────────────────────
// 2.0：可直接選任意貓咪強化（含出任務中的貓）——強化裝備不佔用貓，
//      因此不再受限於 equipCat 的忙碌檢查；忙碌貓僅顯示徽章。
// 動畫：進場序列＋選貓放大＋鐵砧火花強化中＋升階金光。
function ForgePanel({ profile, resources, myCats }) {
  const [forging,           setForging]           = useState(false);
  const [activeForgingSlot, setActiveForgingSlot] = useState(null);
  const [forgeMsg,          setForgeMsg]          = useState(null);
  const [selectedCatId,     setSelectedCatId]     = useState(null);

  // 全部貓（含忙碌），預設選 equippedCat，沒有則第一隻
  const ownedCats = Object.values(myCats || {});
  const equippedCatId = profile?.equippedCat?.catId;
  const catId = selectedCatId || equippedCatId || ownedCats[0]?.catId || null;

  if (!catId || ownedCats.length === 0) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.mid, textAlign:"center", padding:32 }}>
        <div>
          <div style={{ fontSize:40, marginBottom:12 }}>🐱</div>
          <div style={{ fontSize:14, fontWeight:"bold" }}>還沒有任何貓咪夥伴</div>
          <div style={{ fontSize:12, marginTop:4 }}>先去獲得一隻貓，才能使用鍛造功能</div>
        </div>
      </div>
    );
  }

  // 選中貓的即時資料（subscribeMyCats 訂閱，強化後自動更新）
  const catData  = ownedCats.find(c => c.catId === catId) || {};

  // 完整九隻貓咪清單：已擁有照圖鑑順序在前，未擁有鎖定在後
  const ownedIdSet = new Set(ownedCats.map(c => c.catId));
  const fullCatList = [
    ...Object.keys(CATS).filter(id => ownedIdSet.has(id)),
    ...Object.keys(CATS).filter(id => !ownedIdSet.has(id)),
  ];
  const name     = catData.name || CATS[catId]?.name || "貓咪";
  const catXP    = catData.catXP || 0;
  const catLevel = catLevelFromXP(catXP);
  const xpProg   = catXPProgress(catXP);
  const bondLevel = getBondLevel(catData.bond || 0);
  const equip    = catData.equip || {};
  // 類型以 CAT_TYPE_MAP 固定對應為準（位置決定）；DB 的 type 欄位僅作相容後備
  const realType = CAT_TYPE_MAP[catId] || catData.type || "allround";
  const typeLabel = { attack:"攻擊型", defense:"防禦型", allround:"治癒型" }[realType] || "治癒型";
  const typeColor = { attack:"#ef4444", defense:"#3b82f6", allround:"#22c55e" }[realType] || "#22c55e";
  // 忙碌狀態（僅顯示，不阻擋鍛造）
  const busyJob = getCatJob(profile || {}, catId);
  const busyLabel = busyJob ? CAT_JOB_LABELS[busyJob.job] || busyJob.job : null;

  async function handleForge(slotId) {
    if (forging || activeForgingSlot || !profile?.id) return;
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
    const currentEnhancement = catEquipEnhancement(slotData.grade, slotData.plusLevel);
    let newGrade    = slotData.grade;
    let newPlusLevel = slotData.plusLevel;
    if (slotData.plusLevel < CAT_EQUIP_MAX_PLUS) {
      newPlusLevel = slotData.plusLevel + 1;
    } else {
      newGrade    = CAT_EQUIP_GRADE_NAMES[gIdx + 1];
      newPlusLevel = 0;
    }

    setForging(true);
    setActiveForgingSlot(slotId);
    if (typeof sfxVillageExchange === "function") sfxVillageExchange();

    // 播放 750ms 的鐵砧火花鍛造動畫
    await new Promise(resolve => setTimeout(resolve, 750));

    const res = await upgradeCatEquip(profile.id, catId, slotId, newGrade, newPlusLevel, cost);
    setForging(false);
    setActiveForgingSlot(null);

    if (res.ok) {
      sfxSuccess();
      const nextEnhancement = currentEnhancement + 1;
      if (newPlusLevel === 0) {
        // 升階：金光慶祝
        if (typeof sfxEpic === "function") sfxEpic();
        setForgeMsg(`✨✨ 升階成功！${name} 的${CAT_EQUIP_SLOTS.find(s => s.id === slotId)?.label || slotId} → ${newGrade} +${nextEnhancement}`);
      } else {
        setForgeMsg(`🔨 強化成功！${newGrade} +${nextEnhancement}`);
      }
    } else {
      setForgeMsg("鍛造失敗，請再試");
    }
    setTimeout(() => setForgeMsg(null), 2500);
  }

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px 14px" }}>
      <style>{`
        @keyframes forgeBannerIn {
          from { opacity:0; transform: translateY(-14px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes forgeAnvil {
          0%,100% { transform: translateY(0) rotate(0); }
          50%     { transform: translateY(-4px) rotate(-2deg); }
        }
        @keyframes forgeFire {
          0%,100% { opacity:.55; transform: scale(1) translateY(0); }
          50%     { opacity:.95; transform: scale(1.12) translateY(-2px); }
        }
        @keyframes forgeCatIn {
          from { opacity:0; transform: translateY(10px) scale(.94); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        @keyframes forgeCatPop {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.06); }
        }
        @keyframes forgeHammer {
          0% { transform: rotate(0deg) translate(0, 0); }
          30% { transform: rotate(-30deg) translate(-2px, -5px); }
          70% { transform: rotate(15deg) translate(1px, 2px); }
          100% { transform: rotate(0deg) translate(0, 0); }
        }
        @keyframes forgeSpark {
          0% { transform: scale(0.6); opacity: 0; }
          40% { transform: scale(1.4); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
        @keyframes forgeGlow {
          0%,100% { box-shadow: 0 0 0 rgba(245,158,11,0); }
          50%     { box-shadow: 0 0 18px rgba(245,158,11,.5); }
        }
        @media (prefers-reduced-motion: reduce) {
          .forge-banner, .forge-cat, .forge-cat-pop, .forge-glow { animation:none !important; }
        }
      `}</style>

      {/* 場景化標頭：鍛造工坊 */}
      <div className="forge-banner" style={{
        borderRadius:16, overflow:"hidden", position:"relative", marginBottom:10,
        background:"linear-gradient(135deg,#3a2416,#5C3D2E 55%,#8a5a3b)",
        border:`1px solid ${C.border}`, boxShadow:"0 4px 14px rgba(60,30,10,0.35)",
        animation:"forgeBannerIn .45s ease-out both", color:"#FFF8F0",
      }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 75% 110%, rgba(245,158,11,.4), transparent 55%)" }} />
        <div className="forge-fire" style={{ position:"absolute", right:14, bottom:0, fontSize:26, animation:"forgeFire 1.6s ease-in-out infinite", filter:"drop-shadow(0 0 8px rgba(245,158,11,.8))" }}>🔥</div>
        <div style={{ position:"relative", display:"flex", alignItems:"center", gap:12, padding:"14px 16px" }}>
          <div style={{ fontSize:34, animation:"forgeAnvil 1.8s ease-in-out infinite", filter:"drop-shadow(0 3px 6px rgba(0,0,0,.45))" }}>⚒️</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:9, fontWeight:900, letterSpacing:3, color:"rgba(255,248,240,.65)" }}>CAT BLACKSMITH</div>
            <div style={{ fontSize:18, fontWeight:900, marginTop:2 }}>貓貓鍛造工坊</div>
            <div style={{ fontSize:10, marginTop:3, color:"rgba(255,248,240,.75)" }}>選擇任意貓咪強化裝備・出任務中的貓也能鍛造</div>
          </div>
          {busyLabel && (
            <div style={{ fontSize:9, fontWeight:800, padding:"3px 8px", borderRadius:99, background:"rgba(245,158,11,.2)", border:"1px solid rgba(245,158,11,.5)", color:"#fcd34d", whiteSpace:"nowrap" }}>
              ⏳ {busyLabel}
            </div>
          )}
        </div>
      </div>

      {/* 提示訊息 */}
      {forgeMsg && (
        <div style={{ background:"rgba(255,255,255,0.92)", border:`1px solid ${C.border}`, borderRadius:10,
          padding:"8px 14px", marginBottom:10, textAlign:"center", color:C.brown, fontWeight:"bold", fontSize:13 }}>
          {forgeMsg}
        </div>
      )}

      {/* 選貓列（含忙碌貓） */}
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:10, fontWeight:800, color:C.mid, marginBottom:5 }}>
          🐱 選擇要強化的貓咪（已擁有 {ownedCats.length}/9 隻・點擊切換）
        </div>
        <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"4px 2px 6px" }}>
          {fullCatList.map(cid => {
            const cat = myCats?.[cid] || {};
            const owned = !!myCats?.[cid];
            const isActive = cid === catId;
            const job = owned ? getCatJob(profile || {}, cid) : null;
            const catName = cat.name || CATS[cid]?.name || cid;
            return (
              <button key={cid}
                onClick={() => {
                  if (!owned || isActive || forging) return;
                  sfxTap && sfxTap();
                  setSelectedCatId(cid);
                }}
                title={owned ? (isActive ? catName : `選擇 ${catName}`) : `${catName}（尚未擁有）`}
                className={isActive ? "forge-cat-pop" : "forge-cat"}
                style={{
                  flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                  padding:"6px 8px 7px", borderRadius:12,
                  cursor: !owned ? "not-allowed" : (isActive ? "default" : "pointer"),
                  background: isActive ? "linear-gradient(160deg,#fff7e6,#fde8c8)" : (owned ? C.card : "rgba(0,0,0,.045)"),
                  border: isActive ? "2px solid #d97706" : (owned ? `1px solid ${C.border}` : "1px dashed rgba(0,0,0,.18)"),
                  boxShadow: isActive ? "0 0 0 3px rgba(217,119,6,.22), 0 4px 10px rgba(100,70,50,.14)" : (owned ? C.shadow : "none"),
                  transform: isActive ? "translateY(-2px)" : "none",
                  transition: "all .18s",
                  animation: isActive ? "forgeCatPop 1.4s ease-in-out infinite" : "forgeCatIn .35s ease-out both",
                  opacity: isActive ? 1 : (owned ? .92 : .55),
                  width: 64,
                }}>
                <div style={{ width:46, height:46, borderRadius:10, overflow:"hidden", background:"#f5ede0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, position:"relative" }}>
                  <span style={{ position:"absolute", opacity:owned ? .35 : .6, filter: owned ? "none" : "grayscale(1)" }}>🐱</span>
                  {owned && (
                    <img src={`/cats/portraits/${cid}.webp`} alt={catName}
                      style={{ width:"100%", height:"100%", objectFit:"cover", position:"relative" }}
                      onError={e => { e.target.style.display="none"; }}
                    />
                  )}
                  {job && (
                    <div style={{ position:"absolute", bottom:1, right:1, fontSize:10, filter:"drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}>⏳</div>
                  )}
                </div>
                <span style={{ fontSize:9, color: isActive ? "#b45309" : (owned ? C.mid : "#9ca3af"), fontWeight:700, maxWidth:58, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {catName}
                </span>
                {!owned ? (
                  <span style={{ fontSize:8, color:"#9ca3af", fontWeight:800 }}>🔒 未擁有</span>
                ) : job ? (
                  <span style={{ fontSize:8, color:"#b45309", fontWeight:800 }}>{CAT_JOB_LABELS[job.job] || job.job}</span>
                ) : (
                  <span style={{ fontSize:8, color:"#2d6a4f", fontWeight:800 }}>✓ 空閒</span>
                )}
                {isActive && <span style={{ fontSize:8, color:"#d97706", fontWeight:900 }}>鍛造中</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選中貓資訊卡 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"12px", marginBottom:10, display:"flex", gap:12, alignItems:"center", boxShadow:C.shadow }}>
        <div style={{ flexShrink:0, width:64, height:64, borderRadius:12, overflow:"hidden", border:`2px solid ${C.border}`, background:"#f5ede0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30 }}>
          <img src={`/cats/portraits/${catId}.webp`} alt={name}
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
            onError={e => { e.target.style.display="none"; }}
          />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <span style={{ fontWeight:900, fontSize:15, color:C.brown }}>{name}</span>
            <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:99, background:`${typeColor}18`, color:typeColor, border:`1px solid ${typeColor}66` }}>{typeLabel}</span>
            {busyLabel && (
              <span style={{ fontSize:9, fontWeight:800, padding:"1px 7px", borderRadius:99, background:"rgba(245,158,11,.14)", color:"#b45309", border:"1px solid rgba(217,119,6,.4)" }}>
                ⏳ {busyLabel}
              </span>
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, flexWrap:"wrap" }}>
            <span style={{
              fontSize: "10px", fontWeight: 900, padding: "2px 8px", borderRadius: "99px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)", display: "inline-flex", alignItems: "center",
              ...getLevelStyle(xpProg.level)
            }}>
              Lv.{xpProg.level}
            </span>
            <span style={{ fontSize:11, color:C.mid }}>· 羈絆 {bondLevel}</span>
            {busyLabel && <span style={{ fontSize:10, color:"#b45309" }}>· 強化裝備不影響出任務</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ flex:1, height:5, background:C.border, borderRadius:99, overflow:"hidden" }}>
              <div style={{ width:`${xpProg.pct}%`, height:"100%", background:"#d97706", borderRadius:99, transition:"width .4s" }} />
            </div>
            <span style={{ fontSize:9, color:C.muted, whiteSpace:"nowrap" }}>{xpProg.current}/{xpProg.needed} XP</span>
          </div>
        </div>
      </div>

      {/* 裝備格 */}
      {CAT_EQUIP_SLOTS.map((slot, slotIdx) => {
        const slotData = equip[slot.id] || { grade: "普通", plusLevel: 0 };
        const gIdx     = Math.max(0, CAT_EQUIP_GRADE_NAMES.indexOf(slotData.grade));
        const cost     = calcForgeCost(slot.id, slotData.grade, slotData.plusLevel);
        const canAfford = cost ? Object.entries(cost).every(([k,v]) => (resources[k]||0) >= v) : false;
        const isMaxed  = !cost;
        const enhancement = catEquipEnhancement(slotData.grade, slotData.plusLevel);
        const bonus    = (gIdx * 10 + 1) + (slotData.plusLevel || 0);
        const statLabel = slot.stat === "hp"
          ? `HP +${bonus * 5}`
          : slot.stat === "atk" ? `ATK +${bonus}` : `DEF +${bonus}`;
        const nextLabel = isMaxed ? "MAX"
          : slotData.plusLevel < CAT_EQUIP_MAX_PLUS
            ? `強化 +${enhancement + 1}`
            : `升階 ${CAT_EQUIP_GRADE_NAMES[gIdx + 1]} +${enhancement + 1}`;
        const gradeColor = CAT_EQUIP_GRADE_COLORS[gIdx] || C.mid;
        const gradeBg    = CAT_EQUIP_GRADE_BG[gIdx]    || "rgba(156,163,175,0.1)";

        return (
          <div key={slot.id} className="forge-glow" style={{
            position: "relative",
            background: gradeBg, borderRadius:12, padding:"12px 14px", marginBottom:9,
            border:`1.5px solid ${gradeColor}44`, display:"flex", alignItems:"center", gap:10,
            overflow: "hidden",
            animation: activeForgingSlot === slot.id ? "forgeGlow 1.1s ease-in-out infinite" : "none",
          }}>
            {/* Forging Animation Overlay：鐵砧＋火花 */}
            {activeForgingSlot === slot.id && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(92,61,46,0.9)", borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 20,
              }}>
                <div style={{ position: "relative", width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 22, position: "absolute", bottom: 0, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.6))" }}>🔩</div>
                  <div style={{ fontSize: 30, animation: "forgeHammer 0.32s infinite ease-in-out", transformOrigin: "bottom right" }}>🔨</div>
                  <div style={{ fontSize: 20, position: "absolute", right: -2, top: -2, animation: "forgeSpark 0.32s infinite ease-in-out" }}>💥</div>
                </div>
                <span style={{ color: "#FFF8F0", fontSize: 13, fontWeight: 900, letterSpacing: 1.5, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                  ⚒️ 鍛造中...
                </span>
              </div>
            )}

            <div style={{ width:44, height:44, borderRadius:10, overflow:"hidden", border:`1.5px solid ${gradeColor}66`, flexShrink:0, background:"#fff", boxShadow:"0 2px 6px rgba(0,0,0,0.12)" }}>
              <img
                src={slot.image}
                alt={slot.label}
                style={{ width:"100%", height:"100%", objectFit:"cover" }}
                onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }}
              />
              <div style={{ display:"none", width:"100%", height:"100%", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                {slot.icon}
              </div>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <span style={{ fontWeight:"bold", color:C.brown, fontSize:13 }}>{slot.label}</span>
                <span style={{ fontSize:10, fontWeight:800, color:"white", background:gradeColor, borderRadius:6, padding:"1px 6px" }}>
                  +{enhancement}
                </span>
              </div>
              <div style={{ fontSize:11, color:gradeColor, fontWeight:"bold" }}>
                {slotData.grade} +{enhancement}
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

// ── 藥水製作面板 ────────────────────────────────────────────
function ConsumableArt({ item, size = 40 }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setLoaded(true);
    image.onerror = () => setLoaded(false);
    image.src = item.asset;
    return () => { image.onload = null; image.onerror = null; };
  }, [item.asset]);
  if (!loaded) return <span aria-hidden="true" style={{ width:size, height:size, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:size * .55 }}>{item.icon}</span>;
  const col = item.spriteIndex % 6;
  const row = Math.floor(item.spriteIndex / 6);
  return (
    <span aria-hidden="true" style={{
      width:size, height:size, flexShrink:0, display:"inline-block",
      backgroundImage:`url(${item.asset})`, backgroundRepeat:"no-repeat",
      backgroundSize:"600% 500%", backgroundPosition:`${col * 20}% ${row * 25}%`,
    }} />
  );
}

const POTION_CRAFT_GROUPS = {
  carry: [
    { id:"recovery", label:"回復續航", icon:"❤️", match:item => ["heal","regen"].includes(item.family) && !item.futureFeature },
    { id:"offense", label:"輸出強化", icon:"⚔️", match:item => ["power","berserk"].includes(item.family) && !item.futureFeature },
    { id:"defense", label:"防護生存", icon:"🛡️", match:item => ["guard","shield"].includes(item.family) && !item.futureFeature },
    { id:"future", label:"預備配方", icon:"✨", match:item => !!item.futureFeature },
  ],
  throw: [
    { id:"damage", label:"直接傷害", icon:"💥", match:item => item.family === "damage" && !item.futureFeature },
    { id:"debuff", label:"弱化破甲", icon:"🧴", match:item => item.family === "debuff" && !item.futureFeature },
    { id:"control", label:"支援控制", icon:"🎯", match:item => ["support","control"].includes(item.family) && !item.futureFeature },
    { id:"future", label:"預備配方", icon:"🕸️", match:item => !!item.futureFeature },
  ],
  raid: [
    { id:"damage", label:"討伐傷害", icon:"💣", match:item => item.actionCost === "arrow" },
    { id:"tactics", label:"討伐戰術", icon:"👑", match:item => item.actionCost !== "arrow" },
  ],
};

function PotionCraftingPanel({ resources, potionInventory, coins, memberId, onCrafted }) {
  const [tab, setTab] = useState("carry");
  const [craftMode, setCraftMode] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // 稀有度顏色
  const RARITY_COLORS = {
    common:    { bg:"rgba(156,163,175,0.12)", text:"#6b7280", label:"普通" },
    uncommon:  { bg:"rgba(34,197,94,0.12)",  text:"#16a34a", label:"非凡" },
    rare:      { bg:"rgba(59,130,246,0.12)", text:"#2563eb", label:"稀有" },
    epic:      { bg:"rgba(168,85,247,0.12)", text:"#9333ea", label:"史詩" },
    legendary: { bg:"rgba(234,179,8,0.12)",  text:"#ca8a04", label:"傳說" },
  };

  const potions = tab === "carry" ? CARRY_POTIONS : tab === "throw" ? THROW_POTIONS : RAID_POTIONS;
  const potionGroups = (POTION_CRAFT_GROUPS[tab] || []).map(group => ({
    ...group,
    items: potions.filter(group.match),
  })).filter(group => group.items.length > 0);

  async function handleCraft(potion) {
    if (busy || !memberId) return;
    const maxCrafts = calculateMaxCrafts(potion, resources, coins);
    const executions = craftMode === "max" ? maxCrafts : craftMode;
    if (craftMode !== "max" && maxCrafts < executions) return;
    if (executions <= 0) return;
    setBusy(true);
    try {
      const res = await craftPotion(memberId, potion.id, executions);
      if (res.ok) {
        setMsg(`✅ 成功製作 ${potion.name} ×${res.outputCount}！`);
        sfxSuccess();
        onCrafted?.();
      } else {
        setMsg(`❌ ${res.reason}`);
      }
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div>
      <div className="text-xs font-bold mb-3" style={{ color: C.mid }}>🧪 藥水製作</div>
      <div className="text-[10px] mb-3" style={{ color: C.muted }}>
        消耗村莊資源 + 金幣來合成藥水，合成後到背包使用。
      </div>

      {/* 即時訊息 */}
      {msg && (
        <div className="rounded-xl px-4 py-2 mb-3 text-xs font-bold text-center"
          style={{ background: msg.startsWith("✅") ? "rgba(90,158,80,0.15)" : "rgba(192,83,58,0.12)",
            border: `1px solid ${msg.startsWith("✅") ? "#5A9E50" : "#C0533A"}`,
            color: msg.startsWith("✅") ? "#3D7A3A" : "#9B3A20" }}>
          {msg}
        </div>
      )}

      {/* 頁籤：攜帶型 vs 投擲型 */}
      <div className="flex rounded-xl overflow-hidden mb-3" style={{ border: `1px solid ${C.border}` }}>
        {[["carry","💊 攜帶型"],["throw","💣 投擲型"],["raid","👑 討伐型"]].map(([id, lb]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2 text-[11px] font-bold transition-colors"
            style={{
              background: tab === id ? C.brown : "rgba(255,255,255,0.5)",
              color: tab === id ? "#FFF8F0" : C.mid,
            }}>
            {lb}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 mb-3" role="group" aria-label="製作次數">
        {[[1,"製作 1 次"],[5,"製作 5 次"],["max","最大數量"]].map(([value, label]) => (
          <button key={value} onClick={() => setCraftMode(value)}
            className="flex-1 min-h-11 px-2 py-2 rounded-lg text-[11px] font-bold transition-colors"
            style={{ background: craftMode === value ? C.sage : "rgba(255,255,255,0.55)", color: craftMode === value ? "white" : C.mid, border:`1px solid ${C.border}` }}>
            {label}
          </button>
        ))}
      </div>

      {/* 金幣顯示 */}
      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
        style={{ background: "rgba(255,255,255,0.6)", border: `1px solid ${C.border}` }}>
        <span style={{ fontSize: 18 }}>🪙</span>
        <span className="font-black text-sm" style={{ color: C.brown }}>{Math.floor(coins || 0).toLocaleString()}</span>
        <span className="text-[10px]" style={{ color: C.muted }}>金幣</span>
      </div>

      {/* 依用途分區 */}
      <div className="flex flex-col gap-4">
        {potionGroups.map(group => (
          <section key={group.id}>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <div className="flex items-center gap-1.5 text-xs font-black" style={{ color:C.brown }}>
                <span aria-hidden="true">{group.icon}</span>
                <span>{group.label}</span>
              </div>
              <span className="text-[10px] font-bold" style={{ color:C.muted }}>{group.items.length} 種</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-stretch">
              {group.items.map(p => {
                const havePotion = potionInventory?.[p.id] || 0;
                const maxCrafts = calculateMaxCrafts(p, resources, coins);
                const executions = craftMode === "max" ? maxCrafts : craftMode;
                const canCraft = executions > 0 && maxCrafts >= executions;
                const costMultiplier = Math.max(1, executions);
                const totalGold = (p.gold || 0) * costMultiplier;
                return (
                  <div key={p.id} className="rounded-lg p-2 min-w-0 h-full flex flex-col"
                    style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
                    <div className="flex items-start gap-1.5 mb-1.5 min-w-0">
                      <ConsumableArt item={p} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] leading-tight font-black break-words" style={{ color:C.brown }}>{p.name}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {RARITY_COLORS[p.rarity] && (
                            <span className="text-[9px] leading-none font-bold px-1 py-0.5 rounded"
                              style={{ background: RARITY_COLORS[p.rarity].bg, color: RARITY_COLORS[p.rarity].text }}>
                              {RARITY_COLORS[p.rarity].label}
                            </span>
                          )}
                          <span className="text-[9px] font-black" style={{ color:havePotion > 0 ? C.sage : C.muted }}>持有 {havePotion}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] leading-snug font-bold min-h-7 mb-1" style={{ color:C.sage }}>{p.effectText}</div>
                    <div className="text-[9px] leading-snug mb-2 min-h-6" style={{
                      color:C.muted, display:"-webkit-box", WebkitLineClamp:2,
                      WebkitBoxOrient:"vertical", overflow:"hidden",
                    }}>{p.desc}</div>
                    {p.futureFeature && (
                      <div className="text-[9px] leading-tight font-bold mb-2 px-1.5 py-1 rounded" style={{ color:"#9a5b08", background:"rgba(212,147,58,0.10)" }}>
                        預備道具・尚未開放使用
                      </div>
                    )}
                    <div className="flex flex-col gap-1 mb-2">
                      {p.recipe.map(r => {
                        const have = Math.floor(resources?.[r.id] || 0);
                        const need = r.count * costMultiplier;
                        const ok = have >= need;
                        const resEmoji = RES_EMOJI[r.id.split("_t")[0]] || "📦";
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-1 px-1.5 py-1 rounded text-[9px] font-bold min-w-0"
                            style={{ background: ok ? "rgba(90,158,80,0.10)" : "rgba(192,83,58,0.08)",
                              color: ok ? C.sage : "#C0533A" }}>
                            <span className="truncate min-w-0">{resEmoji} {formatResKey(r.id)}</span>
                            <span className="shrink-0">{need}/{have}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between gap-1 px-1.5 py-1 rounded text-[9px] font-bold"
                        style={{ background: (coins || 0) >= totalGold ? "rgba(212,147,58,0.12)" : "rgba(192,83,58,0.08)",
                          color: (coins || 0) >= totalGold ? "#D4933A" : "#C0533A" }}>
                        <span>🪙 金幣</span><span>{totalGold}</span>
                      </div>
                    </div>
                    <button
                      disabled={!canCraft || busy}
                      onClick={() => handleCraft(p)}
                      className="w-full min-h-11 mt-auto px-1 py-2 rounded-lg text-[10px] leading-tight font-bold active:scale-95 transition-all"
                      style={{
                        background: canCraft ? "linear-gradient(135deg,#7CBF70,#5A9E50)" : C.lockBd,
                        color: canCraft ? "white" : C.muted,
                        boxShadow: canCraft ? "0 2px 6px rgba(90,158,80,0.35)" : "none",
                        cursor: canCraft ? "pointer" : "default",
                      }}>
                      {busy ? "製作中…" : canCraft ? `製作 ×${executions * (p.craftYield || 1)}` : "材料不足"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// 村莊場所定義已移至 VillageHomeScene.jsx（導覽列＋廣場攤位共用單一來源）

// ── 主元件 ───────────────────────────────────────────────────
export default function CatVillage({ catCards, gachaCoins, initialTab = "village", sharedCats }) {
  const { profile } = useAuth();
  // ⚠️ initialTab="board"＝從首頁「貓貓村探索地圖」建議跳進來：
  //    直接進議事廳（council），並讓 CouncilHall 開在探索地圖（collect）分頁。
  //    只聚焦第一次：之後玩家自己切 tab 回議事廳，恢復預設的「探險隊」分頁。
  const [boardFocus, setBoardFocus] = useState(initialTab === "board");
  useEffect(() => { if (boardFocus) setBoardFocus(false); }, [boardFocus]); // eslint-disable-line
  const [tab, setTab]               = useState(boardFocus ? "council" : initialTab);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [collecting, setCollecting] = useState(false);
  const [upgrading, setUpgrading]   = useState(false);
  const [localVillage, setLocalVillage] = useState(null);
  const [collectedResult, setCollectedResult] = useState(null);
  const [potionInventory, setPotionInventory] = useState({});

  const village    = localVillage || profile?.village || DEFAULT_VILLAGE;
  const buildings  = village.buildings || DEFAULT_VILLAGE.buildings;
  const resources  = village.resources || DEFAULT_VILLAGE.resources;
  const villageLevel = getVillageLevel(buildings);

  const [myCats, setMyCats] = useState({});

  useEffect(() => {
    if (profile?.id && !profile?.village) {
    initVillageIfNeeded(profile.id, profile?.village).catch(() => {});
  }
}, [profile?.id]); // eslint-disable-line

  // 進入村莊頁時檢查村目標狀態（自動刷新）
  useEffect(() => {
    if (tab === "village" && profile?.id) {
      autoSpawnVillageGoal(getVillageLevel(buildings));
    }
  }, [tab, profile?.id]); // eslint-disable-line

  useEffect(() => {
    if (sharedCats !== undefined) {
      setMyCats(Object.fromEntries((sharedCats || []).map(cat => [cat.catId, cat])));
      return undefined;
    }
    if (!profile?.id) return;
    const unsub = subscribeMyCats(profile.id, setMyCats);
    return unsub;
  }, [profile?.id, sharedCats]);

  useEffect(() => {
    if (!profile?.id) return;
    return subscribePotions(profile.id, setPotionInventory);
  }, [profile?.id]); // eslint-disable-line

  const secretaryCat = useMemo(() => {
    const cats = Object.values(myCats);
    if (!cats.length) return null;
    return cats.reduce((best, c) => (c.bond || 0) > (best.bond || 0) ? c : best, cats[0]);
  }, [myCats]);

  const [tick, setTick] = useState(0);
  const effectiveVillageCardAlbums = useMemo(() => profile?.villageCardAlbums?.version === 1
    ? profile.villageCardAlbums
    : { version: 1, xp: albumXpFromCards(catCards || {}) },
  [profile?.villageCardAlbums, catCards]);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // ── 場所列拖曳捲動（手機可直接左右滑，不擋原生垂直捲動）──────
  // 注意：最外層 App 容器是 overflow:hidden，iOS 上子元素的原生橫向 touch 捲動會失效，
  // 所以 nav 用 touch-action:pan-y（垂直捲動交給瀏覽器）+ JS 手動捲動。
  // 不用 setPointerCapture：它在觸控上可能吃掉 click，導致按鈕點不到。
  const placeNavRef = useRef(null);
  const placeNavDragRef = useRef(null);

  function placeNavPointerDown(e) {
    const el = placeNavRef.current;
    if (!el) return;
    placeNavDragRef.current = { startX: e.clientX, scrollLeft: el.scrollLeft, moved: false, id: e.pointerId };
  }
  function placeNavPointerMove(e) {
    const el = placeNavRef.current;
    const drag = placeNavDragRef.current;
    if (!el || !drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 8) drag.moved = true;
    if (drag.moved) el.scrollLeft = drag.scrollLeft - dx;
  }
  function placeNavPointerEnd(e) {
    // 沒真的拖動就清掉 ref；有拖動則留給 click handler 消費 moved
    const drag = placeNavDragRef.current;
    if (drag && drag.id === e.pointerId && !drag.moved) placeNavDragRef.current = null;
  }

  // 切分頁時自動把目前場所捲到中間，避免選到右邊的項目卻看不到
  useEffect(() => {
    const el = placeNavRef.current;
    if (!el) return;
    const btn = el.querySelector('[aria-pressed="true"]');
    if (btn) btn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [tab]);

  const { pending } = useMemo(
    () => calcPendingResources(village, { myCats, villageCardAlbums: effectiveVillageCardAlbums }),
    [village, myCats, effectiveVillageCardAlbums, tick] // eslint-disable-line
  );



  async function handleCollect() {
    if (collecting || !profile?.id) return;
    sfxVillageCollect();
    setCollecting(true);
    try {
      const res = await collectVillageResources(profile.id, village, { myCats, villageCardAlbums: effectiveVillageCardAlbums });
      if (res.resources) {
        setLocalVillage(prev => ({
          ...(prev || village),
          resources: res.resources,
          lastCollectedAt: { toMillis: () => Date.now() },
        }));
      }
      if (res.collected && Object.keys(res.collected).length > 0) {
        setCollectedResult(res.collected);
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
    <div className="flex min-h-dvh flex-col overflow-x-hidden" style={{ background: C.bg }}>

      {/* 村莊場所列（一列走遍所有功能，取代舊的主/子兩層導覽） */}
      <nav aria-label="貓貓村場所"
        ref={placeNavRef}
        onPointerDown={placeNavPointerDown}
        onPointerMove={placeNavPointerMove}
        onPointerUp={placeNavPointerEnd}
        onPointerCancel={placeNavPointerEnd}
        className="sticky top-0 z-30 flex shrink-0 items-center gap-2 overflow-x-auto px-3 py-2 shadow-sm transition-all"
        style={{ position:"sticky", background:"rgba(253,246,236,0.96)", borderBottom:`1.5px solid ${C.border}`, backdropFilter:"blur(12px)", scrollbarWidth:"none", touchAction:"pan-y", cursor:"grab", WebkitOverflowScrolling:"touch" }}>
        {/* 兩側漸層提示還有更多場所（pointerEvents:none 保證不擋點擊） */}
        <div style={{ position:"absolute", left:0, top:0, bottom:0, width:14, background:"linear-gradient(to right, rgba(253,246,236,1), rgba(253,246,236,0))", zIndex:2, pointerEvents:"none" }} />
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:24, background:"linear-gradient(to left, rgba(253,246,236,1), rgba(253,246,236,0))", zIndex:2, pointerEvents:"none" }} />
        {[{ id: "village", label: "村莊", art: "village" }, ...VILLAGE_PLACES].map(item => {
          const isActive = tab === item.id;
          return (
            <button key={item.id} type="button" onClick={() => {
              // 拖曳後吞掉這次 click（moved 由下次 pointerdown 自然重置）
              if (placeNavDragRef.current?.moved) { placeNavDragRef.current.moved = false; return; }
              setTab(item.id);
            }}
              aria-pressed={isActive}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition-all active:scale-95 ${isActive ? "shadow-sm scale-[1.02]" : "hover:bg-amber-900/5"}`}
              style={{
                background: isActive ? "linear-gradient(135deg, #5C3D2E, #45291C)" : "rgba(255,255,255,0.6)",
                color: isActive ? "#FFF8F0" : C.brown,
                border: isActive ? "1.5px solid #784F32" : `1px solid ${C.border}`,
                minHeight: 40,
              }}>
              <CatVillageNavArt name={item.art} size={26} style={{ filter: isActive ? "drop-shadow(0 2px 4px rgba(0,0,0,.5))" : undefined }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {tab === "gacha" && (
        <GachaMachine catCards={catCards} gachaCoins={gachaCoins} onCoinsUpdated={() => {}} />
      )}

      {tab === "council" && (
        <CouncilHall
          profile={profile}
          village={localVillage || profile?.village}
          myCats={myCats}
          onBack={() => setTab("village")}
          initialTab={boardFocus ? "collect" : "expedition"}
        />
      )}

      {tab === "forge" && (
        <ForgePanel
          profile={profile}
          resources={resources}
          myCats={myCats}
        />
      )}

      {tab === "potioncraft" && (
        <div className="px-4 py-3">
          <PotionCraftingPanel
            resources={resources}
            potionInventory={potionInventory}
            coins={profile?.coins || 0}
            memberId={profile?.id}
            onCrafted={() => {
              setLocalVillage(null);
              sfxVillageExchange();
            }}
          />
        </div>
      )}

      {tab === "shop" && (
        <div className="px-4 py-3">
          <ShopSimulator
            memberId={profile?.id}
            resources={resources}
            coins={profile?.coins || 0}
            village={village}
            onChange={() => setLocalVillage(null)}
          />
        </div>
      )}

      {tab === "cardmarket" && (
        <div>
          <CardMarketPanel
            catCards={catCards}
            memberId={profile?.id}
            memberName={profile?.nickname || profile?.name || "射手"}
          />
        </div>
      )}

      {tab === "village" && (
        <>
          <VillageHomeScene
            village={village}
            buildings={buildings}
            resources={resources}
            pending={pending}
            myCats={myCats}
            secretaryCat={secretaryCat}
            villageLevel={villageLevel}
            displayLv={profile?.displayVillageLv}
            memberId={profile?.id}
            collectedResult={collectedResult}
            collecting={collecting}
            onCollect={handleCollect}
            onDismissCollected={() => setCollectedResult(null)}
            onBuildingClick={setSelectedBuilding}
            onNavigate={setTab}
          />

          <VillageGoalBanner />

          <ResourceRow resources={resources} gachaCoins={gachaCoins} buildings={buildings} />
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
          onVillageUpdate={setLocalVillage}
          village={village}
          myCats={myCats}
          profile={profile}
        />
      )}
    </div>
  );
}
