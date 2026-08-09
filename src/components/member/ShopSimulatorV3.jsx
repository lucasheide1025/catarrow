// src/components/member/ShopSimulatorV3.jsx
// 貓貓村商店 v3 — 場景式獨立商店模擬經營 UI。
// 只重做顯示/操作層；經濟、商品、顧客、家具與 Firestore 契約全部沿用既有模組。
import { useEffect, useMemo, useRef, useState } from "react";
import {
  sfxSuccess, sfxTap, sfxVillageExchange, sfxCoinDrop, sfxShopBuy,
  sfxDoorOpen, sfxLevelUp, sfxVictoryFanfare, sfxGachaReveal, sfxNotify,
} from "../../lib/sound";
import {
  SHOP_GOODS, SHOP_GOOD_STOCK_CAP, SHOP_VILLAGE_RESOURCE_META, getShopSinkRecommendations,
  getShopTierOverflowEntries, getShopQuickRefillPlan,
  getGoodById, GOODS_CATEGORIES, TIER_LABELS, TIER_NAMES,
} from "../../lib/shopGoodsCatalog";
import {
  normalizeShop, calcShopRate, calcShopCap, calcShopSlots, calcWaitingVisitors,
  getLevelProgress, getLevelReward, FURNITURE_DEFS, getFurniturePrice,
  SHOP_EXCHANGE_REWARDS, SHOP_CUSTOMERS, getExchangeRemaining,
} from "../../lib/villageShop";
import {
  initVillageShopIfNeeded, craftShopGood, craftAndStockShopGood, arrangeShopDisplay, completeLiveShopSession,
  buyShopFurniture, exchangeTicketsForReward, settleVillageShopAutoSales,
  selectVillageShopManager,
} from "../../lib/villageShopDb";
import { advanceManualShopClock, buildLiveShopSession, evaluateLiveShopMission, getLiveActorStage, liveShopStateSignature } from "../../lib/villageShopLive";
import { CUSTOMER_ART_MANIFEST, GOOD_ART_MANIFEST, getShopCustomerArt, getShopGoodArt, getShopManager, SHOP_MANAGER_OPTIONS } from "../../lib/shopArt";

const SHOP_CAT_ART = [
  "/assets/guild/chibi/cat_meimei.webp",
  "/assets/guild/chibi/cat_gege.webp",
  "/assets/guild/chibi/cat_niuniu.webp",
  "/assets/guild/chibi/cat_baobao.webp",
  "/assets/guild/chibi/cat_daming.webp",
  "/assets/guild/chibi/cat_diandian.webp",
  "/assets/guild/chibi/cat_haji.webp",
  "/assets/guild/chibi/cat_xiaoan.webp",
  "/assets/guild/chibi/cat_youyou.webp",
];
const MASCOT = SHOP_CAT_ART[0];
const SHOP_PRELOAD_URLS = [...new Set([
  "/assets/shop/interior-stock-low.webp",
  "/assets/shop/interior-stock-normal.webp",
  "/assets/shop/interior-stock-abundant.webp",
  ...Object.values(GOOD_ART_MANIFEST),
  ...Object.values(CUSTOMER_ART_MANIFEST).flatMap(group => Object.values(group)),
  ...SHOP_MANAGER_OPTIONS.map(manager => manager.art),
])];
let shopPreloadPromise = null;
function preloadShopArt() {
  if (shopPreloadPromise || typeof Image === "undefined") return shopPreloadPromise;
  shopPreloadPromise = Promise.allSettled(SHOP_PRELOAD_URLS.map(src => new Promise(resolve => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
    if (image.complete) resolve();
  })));
  return shopPreloadPromise;
}
function stableArtIndex(value) {
  const text = String(value || "cat");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
  return hash % SHOP_CAT_ART.length;
}
function customerArt(customer) { return getShopCustomerArt(customer); }
function rewardArt(reward) {
  if (reward?.type === "family_mat" && reward.family && reward.tierIndex >= 1 && reward.tierIndex <= 5) {
    return `/assets/chests/chest_${reward.family}_t${reward.tierIndex}.webp`;
  }
  if (reward?.type === "potion") return "/assets/cat_equip/potion.jpg";
  if (reward?.type === "card_pack") return "/ui/card-bg.webp";
  if (reward?.type === "cat_box") return "/assets/chests/chest_treasure_t6.webp";
  return null;
}
function ArtIcon({ src, fallback, alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={`s3-artfallback ${className}`} aria-hidden="true">{fallback}</span>;
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}
function GoodVisual({ good, locked = false, className = "" }) {
  if (!good) return null;
  const src = getShopGoodArt(good) || good.art || good.motifArt || null;
  return <span className={`s3-goodvisual ${src ? "exact" : "motif"} tier-${good.tier || 1} ${locked ? "locked" : ""} ${className}`}>
    <ArtIcon src={src} fallback={good.icon || "?"} alt="" className="s3-goodvisual-img" />
    {!src && <span className="s3-goodvisual-label">{good.visualLabel || good.name}</span>}
    <span className="s3-goodvisual-tier">T{good.tier}</span>
    {locked && <span className="s3-goodvisual-lock" aria-hidden="true">Lv.{good.unlockLevel}</span>}
  </span>;
}
function CustomerPortrait({ customer, seen = true, unlocked = true, className = "" }) {
  return <span className={`s3-portrait ${seen ? "seen" : unlocked ? "mystery" : "locked"} ${className}`}>
    <ArtIcon src={customerArt(customer)} fallback={customer?.emoji || "🐱"} alt={seen ? customer?.name || "顧客" : ""} className="s3-customerart" />
    {!seen && <span className="s3-portraitveil" aria-hidden="true">{unlocked ? "?" : "🔒"}</span>}
  </span>;
}
const RES_ICON = Object.fromEntries(Object.entries(SHOP_VILLAGE_RESOURCE_META).map(([id, meta]) => [id, meta.icon]));
const RES_NAME = Object.fromEntries(Object.entries(SHOP_VILLAGE_RESOURCE_META).map(([id, meta]) => [id, meta.name]));
const TIER = {
  1:["#66745f","#edf1e8"], 2:["#3c7197","#e8f2f8"], 3:["#785ba2","#f0ebf7"],
  4:["#b26932","#faeee4"], 5:["#a44844","#f9e8e6"],
};
const NAV = [["stall","🏪","店鋪"],["craft","🪚","工坊"],["exchange","🎁","獎品"],["growth","🛠️","裝修"],["dex","🐾","顧客"]];

const CSS = `
.shop3,.shop3 *{box-sizing:border-box}.shop3{--ink:#4d3929;--muted:#826c59;--cream:#fffaf0;--wood:#966039;--wood2:#684125;--leaf:#648d5e;color:var(--ink);font-family:inherit;padding:2px 0 18px}.shop3 button{font:inherit;touch-action:manipulation}.shop3 button:focus-visible{outline:3px solid rgba(54,111,171,.6);outline-offset:3px}
.s3-hud{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:10px 11px;margin-bottom:10px;border-radius:20px;background:linear-gradient(135deg,#fffdf8,#f5e9d5);border:1px solid #dec5a3;box-shadow:0 5px 15px rgba(86,55,30,.1)}.s3-brand{display:flex;align-items:center;gap:9px;min-width:0}.s3-logo{width:39px;height:39px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(#d79b59,#985d34);border:2px solid #754826;color:white;font-size:21px;box-shadow:0 3px 0 #62401f}.s3-title{font-size:13px;font-weight:950}.s3-sub{font-size:8px;color:var(--muted);font-weight:800;margin-top:3px}.s3-bar{width:105px;height:5px;margin-top:5px;border-radius:99px;background:#e6d5bd;overflow:hidden}.s3-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#72a06a,#e1ae4c)}.s3-wallet{min-width:81px;padding:6px 9px;border-radius:14px;text-align:right;background:#fff2bf;border:1px solid #dfba61}.s3-wallet b{display:block;font-size:14px;color:#89611c}.s3-wallet small{display:block;margin-top:3px;font-size:7px;color:#96733b;font-weight:850}
.s3-scene{position:relative;min-height:332px;overflow:hidden;border-radius:28px;background:radial-gradient(circle at 14% 17%,#fff 0 18px,transparent 19px),radial-gradient(circle at 21% 18%,#fff 0 12px,transparent 13px),linear-gradient(#bde2e9 0 47%,#a7c883 47% 63%,#cea774 63%);border:2px solid #8c6b49;box-shadow:inset 0 0 0 4px rgba(255,255,255,.22),0 8px 21px rgba(75,48,27,.18)}.s3-scene:before{content:"";position:absolute;left:-9%;right:-9%;top:137px;height:72px;background:radial-gradient(ellipse at 14% 90%,#739d5d 0 43%,transparent 44%),radial-gradient(ellipse at 43% 90%,#608c50 0 44%,transparent 45%),radial-gradient(ellipse at 76% 90%,#78a262 0 43%,transparent 44%);opacity:.82}.s3-badges{position:absolute;z-index:5;left:10px;right:10px;top:10px;display:flex;justify-content:space-between;gap:5px}.s3-badge{padding:6px 7px;border-radius:12px;background:rgba(255,253,246,.93);border:1px solid rgba(108,69,36,.22);box-shadow:0 3px 9px rgba(70,44,23,.1)}.s3-badge b{display:block;font-size:9px}.s3-badge small{display:block;margin-top:3px;font-size:6px;color:#8a735e;font-weight:850}.s3-building{position:absolute;z-index:2;left:50%;top:92px;transform:translateX(-50%);width:min(76%,290px);height:196px;border-radius:15px 15px 5px 5px;background:linear-gradient(90deg,#e5b779,#f5d59f 48%,#dfad70);border:3px solid #77502f;box-shadow:0 8px 0 rgba(86,55,28,.17)}.s3-roof{position:absolute;left:-18px;right:-18px;top:-29px;height:46px;border-radius:16px 16px 7px 7px;background:repeating-linear-gradient(90deg,#b85d4a 0 28px,#f4e3bd 28px 56px);border:3px solid #7e4836;box-shadow:0 5px 0 rgba(83,47,27,.18)}.s3-sign{position:absolute;z-index:4;left:50%;top:-49px;transform:translateX(-50%);min-width:137px;padding:8px 12px;border-radius:10px;text-align:center;background:linear-gradient(#966033,#744421);border:2px solid #57351d;color:#fff2cb;font-size:12px;font-weight:950;box-shadow:0 4px 0 #533019}.s3-window{position:absolute;left:14px;right:14px;top:39px;height:91px;overflow:hidden;border-radius:10px 10px 4px 4px;background:linear-gradient(#c7e6e3,#eef5e5 61%,#c89a60 62%);border:3px solid #7e5735}.s3-window:after{content:"";position:absolute;left:0;right:0;bottom:0;height:24px;background:repeating-linear-gradient(90deg,#996238 0 31px,#b77843 31px 62px);border-top:3px solid #704321}.s3-preview{position:absolute;z-index:2;left:9px;right:79px;bottom:27px;display:flex;align-items:end;gap:7px}.s3-preview span{font-size:23px;filter:drop-shadow(0 3px 2px rgba(67,40,18,.18));animation:s3bob 2.8s ease-in-out infinite}.s3-door{position:absolute;left:17px;bottom:14px;width:55px;height:55px;border-radius:24px 24px 4px 4px;background:linear-gradient(90deg,#815232,#a6754d);border:3px solid #653d24}.s3-door:after{content:"";position:absolute;right:8px;top:28px;width:5px;height:5px;border-radius:50%;background:#efc456}.s3-crate{position:absolute;left:80px;bottom:17px;width:55px;height:35px;display:grid;place-items:center;background:#b97f4b;border:2px solid #784d2b;font-size:20px}.s3-catboss{position:absolute;z-index:5;right:15px;bottom:18px;width:61px;height:61px;object-fit:cover;border-radius:50%;border:3px solid #efc95d;background:#fff;box-shadow:0 4px 0 #8a592c}.s3-talk{position:absolute;z-index:6;right:2px;top:34px;width:145px;padding:7px 9px;border-radius:14px 14px 4px 14px;background:#fffdf8;border:1.5px solid #c69c67;font-size:8px;line-height:1.4;font-weight:850;box-shadow:0 3px 8px rgba(70,44,24,.12)}.s3-queue{position:absolute;z-index:4;left:11px;bottom:11px;width:146px;min-height:53px;padding:6px 8px 8px;border-radius:18px;display:flex;align-items:end;gap:4px;background:rgba(89,59,34,.23);border:1px solid rgba(255,255,255,.3)}.s3-qcat{display:inline-block;font-size:22px;filter:drop-shadow(0 3px 2px rgba(68,43,23,.22));animation:s3hop 2.4s ease-in-out infinite}.s3-qempty{font-size:7px;color:#fff4dd;font-weight:900;text-shadow:0 1px rgba(65,41,23,.45)}.s3-open{position:absolute;z-index:7;right:11px;bottom:11px;width:107px;min-height:62px;padding:7px;border:2px solid #79502c;border-radius:19px;background:linear-gradient(#f4c45a,#da9b38);color:#553b25;font-weight:950;box-shadow:0 5px 0 #8b5a2c,0 8px 16px rgba(75,45,20,.22);cursor:pointer}.s3-open:active:not(:disabled){transform:translateY(4px);box-shadow:0 1px 0 #8b5a2c}.s3-open:disabled{opacity:.68;filter:saturate(.45);cursor:default}.s3-open .bell{display:block;font-size:22px;animation:s3bell 1.7s ease-in-out infinite;transform-origin:top center}.s3-open b{display:block;font-size:10px}.s3-open small{display:block;margin-top:2px;font-size:6px;opacity:.75}
.s3-guide{display:flex;align-items:center;gap:8px;margin:10px 0;padding:9px 10px;border-radius:17px;background:#f4efdf;border:1px solid #d6c49e}.s3-step{width:29px;height:29px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:#6d9464;color:#fff;font-size:11px;font-weight:950;box-shadow:0 3px 0 #4b6e47}.s3-guidecopy{flex:1;min-width:0}.s3-guidecopy b{display:block;font-size:9px}.s3-guidecopy span{display:block;margin-top:2px;font-size:7px;color:#846e5a;font-weight:750;line-height:1.35}.s3-link{flex:0 0 auto;padding:7px 8px;border:0;border-radius:11px;background:#fffdf8;color:#745436;font-size:7px;font-weight:900;box-shadow:inset 0 0 0 1px #d7c2a2;cursor:pointer}.s3-toast{margin:8px 0;padding:9px 11px;border-radius:14px;text-align:center;background:#e9f4e3;border:1px solid #a6ca9a;color:#416d42;font-size:9px;font-weight:950;animation:s3pop .2s ease-out both}
.s3-panel{padding:13px;border-radius:23px;background:linear-gradient(#fffdf8,#f7eddd);border:1px solid #dac3a2;box-shadow:0 5px 15px rgba(84,54,30,.1)}.s3-head{display:flex;justify-content:space-between;align-items:flex-start;gap:9px;margin-bottom:10px}.s3-head h3{margin:0;font-size:13px;line-height:1.1;font-weight:950}.s3-head p{margin:4px 0 0;font-size:7px;line-height:1.45;color:#836d59;font-weight:750}.s3-tag{flex:0 0 auto;padding:5px 7px;border-radius:99px;background:#eee3d0;color:#71573f;font-size:7px;font-weight:900}.s3-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:10px;border:1px solid #dec7a7;border-radius:16px;overflow:hidden;background:#fff9ec}.s3-stat{text-align:center;padding:8px 3px;border-right:1px dashed #dec7a7}.s3-stat:last-child{border-right:0}.s3-stat b{display:block;font-size:9px;white-space:nowrap}.s3-stat small{display:block;margin-top:3px;font-size:6px;color:#8b745f;font-weight:800}.s3-shelf{position:relative;padding:16px 10px 17px;border-radius:17px;background:linear-gradient(#87512c,#6c3f20);border:2px solid #53321d;box-shadow:inset 0 5px 9px rgba(50,27,12,.2),0 5px 0 #5a371f}.s3-shelf:before,.s3-shelf:after{content:"";position:absolute;left:7px;right:7px;height:7px;border-radius:4px;background:#b67541;border:1px solid #68401f}.s3-shelf:before{top:5px}.s3-shelf:after{bottom:5px}.s3-shelfscroll{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 7px;scroll-snap-type:x proximity}.s3-slot{position:relative;flex:0 0 108px;min-height:112px;scroll-snap-align:start;padding:8px 7px 18px;border-radius:12px;text-align:left;background:linear-gradient(#fff9e9,#ead3ad);border:2px solid #d2b17a;color:#563e2c;box-shadow:0 4px 0 #58341b;cursor:pointer}.s3-slot.empty{display:grid;place-items:center;text-align:center;background:rgba(255,246,220,.17);border:2px dashed rgba(255,236,201,.55);color:#f3e3c6}.s3-slot .floor{position:absolute;left:0;right:0;bottom:0;height:14px;border-radius:0 0 9px 9px;background:repeating-linear-gradient(90deg,#c28449 0 12px,#a56536 12px 24px);border-top:2px solid #794827}.s3-slot .kind{position:absolute;z-index:2;right:5px;top:5px;padding:2px 4px;border-radius:8px;background:rgba(255,255,255,.75);font-size:6px}.s3-slot .ico{display:block;font-size:30px;line-height:1}.s3-slot .name{display:block;min-height:20px;margin-top:7px;font-size:8px;font-weight:950;line-height:1.2}.s3-slot .meta{display:flex;justify-content:space-between;gap:3px;margin-top:5px;font-size:6px;font-weight:900}.s3-emptyplus{display:block;font-size:25px}.s3-emptycopy{font-size:7px;font-weight:900}.s3-bins{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:11px}.s3-bin{padding:8px 6px;border-radius:13px;background:#f3e8d5;border:1px solid #d5bea0}.s3-bin b{display:block;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s3-bin span{display:block;margin-top:3px;font-size:7px;color:#7d6754;font-weight:800}
.s3-nav{position:sticky;z-index:40;bottom:8px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin-top:12px;padding:6px;border-radius:20px;background:linear-gradient(#8c5731,#6b3f24);border:2px solid #54321d;box-shadow:0 7px 18px rgba(67,40,23,.27)}.s3-nav button{padding:7px 2px 6px;border:0;border-radius:13px;background:transparent;color:#f6e4c7;font-size:7px;font-weight:900;cursor:pointer}.s3-nav button span{display:block;margin-bottom:4px;font-size:17px;line-height:1}.s3-nav button.active{transform:translateY(-2px);background:linear-gradient(#f6d47a,#e1a94c);color:#553a24;box-shadow:inset 0 0 0 1px #c48331,0 3px 0 #4d2e1b}
.s3-filter{display:flex;gap:5px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.s3-filter::-webkit-scrollbar{display:none}.s3-chip{flex:0 0 auto;padding:6px 8px;border:1px solid #d2bca0;border-radius:99px;background:#fff9ef;color:#755c47;font-size:7px;font-weight:900;cursor:pointer}.s3-chip.active{background:#6d9165;border-color:#50754d;color:white;box-shadow:0 2px 0 #456341}.s3-bench{margin-top:8px;padding:11px;border-radius:19px;background:linear-gradient(145deg,#6c4d35,#493425);border:2px solid #3b291e;color:#fff2dc;box-shadow:0 5px 0 rgba(59,39,23,.2)}.s3-blueprint{padding:11px;border-radius:16px;background:#fff9ef;border:2px solid #d6b685;color:#503a29;box-shadow:0 4px 0 #3c281a}.s3-goodhero{display:flex;gap:10px}.s3-goodicon{width:64px;height:64px;flex:0 0 auto;display:grid;place-items:center;border-radius:17px;background:#efe2cd;border:1px solid #d5ba94;font-size:36px}.s3-goodhero h4{margin:2px 0 3px;font-size:13px;font-weight:950}.s3-goodhero p{margin:4px 0 0;font-size:7px;line-height:1.45;color:#7d6754;font-weight:750}.s3-tier{display:inline-block;padding:3px 6px;border-radius:99px;font-size:6px;font-weight:950}.s3-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.s3-meta span{padding:5px 6px;border-radius:9px;background:#f1e7d6;font-size:7px;font-weight:900}.s3-recipe{display:grid;gap:5px;margin-top:9px}.s3-cost{display:flex;justify-content:space-between;gap:8px;padding:6px 7px;border-radius:9px;background:#f4ecdf;border:1px solid #ddd0bc;font-size:7px;font-weight:850}.s3-cost.bad{background:#faece8;border-color:#e3b5aa;color:#a04e3e}.s3-qty{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}.s3-qty button{padding:6px 2px;border:1px solid rgba(255,244,220,.25);border-radius:9px;background:rgba(255,255,255,.09);color:#f8e6c8;font-size:7px;font-weight:900;cursor:pointer}.s3-qty button.active{background:#e3b354;border-color:#efcc7e;color:#503620}.s3-primary{width:100%;margin-top:8px;padding:9px 10px;border:2px solid #426940;border-radius:12px;background:linear-gradient(#78a86c,#55814e);color:#fff;font-size:9px;font-weight:950;box-shadow:0 4px 0 #3c603a;cursor:pointer}.s3-primary:disabled{background:#bcb3a5;border-color:#92897b;box-shadow:0 4px 0 #83796c;opacity:.73;cursor:default}.s3-drawer{max-height:360px;overflow:auto;margin-top:10px;padding-top:6px;border-top:1px dashed #d0b68f}.s3-reciperow{width:100%;display:flex;align-items:center;gap:8px;padding:8px 4px;border:0;border-bottom:1px dashed #dfcdb4;background:transparent;color:#55402f;text-align:left;cursor:pointer}.s3-reciperow.selected{border-radius:9px;background:#f1e7d4;border-bottom-color:transparent}.s3-reciperow.locked{opacity:.55}.s3-reciperow .icon{width:32px;text-align:center;font-size:21px}.s3-reciperow .copy{flex:1;min-width:0}.s3-reciperow .copy b{display:block;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s3-reciperow .copy span{display:block;margin-top:3px;font-size:6px;color:#856f5c;font-weight:800}.s3-reciperow .stock{flex:0 0 auto;font-size:7px;font-weight:950;color:#5d8357}
.s3-case{position:relative;padding:13px;border-radius:20px;background:linear-gradient(180deg,#fff4d7,#ecd2a7);border:3px solid #86552f;box-shadow:inset 0 0 0 3px rgba(255,255,255,.4),inset 0 -8px 0 rgba(103,61,31,.08),0 6px 0 #603a20,0 12px 24px rgba(70,42,23,.19)}.s3-case:before{content:"";position:absolute;left:9px;right:9px;top:7px;height:5px;border-radius:99px;background:repeating-linear-gradient(90deg,rgba(110,67,34,.16) 0 18px,rgba(255,255,255,.22) 18px 34px)}.s3-tierfilter{padding-top:7px}.s3-sharedlimit{margin:7px 2px 10px;padding:9px 11px;border-radius:12px;background:#f8ead1;border:1px dashed #b78c5b;color:#6f543d;font-size:12px;font-weight:850}.s3-prizegroup+.s3-prizegroup{margin-top:15px}.s3-grouptitle{margin:0 0 8px;padding:8px 10px;border-radius:10px;background:linear-gradient(#7d4b2a,#5d351d);border:1px solid #492817;color:#fff0cd;font-size:13px;font-weight:950;letter-spacing:.02em;box-shadow:0 3px 0 rgba(66,37,20,.32)}.s3-reward{display:flex;align-items:center;gap:10px;margin-bottom:7px;padding:11px 9px;border-radius:14px;background:linear-gradient(#fffdf4,#f2dfbd);border:1px solid #c9a574;box-shadow:inset 0 1px 0 #fff,0 3px 0 rgba(108,68,35,.11)}.s3-reward:last-child{margin-bottom:0}.s3-rico{width:48px;height:48px;flex:0 0 auto;display:grid;place-items:center;border-radius:14px;background:radial-gradient(circle at 35% 28%,#fff8dc,#e6c48c 74%);border:1px solid #c1975c;font-size:28px;box-shadow:inset 0 2px 0 #fff,0 2px 0 rgba(91,56,30,.14)}.s3-rcopy{flex:1;min-width:0}.s3-rcopy b{display:block;font-size:14px;line-height:1.3}.s3-rcopy span{display:block;margin-top:4px;font-size:12px;line-height:1.45;color:#705742;font-weight:800}.s3-buy{min-width:82px;flex:0 0 auto;padding:9px 8px;border:1.5px solid #95601f;border-radius:11px;background:linear-gradient(#f5cf68,#daa03e);color:#573716;font-size:12px;font-weight:950;box-shadow:0 3px 0 #986123;cursor:pointer}.s3-buy:disabled{background:#ddd1bd;border-color:#b7a890;color:#91826f;box-shadow:0 3px 0 #a99a83;cursor:default}
.s3-levelcard{padding:11px;border-radius:17px;background:linear-gradient(135deg,#6d8960,#4c6e4b);border:2px solid #3b5a3a;color:#fff8e7;box-shadow:0 5px 0 #324d32}.s3-leveltop{display:flex;justify-content:space-between;align-items:end;gap:8px}.s3-leveltop b{font-size:12px}.s3-leveltop span{font-size:7px;font-weight:800;opacity:.85}.s3-progress{height:8px;margin-top:8px;border-radius:99px;overflow:hidden;background:rgba(33,57,32,.47)}.s3-progress i{display:block;height:100%;background:linear-gradient(90deg,#efc765,#fff0a7)}.s3-next{margin-top:8px;padding:7px 8px;border-radius:10px;background:rgba(255,255,255,.11);font-size:7px;line-height:1.45;font-weight:850}.s3-furniture{display:grid;gap:7px;margin-top:10px}.s3-frow{display:flex;align-items:center;gap:8px;padding:9px;border-radius:14px;background:#fff9ef;border:1px solid #d9c1a1}.s3-fico{width:41px;height:41px;flex:0 0 auto;display:grid;place-items:center;border-radius:12px;background:#eee1cc;font-size:24px}.s3-fcopy{flex:1;min-width:0}.s3-fcopy b{display:block;font-size:9px}.s3-fcopy p{margin:2px 0 0;font-size:6px;line-height:1.35;color:#806a57;font-weight:750}.s3-fcopy .lv{margin-top:4px;font-size:7px;color:#597b54;font-weight:950}
.s3-album{padding:13px;border-radius:18px;background:linear-gradient(145deg,#b65d4b,#844238);border:2px solid #68342d;color:#fff5e2;box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 5px 0 #60302a}.s3-album b{display:block;font-size:17px}.s3-album span{display:block;margin-top:5px;font-size:12px;line-height:1.5;opacity:.9;font-weight:800}.s3-albumsection{margin-top:13px}.s3-albumtitle{display:flex;justify-content:space-between;margin-bottom:7px;font-size:13px;font-weight:950}.s3-customer{display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px dashed #ddc8ad}.s3-face{width:46px;height:46px;flex:0 0 auto;display:grid;place-items:center;border-radius:50%;background:#eee3d0;border:1px solid #d4bb9d;font-size:26px}.s3-ccopy{flex:1;min-width:0}.s3-ccopy b{display:block;font-size:14px}.s3-ccopy span{display:block;margin-top:4px;font-size:12px;line-height:1.45;color:#7e6855;font-weight:800}.s3-state{flex:0 0 auto;padding:5px 7px;border-radius:99px;background:#eee3d0;color:#765c45;font-size:11px;font-weight:950}
.s3-sheetbg,.s3-modalbg{position:fixed;inset:0;z-index:220;display:flex;justify-content:center;background:rgba(50,35,23,.58);backdrop-filter:blur(3px)}.s3-sheetbg{align-items:flex-end}.s3-modalbg{align-items:center;padding:15px}.s3-sheet{width:min(100%,440px);max-height:82vh;overflow:auto;padding:13px;border-radius:24px 24px 0 0;background:linear-gradient(#fff9ef,#f0dfc5);border:2px solid #8b5d37;box-shadow:0 -10px 27px rgba(43,27,17,.25);animation:s3sheet .2s ease-out both}.s3-handle{width:45px;height:5px;margin:0 auto 9px;border-radius:99px;background:#cbb08b}.s3-sheet h4{margin:0;font-size:11px}.s3-sheet p{margin:4px 0 9px;font-size:7px;color:#806a56;font-weight:750}.s3-pick{width:100%;display:flex;align-items:center;gap:8px;padding:9px 4px;border:0;border-bottom:1px dashed #dbc3a3;background:transparent;color:#513c2c;text-align:left;cursor:pointer}.s3-pick b{display:block;font-size:8px}.s3-pick span span{display:block;margin-top:3px;font-size:6px;color:#806a57;font-weight:800}.s3-pick .qty{margin-left:auto;color:#5b8256;font-size:7px;font-weight:950}.s3-receipt{width:min(100%,390px);max-height:88vh;overflow:auto;padding:15px;border-radius:19px;background:#fffdf7;border:2px solid #cfb185;color:#493728;box-shadow:0 12px 36px rgba(43,28,18,.29);animation:s3pop .22s ease-out both}.s3-receipthead{text-align:center;padding-bottom:9px;border-bottom:2px dashed #d1b79c}.s3-receipthead .mark{font-size:32px}.s3-receipthead h3{margin:3px 0 0;font-size:13px}.s3-total{margin:9px 0;padding:10px;border-radius:13px;background:#fff0bc;border:1px solid #dfc267;text-align:center}.s3-total small{display:block;font-size:7px;font-weight:850;color:#89682e}.s3-total b{display:block;margin-top:3px;font-size:20px;color:#875f1d}.s3-sale{display:flex;align-items:center;gap:7px;padding:7px 2px;border-bottom:1px dashed #decbb5}.s3-sale .face{font-size:21px}.s3-sale .copy{flex:1;min-width:0}.s3-sale .copy b{display:block;font-size:8px}.s3-sale .copy span{display:block;margin-top:2px;font-size:6px;color:#806b59;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s3-sale strong{font-size:8px;color:#8c651f}.s3-close{width:100%;margin-top:10px;padding:9px;border:1.5px solid #724e32;border-radius:11px;background:#976841;color:#fff;font-size:8px;font-weight:950;box-shadow:0 3px 0 #63412a;cursor:pointer}.s3-levelup{width:min(100%,360px);padding:18px 15px;border-radius:24px;text-align:center;background:linear-gradient(#fff3c6,#f3d586);border:3px solid #b98030;box-shadow:0 12px 38px rgba(44,28,14,.32);animation:s3pop .25s ease-out both}.s3-levelup .big{font-size:46px;animation:s3hop 1.7s ease-in-out infinite}.s3-levelup h3{margin:4px 0 2px;font-size:15px;color:#6d471f}.s3-levelup p{margin:0;font-size:7px;color:#8c652e;font-weight:800}.s3-levelreward{display:grid;gap:5px;margin-top:9px}.s3-levelreward div{display:flex;justify-content:space-between;gap:6px;padding:7px 8px;border-radius:9px;background:rgba(255,255,255,.55);border:1px solid rgba(163,112,37,.29);font-size:7px;font-weight:900}
@keyframes s3bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes s3hop{0%,100%{transform:translateY(0)}45%{transform:translateY(-5px)}}@keyframes s3bell{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(-12deg)}82%{transform:rotate(11deg)}88%{transform:rotate(-7deg)}}@keyframes s3pop{from{opacity:0;transform:scale(.94) translateY(7px)}to{opacity:1;transform:none}}@keyframes s3sheet{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
/* 人類可讀字級 + 更一致的木作商店美術層。 */
.shop3{font-size:14px;line-height:1.5;background:radial-gradient(circle at 12% 2%,rgba(255,244,204,.58),transparent 24%),linear-gradient(#f6ead2,#ead5b2)}
.shop3 .s3-head h3{font-size:20px}.shop3 .s3-head p{font-size:13px;line-height:1.55}.shop3 .s3-tag{font-size:12px;padding:7px 10px}.shop3 .s3-badge b{font-size:13px}.shop3 .s3-badge small{font-size:11px}.shop3 .s3-talk{font-size:12px;line-height:1.5}.shop3 .s3-open b{font-size:14px}.shop3 .s3-open small{font-size:11px}.shop3 .s3-guidecopy b{font-size:14px}.shop3 .s3-guidecopy span,.shop3 .s3-link{font-size:12px}.shop3 .s3-stat b{font-size:13px}.shop3 .s3-stat small{font-size:11px}.shop3 .s3-nav button{font-size:12px;min-height:55px}.shop3 .s3-chip{font-size:12px;padding:8px 11px}.shop3 .s3-tier{font-size:11px}.shop3 .s3-goodhero h4{font-size:18px}.shop3 .s3-goodhero p{font-size:12px;line-height:1.5}.shop3 .s3-meta span,.shop3 .s3-cost,.shop3 .s3-qty button{font-size:12px}.shop3 .s3-primary{font-size:14px;padding:12px}.shop3 .s3-reciperow .copy b{font-size:13px}.shop3 .s3-reciperow .copy span,.shop3 .s3-reciperow .stock{font-size:11px}.shop3 .s3-leveltop b{font-size:17px}.shop3 .s3-leveltop span,.shop3 .s3-next{font-size:12px}.shop3 .s3-fcopy b{font-size:14px}.shop3 .s3-fcopy p{font-size:11px}.shop3 .s3-fcopy .lv{font-size:12px}.shop3 .s3-sheet h4{font-size:17px}.shop3 .s3-sheet p,.shop3 .s3-pick b,.shop3 .s3-pick span span,.shop3 .s3-pick .qty{font-size:12px}.shop3 .s3-receipthead h3{font-size:18px}.shop3 .s3-total small{font-size:12px}.shop3 .s3-sale .copy b,.shop3 .s3-sale strong{font-size:13px}.shop3 .s3-sale .copy span{font-size:11px}.shop3 .s3-close{font-size:14px}.shop3 .s3-levelup h3{font-size:20px}.shop3 .s3-levelup p,.shop3 .s3-levelreward div{font-size:12px}
.shop3 .s3-panel{background:linear-gradient(180deg,#fffaf0,#f0dcc0);border:2px solid #b88b55;box-shadow:inset 0 1px 0 #fff,0 6px 0 rgba(117,74,38,.12),0 12px 28px rgba(92,57,30,.12)}.shop3 .s3-head{padding-bottom:9px;border-bottom:2px dashed rgba(120,78,43,.22)}.shop3 .s3-nav{background:linear-gradient(#7a492a,#59331f);border-color:#432516;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 6px 0 #3c2215,0 11px 20px rgba(54,31,19,.28)}.shop3 .s3-nav button.active{background:linear-gradient(#f7d876,#dda746);box-shadow:inset 0 1px 0 #fff1ad,0 3px 0 #4d2e1b}.shop3 .s3-bench{background:linear-gradient(145deg,#80593d,#4c3223);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 6px 0 #382419,0 12px 20px rgba(54,35,22,.2)}
/* V4：把既有 chibi / 寶箱資產真正放進場景，不再只靠 emoji。 */
.shop3 .s3-scene{min-height:370px;background:radial-gradient(circle at 14% 14%,rgba(255,255,255,.9) 0 19px,transparent 20px),radial-gradient(circle at 21% 15%,rgba(255,255,255,.82) 0 13px,transparent 14px),linear-gradient(#b9e4ed 0 43%,#8fbd78 43% 61%,#c59867 61% 100%);box-shadow:inset 0 0 0 4px rgba(255,255,255,.25),inset 0 -24px 38px rgba(85,51,27,.12),0 10px 25px rgba(75,48,27,.2)}
.shop3 .s3-building{top:104px;height:220px;width:min(79%,310px);background:linear-gradient(90deg,#dca765,#f3d29a 42%,#e7b975 72%,#cf9558);box-shadow:inset 0 0 0 2px rgba(255,239,204,.25),0 10px 0 rgba(86,55,28,.18),0 18px 25px rgba(67,42,24,.16)}
.shop3 .s3-building:after{content:"";position:absolute;left:-15px;right:-15px;bottom:-9px;height:20px;border-radius:8px;background:repeating-linear-gradient(90deg,#8d5831 0 34px,#a96b3c 34px 68px);border:2px solid #704526;box-shadow:0 6px 0 rgba(73,43,23,.18)}
.shop3 .s3-window{top:43px;height:103px;background:linear-gradient(155deg,rgba(220,250,247,.94),rgba(255,244,204,.94) 61%,#c59358 62%);box-shadow:inset 0 0 16px rgba(255,236,174,.75)}
.shop3 .s3-preview{right:102px;bottom:29px}.shop3 .s3-preview span{font-size:28px}
.shop3 .s3-catboss{right:8px;bottom:9px;width:88px;height:106px;object-fit:contain;border:0;border-radius:0;background:transparent;box-shadow:none;filter:drop-shadow(0 7px 3px rgba(74,43,22,.28));transform-origin:bottom center;animation:s3bob 3.1s ease-in-out infinite}
.shop3 .s3-worker{position:absolute;z-index:4;bottom:20px;width:48px;height:60px;object-fit:contain;filter:drop-shadow(0 5px 2px rgba(66,39,20,.22));opacity:.96}.shop3 .s3-worker-a{left:78px}.shop3 .s3-worker-b{left:120px;bottom:22px;transform:scale(.92)}
.shop3 .s3-talk{top:35px;right:-3px;width:158px;padding:9px 11px;border:2px solid #bc8a53;background:linear-gradient(#fffdf8,#fff3d9);box-shadow:0 4px 0 rgba(91,54,29,.12),0 8px 16px rgba(70,44,24,.12)}
.shop3 .s3-scenedecor{position:absolute;z-index:3;pointer-events:none;filter:drop-shadow(0 4px 2px rgba(61,37,20,.2))}.shop3 .s3-plant{left:7px;bottom:68px;font-size:34px}.shop3 .s3-boxes{left:165px;bottom:14px;font-size:29px}.shop3 .s3-banner{right:14px;top:76px;font-size:29px;transform:rotate(6deg)}
.shop3 .s3-queue{left:9px;bottom:10px;width:min(53%,205px);min-height:74px;padding:7px 8px 8px;gap:3px;background:linear-gradient(180deg,rgba(101,66,38,.18),rgba(74,45,25,.34));border:1px solid rgba(255,240,210,.52);box-shadow:inset 0 2px 0 rgba(255,255,255,.14)}
.shop3 .s3-qcat{width:34px;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:inherit}.shop3 .s3-qcatart{display:block;width:34px;height:43px;object-fit:contain;filter:drop-shadow(0 4px 2px rgba(54,32,18,.25))}.shop3 .s3-qname{max-width:38px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff8e8;font-size:9px;line-height:1.1;font-weight:950;text-shadow:0 1px 2px #51321d}.shop3 .s3-qempty{font-size:11px;line-height:1.35}
.shop3 .s3-open{right:10px;bottom:11px;width:116px;min-height:69px}
/* V5：商品視覺 token。真實成品圖優先；其餘用「素材底紋 + 商品名章 + Tier」避免錯圖與 emoji 牆。 */
.shop3 .s3-goodvisual{position:relative;display:inline-grid;place-items:center;overflow:hidden;width:58px;height:58px;flex:0 0 58px;border:2px solid #9a8166;border-radius:15px;background:radial-gradient(circle at 35% 28%,#fff9e8,#ead4b5 76%);box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 3px 0 rgba(83,52,31,.16);isolation:isolate}
.shop3 .s3-goodvisual-img{display:block;width:100%;height:100%;object-fit:contain;padding:3px}
.shop3 .s3-goodvisual.motif .s3-goodvisual-img{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);padding:6px;opacity:.48;filter:saturate(.82) contrast(.94);transform:rotate(-5deg) scale(1.03);z-index:0}
.shop3 .s3-goodvisual-label{position:relative;z-index:2;max-width:88%;padding:3px 5px;border:1px solid rgba(87,56,35,.24);border-radius:7px;background:rgba(255,249,231,.88);color:#5a3d28;font-size:11px;line-height:1.05;font-weight:950;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 4px rgba(67,43,28,.12);backdrop-filter:blur(2px)}
.shop3 .s3-goodvisual-tier{position:absolute;z-index:3;right:2px;top:2px;min-width:22px;padding:2px 4px;border-radius:7px;background:rgba(72,49,34,.86);color:#fff7e2;font-size:9px;line-height:1.1;font-weight:950;text-align:center}
.shop3 .s3-goodvisual-lock{position:absolute;z-index:4;inset:auto 3px 3px 3px;padding:2px 3px;border-radius:6px;background:rgba(58,45,36,.9);color:#fff4dc;font-size:9px;line-height:1.1;font-weight:950;text-align:center}
.shop3 .s3-goodvisual.locked .s3-goodvisual-img{filter:grayscale(1) brightness(.55);opacity:.38}.shop3 .s3-goodvisual.locked .s3-goodvisual-label{filter:grayscale(1);opacity:.55}
.shop3 .s3-goodvisual.tier-1{background:radial-gradient(circle at 35% 28%,#fff9e8,#dbc9aa 76%)}.shop3 .s3-goodvisual.tier-2{border-color:#6f8fc3;background:radial-gradient(circle at 35% 28%,#f5fbff,#c8dceb 76%)}.shop3 .s3-goodvisual.tier-3{border-color:#9270bf;background:radial-gradient(circle at 35% 28%,#fbf4ff,#d9c5e8 76%)}.shop3 .s3-goodvisual.tier-4{border-color:#c27d42;background:radial-gradient(circle at 35% 28%,#fff7df,#ebc28b 76%)}.shop3 .s3-goodvisual.tier-5{border-color:#bc5f53;background:radial-gradient(circle at 35% 28%,#fff4ec,#e9aaa0 76%);box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 0 0 2px rgba(188,95,83,.18),0 3px 0 rgba(83,52,31,.16)}.shop3 .s3-goodvisual.tier-2 .s3-goodvisual-tier{background:#527aa9}.shop3 .s3-goodvisual.tier-3 .s3-goodvisual-tier{background:#73539d}.shop3 .s3-goodvisual.tier-4 .s3-goodvisual-tier{background:#a5632d}.shop3 .s3-goodvisual.tier-5 .s3-goodvisual-tier{background:#9f453e}
.shop3 .s3-previewgood{width:42px;height:42px;flex-basis:42px;border-radius:11px}.shop3 .s3-previewgood .s3-goodvisual-label{font-size:9px;padding:2px 3px}.shop3 .s3-previewgood .s3-goodvisual-tier{font-size:7px;min-width:18px}
.shop3 .s3-slotgood{width:62px;height:62px;flex-basis:62px;margin:1px auto 4px}.shop3 .s3-goodheroart{width:88px;height:88px;flex-basis:88px;border-radius:20px}.shop3 .s3-goodheroart .s3-goodvisual-label{font-size:14px;padding:5px 7px}
.shop3 .s3-listgood,.shop3 .s3-pickgood{width:50px;height:50px;flex-basis:50px;border-radius:13px}.shop3 .s3-listgood .s3-goodvisual-label,.shop3 .s3-pickgood .s3-goodvisual-label{font-size:10px;padding:2px 4px}
.shop3 .s3-rico{position:relative;width:72px;height:72px;border-radius:18px;overflow:hidden;background:radial-gradient(circle at 40% 28%,#fff8de,#e6c38a 78%);box-shadow:inset 0 2px 0 #fff,0 4px 0 rgba(91,56,30,.15)}.shop3 .s3-rewardart{width:68px;height:68px;object-fit:contain;filter:drop-shadow(0 5px 3px rgba(76,45,24,.2))}.shop3 .s3-rico.locked .s3-rewardart{filter:grayscale(.3) brightness(.52) opacity(.72)}.shop3 .s3-artlock{position:absolute;right:3px;bottom:3px;width:25px;height:25px;display:grid;place-items:center;border-radius:50%;background:rgba(70,45,28,.9);border:1px solid #f1d18a;font-size:13px;color:white;box-shadow:0 2px 4px rgba(50,28,16,.2)}.shop3 .s3-artfallback{display:grid;place-items:center;width:100%;height:100%;font-size:32px}
.shop3 .s3-portrait{position:relative;display:grid;place-items:center;overflow:hidden;border-radius:18px;background:linear-gradient(#fff4dc,#e8cfaa);border:2px solid #c79f6d;box-shadow:inset 0 1px 0 #fff,0 3px 0 rgba(91,56,30,.12)}.shop3 .s3-customerart{display:block;width:100%;height:100%;object-fit:contain;padding:2px;filter:drop-shadow(0 3px 2px rgba(68,40,22,.18))}.shop3 .s3-portrait.mystery .s3-customerart,.shop3 .s3-portrait.locked .s3-customerart{filter:brightness(0) opacity(.28)}.shop3 .s3-portrait.locked .s3-customerart{opacity:.17}.shop3 .s3-portraitveil{position:absolute;inset:0;display:grid;place-items:center;color:#fff5dc;font-size:20px;font-weight:950;text-shadow:0 2px 4px #4d3020}.shop3 .s3-face.s3-portrait{width:58px;height:58px;border-radius:18px;background:linear-gradient(#fff4dc,#e8cfaa);font-size:inherit}.shop3 .s3-sale .face.s3-portrait{width:45px;height:45px;flex:0 0 45px;border-radius:13px}.shop3 .s3-sale{gap:10px;padding:9px 2px}.shop3 .s3-sale .copy b{font-size:14px}.shop3 .s3-sale .copy span{font-size:12px}.shop3 .s3-sale strong{font-size:13px}
/* V6：真正的即時營業場景。室內背景是舞台，HUD/貨架/角色是可讀可動的互動層。 */
.shop3 .s3-livewrap{margin-bottom:10px}.shop3 .s3-livescene{position:relative;min-height:500px;overflow:hidden;border:3px solid #5d3821;border-radius:30px;background:#3b2418;box-shadow:inset 0 0 0 4px rgba(255,229,173,.16),0 10px 0 rgba(91,54,30,.14),0 20px 38px rgba(62,38,24,.24);isolation:isolate}.shop3 .s3-livebg{position:absolute;z-index:-4;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;filter:saturate(1.08) contrast(.94) brightness(.8);transform:scale(1.025)}.shop3 .s3-liveveil{position:absolute;z-index:-3;inset:0;background:linear-gradient(180deg,rgba(42,24,13,.08),rgba(58,31,16,.03) 47%,rgba(35,19,11,.39)),radial-gradient(circle at 50% 40%,rgba(255,220,139,.2),transparent 48%);pointer-events:none}.shop3 .s3-livehud{position:absolute;z-index:30;left:10px;right:10px;top:10px;display:grid;grid-template-columns:auto 1fr 1fr auto;align-items:center;gap:7px;padding:7px 8px;border:1px solid rgba(255,230,183,.38);border-radius:17px;background:rgba(58,35,22,.82);color:#fff4dc;box-shadow:0 4px 14px rgba(42,24,14,.28);backdrop-filter:blur(6px)}.shop3 .s3-livehud>span:not(.s3-openbadge){min-width:0;text-align:center}.shop3 .s3-livehud b{display:block;font-size:14px;line-height:1.1}.shop3 .s3-livehud small{display:block;margin-top:3px;color:#e4c9a3;font-size:10px;font-weight:800}.shop3 .s3-livehud button{width:43px;height:38px;border:1px solid #d69b45;border-radius:11px;background:linear-gradient(#f3c763,#ce8c34);color:#53351e;font-size:13px;font-weight:950;box-shadow:0 3px 0 #70441f;cursor:pointer}.shop3 .s3-openbadge{display:flex;align-items:center;gap:5px;padding:6px 8px;border-radius:99px;background:#9e493c;border:1px solid #e5a17c;color:white;font-size:11px;font-weight:950;white-space:nowrap}.shop3 .s3-openbadge i{width:8px;height:8px;border-radius:50%;background:#ffe39b;box-shadow:0 0 0 3px rgba(255,225,139,.15);animation:s3pulse 1.25s ease-in-out infinite}
.shop3 .s3-livebeam{position:absolute;z-index:-1;top:50px;width:80px;height:360px;background:linear-gradient(180deg,rgba(255,224,142,.22),transparent 80%);filter:blur(3px);transform:rotate(11deg);transform-origin:top center;pointer-events:none}.shop3 .beam-a{left:22%}.shop3 .beam-b{right:19%;transform:rotate(-12deg)}.shop3 .s3-liveshelf{position:absolute;z-index:6;top:115px;width:31%;min-width:118px;padding:28px 7px 9px;border:3px solid #5b351e;border-radius:12px 12px 7px 7px;background:linear-gradient(90deg,#754429,#a2683b 45%,#80502d);box-shadow:inset 0 0 0 2px rgba(255,220,164,.11),0 8px 0 rgba(54,30,16,.28),0 12px 18px rgba(45,27,17,.2)}.shop3 .s3-liveshelf-left{left:3.5%}.shop3 .s3-liveshelf-right{right:3.5%}.shop3 .s3-liveshelfsign{position:absolute;left:8px;right:8px;top:5px;padding:3px 4px;border-radius:7px;text-align:center;background:#4d2c1a;color:#f6d9a4;font-size:10px;font-weight:950;letter-spacing:.04em}.shop3 .s3-livegood{position:relative;display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:5px;min-height:58px;margin-bottom:5px;padding:5px;border-radius:9px;background:linear-gradient(90deg,rgba(255,245,220,.92),rgba(229,199,153,.9));border:1px solid #c69a62;box-shadow:inset 0 1px 0 #fff,0 2px 0 rgba(57,31,16,.2)}.shop3 .s3-livegood:last-child{margin-bottom:0}.shop3 .s3-livegoodart{width:46px;height:46px;flex-basis:46px;border-radius:10px}.shop3 .s3-livegoodart .s3-goodvisual-label{font-size:8px;padding:2px}.shop3 .s3-livegoodart .s3-goodvisual-tier{font-size:7px;min-width:17px}.shop3 .s3-livegood>span{min-width:0;overflow:hidden;text-overflow:ellipsis;color:#553821;font-size:10px;font-weight:900;white-space:nowrap}.shop3 .s3-livegood>b{padding:3px 4px;border-radius:7px;background:#775034;color:#fff1d3;font-size:9px}.shop3 .s3-liveemptyshelf{padding:21px 4px;text-align:center;color:#f2d7ad;font-size:11px;font-weight:900}
.shop3 .s3-livecounter{position:absolute;z-index:12;left:50%;bottom:25px;width:190px;height:94px;transform:translateX(-50%);border:3px solid #57331e;border-radius:14px 14px 7px 7px;background:linear-gradient(#a46b3d 0 19px,#86502d 20px 100%);box-shadow:inset 0 2px 0 #d69a5b,0 7px 0 #492919,0 14px 19px rgba(42,24,13,.25)}.shop3 .s3-countertop{position:absolute;left:10px;top:4px;color:#ffe4b1;font-size:9px;font-weight:950}.shop3 .s3-liveboss{position:absolute;left:50%;bottom:41px;width:78px;height:90px;object-fit:contain;transform:translateX(-50%);filter:drop-shadow(0 6px 3px rgba(42,23,12,.3));animation:s3bob 3s ease-in-out infinite}.shop3 .s3-bossname{position:absolute;left:50%;bottom:9px;transform:translateX(-50%);padding:3px 7px;border-radius:99px;background:#f2d18b;color:#57381f;font-size:9px;font-weight:950;white-space:nowrap}.shop3 .s3-register{position:absolute;right:15px;top:30px;font-size:25px}.shop3 .s3-livestaff{position:absolute;z-index:7;width:54px;height:65px;object-fit:contain;filter:drop-shadow(0 5px 2px rgba(44,25,14,.28));animation:s3bob 3.4s ease-in-out infinite}.shop3 .staff-a{left:7%;bottom:17px}.shop3 .staff-b{right:7%;bottom:18px;animation-delay:.7s}.shop3 .s3-liveplant{position:absolute;z-index:5;left:35%;bottom:19px;font-size:32px;filter:drop-shadow(0 4px 2px rgba(42,24,14,.24))}.shop3 .s3-livelamp{position:absolute;z-index:5;top:72px;font-size:27px;filter:drop-shadow(0 5px 7px rgba(255,174,70,.5));animation:s3sway 3.8s ease-in-out infinite;transform-origin:top center}.shop3 .lamp-a{left:38%}.shop3 .lamp-b{right:38%;animation-delay:1.2s}
.shop3 .s3-livecustomer{position:absolute;z-index:18;left:4%;bottom:31px;width:88px;text-align:center;transition:left .55s cubic-bezier(.2,.8,.2,1),bottom .55s cubic-bezier(.2,.8,.2,1),transform .55s ease;filter:drop-shadow(0 7px 3px rgba(43,24,13,.27))}.shop3 .s3-livecustomer.stage-enter{left:4%;bottom:29px;transform:scale(.9)}.shop3 .s3-livecustomer.stage-browse{left:38%;bottom:104px;transform:scale(1.04)}.shop3 .s3-livecustomer.stage-checkout{left:calc(50% + 75px);bottom:42px;transform:scale(1)}.shop3 .s3-livecustomer.stage-checkout.will-leave{left:82%;transform:scale(.9)}.shop3 .s3-livecustomerportrait{width:72px;height:82px;margin:0 auto;border:0;border-radius:0;background:transparent;box-shadow:none;overflow:visible}.shop3 .s3-livecustomerportrait .s3-customerart{object-fit:contain;padding:0;filter:drop-shadow(0 4px 2px rgba(45,25,14,.27))}.shop3 .s3-livecustomername{display:inline-block;max-width:86px;margin-top:-2px;padding:3px 7px;border-radius:99px;background:rgba(71,42,25,.88);border:1px solid rgba(255,226,176,.5);color:#fff4dc;font-size:10px;font-weight:950;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shop3 .s3-livebubble{position:absolute;z-index:25;left:50%;bottom:133px;width:min(82%,360px);transform:translateX(-50%);padding:10px 12px;border:2px solid #a66e39;border-radius:16px 16px 6px 16px;background:linear-gradient(180deg,rgba(255,252,239,.97),rgba(248,226,188,.96));color:#4f3522;box-shadow:0 5px 0 rgba(76,44,24,.16),0 12px 22px rgba(46,26,15,.22);backdrop-filter:blur(4px)}.shop3 .s3-livebubble small{display:block;color:#9a6b38;font-size:10px;font-weight:950}.shop3 .s3-livebubble b{display:block;margin-top:2px;font-size:15px;line-height:1.25}.shop3 .s3-livebubble span{display:block;margin-top:4px;color:#6e523c;font-size:11px;line-height:1.45;font-weight:800}.shop3 .s3-livebubble.bad{border-color:#a96355;background:linear-gradient(#fff6eb,#efd6c9)}.shop3 .s3-livebubble.bad small{color:#a45648}.shop3 .s3-livebubble.settling{bottom:50%;transform:translate(-50%,50%);text-align:center}
.shop3 .s3-missionveil{position:absolute;z-index:60;inset:0;display:grid;place-items:center;padding:16px;background:rgba(38,23,15,.58);backdrop-filter:blur(4px);animation:s3fade .18s ease-out both}.shop3 .s3-missionoffer{position:relative;width:min(100%,330px);padding:28px 18px 17px;border:3px solid #7d4b27;border-radius:18px;background:linear-gradient(#fff4cf,#efd29b);color:#54371f;text-align:center;box-shadow:inset 0 0 0 3px rgba(255,255,255,.36),0 7px 0 #55311c,0 18px 40px rgba(25,14,8,.38);animation:s3pop .22s ease-out both}.shop3 .s3-missionoffer:before,.shop3 .s3-missionoffer:after{content:"";position:absolute;left:11px;right:11px;height:2px;background:repeating-linear-gradient(90deg,#aa7840 0 9px,transparent 9px 15px)}.shop3 .s3-missionoffer:before{top:12px}.shop3 .s3-missionoffer:after{bottom:9px}.shop3 .s3-missionseal{position:absolute;left:50%;top:-31px;width:60px;height:60px;display:grid;place-items:center;transform:translateX(-50%) rotate(-4deg);border:3px solid #744322;border-radius:50%;background:linear-gradient(#d96856,#a83f35);color:white;font-size:29px;box-shadow:0 5px 0 rgba(72,38,20,.25)}.shop3 .s3-missionoffer>small{display:block;margin-top:7px;color:#9a6c35;font-size:11px;font-weight:950}.shop3 .s3-missionoffer h3{margin:4px 0 6px;font-size:21px}.shop3 .s3-missionoffer p{margin:0;color:#6c5038;font-size:13px;line-height:1.5;font-weight:800}.shop3 .s3-missionoffer strong{display:block;margin:11px 0;padding:7px;border:1px dashed #af7a39;border-radius:10px;background:rgba(255,248,221,.63);color:#8a5c20;font-size:14px}.shop3 .s3-missionoffer>div{display:grid;grid-template-columns:1.25fr .75fr;gap:7px}.shop3 .s3-missionoffer button{min-height:45px;border-radius:11px;font-size:13px;font-weight:950;cursor:pointer}.shop3 .s3-missionoffer .accept{border:2px solid #416b42;background:linear-gradient(#78a66c,#527b4d);color:#fff;box-shadow:0 4px 0 #395c37}.shop3 .s3-missionoffer .skip{border:1px solid #b99b74;background:#f6e7cc;color:#71563f;box-shadow:0 3px 0 #bca07b}
.shop3 .s3-liveledger{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.shop3 .s3-liveledger>div{padding:9px 6px;border:1px solid #cba778;border-radius:13px;text-align:center;background:linear-gradient(#fff7e7,#ead4b4);box-shadow:0 3px 0 rgba(93,57,31,.12)}.shop3 .s3-liveledger small{display:block;color:#80674f;font-size:10px;font-weight:850}.shop3 .s3-liveledger b{display:block;margin-top:2px;color:#583d29;font-size:14px}.shop3 .s3-missionactive{display:grid;grid-template-columns:50px 1fr;align-items:center;gap:9px;margin-top:8px;padding:9px 10px;border:2px solid #9f7443;border-radius:15px;background:linear-gradient(#fff3cf,#ead0a0);box-shadow:0 4px 0 rgba(92,56,29,.13)}.shop3 .s3-missionactive.done{border-color:#628356;background:linear-gradient(#eff5d9,#d8e9bd)}.shop3 .s3-missionmini{width:47px;height:47px;display:grid;place-items:center;border-radius:14px;background:#8a5830;color:white;font-size:26px;box-shadow:0 3px 0 #5c371f}.shop3 .s3-missionactive.done .s3-missionmini{background:#65885b;box-shadow:0 3px 0 #456440}.shop3 .s3-missionactive small{display:block;color:#8a6a45;font-size:10px;font-weight:900}.shop3 .s3-missionactive b{display:block;font-size:14px}.shop3 .s3-missionactive span:not(.s3-missionmini){display:block;margin-top:2px;color:#755a40;font-size:11px;font-weight:800}.shop3 .s3-missionprogress{height:7px;margin-top:6px;border-radius:99px;background:rgba(105,72,43,.18);overflow:hidden}.shop3 .s3-missionprogress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#d19643,#f0c965);transition:width .35s ease}.shop3 .s3-missionactive.done .s3-missionprogress i{background:linear-gradient(90deg,#62905c,#9bc577)}.shop3 .s3-livehint{margin:7px 3px 0;color:#7b654f;font-size:10px;line-height:1.4;font-weight:800;text-align:center}.shop3 .s3-nav button:disabled{opacity:.42;cursor:default;filter:saturate(.45)}
@keyframes s3pulse{0%,100%{opacity:.65;transform:scale(.85)}50%{opacity:1;transform:scale(1.13)}}@keyframes s3sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}@keyframes s3fade{from{opacity:0}to{opacity:1}}
@media(max-width:420px){.shop3 .s3-head{align-items:flex-start}.shop3 .s3-head h3{font-size:18px}.shop3 .s3-head p{font-size:12px}.shop3 .s3-tag{font-size:11px}.shop3 .s3-reward{align-items:flex-start;flex-wrap:wrap}.shop3 .s3-buy{margin-left:58px;min-width:calc(100% - 58px);font-size:12px}.shop3 .s3-nav button{font-size:11px}}
@media(min-width:700px){.s3-scene{min-height:368px}.s3-building{width:330px;height:217px;top:105px}.s3-window{height:103px}.s3-queue{width:205px}.s3-open{width:125px}.s3-furniture{grid-template-columns:1fr 1fr}.s3-workshop{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(250px,.92fr);gap:10px;align-items:start}.s3-drawer{max-height:450px;margin-top:0;padding:0 0 0 9px;border-top:0;border-left:1px dashed #d0b68f}}
@media(prefers-reduced-motion:reduce){.shop3 *,.shop3 *:before,.shop3 *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
/* V7：多人即時營運舞台。經濟結算不變，只強化店內動線、顧客重疊與可讀性。 */
.shop3 .s3-livescene.v7{min-height:550px;background:#2c1a11;box-shadow:inset 0 0 0 4px rgba(255,230,177,.2),0 11px 0 rgba(75,43,24,.2),0 24px 48px rgba(46,27,17,.3)}
.shop3 .s3-livescene.v7 .s3-liveveil{background:linear-gradient(180deg,rgba(29,16,9,.14),rgba(66,35,17,.03) 45%,rgba(30,17,10,.52)),radial-gradient(circle at 50% 36%,rgba(255,222,146,.28),transparent 48%)}
.shop3 .s3-livescene.v7 .s3-livehud{grid-template-columns:auto repeat(3,minmax(0,1fr)) auto;gap:6px;padding:8px 9px;border:2px solid rgba(255,223,166,.42);background:linear-gradient(180deg,rgba(64,37,22,.94),rgba(49,29,19,.9));box-shadow:0 5px 0 rgba(35,18,10,.2),0 12px 24px rgba(32,18,10,.26)}
.shop3 .s3-livescene.v7 .s3-livehud b{font-size:14px}.shop3 .s3-livescene.v7 .s3-livehud small{font-size:10px}
.shop3 .s3-liveentry{position:absolute;z-index:8;left:1.4%;bottom:20px;width:72px;height:124px;border:4px solid #5b321d;border-bottom-width:7px;border-radius:38px 38px 6px 6px;background:linear-gradient(90deg,#6f4125,#a36a3c 46%,#724225);box-shadow:inset 0 0 0 3px rgba(255,221,165,.14),0 8px 0 rgba(46,24,13,.3)}
.shop3 .s3-liveentry:before{content:"";position:absolute;inset:15px 10px 8px;border-radius:28px 28px 3px 3px;background:linear-gradient(160deg,rgba(244,200,116,.24),rgba(37,22,15,.76)),repeating-linear-gradient(90deg,#59331f 0 4px,#6a4027 4px 8px)}
.shop3 .s3-liveentry span{position:absolute;z-index:2;left:50%;top:20px;transform:translateX(-50%) rotate(-4deg);padding:3px 5px;border:1px solid #f2c975;border-radius:5px;background:#8c3f35;color:#fff0c8;font-size:9px;font-weight:950}.shop3 .s3-liveentry b{position:absolute;z-index:2;left:50%;bottom:10px;transform:translateX(-50%);color:#f4ddb5;font-size:10px;white-space:nowrap}
.shop3 .s3-liverug{position:absolute;z-index:3;left:50%;bottom:9px;width:46%;height:92px;transform:translateX(-50%) perspective(180px) rotateX(62deg);border:2px solid rgba(106,54,30,.68);border-radius:50%;background:repeating-linear-gradient(90deg,rgba(177,79,55,.42) 0 22px,rgba(215,156,85,.28) 22px 44px);box-shadow:0 0 30px rgba(255,191,94,.12)}
.shop3 .s3-liverug i{position:absolute;width:13px;height:10px;border-radius:50% 50% 45% 45%;background:rgba(255,226,176,.22)}.shop3 .s3-liverug i:nth-child(1){left:14%;top:42%}.shop3 .s3-liverug i:nth-child(2){left:31%;top:57%}.shop3 .s3-liverug i:nth-child(3){left:50%;top:39%}.shop3 .s3-liverug i:nth-child(4){left:68%;top:58%}.shop3 .s3-liverug i:nth-child(5){left:84%;top:40%}
.shop3 .s3-queueguide{position:absolute;z-index:10;right:7%;bottom:17px;width:190px;height:65px;border-bottom:2px dashed rgba(255,226,174,.34);pointer-events:none}.shop3 .s3-queueguide>span{position:absolute;right:0;bottom:3px;padding:3px 7px;border-radius:99px;background:rgba(72,42,24,.72);color:#f2d6a7;font-size:9px;font-weight:950}.shop3 .s3-queueguide i{position:absolute;bottom:16px;width:18px;height:13px;border:2px solid rgba(255,224,169,.35);border-radius:50%}.shop3 .s3-queueguide i:nth-of-type(1){right:125px}.shop3 .s3-queueguide i:nth-of-type(2){right:75px}.shop3 .s3-queueguide i:nth-of-type(3){right:25px}
.shop3 .s3-livecustomer.v7{width:80px;z-index:20;transition:left .38s cubic-bezier(.2,.8,.2,1),bottom .38s cubic-bezier(.2,.8,.2,1),opacity .35s ease,transform .35s ease}.shop3 .s3-livecustomer.v7.stage-enter{transform:scale(.84);opacity:.9}.shop3 .s3-livecustomer.v7.stage-browse{transform:scale(1.02)}.shop3 .s3-livecustomer.v7.stage-queue{transform:scale(.91);z-index:17}.shop3 .s3-livecustomer.v7.stage-checkout{transform:scale(1);z-index:22}.shop3 .s3-livecustomer.v7.stage-exit{transform:scale(.84);opacity:.72}
.shop3 .s3-livecustomer.v7 .s3-livecustomerportrait{width:66px;height:74px}.shop3 .s3-livecustomer.v7 .s3-livecustomername{max-width:80px;font-size:11px;padding:3px 7px}.shop3 .s3-livetrait{display:block;width:max-content;max-width:90px;margin:2px auto 0;padding:2px 5px;border:1px solid rgba(255,223,165,.48);border-radius:99px;background:rgba(104,63,35,.92);color:#ffe4b8;font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shop3 .s3-livescene.v7 .s3-livebubble{bottom:148px;width:min(84%,390px);padding:11px 13px}.shop3 .s3-livescene.v7 .s3-livebubble small{font-size:11px}.shop3 .s3-livescene.v7 .s3-livebubble b{font-size:16px}.shop3 .s3-livescene.v7 .s3-livebubble span{font-size:12px}.shop3 .s3-livescene.v7 .s3-livebubble.settling{bottom:50%}
.shop3 .s3-livescene.v7 .s3-liveshelf{top:118px;width:30%;padding-top:30px}.shop3 .s3-livescene.v7 .s3-liveshelfsign{font-size:11px;padding:4px}.shop3 .s3-livescene.v7 .s3-livegood>span{font-size:11px}.shop3 .s3-livescene.v7 .s3-livegood>b{font-size:10px}.shop3 .s3-livescene.v7 .s3-countertop{font-size:10px}
.shop3 .s3-liveledger{grid-template-columns:repeat(4,1fr)}.shop3 .s3-liveledger small{font-size:10px}.shop3 .s3-liveledger b{font-size:14px}
@media(max-width:520px){.shop3 .s3-livescene.v7{min-height:520px;border-radius:24px}.shop3 .s3-livescene.v7 .s3-livehud{left:7px;right:7px;top:7px;grid-template-columns:auto repeat(2,minmax(0,1fr)) auto}.shop3 .s3-livescene.v7 .s3-livehud>span:nth-child(4){display:none}.shop3 .s3-livescene.v7 .s3-liveshelf{top:112px;width:32%;min-width:112px}.shop3 .s3-livescene.v7 .s3-livegood{grid-template-columns:42px minmax(0,1fr);min-height:54px}.shop3 .s3-livescene.v7 .s3-livegood>b{display:none}.shop3 .s3-liveentry{width:62px;height:108px}.shop3 .s3-queueguide{width:150px;right:3%}.shop3 .s3-livecustomer.v7{width:70px}.shop3 .s3-livecustomer.v7 .s3-livecustomerportrait{width:59px;height:66px}.shop3 .s3-livetrait{font-size:9px;max-width:76px}.shop3 .s3-livescene.v7 .s3-livebubble{bottom:137px}.shop3 .s3-liveledger{grid-template-columns:repeat(2,1fr)}}
/* V8：家具與店員真正進入營業舞台。只改演出節奏，不改 deterministic 經濟結果。 */
.shop3 .s3-livescene.v8{min-height:592px}.shop3 .s3-operations{position:absolute;z-index:29;left:50%;top:68px;width:min(82%,370px);transform:translateX(-50%);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));overflow:hidden;border:1px solid rgba(255,226,175,.4);border-radius:14px;background:rgba(66,40,25,.86);color:#fff0d2;box-shadow:0 4px 12px rgba(37,21,12,.22);backdrop-filter:blur(5px)}.shop3 .s3-operations span{min-width:0;padding:6px 3px;text-align:center;border-right:1px solid rgba(255,226,175,.18)}.shop3 .s3-operations span:last-child{border-right:0}.shop3 .s3-operations b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shop3 .s3-operations small{display:block;margin-top:2px;color:#ddbf94;font-size:10px;font-weight:850}
.shop3 .s3-livescene.v8 .s3-liveshelf{top:121px}.shop3 .s3-staffpost{position:absolute;z-index:16;bottom:16px;width:76px;text-align:center;transition:transform .25s ease,filter .25s ease}.shop3 .s3-staffpost.staff-a{left:9%}.shop3 .s3-staffpost.staff-b{right:7%}.shop3 .s3-staffpost .s3-livestaff{position:static;width:58px;height:68px;display:block;margin:0 auto;object-fit:contain;filter:drop-shadow(0 5px 2px rgba(44,25,14,.28));animation:s3bob 3.4s ease-in-out infinite}.shop3 .s3-staffpost>span{display:inline-block;margin-top:-4px;padding:2px 5px;border-radius:99px;background:rgba(69,40,23,.9);border:1px solid rgba(255,223,164,.44);color:#ffe6bb;font-size:10px;font-weight:950;white-space:nowrap}.shop3 .s3-staffpost>b{position:absolute;left:50%;top:-18px;transform:translateX(-50%);padding:4px 7px;border:1px solid #e0b45f;border-radius:10px 10px 10px 3px;background:#fff2c9;color:#6b451f;font-size:10px;white-space:nowrap;box-shadow:0 3px 0 rgba(71,40,21,.15)}.shop3 .s3-staffpost.working{transform:translateY(-4px) scale(1.06);filter:brightness(1.08)}.shop3 .s3-staffpost.working .s3-livestaff{animation:s3work .48s ease-in-out infinite alternate}
.shop3 .s3-decorflower{position:absolute;z-index:7;left:35%;bottom:20px;width:44px;height:28px;border:2px solid #694125;border-radius:5px 5px 12px 12px;background:#aa7040;box-shadow:0 4px 0 rgba(51,28,15,.22)}.shop3 .s3-decorflower i{position:absolute;bottom:18px;width:16px;height:16px;border-radius:50% 50% 45% 55%;background:#f0b6a7;border:2px solid #fff0c9}.shop3 .s3-decorflower i:nth-child(1){left:1px}.shop3 .s3-decorflower i:nth-child(2){left:14px;bottom:24px}.shop3 .s3-decorflower i:nth-child(3){right:1px}.shop3 .s3-decorsign{position:absolute;z-index:8;left:82px;bottom:129px;padding:5px 7px;border:2px solid #56321d;border-radius:5px;background:linear-gradient(#9d6538,#754525);color:#ffe2aa;font-size:10px;font-weight:950;transform:rotate(-3deg);box-shadow:0 4px 0 rgba(50,28,15,.22)}.shop3 .s3-decorlucky{position:absolute;z-index:9;right:29%;bottom:104px;width:50px;text-align:center}.shop3 .s3-decorluckyart{display:block;width:46px;height:50px;object-fit:contain;filter:drop-shadow(0 4px 2px rgba(50,29,16,.28))}.shop3 .s3-decorlucky span{display:inline-block;margin-top:-4px;padding:1px 4px;border-radius:6px;background:#a84336;color:#ffe4a7;font-size:9px;font-weight:950}.shop3 .s3-decorstars{position:absolute;z-index:4;left:36%;right:36%;top:111px;height:32px;border-top:2px solid rgba(255,224,154,.55)}.shop3 .s3-decorstars i{position:absolute;top:-5px;width:10px;height:10px;transform:rotate(45deg);background:#ffd77a;box-shadow:0 0 9px rgba(255,205,97,.65);animation:s3pulse 1.8s ease-in-out infinite}.shop3 .s3-decorstars i:nth-child(1){left:2%}.shop3 .s3-decorstars i:nth-child(2){left:32%;animation-delay:.35s}.shop3 .s3-decorstars i:nth-child(3){right:32%;animation-delay:.7s}.shop3 .s3-decorstars i:nth-child(4){right:2%;animation-delay:1.05s}
.shop3 .s3-liveeffect{margin-top:6px;padding:6px 7px;border:1px dashed #c6a06f;border-radius:9px;background:#f5e9d4;color:#765637;font-size:11px;line-height:1.4;font-weight:800}.shop3 .s3-liveeffect strong{display:inline-block;margin-right:5px;padding:1px 5px;border-radius:99px;background:#795032;color:#fff0d2;font-size:10px}
@keyframes s3work{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-4px) rotate(2deg)}}
@media(max-width:520px){.shop3 .s3-livescene.v8{min-height:580px}.shop3 .s3-operations{top:61px;width:92%;grid-template-columns:repeat(2,minmax(0,1fr))}.shop3 .s3-operations span:nth-child(2){border-right:0}.shop3 .s3-operations span:nth-child(-n+2){border-bottom:1px solid rgba(255,226,175,.18)}.shop3 .s3-livescene.v8 .s3-liveshelf{top:145px}.shop3 .s3-staffpost{bottom:14px;width:68px}.shop3 .s3-staffpost.staff-a{left:4%}.shop3 .s3-staffpost.staff-b{right:3%}.shop3 .s3-staffpost>span{font-size:9px}.shop3 .s3-decorsign{left:64px;bottom:116px}.shop3 .s3-decorlucky{right:26%;bottom:99px}.shop3 .s3-decorstars{top:132px}.shop3 .s3-livescene.v8 .s3-livebubble{bottom:139px}}
/* V9：材料去化工坊。做成倉庫委託板，不再像另一個貨幣商店。 */
.shop3 .s3-sinkboard{margin:10px 0 12px;padding:12px;border:2px solid #80502e;border-radius:17px;background:linear-gradient(145deg,#9b663c,#6c4329);color:#fff0d5;box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 5px 0 #4e2f1d}.shop3 .s3-sinktitle{display:flex;align-items:flex-start;justify-content:space-between;gap:9px}.shop3 .s3-sinktitle b{font-size:15px}.shop3 .s3-sinktitle span{max-width:215px;color:#ead0aa;font-size:11px;line-height:1.4;font-weight:800;text-align:right}.shop3 .s3-sinkresources{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:9px}.shop3 .s3-sinkres{padding:7px 5px;border:1px solid rgba(255,228,181,.22);border-radius:10px;background:rgba(255,247,225,.09);text-align:center}.shop3 .s3-sinkres b{display:block;font-size:12px}.shop3 .s3-sinkres small{display:block;margin-top:2px;color:#e2c59c;font-size:10px;font-weight:850}.shop3 .s3-sinkjobs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.shop3 .s3-sinkjob{min-width:0;padding:8px;border:1px solid #d5aa68;border-radius:11px;background:linear-gradient(#fff2cb,#e7c38a);color:#5c3b22;text-align:left;box-shadow:0 3px 0 rgba(57,31,17,.28)}.shop3 .s3-sinkjob b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shop3 .s3-sinkjob span{display:block;margin-top:3px;font-size:10px;line-height:1.35;font-weight:850;color:#795734}.shop3 .s3-sinkjobactions{display:grid;grid-template-columns:.8fr 1.2fr;gap:5px;margin-top:7px}.shop3 .s3-sinkjobactions button{min-height:36px;padding:6px;border-radius:9px;font-size:11px;font-weight:950;cursor:pointer}.shop3 .s3-sinklook{border:1px solid #a98253;background:#fff8df;color:#6b4b2e}.shop3 .s3-sinkquick{border:1px solid #426940;background:linear-gradient(#78a86c,#55814e);color:#fff;box-shadow:0 3px 0 #3c603a}.shop3 .s3-sinkquick:disabled{opacity:.55;box-shadow:none;cursor:default}.shop3 .s3-craftactions{display:grid;grid-template-columns:.85fr 1.15fr;gap:6px}.shop3 .s3-craftactions .s3-primary{margin-top:8px}.shop3 .s3-primary.secondary{border-color:#8d6b48;background:linear-gradient(#c7a77d,#a47a51);box-shadow:0 4px 0 #775537}.shop3 .s3-sinknote{margin-top:8px;color:#e7cda8;font-size:10px;line-height:1.45;font-weight:800}.shop3 .s3-sinkempty{margin-top:9px;padding:9px;border:1px dashed rgba(255,226,178,.35);border-radius:10px;color:#ead3b3;font-size:11px;font-weight:850;text-align:center}
/* V11：exact-tier 爆倉雷達 + 已上架低庫存快速補貨。 */
.shop3 .s3-overflowhead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}.shop3 .s3-overflowhead b{font-size:13px}.shop3 .s3-overflowreset{min-height:34px;padding:6px 9px;border:1px solid rgba(255,228,181,.38);border-radius:9px;background:rgba(255,248,226,.14);color:#fff0d5;font-size:11px;font-weight:950;cursor:pointer}.shop3 .s3-overflowreset.active{background:#f3d28f;color:#5b3a20;border-color:#e2b967}.shop3 .s3-overflowgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:7px}.shop3 .s3-overflowres{min-width:0;min-height:58px;padding:7px 6px;border:1px solid rgba(255,228,181,.25);border-radius:10px;background:rgba(255,247,225,.1);color:#fff0d5;text-align:left;cursor:pointer}.shop3 .s3-overflowres b{display:block;font-size:12px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shop3 .s3-overflowres small{display:block;margin-top:4px;color:#efd2a7;font-size:11px;line-height:1.3;font-weight:850}.shop3 .s3-overflowres.active{border-color:#ffe29b;background:rgba(255,224,155,.23);box-shadow:0 0 0 2px rgba(255,224,155,.12)}.shop3 .s3-overflowres:disabled{cursor:default;opacity:.62}.shop3 .s3-focusnote{margin-top:7px;padding:7px 8px;border-radius:9px;background:rgba(255,244,214,.12);color:#f4d9ad;font-size:11px;line-height:1.4;font-weight:850}.shop3 .s3-slotwrap{flex:0 0 116px;scroll-snap-align:start;display:flex;flex-direction:column;gap:6px;min-width:0}.shop3 .s3-slotwrap .s3-slot{width:100%;flex:0 0 auto;scroll-snap-align:unset}.shop3 .s3-slot.lowstock{border-color:#d08b3f}.shop3 .s3-slot.outstock{border-color:#bd5e4f;filter:saturate(.82)}.shop3 .s3-refillnotice{margin:0 1px 8px;padding:8px 9px;border:1px solid #d6aa68;border-radius:11px;background:#fff1cf;color:#71502e;font-size:12px;line-height:1.4;font-weight:900}.shop3 .s3-refill{width:100%;min-height:38px;padding:7px 5px;border:1px solid #54774d;border-radius:9px;background:linear-gradient(#7cab72,#5f8957);color:#fff;font-size:12px;line-height:1.25;font-weight:950;box-shadow:0 3px 0 #41623d;cursor:pointer}.shop3 .s3-refill:disabled{border-color:#9d8e79;background:#c1b4a0;color:#6f6252;box-shadow:0 3px 0 #938572;cursor:default}
@media(max-width:520px){.shop3 .s3-sinktitle{display:block}.shop3 .s3-sinktitle span{display:block;max-width:none;margin-top:4px;text-align:left}.shop3 .s3-sinkresources{grid-template-columns:repeat(2,minmax(0,1fr))}.shop3 .s3-sinkjobs{grid-template-columns:1fr}}
@media(max-width:520px){.shop3 .s3-overflowgrid{grid-template-columns:repeat(2,minmax(0,1fr))}.shop3 .s3-slotwrap{flex-basis:122px}}
@media(max-width:420px){.shop3 .s3-craftactions{grid-template-columns:1fr}}
.s3-game{width:100%;max-width:100%;overflow-x:clip}.s3-crosssection{position:relative;min-height:540px;overflow:hidden;border:3px solid #5d3821;border-radius:28px;background:#49301e;box-shadow:0 12px 30px rgba(54,32,18,.28)}.s3-crosssection-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}.s3-scenehud{position:absolute;z-index:20;left:10px;right:10px;top:10px;display:grid;grid-template-columns:1.35fr repeat(3,1fr);gap:5px;padding:7px;border:1px solid rgba(255,231,190,.45);border-radius:16px;background:rgba(54,32,20,.88);color:#fff4dc;backdrop-filter:blur(6px)}.s3-scenehud>span{text-align:center;min-width:0}.s3-scenehud b,.s3-scenehud small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s3-scenehud b{font-size:13px}.s3-scenehud small{margin-top:2px;color:#e2c29c;font-size:9px;font-weight:800}.s3-season{padding:4px;border-radius:10px;background:#6d7650}.s3-season.rush{background:#af4d3d}.s3-zone{position:absolute;z-index:5;border:1px dashed rgba(255,239,202,.38);border-radius:14px}.s3-zone>span:first-child{position:absolute;padding:3px 7px;border-radius:99px;background:rgba(70,40,22,.82);color:#ffe6b7;font-size:10px;font-weight:900}.s3-zone-entry{left:2%;bottom:7%;width:18%;height:60%}.s3-zone-entry>span{left:5px;bottom:5px}.s3-zone-shelf{left:20%;top:22%;width:31%;height:43%;display:flex;align-items:flex-end;justify-content:center;gap:4px;padding:0 7px 9px}.s3-zone-shelf>span:first-child{left:5px;top:5px}.s3-zone-aisle{left:20%;right:24%;bottom:5%;height:28%}.s3-zone-aisle>span{left:45%;bottom:5px}.s3-zone-counter{right:3%;bottom:8%;width:24%;height:43%}.s3-zone-counter>span{right:5px;bottom:5px}.s3-sceneproduct{width:52px}.s3-countercat{position:absolute;right:15%;bottom:20%;width:70px;height:80px;object-fit:contain;filter:drop-shadow(0 5px 3px rgba(44,24,12,.35))}.s3-customers{position:absolute;z-index:10;left:7%;right:25%;bottom:15%;height:135px;pointer-events:none}.s3-roamingcat{position:absolute;width:72px;height:88px;object-fit:contain;filter:drop-shadow(0 5px 3px rgba(42,23,12,.4));animation:s3shopwalk 2.8s ease-in-out infinite}.s3-roamingcat.cat-0{left:3%;bottom:0}.s3-roamingcat.cat-1{left:30%;bottom:32%;animation-delay:.45s}.s3-roamingcat.cat-2{left:58%;bottom:3%;animation-delay:.9s}.s3-roamingcat.cat-3{left:78%;bottom:38%;animation-delay:1.35s}.s3-sceneopen{position:absolute;z-index:30;right:12px;bottom:12px;min-height:44px;padding:8px 13px;border:2px solid #70451f;border-radius:14px;background:linear-gradient(#f5cf68,#d99c3b);color:#543515;font-weight:950;box-shadow:0 4px 0 #70451f}.s3-actiondock{position:sticky;z-index:40;bottom:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px;padding:7px;border:2px solid #55331d;border-radius:20px;background:linear-gradient(#86532f,#61391f);box-shadow:0 8px 20px rgba(55,32,18,.3)}.s3-actiondock button{min-width:0;min-height:58px;padding:7px 3px;border:1px solid rgba(255,226,178,.24);border-radius:13px;background:rgba(255,255,255,.08);color:#fff0d4}.s3-actiondock button.active{background:#edbe5b;color:#50321a}.s3-actiondock span,.s3-actiondock b,.s3-actiondock small{display:block}.s3-actiondock span{font-size:20px}.s3-actiondock b{font-size:12px}.s3-actiondock small{margin-top:2px;font-size:9px;opacity:.8}.s3-operationsdrawer{position:relative;margin-top:10px;padding:40px 8px 8px;border:2px solid #805532;border-radius:22px;background:#f7ead4}.s3-drawerclose{position:absolute;z-index:5;right:9px;top:8px;width:28px;height:28px;border:0;border-radius:50%;background:#745039;color:#fff;font-size:20px}.s3-operationsdrawer>.s3-panel{box-shadow:none}.s3-operationsdrawer .s3-panel{margin:0}
@keyframes s3shopwalk{50%{transform:translateY(-7px)}}
@media(max-width:520px){.s3-crosssection{min-height:500px;border-radius:20px}.s3-scenehud{left:6px;right:6px;top:6px;grid-template-columns:repeat(2,minmax(0,1fr))}.s3-zone-shelf{left:18%;width:38%}.s3-zone-counter{width:28%}.s3-roamingcat{width:58px;height:72px}.s3-sceneopen{right:7px;bottom:7px}.s3-actiondock{bottom:5px;margin-inline:0}}
@media(prefers-reduced-motion:reduce){.shop3 *{scroll-behavior:auto!important}.shop3 .s3-roamingcat,.shop3 .s3-qcat,.shop3 .s3-worker,.shop3 .s3-livecustomer,.shop3 .s3-open .bell{animation:none!important;transition:none!important}}
/* V12：營業是獨立全螢幕遊戲。舞台維持 16:9 座標系，工具以抽屜覆蓋，不擠壓場景。 */
.shop3 .s3-livefullscreen{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:12px 12px 88px;background:#24150d;overflow:hidden}.shop3 .s3-livewrap{width:min(100%,1180px);height:100%;display:grid;place-items:center}.shop3 .s3-livescene.v8{width:100%;min-height:0;aspect-ratio:16/9;max-height:calc(100dvh - 112px);border-radius:22px}.shop3 .s3-livebg{object-fit:cover}.shop3 .s3-operations,.shop3 .s3-liveledger,.shop3 .s3-livehint{display:none}.shop3 .s3-livehud{grid-template-columns:auto repeat(2,minmax(0,1fr)) auto;max-width:720px;margin-inline:auto}.shop3 .s3-livehud>span:nth-child(4){display:none}.shop3 .s3-livehud b{font-size:clamp(14px,1.6vw,18px)}.shop3 .s3-livehud small{font-size:12px}.shop3 .s3-livescene.v8 .s3-liveshelf{top:25%;bottom:23%;width:27%;min-width:0;padding:38px 7px 8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:4px;background:linear-gradient(180deg,rgba(104,61,31,.25),rgba(81,45,23,.78));border:0;border-bottom:12px solid #673b20;box-shadow:inset 0 -5px #bd7d42}.shop3 .s3-liveshelf-left{left:4%}.shop3 .s3-liveshelf-right{right:4%}.shop3 .s3-livegood{display:flex;min-width:0;min-height:0;margin:0;padding:0;align-items:end;justify-content:center;background:none;border:0;box-shadow:none}.shop3 .s3-livegoodart{width:min(100%,76px);height:auto;aspect-ratio:1;overflow:visible;border:0!important;background:none!important;box-shadow:none!important}.shop3 .s3-livegoodart .s3-goodvisual-img{object-fit:contain;filter:drop-shadow(0 5px 3px rgba(34,18,8,.35))}.shop3 .s3-livegood>span,.shop3 .s3-livegood>b,.shop3 .s3-livegoodart .s3-goodvisual-tier{display:none}.shop3 .s3-livecounter{left:50%;bottom:7%;width:24%;height:20%;transform:translateX(-50%)}.shop3 .s3-liveboss{z-index:-1;bottom:55%;width:42%;height:auto;max-height:130px;object-fit:contain}.shop3 .s3-bossname{font-size:12px}.shop3 .s3-staffpost.staff-a{left:38%;bottom:7%}.shop3 .s3-staffpost.staff-b{right:36%;bottom:7%}.shop3 .s3-livebubble{bottom:27%;font-size:14px}.shop3 .s3-livebubble small,.shop3 .s3-livebubble span{font-size:12px}.shop3 .s3-livebubble b{font-size:16px}.shop3 .s3-livetools{position:fixed;z-index:1030;left:50%;bottom:max(10px,env(safe-area-inset-bottom));width:min(calc(100% - 20px),560px);transform:translateX(-50%);display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;border:2px solid #80502e;border-radius:18px;background:rgba(55,31,18,.96);box-shadow:0 8px 26px rgba(0,0,0,.38)}.shop3 .s3-livetools button{min-height:54px;border:1px solid #b9864d;border-radius:12px;background:#f3d28b;color:#51331d;font-size:22px;font-weight:950}.shop3 .s3-livetools button span{display:block;font-size:14px}.shop3 .s3-livetools button.active{background:#fff1c5}.shop3 .s3-livetools button.danger{background:#a84d42;border-color:#d98a7f;color:#fff}.shop3 .s3-livetooldrawer{position:fixed;z-index:1020;left:50%;bottom:82px;width:min(calc(100% - 20px),760px);max-height:min(72dvh,680px);transform:translateX(-50%);overflow:auto;padding:48px 10px 12px;border:2px solid #9a683b;border-radius:22px;background:#f7ead4;box-shadow:0 -10px 35px rgba(0,0,0,.38)}.shop3 .s3-livedrawerclose{position:absolute;right:12px;top:10px;width:36px;height:36px;border:0;border-radius:50%;background:#694027;color:#fff;font-size:24px}.shop3 .s3-livetooldrawer .s3-panel{box-shadow:none}.shop3 .s3-live-refill{display:grid;gap:10px}.shop3 .s3-live-refill h3{margin:0;font-size:20px}.shop3 .s3-live-refill p{margin:0;color:#765f4c;font-size:14px}.shop3 .s3-live-refill-row{display:grid;grid-template-columns:64px 1fr auto;align-items:center;gap:10px;padding:9px;border:1px solid #d2b488;border-radius:14px;background:#fff9ee}.shop3 .s3-live-refill-row .s3-goodvisual{width:60px;height:60px}.shop3 .s3-live-refill-row b{font-size:15px}.shop3 .s3-live-refill-row small{display:block;margin-top:4px;font-size:13px;color:#77604b}.shop3 .s3-live-refill-row button{min-height:44px;padding:8px 12px;border:1px solid #477044;border-radius:10px;background:#66935e;color:#fff;font-size:14px;font-weight:950}.shop3 .s3-livetooldrawer .s3-head p,.shop3 .s3-livetooldrawer .s3-goodhero p,.shop3 .s3-livetooldrawer .s3-meta span,.shop3 .s3-livetooldrawer .s3-cost,.shop3 .s3-livetooldrawer .s3-chip,.shop3 .s3-livetooldrawer .s3-qty button,.shop3 .s3-livetooldrawer .s3-reciperow .copy b,.shop3 .s3-livetooldrawer .s3-reciperow .copy span,.shop3 .s3-livetooldrawer .s3-reciperow .stock{font-size:12px}.shop3 .s3-livetooldrawer .s3-primary{min-height:44px;font-size:14px}
@media(max-width:620px){.shop3 .s3-livefullscreen{padding:6px 6px 82px}.shop3 .s3-livescene.v8{aspect-ratio:9/16;max-height:calc(100dvh - 94px);border-radius:15px}.shop3 .s3-livehud{left:6px;right:6px;grid-template-columns:auto 1fr 1fr auto}.shop3 .s3-livehud small{font-size:11px}.shop3 .s3-livescene.v8 .s3-liveshelf{top:22%;bottom:31%;width:31%;grid-template-columns:repeat(2,minmax(0,1fr));padding-top:34px}.shop3 .s3-liveshelf-left{left:3%}.shop3 .s3-liveshelf-right{right:3%}.shop3 .s3-livecounter{bottom:10%;width:42%;height:17%}.shop3 .s3-staffpost.staff-a{left:5%;bottom:11%}.shop3 .s3-staffpost.staff-b{right:4%;bottom:11%}.shop3 .s3-livebubble{bottom:29%;width:68%;padding:9px}.shop3 .s3-livebubble span{display:none}.shop3 .s3-livecustomer.v7{width:64px}.shop3 .s3-livecustomer.v7 .s3-livecustomerportrait{width:58px;height:66px}.shop3 .s3-livetrait,.shop3 .s3-livecustomername{font-size:11px}.shop3 .s3-live-refill-row{grid-template-columns:54px 1fr}.shop3 .s3-live-refill-row button{grid-column:1/-1}.shop3 .s3-livetooldrawer{max-height:76dvh}}
.shop3 .s3-liveboss{z-index:1!important}.shop3 .s3-title,.shop3 .s3-head h3{font-size:16px}.shop3 .s3-sub,.shop3 .s3-wallet small,.shop3 .s3-head p,.shop3 .s3-tag,.shop3 .s3-stat small,.shop3 .s3-slot .kind,.shop3 .s3-slot .name,.shop3 .s3-slot .meta,.shop3 .s3-emptycopy,.shop3 .s3-bin b,.shop3 .s3-bin span,.shop3 .s3-nav button,.shop3 .s3-chip,.shop3 .s3-goodhero p,.shop3 .s3-tier,.shop3 .s3-meta span,.shop3 .s3-cost,.shop3 .s3-qty button,.shop3 .s3-reciperow .copy b,.shop3 .s3-reciperow .copy span,.shop3 .s3-reciperow .stock{font-size:12px}.shop3 .s3-stat b,.shop3 .s3-primary{font-size:14px}.shop3 .s3-nav button{min-height:48px}.shop3 .s3-actiondock small{font-size:11px}.shop3 .s3-actiondock b{font-size:14px}
.shop3 .s3-livescene.v8 .s3-livebubble{top:15%;bottom:auto;width:min(62%,620px);padding:8px 12px}.shop3 .s3-livescene.v8 .s3-livebubble.settling{top:15%;bottom:auto}@media(max-width:620px){.shop3 .s3-livescene.v8 .s3-livebubble{top:13%;bottom:auto;width:72%;padding:7px 9px}.shop3 .s3-livescene.v8 .s3-livebubble small{font-size:11px}.shop3 .s3-livescene.v8 .s3-livebubble b{font-size:14px}}
.shop3 .s3-livehud{grid-template-columns:auto minmax(100px,1fr) minmax(220px,2.2fr) minmax(100px,1fr) auto}.shop3 .s3-livehud>span:nth-child(4){display:block}.shop3 .s3-hudevent{padding:4px 10px;border-inline:1px solid rgba(255,226,175,.22)}.shop3 .s3-hudevent b{white-space:normal;line-height:1.2}.shop3 .s3-livecounter{bottom:18%}.shop3 .s3-staffpost{display:none}@media(max-width:620px){.shop3 .s3-livehud{grid-template-columns:auto minmax(0,1fr) auto}.shop3 .s3-livehud>span:nth-child(2),.shop3 .s3-livehud>span:nth-child(4){display:none}.shop3 .s3-hudevent{padding:3px 6px;border-left:1px solid rgba(255,226,175,.22);border-right:0}.shop3 .s3-hudevent b{font-size:13px}.shop3 .s3-hudevent small{font-size:11px}.shop3 .s3-livecounter{bottom:19%}}
.shop3 .s3-livecounter .s3-liveboss{left:50%;right:auto;bottom:68%;width:58%;height:130%;max-height:150px;transform:translateX(-50%);object-position:center bottom}.shop3 .s3-livecounter .s3-bossname{left:50%;right:auto;transform:translateX(-50%)}@media(max-width:620px){.shop3 .s3-livecounter .s3-liveboss{bottom:70%;width:68%;height:145%;max-height:125px}}
.shop3 .s3-livegood>.s3-goodvisual{display:inline-flex!important}.shop3 .s3-crosssection{min-height:0;aspect-ratio:16/9}.shop3 .s3-preview-shelf{position:absolute;z-index:5;top:31%;width:29%;height:33%;display:grid;grid-template-columns:repeat(3,1fr);align-items:end;gap:4px;padding:8px}.shop3 .s3-preview-shelf.left{left:5%}.shop3 .s3-preview-shelf.right{right:5%}.shop3 .s3-preview-product{width:100%;height:auto;aspect-ratio:1;background:none!important;border:0!important;box-shadow:none!important}.shop3 .s3-preview-product .s3-goodvisual-tier{display:none}.shop3 .s3-preview-counter{position:absolute;z-index:7;left:50%;bottom:12%;width:25%;height:18%;transform:translateX(-50%);border:3px solid #57331e;border-radius:14px 14px 7px 7px;background:linear-gradient(#a46b3d 0 20%,#86502d 21%);box-shadow:0 7px 0 #492919}.shop3 .s3-preview-manager{position:absolute;left:50%;bottom:72%;width:66%;height:auto;transform:translateX(-50%);object-fit:contain;filter:drop-shadow(0 5px 3px rgba(42,23,12,.3))}.shop3 .s3-manager-picker{margin-bottom:12px}.shop3 .s3-manager-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.shop3 .s3-manager-grid button{position:relative;min-height:122px;padding:6px;border:2px solid #d6bd98;border-radius:14px;background:#fff9ed;color:#5b412d}.shop3 .s3-manager-grid button.active{border-color:#5f8b58;background:#e9f3df}.shop3 .s3-manager-grid img{display:block;width:76px;height:76px;margin:auto;object-fit:contain}.shop3 .s3-manager-grid span{display:block;font-size:14px;font-weight:950}.shop3 .s3-manager-grid b{position:absolute;right:5px;top:5px;padding:3px 5px;border-radius:99px;background:#5f8b58;color:#fff;font-size:10px}@media(max-width:620px){.shop3 .s3-crosssection{aspect-ratio:9/13}.shop3 .s3-preview-shelf{top:28%;height:31%;width:36%;grid-template-columns:repeat(2,1fr)}.shop3 .s3-preview-shelf.left{left:3%}.shop3 .s3-preview-shelf.right{right:3%}.shop3 .s3-preview-counter{bottom:13%;width:40%}.shop3 .s3-preview-manager{bottom:74%;width:72%}}
.shop3 .s3-customerbasket{position:absolute;z-index:4;right:4px;bottom:24px;display:flex!important;gap:2px;width:auto!important;margin:0!important;padding:2px!important;border:0!important;background:rgba(255,250,232,.9)!important;border-radius:8px;box-shadow:0 2px 5px rgba(46,25,13,.22)}.shop3 .s3-customerbasket .s3-carriedgood{display:block!important;width:24px!important;height:24px!important;min-width:24px;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important}.shop3 .s3-customerbasket .s3-goodvisual-tier,.shop3 .s3-customerbasket .s3-goodvisual-label{display:none!important}.shop3 .s3-hudmission{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px;padding:4px 9px;border-radius:9px;background:#72502d;color:#fff0d2}.shop3 .s3-hudmission.done{background:#52764d}.shop3 .s3-hudmission b,.shop3 .s3-hudmission span{font-size:12px;font-weight:950}.shop3 .s3-preview-stock{position:relative;display:flex;align-items:center;justify-content:flex-end;flex-direction:column;min-width:0}.shop3 .s3-preview-stock>b{margin-top:-4px;padding:2px 6px;border-radius:99px;background:rgba(66,39,22,.86);color:#fff0d4;font-size:12px}
.shop3 .s3-livecounter .s3-liveboss{left:50%!important;right:auto!important;transform:translateX(-50%)!important}
.shop3 .s3-customerbasket{right:0!important;bottom:26px!important;gap:1px!important;padding:0!important;border:0!important;background:transparent!important;border-radius:0!important;box-shadow:none!important}.shop3 .s3-livescene.v8 .s3-livegood{position:relative;padding-bottom:18px}.shop3 .s3-livescene.v8 .s3-livegood>b{position:absolute;left:50%;bottom:0;display:block!important;transform:translateX(-50%);min-width:34px;padding:2px 6px;border:1px solid rgba(255,229,183,.5);border-radius:99px;background:rgba(64,37,21,.9);color:#fff0d2;font-size:11px;text-align:center;white-space:nowrap}.shop3 .s3-livescene.v8 .s3-livegoodart{max-width:100%;transform:none!important}
.shop3 .s3-receipthead>div:last-child{font-size:16px!important;color:#62452d!important}.shop3 .s3-total{padding:16px!important}.shop3 .s3-total small{font-size:13px!important}.shop3 .s3-total b{font-size:30px!important}
.shop3 .s3-customerbasket .s3-carriedgood{position:relative!important;flex:0 0 24px!important;margin:0!important;padding:0!important}.shop3 .s3-customerbasket .s3-goodvisual-img{position:absolute;inset:0;width:24px!important;height:24px!important;object-fit:contain}
.shop3 .s3-shelfscroll{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;overflow:visible;padding:2px}.shop3 .s3-slotwrap{width:100%;min-width:0;flex:none}.shop3 .s3-slotwrap .s3-slot{min-height:132px}@media(max-width:430px){.shop3 .s3-shelfscroll{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}}@media(max-width:330px){.shop3 .s3-shelfscroll{grid-template-columns:1fr}}
.shop3 .s3-customerbasket{right:-25px!important;bottom:34px!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:1px!important}
.shop3 .s3-modepicker{width:min(92vw,560px);padding:22px;border:2px solid #9a683b;border-radius:24px;background:#fff8e9;color:#513923;box-shadow:0 20px 60px rgba(28,15,7,.45)}.shop3 .s3-modepicker h3{margin:0;font-size:24px}.shop3 .s3-modepicker>p{margin:7px 0 16px;color:#7a624c;font-size:15px;line-height:1.5}.shop3 .s3-modechoices{display:grid;grid-template-columns:1fr 1fr;gap:12px}.shop3 .s3-modechoice{min-height:150px;padding:16px;border:2px solid #d3b17c;border-radius:18px;background:#fffdf7;color:#513923;text-align:left}.shop3 .s3-modechoice.rush{background:linear-gradient(145deg,#fff1bd,#f4c765);border-color:#bd7c28}.shop3 .s3-modechoice:disabled{filter:grayscale(.65);opacity:.58}.shop3 .s3-modechoice strong,.shop3 .s3-modechoice span,.shop3 .s3-modechoice small{display:block}.shop3 .s3-modechoice strong{font-size:20px}.shop3 .s3-modechoice span{margin-top:8px;font-size:15px;font-weight:900}.shop3 .s3-modechoice small{margin-top:8px;font-size:13px;line-height:1.45}.shop3 .s3-modecancel{width:100%;margin-top:14px;min-height:44px;border:0;border-radius:12px;background:#76513a;color:#fff;font-size:15px;font-weight:900}@media(max-width:520px){.shop3 .s3-modechoices{grid-template-columns:1fr}.shop3 .s3-modechoice{min-height:118px}}
.shop3>.s3-modalbg{z-index:1120}.shop3 .s3-livehud>span:nth-child(4) small{color:#ffe0a0;font-weight:950}
.shop3 .s3-livescene.v8 .s3-livegoodart .s3-goodvisual-img,.shop3 .s3-preview-product .s3-goodvisual-img{padding:8%!important;transform:scale(.84);transform-origin:center;object-fit:contain!important}
`;

export default function ShopSimulatorV3({ memberId, resources, coins, village, onChange }) {
  const shop = useMemo(() => normalizeShop(village?.shop), [village?.shop]);
  const [tab, setTab] = useState(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autoSettling, setAutoSettling] = useState(false);
  const [serveResult, setServeResult] = useState(null);
  const [settlementError, setSettlementError] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [slotPicker, setSlotPicker] = useState(null);
  const [toast, setToast] = useState(null);
  const [openModePicker, setOpenModePicker] = useState(false);
  const [live, setLive] = useState(null);
  const [liveMode, setLiveMode] = useState("manual");
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [liveStage, setLiveStage] = useState("closed");
  const [liveSpeed, setLiveSpeed] = useState(1);
  const [liveRushSeconds, setLiveRushSeconds] = useState(0);
  const [missionStartIndex, setMissionStartIndex] = useState(null);
  const [missionDismissed, setMissionDismissed] = useState(false);
  const [liveTool, setLiveTool] = useState(null);
  const settlingRef = useRef(false);
  const liveRushRef = useRef(0);
  const manualElapsedRef = useRef(0);
  const liveAddedStockRef = useRef({});
  const checkoutSoundCountRef = useRef(0);
  const autoSettlementMemberRef = useRef(null);
  const autoSettlementTargetRef = useRef(null);
  const initializationMemberRef = useRef(null);

  useEffect(() => { preloadShopArt(); }, []);

  useEffect(() => {
    // Wait until the parent profile has actually loaded. Treating an undefined
    // village as a new account can overwrite an existing shop during startup.
    if (memberId && village && !village.shop && initializationMemberRef.current !== memberId) {
      initializationMemberRef.current = memberId;
      initVillageShopIfNeeded(memberId, village).then(() => onChange?.()).catch(() => {
        initializationMemberRef.current = null;
      });
    }
  }, [memberId, village, onChange]);
  useEffect(() => {
    if (!memberId || !village?.shop || autoSettlementMemberRef.current === memberId) return;
    autoSettlementMemberRef.current = memberId;
    setAutoSettling(true);
    const cursor = typeof shop.lastAutoSaleAt === "number"
      ? shop.lastAutoSaleAt
      : shop.lastAutoSaleAt?.toMillis?.() ?? 0;
    settleVillageShopAutoSales(memberId, {
      now:Date.now(),
      expectedLastAutoSaleAtMs:cursor,
      stateSignature:liveShopStateSignature(shop),
    }).then(response => {
      const offline = response?.result?.result;
      const settledAt = Number(response?.result?.settledAt);
      if (Number.isFinite(settledAt)) autoSettlementTargetRef.current = settledAt;
      else setAutoSettling(false);
      if (offline?.totalItems > 0 || offline?.totalTickets > 0) {
        setServeResult({ ...offline, receiptKind:"auto" });
        flash(`離店期間售出 ${offline.totalItems} 件商品，獲得 ${offline.totalTickets} 張票券`);
      }
      onChange?.();
    }).catch(() => {
      // Another tab may have settled first; the parent refresh supplies its result.
      setAutoSettling(false);
      onChange?.();
    });
  }, [memberId, village?.shop, shop, onChange]);
  useEffect(() => {
    const target = autoSettlementTargetRef.current;
    if (!target) return;
    const cursor = typeof shop.lastAutoSaleAt === "number"
      ? shop.lastAutoSaleAt
      : shop.lastAutoSaleAt?.toMillis?.() ?? 0;
    if (cursor >= target) {
      autoSettlementTargetRef.current = null;
      setAutoSettling(false);
    }
  }, [shop.lastAutoSaleAt]);
  useEffect(() => { const timer = window.setInterval(() => setTick(n => n + 1), 30000); return () => window.clearInterval(timer); }, []);

  // tick 讓畫面每 30 秒重繪；來客數依現在時間直接計算，無需額外快取。
  void tick;
  const waiting = calcWaitingVisitors(shop, Date.now());
  const levelInfo = useMemo(() => getLevelProgress(shop.stats?.totalRevenue || 0), [shop.stats?.totalRevenue]);
  const rate = useMemo(() => calcShopRate(shop.furniture, shop.level), [shop.furniture, shop.level]);
  const cap = useMemo(() => calcShopCap(shop.furniture, shop.level), [shop.furniture, shop.level]);
  const slots = useMemo(() => calcShopSlots(shop.furniture), [shop.furniture]);
  const tickets = Math.floor(shop.tickets || 0);
  const manager = useMemo(() => getShopManager(shop.managerId), [shop.managerId]);
  const stockTotal = useMemo(() => stockCount(shop), [shop.stock]);
  const discovered = useMemo(() => new Set(shop.stats?.discoveredCustomers || []), [shop.stats?.discoveredCustomers]);
  const stockList = useMemo(() => SHOP_GOODS.filter(g => (shop.stock?.[g.id] || 0) > 0), [shop.stock]);
  const goodsMap = useMemo(() => Object.fromEntries(SHOP_GOODS.map(g => [g.id, g])), []);
  const baseDisplay = useMemo(() => {
    const base = (shop.display || []).map(d => ({ slot:d.slot || "counter", goodId:d.goodId || null }));
    while (base.length < slots) base.push({ slot:"counter", goodId:null });
    return base.slice(0, slots);
  }, [shop.display, slots]);
  const displayGoods = useMemo(() => baseDisplay.map(d => ({ ...d, good:d.goodId ? getGoodById(d.goodId) : null })), [baseDisplay]);
  const displayCount = baseDisplay.filter(d => d.goodId).length;
  const liveActive = Boolean(live);
  const liveActors = live?.timeline?.actors || [];
  const completedCount = liveActors.filter(actor => liveElapsed >= actor.checkoutEnd).length;
  const completedEvents = live?.result?.events?.slice(0, completedCount) || [];
  const liveTickets = completedEvents.reduce((sum, event) => sum + (Number(event?.tickets) || 0), 0);
  const missionOffered = Boolean(live && completedCount >= live.offerAt && missionStartIndex == null && !missionDismissed && liveStage === "running");
  const missionProgress = missionStartIndex == null || !live
    ? null
    : evaluateLiveShopMission(live.mission, completedEvents, missionStartIndex);
  const queue = useMemo(() => {
    const pool = SHOP_CUSTOMERS.filter(c => c.unlockLevel <= shop.level);
    if (!pool.length) return [];
    return Array.from({ length:Math.min(waiting, 5) }, (_, i) => pool[(i * 5 + tick) % pool.length]);
  }, [waiting, shop.level, tick]);
  const mascotSay = waiting > 0 ? `門口有 ${waiting} 位客人啦，拉鈴就能開店！` : stockTotal === 0 ? "工坊今天還沒開火，先做幾件招牌商品吧。" : displayCount === 0 ? "倉庫有貨喔，把喜歡的商品搬上貨架吧！" : "店面準備好了，客人正在從村子裡走過來。";
  const guide = stockTotal === 0
    ? { step:1, title:"先到工坊加工商品", detail:"消耗貓貓村分層資源，把過剩物資加工成可販售庫存。", action:"去工坊", tab:"craft" }
    : displayCount === 0 ? { step:2, title:"把庫存擺上店內貨架", detail:"點選展示格，再挑一件有庫存的商品。", action:"開始擺貨", tab:"stall" }
    : waiting > 0 ? { step:3, title:"客人到了，現在可以營業", detail:"拉鈴開店後，客人會陸續進門、挑商品、到櫃台結帳；途中還可能收到臨時委託。", action:"看店面", tab:"stall" }
    : { step:"✓", title:"店面已準備完成", detail:"顧客會隨真實時間累積；晚點回來就能再次營業。", action:"看顧客", tab:"dex" };

  function flash(message) { setToast(message); window.setTimeout(() => setToast(null), 2600); }
  function requestOpenShop() {
    if (busy || autoSettling || liveActive || !memberId || waiting === 0) return;
    if (displayCount === 0) { flash("先把商品擺上貨架，客人才有東西可以逛。"); setTab("stall"); return; }
    const hasDisplayedStock = baseDisplay.some(d => d.goodId && (shop.stock?.[d.goodId] || 0) > 0);
    if (!hasDisplayedStock) { flash("貨架上的商品都售完了，先補貨再開店。"); return; }
    sfxTap(); setOpenModePicker(true);
  }
  function openShop(mode) {
    if (mode === "rush_manual" && (Number(shop.rushSeconds) || 0) <= 0) return;
    const session = buildLiveShopSession(shop, { now:Date.now(), goodsMap, mode });
    if (!session.result.waiting) { flash("客人還在路上，晚點再開店看看。"); return; }
    sfxDoorOpen();
    setServeResult(null); setSettlementError(null); setLevelUp(null); setTab("stall");
    setOpenModePicker(false); setLiveMode(mode);
    liveRushRef.current = Math.max(0, Number(shop.rushSeconds) || 0);
    manualElapsedRef.current = 0;
    setLiveRushSeconds(liveRushRef.current);
    liveAddedStockRef.current = {};
    checkoutSoundCountRef.current = 0;
    setLiveTool(null); setLive(session); setLiveElapsed(0); setLiveStage("running");
    setLiveSpeed(1); setMissionStartIndex(null); setMissionDismissed(false);
  }

  function acceptMission() {
    if (!live || missionStartIndex != null) return;
    sfxTap(); setMissionStartIndex(completedCount); flash(`📜 已接下「${live.mission.title}」`);
  }
  function dismissMission() {
    if (!live || missionStartIndex != null) return;
    sfxTap(); setMissionDismissed(true); flash("這次委託先略過，繼續招呼客人。");
  }
  function cycleLiveSpeed() {
    setLiveSpeed(speed => speed === 1 ? 2 : speed === 2 ? 4 : 1);
  }
  async function craft(good, count) {
    if (busy || !memberId) return; setBusy(true); sfxVillageExchange();
    try { const res = await craftShopGood(memberId, good.id, count); if (res?.ok) { const added=Math.max(0,Number(res.added ?? res.count)||0); if(liveActive&&added) liveAddedStockRef.current[good.id]=(liveAddedStockRef.current[good.id]||0)+added; flash(`完成 ${good.name} ×${added}・庫存 ${res.stock}`); sfxSuccess(); onChange?.(); } }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function craftAndStock(good, count) {
    if (busy || !memberId) return; setBusy(true); sfxVillageExchange();
    try {
      const res = await craftAndStockShopGood(memberId, good.id, count);
      if (res?.ok) {
        const added = Math.max(0, Number(res.added ?? res.count) || 0);
        if (liveActive && added) liveAddedStockRef.current[good.id] = (liveAddedStockRef.current[good.id] || 0) + added;
        const slotLabel = res.slot === "counter" ? "檯面" : "櫃子";
        const suffix = res.alreadyDisplayed
          ? "・目前貨架已在販售"
          : res.displayed
            ? `・已補到${slotLabel}`
            : "・展示格已滿，商品先留在倉庫";
        flash(`完成 ${good.name} ×${res.added ?? res.count}${suffix}`);
        sfxSuccess(); onChange?.();
      }
    }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function place(index, goodId) {
    if (!memberId || liveActive) return;
    const next = baseDisplay.map(d => ({ slot:d.slot || "counter", goodId:d.goodId || null })); next[index] = { ...next[index], goodId }; sfxTap();
    try { await arrangeShopDisplay(memberId, next); onChange?.(); } catch (e) { alert(e.message); } finally { setSlotPicker(null); }
  }
  async function buyFurniture(id) {
    if (busy || liveActive || !memberId) return;
    const price = getFurniturePrice(id, shop.furniture?.[id] || 0); if (price <= 0) return;
    if (tickets < price) { alert(`票券不足（需要 ${price.toLocaleString()}）`); return; }
    setBusy(true); sfxShopBuy();
    try { const res = await buyShopFurniture(memberId, id); if (res?.ok) { flash(`${FURNITURE_DEFS[id].icon} ${FURNITURE_DEFS[id].name} 升到 Lv.${res.level}`); sfxSuccess(); onChange?.(); } }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function exchange(reward, count = 1) {
    if (busy || liveActive || !memberId) return; setBusy(true); sfxShopBuy();
    try { const res = await exchangeTicketsForReward(memberId, reward.id, count); if (res?.ok) { flash(`🎁 已兌換 ${reward.label} ×${res.count}`); sfxSuccess(); onChange?.(); } }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function selectManager(managerId) {
    if (busy || liveActive || !memberId) return;
    setBusy(true); sfxTap();
    try { await selectVillageShopManager(memberId, managerId); flash(`已由 ${getShopManager(managerId).name} 擔任店長`); onChange?.(); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  async function endLiveShop() {
    if (!live || busy || liveStage === "settling" || settlingRef.current) return;
    sfxTap(); setLiveTool(null); setLiveStage("settling");
    settlingRef.current = true;
    setBusy(true);
    try {
      const res = await completeLiveShopSession(memberId, {
        seed:live.seed,
        startedAt:live.startedAt,
        expectedLastVisitedAtMs:live.expectedLastVisitedAtMs,
        stateSignature:live.stateSignature,
        missionId:missionStartIndex != null ? live.mission.id : null,
        missionStartIndex,
        manualElapsedSeconds:manualElapsedRef.current,
        manualMode:liveMode,
        allowedStockAdditions:liveAddedStockRef.current,
        initialDisplay:live.initialDisplay,
      });
      if (!res?.ok) throw new Error("營業結算沒有完成，請再試一次。");
      const result = res.result;
      setServeResult(result);
      if (result.newLevel > result.oldLevel) {
        sfxLevelUp();
        window.setTimeout(() => sfxVictoryFanfare(), 350);
        setLevelUp(result);
      } else if (result.served > 0) {
        sfxNotify();
        window.setTimeout(() => sfxCoinDrop(), 180);
      }
      if (result.newCustomers?.length) window.setTimeout(() => sfxGachaReveal(true), 400);
      onChange?.();
      setLive(null);
      setLiveStage("closed");
      liveAddedStockRef.current = {};
      setLiveElapsed(0);
      setLiveRushSeconds(0);
      setMissionStartIndex(null);
      setMissionDismissed(false);
    } catch (error) {
      setSettlementError(error?.message || "營業結算失敗，商品與票券尚未變動。");
      setLiveStage("running");
    } finally {
      settlingRef.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!live || liveStage !== "running" || missionOffered) return undefined;
    const totalDuration = Number(live.timeline?.totalDuration) || 0;
    if (totalDuration <= 0) return undefined;
    const frame = 80;
    const timer = window.setInterval(() => {
      const clock = advanceManualShopClock({ rushSeconds:liveRushRef.current, manualActive:true, manualMode:liveMode, elapsedSeconds:frame / 1000 });
      liveRushRef.current = clock.rushSeconds;
      manualElapsedRef.current += frame / 1000;
      setLiveRushSeconds(clock.rushSeconds);
      setLiveElapsed(current => Math.min(totalDuration, current + clock.timelineSeconds * 1000 * liveSpeed));
    }, frame);
    return () => window.clearInterval(timer);
  }, [live, liveStage, liveSpeed, liveMode, missionOffered]);

  useEffect(() => {
    if (!live || liveStage !== "running" || completedCount < (live.result?.events?.length || 0)) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const accumulated = calcWaitingVisitors(shop, now);
      if (accumulated <= (live.result?.waiting || 0)) return;
      const extended = buildLiveShopSession(shop, { now, seed:live.seed, goodsMap, mode:liveMode });
      if ((extended.result?.events?.length || 0) > (live.result?.events?.length || 0)) setLive(extended);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [completedCount, goodsMap, live, liveStage, shop]);

  useEffect(() => {
    if (!liveActive || completedCount <= checkoutSoundCountRef.current) return;
    const newEvents = (live?.result?.events || []).slice(checkoutSoundCountRef.current, completedCount);
    checkoutSoundCountRef.current = completedCount;
    if (newEvents.some(event => event.outcome === "sale")) sfxShopBuy();
  }, [completedCount, live, liveActive]);

  return <section className="shop3" aria-label="貓貓村商店">
    <style>{CSS}</style>
    {!liveActive && <div className="s3-hud"><div className="s3-brand"><div className="s3-logo">🐾</div><div><div className="s3-title">喵喵雜貨舖</div><div className="s3-sub">商店 Lv.{shop.level}・貓村中央街</div><div className="s3-bar" aria-label={`商店等級進度 ${levelInfo.pct}%`}><i style={{width:`${levelInfo.pct}%`}} /></div></div></div><div className="s3-wallet"><b>🎟️ {tickets.toLocaleString()}</b><small>可用票券</small></div></div>}
    {liveActive
      ? <div className="s3-livefullscreen" role="dialog" aria-modal="true" aria-label="商店營業模式">
          <LiveStoreScene shop={shop} manager={manager} live={live} elapsed={liveElapsed} stage={liveStage} liveMode={liveMode} completedCount={completedCount} liveTickets={liveTickets} speed={liveSpeed} rushSeconds={liveRushSeconds} displayGoods={displayGoods} missionOffered={missionOffered} missionProgress={missionProgress} onAcceptMission={acceptMission} onDismissMission={dismissMission} onSpeed={cycleLiveSpeed} />
          <nav className="s3-livetools" aria-label="營業中操作">
            <button type="button" className={liveTool === "craft" ? "active" : ""} onClick={() => setLiveTool(liveTool === "craft" ? null : "craft")}>🔨<span>製造商品</span></button>
            <button type="button" className={liveTool === "refill" ? "active" : ""} onClick={() => setLiveTool(liveTool === "refill" ? null : "refill")}>📦<span>補充貨架</span></button>
            <button type="button" className="danger" disabled={busy} onClick={endLiveShop}>🚪<span>{liveStage === "settling" ? "結算中…" : "結束營業"}</span></button>
          </nav>
          {liveTool && <div className="s3-livetooldrawer" role="region" aria-label={liveTool === "craft" ? "營業中製造商品" : "營業中補充貨架"}>
            <button type="button" className="s3-livedrawerclose" onClick={() => setLiveTool(null)} aria-label="關閉營業工具">×</button>
            {liveTool === "craft" ? <Workshop resources={resources} coins={coins} shop={shop} busy={busy} onCraft={craft} onCraftAndStock={craftAndStock} /> : <LiveRefill shop={shop} resources={resources} busy={busy} displayGoods={displayGoods} onRefill={craftAndStock} />}
          </div>}
        </div>
      : <CrossSectionStore shop={shop} manager={manager} displayGoods={displayGoods} />}
    {toast && <div className="s3-toast" role="status" aria-live="polite">{toast}</div>}
    {!liveActive && <nav className="s3-actiondock" aria-label="商店營運操作">
      <button type="button" onClick={requestOpenShop} disabled={busy || autoSettling || waiting === 0}><span>🔔</span><b>{autoSettling?"結算離線收益…":"開店"}</b><small>{waiting} 位等候</small></button>
      <button type="button" className={tab === "craft" ? "active" : ""} onClick={() => { sfxTap(); setTab(tab === "craft" ? null : "craft"); }}><span>📦</span><b>補貨</b><small>加工庫存</small></button>
      <button type="button" className={tab === "stall" ? "active" : ""} onClick={() => { sfxTap(); setTab(tab === "stall" ? null : "stall"); }}><span>🪵</span><b>陳列</b><small>配置貨架</small></button>
      <button type="button" className={tab === "exchange" ? "active" : ""} onClick={() => { sfxTap(); setTab(tab === "exchange" ? null : "exchange"); }}><span>🎁</span><b>兌換</b><small>冒險補給</small></button>
      <button type="button" className={tab === "growth" ? "active" : ""} onClick={() => { sfxTap(); setTab(tab === "growth" ? null : "growth"); }}><span>🛠️</span><b>裝修</b><small>升級店鋪</small></button>
      <button type="button" className={tab === "dex" ? "active" : ""} onClick={() => { sfxTap(); setTab(tab === "dex" ? null : "dex"); }}><span>🐾</span><b>顧客</b><small>居民手冊</small></button>
    </nav>}
    {!liveActive && tab && <div className="s3-operationsdrawer" role="region" aria-label={`${({ craft:"補貨", stall:"陳列", exchange:"獎品兌換", growth:"店鋪裝修", dex:"顧客手冊" })[tab]}抽屜`}>
      <button type="button" className="s3-drawerclose" onClick={() => setTab(null)} aria-label="關閉營運抽屜">×</button>
      {tab === "stall" && <Stall shop={shop} resources={resources} busy={busy} rate={rate} cap={cap} waiting={waiting} slots={slots} displayGoods={displayGoods} stockList={stockList} onPick={setSlotPicker} onCraft={() => setTab("craft")} onRefill={craftAndStock} />}
      {tab === "craft" && <Workshop resources={resources} coins={coins} shop={shop} busy={busy} onCraft={craft} onCraftAndStock={craftAndStock} />}
      {tab === "exchange" && <PrizeCounterV2 shop={shop} tickets={tickets} busy={busy} onExchange={exchange} />}
      {tab === "growth" && <><ManagerPicker selectedId={manager.id} busy={busy} onSelect={selectManager} /><Renovation shop={shop} tickets={tickets} levelInfo={levelInfo} busy={busy} onBuy={buyFurniture} /></>}
      {tab === "dex" && <CustomerBook shop={shop} discovered={discovered} />}
    </div>}
    {!liveActive && slotPicker && <ShelfPicker picker={slotPicker} stockList={stockList} shop={shop} onClose={() => setSlotPicker(null)} onPick={place} />}
    {!liveActive && openModePicker && <OpenModePicker waiting={waiting} rushSeconds={shop.rushSeconds} onChoose={openShop} onClose={() => setOpenModePicker(false)} />}
    {serveResult && <Receipt result={serveResult} onClose={() => setServeResult(null)} />}
    {settlementError && <SettlementError message={settlementError} onClose={() => setSettlementError(null)} />}
    {!serveResult && levelUp && <LevelUp result={levelUp} onClose={() => setLevelUp(null)} />}
  </section>;
}

function OpenModePicker({ waiting, rushSeconds, onChoose, onClose }) {
  const rush = Math.max(0, Math.floor(Number(rushSeconds) || 0));
  const rushMinutes = Math.floor(rush / 60);
  const rushRemainder = rush % 60;
  return <div className="s3-modalbg" style={{zIndex:250}} onClick={onClose}>
    <div className="s3-modepicker" role="dialog" aria-modal="true" aria-label="選擇營業模式" onClick={event => event.stopPropagation()}>
      <h3>選擇這次的營業節奏</h3>
      <p>門口累積的 {waiting} 位顧客會接續進店，不會因開店重新計算。一般營業保留旺季時間；旺季會形成無空窗客潮，大量販售商品。</p>
      <div className="s3-modechoices">
        <button type="button" className="s3-modechoice" onClick={() => onChoose("manual")}>
          <strong>🌿 一般時間</strong><span>來客效率 50%</span><small>不消耗旺季時間。適合慢慢補貨、整理貨架與接委託。</small>
        </button>
        <button type="button" className="s3-modechoice rush" disabled={rush <= 0} onClick={() => onChoose("rush_manual")}>
          <strong>🔥 旺季時間</strong><span>大量販售 500%</span><small>{rush > 0 ? `可用 ${rushMinutes} 分 ${rushRemainder} 秒；顧客連續入店不必等待，使用完會轉為一般速度。` : "目前沒有旺季時間。每 10 支有效箭可在下課時累積 1 分鐘。"}</small>
        </button>
      </div>
      <button type="button" className="s3-modecancel" onClick={onClose}>先不開店</button>
    </div>
  </div>;
}

function CrossSectionStore({ shop, manager, displayGoods }) {
  const preview = displayGoods.filter(entry => entry.good).slice(0, 6);
  const left = preview.slice(0, 3), right = preview.slice(3, 6);
  const shelf = (entries, side) => <div className={`s3-preview-shelf ${side}`}>{entries.map(entry => <span className="s3-preview-stock" key={entry.goodId}><GoodVisual good={entry.good} className="s3-preview-product" /><b>×{Math.max(0, Number(shop.stock?.[entry.goodId]) || 0)}</b></span>)}</div>;
  return <div className="s3-crosssection" aria-label="貓貓村商店場景">
    <img className="s3-crosssection-bg" src={shopInteriorArt(shop)} alt="" aria-hidden="true" />
    {shelf(left, "left")}{shelf(right, "right")}
    <div className="s3-preview-counter"><ArtIcon src={manager.art} fallback="🐱" alt={`${manager.name}店長`} className="s3-preview-manager" /></div>
  </div>;
}

function StoreScene({ shop, waiting, cap, rate, busy, queue, mascotSay, displayGoods, onServe }) {
  const preview = displayGoods.filter(d => d.good).slice(0,3);
  return <div className="s3-scene"><div className="s3-badges"><div className="s3-badge"><b>🚪 {waiting}/{cap}</b><small>門口顧客</small></div><div className="s3-badge"><b>🐾 {rate.toFixed(1)}/分</b><small>來客速度</small></div><div className="s3-badge"><b>📦 {stockCount(shop)}</b><small>店內庫存</small></div></div><span className="s3-scenedecor s3-plant" aria-hidden="true">🪴</span><span className="s3-scenedecor s3-boxes" aria-hidden="true">🧺</span><span className="s3-scenedecor s3-banner" aria-hidden="true">🏮</span><div className="s3-building"><div className="s3-roof" aria-hidden="true"/><div className="s3-sign">🐾 喵喵雜貨舖</div><div className="s3-window" aria-hidden="true"><div className="s3-preview">{preview.length ? preview.map((d,i) => <span key={`${d.goodId}-${i}`} style={{animationDelay:`${i*.35}s`}}><GoodVisual good={d.good} className="s3-previewgood" /></span>) : <span style={{fontSize:12,fontWeight:900,color:"#765d47",padding:8}}>櫥窗還空空的</span>}</div></div><div className="s3-door" aria-hidden="true"/><div className="s3-crate" aria-hidden="true">📦</div><ArtIcon src={SHOP_CAT_ART[3]} fallback="🐱" className="s3-worker s3-worker-a"/><ArtIcon src={SHOP_CAT_ART[8]} fallback="🐱" className="s3-worker s3-worker-b"/><div className="s3-talk">{mascotSay}</div><ArtIcon src={MASCOT} fallback="🐱" alt="店長妹妹" className="s3-catboss"/></div><div className="s3-queue" aria-label={`目前有 ${waiting} 位顧客等待`}>{queue.length ? queue.map((c,i) => <span key={`${c.id}-${i}`} className="s3-qcat" style={{animationDelay:`${i*.22}s`}} title={c.name}><ArtIcon src={customerArt(c)} fallback={c.emoji} alt={c.name} className="s3-qcatart"/><span className="s3-qname">{c.name}</span></span>) : <span className="s3-qempty">街道安靜中…客人正在路上</span>}{waiting>5 && <span className="s3-qempty">+{waiting-5}</span>}</div><button className="s3-open" disabled={busy||waiting===0} onClick={onServe}><span className="bell">🔔</span><b>{busy?"正在結帳…":waiting>0?"拉鈴營業":"準備中"}</b><small>{waiting>0?`接待目前 ${waiting} 位`:"顧客會隨時間累積"}</small></button></div>;
}

function LiveStoreScene({ shop, manager, live, elapsed, stage, liveMode, completedCount, liveTickets, speed, rushSeconds, displayGoods, missionOffered, missionProgress, onAcceptMission, onDismissMission, onSpeed }) {
  const total = live?.result?.events?.length || 0;
  const operations = live?.timeline?.operations || {};
  const actorViews = (live?.timeline?.actors || [])
    .map(actor => ({ actor, stage:getLiveActorStage(actor, elapsed) }))
    .filter(view => view.stage);
  const queueViews = actorViews.filter(view => view.stage === "queue");
  const checkoutView = actorViews.find(view => view.stage === "checkout");
  const focus = checkoutView || queueViews[0] || actorViews.find(view => view.stage === "browse") || actorViews[0] || null;
  const event = focus?.actor?.event || null;
  const customer = event
    ? SHOP_CUSTOMERS.find(c => c.id === event.customerId) || { id:event.customerId, name:event.customerName, emoji:event.customerEmoji, line:event.customerLine }
    : null;
  const soldByGood = {};
  const claimedIndexes = new Set(Array.from({ length:completedCount }, (_, index) => index));
  actorViews.filter(view => ["queue", "checkout", "exit"].includes(view.stage)).forEach(view => claimedIndexes.add(view.actor.eventIndex));
  Array.from(claimedIndexes).map(index => live?.result?.events?.[index]).filter(Boolean).forEach(ev => (ev.items || []).forEach(item => {
    soldByGood[item.goodId] = (soldByGood[item.goodId] || 0) + (Number(item.qty) || 1);
  }));
  const visible = displayGoods.filter(d => d.good).slice(0, 6);
  const leftShelf = visible.slice(0, 3), rightShelf = visible.slice(3, 6);
  const saleText = event?.outcome === "sale"
    ? (event.items || []).map(item => `${item.goodName}${(item.qty || 1) > 1 ? ` ×${item.qty}` : ""}`).join("、")
    : "";
  const focusStage = focus?.stage || (stage === "settling" ? "settling" : "idle");
  const stageLabel = focusStage === "enter" ? "新客推門進店"
    : focusStage === "browse" ? `${focus.actor.profile.icon} ${focus.actor.profile.label}正在挑選`
      : focusStage === "queue" ? "準備排隊結帳"
        : focusStage === "checkout" ? (event?.outcome === "sale" ? "櫃台成交中" : "沒有找到想買的")
          : focusStage === "exit" ? "顧客準備離店" : focusStage === "settling" ? "今日這輪營業收尾" : "等待下一位顧客上門";
  const managerLine = missionProgress?.completed ? `「做得好，${missionProgress.title}完成了！」`
    : focusStage === "enter" ? "「歡迎光臨，慢慢挑選喵！」"
      : focusStage === "browse" ? "「貨架上的都是村裡做的好東西。」"
        : focusStage === "queue" ? "「請依序排隊，很快就輪到你。」"
          : focusStage === "checkout" && event?.outcome === "sale" ? "「謝謝惠顧，歡迎再來！」"
            : focusStage === "checkout" ? "「缺貨了，我等等立刻補上。」"
              : liveMode === "rush_manual" && rushSeconds > 0
                ? "「旺季客潮不停，下一批馬上進店喵！」"
                : "「這批客人接待完了，下一位正在路上喵。」";
  const shelf = (entries, side) => <div className={`s3-liveshelf s3-liveshelf-${side}`}>
    <div className="s3-liveshelfsign">{side === "left" ? "武器・裝備選物" : "料理・人氣商品"}</div>
    {entries.length ? entries.map((entry, index) => {
      const sold = soldByGood[entry.goodId] || 0;
      const left = Math.max(0, (shop.stock?.[entry.goodId] || 0) - sold);
      return <div className="s3-livegood" key={`${side}-${entry.goodId}-${index}`}><GoodVisual good={entry.good} className="s3-livegoodart"/><span>{entry.good.name}</span><b>×{left}</b></div>;
    }) : <div className="s3-liveemptyshelf">這側貨架目前空著</div>}
  </div>;
  const actorStyle = (view, queueIndex) => {
    if (view.stage === "enter") return { left:"8%", bottom:"8%" };
    if (view.stage === "browse") return { left:view.actor.browseSide === "left" ? "28%" : "72%", bottom:"8%" };
    if (view.stage === "queue") return { left:`${62 + Math.min(queueIndex, 3) * 10}%`, bottom:"8%" };
    if (view.stage === "checkout") return { left:"50%", bottom:"8%" };
    return { left:"91%", bottom:"8%" };
  };

  return <div className="s3-livewrap">
    <div className="s3-livescene v7 v8" aria-label={`商店營業中，目前店內 ${actorViews.length} 位顧客`}>
      <img className="s3-livebg" src={shopInteriorArt(shop)} alt="" aria-hidden="true" />
      <div className="s3-liveveil" aria-hidden="true" />
      <div className="s3-livehud">
        <span className="s3-openbadge"><i />營業中</span>
        <span><b>{liveMode === "rush_manual" && rushSeconds > 0 ? "旺季大量販售 500%" : "一般 50%"}</b><small>{liveMode === "rush_manual" ? (rushSeconds > 0 ? `連續客潮・剩餘 ${Math.ceil(rushSeconds)} 秒` : "旺季用完，轉為一般") : "不消耗旺季時間"}</small></span>
        <span className="s3-hudevent"><b>{customer ? `${customer.name || event?.customerName}・${stageLabel}` : stageLabel}</b><small>{focusStage === "checkout" && event?.outcome === "sale" ? `${saleText || "成交"}・+${Number(event.tickets || 0).toLocaleString()} 🎟` : `${manager.name}：${managerLine}`}</small></span>
        <span><b>+{liveTickets.toLocaleString()} 🎟</b><small>結束營業後入帳</small></span>
        <button type="button" onClick={onSpeed} aria-label={`目前營業速度 ${speed} 倍，點擊切換`}>×{speed}</button>
        {missionProgress && <div className={`s3-hudmission ${missionProgress.completed ? "done" : ""}`}><b>{missionProgress.icon} {missionProgress.title}</b><span>{missionProgress.completed ? "任務完成 ✓" : `${Math.min(missionProgress.progress, missionProgress.target)} / ${missionProgress.target}`}</span></div>}
      </div>
      <span className="s3-livebeam beam-a" aria-hidden="true"/><span className="s3-livebeam beam-b" aria-hidden="true"/>
      <div className="s3-operations" aria-label="本店即時營運能力">
        <span><b>{operations.maxConcurrent || 2} 位</b><small>同場容量</small></span>
        <span><b>{operations.checkoutSpeedLabel || "標準"}</b><small>收銀速度</small></span>
        <span><b>{operations.attractionLabel || "街坊店"}</b><small>招客節奏</small></span>
        <span><b>{operations.comfortLabel || "樸實"}</b><small>排隊舒適</small></span>
      </div>
      <div className="s3-liveentry" aria-hidden="true"><span>OPEN</span><b>入口</b></div>
      <div className="s3-liverug" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <div className="s3-queueguide" aria-hidden="true"><span>收銀排隊</span><i/><i/><i/></div>
      {shelf(leftShelf, "left")}{shelf(rightShelf, "right")}
      <div className="s3-livecounter"><span className="s3-countertop">收銀櫃台・Lv.{shop.furniture?.counter || 1}</span><ArtIcon src={manager.art} fallback="🐱" alt={`${manager.name}店長，負責收銀`} className="s3-liveboss"/><span className="s3-bossname">{manager.name}店長・收銀</span><span className="s3-register" aria-hidden="true">🧾</span></div>
      {(shop.furniture?.flower||0)>0&&<div className="s3-decorflower" aria-hidden="true"><i/><i/><i/></div>}
      {(shop.furniture?.sign||0)>0&&<div className="s3-decorsign" aria-hidden="true">本日營業</div>}
      {(shop.furniture?.luckyCat||0)>0&&<div className="s3-decorlucky"><ArtIcon src={MASCOT} fallback="🐱" alt="" className="s3-decorluckyart"/><span>招財</span></div>}
      {(shop.furniture?.starLamp||0)>0&&<div className="s3-decorstars" aria-hidden="true"><i/><i/><i/><i/></div>}
      {actorViews.map(view => {
        const actorCustomer = SHOP_CUSTOMERS.find(c => c.id === view.actor.customerId) || { id:view.actor.customerId, name:view.actor.event?.customerName, emoji:view.actor.event?.customerEmoji };
        const queueIndex = queueViews.findIndex(item => item.actor.eventIndex === view.actor.eventIndex);
        const carriedItems = ["queue", "checkout", "exit"].includes(view.stage) && view.actor.event?.outcome === "sale" ? (view.actor.event.items || []).slice(0, 2) : [];
        return <div key={`live-${view.actor.eventIndex}`} className={`s3-livecustomer v7 stage-${view.stage} lane-${view.actor.browseSide}`} style={actorStyle(view, Math.max(0, queueIndex))}>
          <CustomerPortrait customer={actorCustomer} className="s3-livecustomerportrait" />
          {carriedItems.length > 0 && <span className="s3-customerbasket" aria-label={`已挑選 ${carriedItems.map(item => item.goodName).join("、")}`}>{carriedItems.map(item => <GoodVisual key={item.goodId} good={getGoodById(item.goodId)} className="s3-carriedgood" />)}</span>}
          <span className="s3-livecustomername">{actorCustomer.name || view.actor.event?.customerName}</span>
          <span className="s3-livetrait">{view.actor.profile.icon} {view.actor.profile.label}</span>
        </div>;
      })}
      {missionOffered && <div className="s3-missionveil"><div className="s3-missionoffer" role="dialog" aria-modal="true" aria-label="臨時委託">
        <span className="s3-missionseal">{live.mission.icon}</span><small>⚡ 營業中的臨時需求</small><h3>{live.mission.title}</h3><p>{live.mission.description}</p><strong>完成獎勵・+{live.mission.rewardTickets} 🎟</strong><div><button className="accept" onClick={onAcceptMission}>接下委託</button><button className="skip" onClick={onDismissMission}>這次略過</button></div>
      </div></div>}
    </div>
    <div className="s3-liveledger">
      <div><small>本輪客流</small><b>{total} 位</b></div><div><small>店內活動</small><b>{actorViews.length} 位</b></div><div><small>已完成接待</small><b>{completedCount}/{total}</b></div><div><small>目前營業額</small><b>+{liveTickets.toLocaleString()} 🎟</b></div>
    </div>
    <div className="s3-livehint">{liveMode === "rush_manual" && rushSeconds > 0
      ? "旺季會連續接待已累積的客潮、不等待下一位；顧客或庫存用完後仍可在店內製造與補貨。"
      : "先接待開店前累積的顧客；佇列用完後會等待下一位上門，直到你結束營業。"}</div>
  </div>;
}

function LiveRefill({ shop, resources, busy, displayGoods, onRefill }) {
  const shown = displayGoods.filter(entry => entry.good);
  return <div className="s3-live-refill">
    <h3>營業中補充貨架</h3>
    <p>商品會留在原本的貨架位置，製造完成後直接增加可販售庫存。</p>
    {shown.length ? shown.map(entry => {
      const plan = getShopQuickRefillPlan(resources, shop, entry.goodId);
      const stock = Math.max(0, Math.floor(Number(shop.stock?.[entry.goodId]) || 0));
      return <div className="s3-live-refill-row" key={entry.goodId}>
        <GoodVisual good={entry.good} />
        <span><b>{entry.good.name}</b><small>目前庫存 {stock}・{plan?.canRefill ? `可製造 ${plan.refillCount}` : "材料不足"}</small></span>
        <button type="button" disabled={busy || !plan?.canRefill} onClick={() => onRefill(entry.good, plan.refillCount)}>{busy ? "製造中…" : "立即補貨"}</button>
      </div>;
    }) : <p>目前沒有陳列商品，請結束營業後先配置貨架。</p>}
  </div>;
}

function ManagerPicker({ selectedId, busy, onSelect }) {
  return <div className="s3-panel s3-manager-picker"><div className="s3-head"><div><h3>選擇商店店長</h3><p>店長只影響店內演出，不會改變販售數值。</p></div></div><div className="s3-manager-grid">{SHOP_MANAGER_OPTIONS.map(manager => <button type="button" key={manager.id} className={selectedId === manager.id ? "active" : ""} disabled={busy} onClick={() => onSelect(manager.id)}><img src={manager.art} alt=""/><span>{manager.name}</span>{selectedId === manager.id && <b>目前店長</b>}</button>)}</div></div>;
}

function Stall({ shop, resources, busy, rate, cap, waiting, slots, displayGoods, stockList, onPick, onCraft, onRefill }) {
  const bins = GOODS_CATEGORIES.map(cat => { const goods=stockList.filter(g=>g.category===cat.id); return {...cat,kinds:goods.length,units:goods.reduce((n,g)=>n+(shop.stock?.[g.id]||0),0)}; });
  const refillPlans = useMemo(() => displayGoods.map(d => d.goodId ? getShopQuickRefillPlan(resources, shop, d.goodId) : null), [displayGoods, resources, shop]);
  const refillNeeded = refillPlans.filter(plan => plan?.needsRefill).length;
  return <div className="s3-panel"><div className="s3-head"><div><h3>店內陳列</h3><p>這裡是客人真正會購買的展示區。點貨架格位即可換商品。</p></div><span className="s3-tag">{displayGoods.filter(d=>d.goodId).length}/{slots} 格營業中</span></div><div className="s3-stats"><div className="s3-stat"><b>{rate.toFixed(1)}</b><small>客/分鐘</small></div><div className="s3-stat"><b>{waiting}/{cap}</b><small>排隊/上限</small></div><div className="s3-stat"><b>{displayGoods.filter(d=>d.goodId).length}</b><small>展示品項</small></div><div className="s3-stat"><b>{stockCount(shop)}</b><small>總庫存</small></div></div>{refillNeeded>0&&<div className="s3-refillnotice">📦 有 {refillNeeded} 個展示商品庫存偏低。可直接在貨架下方加工補到安全存量，不會更換目前陳列。</div>}<div className="s3-shelf"><div className="s3-shelfscroll" aria-label="商品貨架">{displayGoods.map((d,i)=>{const g=d.good,theme=g?TIER[g.tier]:null,plan=refillPlans[i],stock=g?Math.max(0,Math.floor(Number(shop.stock?.[g.id])||0)):0;return <div key={`${d.slot}-${i}`} className="s3-slotwrap"><button className={`s3-slot ${g?"":"empty"} ${g&&stock===0?"outstock":g&&plan?.needsRefill?"lowstock":""}`} aria-label={g?`第 ${i+1} 格，${g.name}，庫存 ${stock}`:`第 ${i+1} 格空貨架，點擊擺貨`} onClick={()=>{sfxTap();onPick({index:i,slot:d.slot});}}>{g?<><span className="kind">{d.slot==="counter"?"🧺 檯":"🗄️ 櫃"}</span><GoodVisual good={g} className="s3-slotgood" /><span className="name">{g.name}</span><span className="meta"><span style={{color:theme[0]}}>{TIER_LABELS[g.tier]}</span><span style={{color:stock===0?"#a34f43":plan?.needsRefill?"#a96a2d":"#51764d"}}>{stock===0?"售完":`×${stock}`}</span></span><span className="floor"/></>:<span><span className="s3-emptyplus">＋</span><span className="s3-emptycopy">空展示格</span></span>}</button>{g&&plan?.needsRefill&&<button type="button" className="s3-refill" disabled={busy||!plan.canRefill} onClick={()=>plan.canRefill&&onRefill(g,plan.refillCount)}>{busy?"補貨中…":plan.canRefill?`${stock===0?"立即補貨":"快速補貨"} +${plan.refillCount}`:"材料不足・暫時無法補貨"}</button>}</div>;})}</div></div><div className="s3-head" style={{marginTop:13,marginBottom:6}}><div><h3 style={{fontSize:14}}>後方倉庫</h3><p>不再塞滿庫存卡，用貨箱直接看三大類存量。</p></div><button className="s3-link" onClick={()=>{sfxTap();onCraft();}}>前往工坊</button></div><div className="s3-bins">{bins.map(cat=><div className="s3-bin" key={cat.id}><b>{cat.icon} {cat.label}</b><span>{cat.kinds} 種・{cat.units} 件</span></div>)}</div></div>;
}

function Workshop({ resources, coins, shop, busy, onCraft, onCraftAndStock }) {
  const [cat,setCat]=useState("all"),[tier,setTier]=useState(0),[qty,setQty]=useState(1),[selectedId,setSelectedId]=useState(null),[focusResourceKey,setFocusResourceKey]=useState(null);
  const list=useMemo(()=>SHOP_GOODS.filter(g=>(cat==="all"||g.category===cat)&&(tier===0||g.tier===tier)),[cat,tier]);
  const selected=list.find(g=>g.id===selectedId)||list.find(g=>g.unlockLevel<=shop.level)||list[0]||null;
  const cs=selected?craftState(selected,resources,coins,shop):null;
  const count=cs?(qty==="max"?cs.maxCraft:Math.min(Number(qty),cs.maxCraft)):0;
  const overflowEntries=useMemo(()=>getShopTierOverflowEntries(resources,shop),[resources,shop]);
  const visibleOverflow=overflowEntries.filter(entry=>entry.amount>0).slice(0,9);
  const focusedOverflow=focusResourceKey?overflowEntries.find(entry=>entry.key===focusResourceKey)||null:null;
  const sinkRecommendations=useMemo(()=>getShopSinkRecommendations(resources,shop,4,focusResourceKey),[resources,shop,focusResourceKey]);
  const chooseSinkJob=(entry)=>{const g=entry.good;sfxTap();setCat(g.category);setTier(g.tier);setSelectedId(g.id);setQty("max");};
  const focusEmptyCopy=focusedOverflow&&!sinkRecommendations.length
    ? focusedOverflow.consumerCount===0?`${focusedOverflow.icon} ${focusedOverflow.name} T${focusedOverflow.tier} 目前沒有商店配方；保留為其他村莊用途。`
      : !focusedOverflow.unlocked?`對應食譜最早在商店 Lv.${focusedOverflow.minUnlockLevel} 解鎖。`
        : `這一階目前缺少搭配材料，或對應商品庫存已滿。`
    : null;
  return <div className="s3-panel"><div className="s3-head"><div><h3>村莊加工工坊</h3><p>把礦山、農地、海港、獵場、市集、倉庫、採集與練箭場累積的村莊物資做成商品。這是材料去化玩法，不收金幣加工費。</p></div><span className="s3-tag">📦 村莊物資加工</span></div><div className="s3-sinkboard"><div className="s3-sinktitle"><b>📡 材料爆倉雷達</b><span>現在直接看「哪一種、哪一階」堆最多，不再把 T1～T5 混成總數。</span></div><div className="s3-overflowhead"><b>{focusedOverflow?`正在找：${focusedOverflow.icon} ${focusedOverflow.name} T${focusedOverflow.tier}`:"最高存量 exact-tier"}</b><button type="button" className={`s3-overflowreset ${!focusResourceKey?"active":""}`} onClick={()=>{sfxTap();setFocusResourceKey(null);}}>全部推薦</button></div>{visibleOverflow.length>0?<div className="s3-overflowgrid">{visibleOverflow.map(r=><button type="button" className={`s3-overflowres ${focusResourceKey===r.key?"active":""}`} key={r.key} disabled={!r.unlocked} onClick={()=>{sfxTap();setFocusResourceKey(r.key);}}><b>{r.icon} {r.name} T{r.tier}</b><small>{r.amount.toLocaleString()}・{r.consumerCount===0?"此階無商店配方":!r.unlocked?`Lv.${r.minUnlockLevel} 解鎖`:r.actionable?"點我找去化方案":"缺搭配材料"}</small></button>)}</div>:<div className="s3-sinkempty">目前沒有可加工的分層村莊物資。</div>}{focusEmptyCopy&&<div className="s3-focusnote">{focusEmptyCopy}</div>}{sinkRecommendations.length>0&&<div className="s3-sinkjobs">{sinkRecommendations.map(entry=><div className="s3-sinkjob" key={entry.good.id}><b>{entry.good.icon} {entry.good.name}</b><span>{focusedOverflow?`MAX ×${entry.maxCraft}・可消耗 ${entry.focusUnits.toLocaleString()} ${focusedOverflow.name} T${focusedOverflow.tier}`:`推薦 MAX ×${entry.maxCraft}・可去化約 ${entry.sinkUnits.toLocaleString()} 份材料`}</span><div className="s3-sinkjobactions"><button type="button" className="s3-sinklook" onClick={()=>chooseSinkJob(entry)}>查看配方</button><button type="button" className="s3-sinkquick" disabled={busy||entry.maxCraft<=0} onClick={()=>onCraftAndStock(entry.good,entry.maxCraft)}>MAX 加工＋上架</button></div></div>)}</div>}<div className="s3-sinknote">九種去化資源：礦物、瓜瓜、鮮魚、動物肉、小魚乾、貓罐頭、貓薄荷藥水、貓毛、貓貓射手。雷達會把每個 T 級分開顯示；箭露與扭蛋幣仍不會被大量消耗。</div></div><div className="s3-filter"><button className={`s3-chip ${cat==="all"?"active":""}`} onClick={()=>setCat("all")}>全部</button>{GOODS_CATEGORIES.map(c=><button key={c.id} className={`s3-chip ${cat===c.id?"active":""}`} onClick={()=>setCat(c.id)}>{c.icon} {c.label}</button>)}</div><div className="s3-filter" style={{marginTop:3}}>{[0,1,2,3,4,5].map(v=><button key={v} className={`s3-chip ${tier===v?"active":""}`} style={tier===v&&v?{background:TIER[v][0],borderColor:TIER[v][0]}:undefined} onClick={()=>setTier(v)}>{v===0?"全部 T 級":`${TIER_LABELS[v]} ${TIER_NAMES[v]}`}</button>)}</div><div className="s3-bench"><div className="s3-workshop"><div>{selected?<div className="s3-blueprint"><div className="s3-goodhero"><GoodVisual good={selected} locked={selected.unlockLevel>shop.level} className="s3-goodheroart" /><div style={{minWidth:0}}><span className="s3-tier" style={{background:TIER[selected.tier][1],color:TIER[selected.tier][0]}}>{TIER_LABELS[selected.tier]} {TIER_NAMES[selected.tier]}</span><h4>{selected.unlockLevel<=shop.level?selected.name:"尚未解鎖的食譜"}</h4><p>{selected.unlockLevel<=shop.level?selected.desc:`商店升到 Lv.${selected.unlockLevel} 後才能開始製作。`}</p></div></div><div className="s3-meta"><span>🎟️ 售價 {selected.price}</span><span>🧺 耗材 {selected.recipe.reduce((n,r)=>n+r.count,0)}/件</span><span>📦 庫存 {shop.stock?.[selected.id]||0}/{SHOP_GOOD_STOCK_CAP}</span></div><div className="s3-recipe">{selected.recipe.map(r=>{const key=`${r.resource}_t${r.tier}`,need=r.count*Math.max(1,count||1),have=Math.floor(resources?.[key]||0),ok=have>=need;return <div key={key} className={`s3-cost ${ok?"":"bad"}`}><span>{RES_ICON[r.resource]} {RES_NAME[r.resource]} T{r.tier}</span><span>{need} / {have}</span></div>;})}</div></div>:<div className="s3-blueprint">沒有符合條件的食譜。</div>}<div className="s3-qty">{[[1,"×1"],[10,"×10"],[50,"×50"],["max","MAX"]].map(([v,l])=><button key={v} className={qty===v?"active":""} onClick={()=>setQty(v)}>{l}</button>)}</div><div className="s3-craftactions"><button className="s3-primary secondary" disabled={!selected||selected.unlockLevel>shop.level||count<=0||busy} onClick={()=>selected&&onCraft(selected,Math.max(1,count))}>{busy?"加工中…":!selected?"沒有食譜":selected.unlockLevel>shop.level?`Lv.${selected.unlockLevel} 解鎖`:count>0?`只加工 ×${count}`:cs?.stockFull?`庫存已達 ${SHOP_GOOD_STOCK_CAP}`:"材料不足"}</button><button className="s3-primary" disabled={!selected||selected.unlockLevel>shop.level||count<=0||busy} onClick={()=>selected&&onCraftAndStock(selected,Math.max(1,count))}>{busy?"加工中…":!selected?"沒有食譜":selected.unlockLevel>shop.level?`Lv.${selected.unlockLevel} 解鎖`:count>0?`加工＋上架 ×${count}`:cs?.stockFull?`庫存已達 ${SHOP_GOOD_STOCK_CAP}`:"材料不足"}</button></div></div><div className="s3-drawer">{list.map(g=>{const locked=g.unlockLevel>shop.level;return <button key={g.id} className={`s3-reciperow ${selected?.id===g.id?"selected":""} ${locked?"locked":""}`} onClick={()=>{sfxTap();setSelectedId(g.id);}}><GoodVisual good={g} locked={locked} className="s3-listgood" /><span className="copy"><b>{locked?`Lv.${g.unlockLevel} 食譜`:g.name}</b><span>{TIER_LABELS[g.tier]}・售 {g.price} 🎟️・耗材 {g.recipe.reduce((n,r)=>n+r.count,0)}</span></span><span className="stock">{locked?"未解鎖":`×${shop.stock?.[g.id]||0}`}</span></button>;})}</div></div></div></div>;
}

function PrizeCounterV2({ shop, tickets, busy, onExchange }) {
  const [materialTier,setMaterialTier]=useState(1);
  const mats=SHOP_EXCHANGE_REWARDS.filter(reward=>reward.type==="family_mat"&&reward.tierIndex===materialTier);
  const daily=SHOP_EXCHANGE_REWARDS.filter(reward=>reward.type!=="family_mat"&&reward.period!=="weekly");
  const weekly=SHOP_EXCHANGE_REWARDS.filter(reward=>reward.period==="weekly");
  return <div className="s3-panel"><div className="s3-head"><div><h3>獎品兌換櫃</h3><p>族系材料箱不限次數兌換；特殊票券仍遵守各自每日與持有上限。</p></div><span className="s3-tag">🎟️ {tickets.toLocaleString()}</span></div><div className="s3-case"><div className="s3-filter s3-tierfilter">{[1,2,3,4,5].map(t=>{const reward=SHOP_EXCHANGE_REWARDS.find(r=>r.type==="family_mat"&&r.tierIndex===t),locked=(shop.level||1)<(reward?.unlockLevel||1);return <button key={t} className={`s3-chip ${materialTier===t?"active":""}`} onClick={()=>setMaterialTier(t)}>T{t}{locked?`・Lv.${reward?.unlockLevel}`:""}</button>;})}</div><div className="s3-sharedlimit">T{materialTier} 材料箱：<b>不限兌換次數</b></div><PrizeGroupV2 title={`🧰 T${materialTier} 族系材料補給`} rewards={mats} shop={shop} tickets={tickets} busy={busy} onExchange={onExchange}/>{daily.length>0&&<PrizeGroupV2 title="🧪 每日補給" rewards={daily} shop={shop} tickets={tickets} busy={busy} onExchange={onExchange}/>} {weekly.length>0&&<PrizeGroupV2 title="🌟 每週珍藏" rewards={weekly} shop={shop} tickets={tickets} busy={busy} onExchange={onExchange}/>}</div></div>;
}
function PrizeGroupV2({title,rewards,shop,tickets,busy,onExchange}) { return <div className="s3-prizegroup"><h4 className="s3-grouptitle">{title}</h4>{rewards.map(r=>{const unlimited=r.period==="unlimited",remain=getExchangeRemaining(shop,r.id),locked=(shop.level||1)<(r.unlockLevel||1),limit=r.period==="weekly"?r.weeklyLimit:r.dailyLimit,period=r.period==="weekly"?"本週":"今日",can=!locked&&(unlimited||remain>0)&&tickets>=r.price,art=rewardArt(r);return <div className="s3-reward" key={r.id}><div className={`s3-rico ${locked?"locked":""}`} style={r.tierIndex?{borderColor:TIER[r.tierIndex]?.[0]}:undefined}><ArtIcon src={art} fallback={r.icon} alt={r.label} className="s3-rewardart"/>{locked&&<span className="s3-artlock" aria-hidden="true">🔒</span>}</div><div className="s3-rcopy"><b>{r.label}</b><span>{locked?`商店 Lv.${r.unlockLevel} 解鎖`:unlimited?`不限次數・單次 ${r.price.toLocaleString()} 票券`:`${period}剩 ${remain}/${limit}・單次 ${r.price.toLocaleString()} 票券`}</span></div><button className="s3-buy" disabled={!can||busy} onClick={()=>onExchange(r)}>{locked?`Lv.${r.unlockLevel} 解鎖`:!unlimited&&remain<=0?`${period}售罄`:`🎟️ ${r.price.toLocaleString()}`}</button></div>;})}</div>; }

function PrizeCounter({ shop, tickets, busy, onExchange }) {
  const [materialTier,setMaterialTier]=useState(1);
  const mats=SHOP_EXCHANGE_REWARDS.filter(r=>r.type==="family_mat"&&r.tierIndex===materialTier);
  const daily=SHOP_EXCHANGE_REWARDS.filter(r=>r.type!=="family_mat"&&r.period!=="weekly");
  const weekly=SHOP_EXCHANGE_REWARDS.filter(r=>r.period==="weekly");
  const tierReward=mats[0],tierRemain=tierReward?getExchangeRemaining(shop,tierReward.id):0;
  return <div className="s3-panel"><div className="s3-head"><div><h3>獎品兌換櫃</h3><p>材料箱依 T 級共用每日額度；稀有獎品改成每週珍藏。</p></div><span className="s3-tag">🎟️ {tickets.toLocaleString()}</span></div><div className="s3-case"><div className="s3-filter s3-tierfilter">{[1,2,3,4,5].map(t=>{const reward=SHOP_EXCHANGE_REWARDS.find(r=>r.type==="family_mat"&&r.tierIndex===t),locked=(shop.level||1)<(reward?.unlockLevel||1);return <button key={t} className={`s3-chip ${materialTier===t?"active":""}`} onClick={()=>setMaterialTier(t)}>T{t}{locked?`・Lv.${reward?.unlockLevel}`:""}</button>;})}</div><div className="s3-sharedlimit">T{materialTier} 七族共用今日額度：剩 <b>{tierRemain}/{tierReward?.dailyLimit||0}</b> 次</div><PrizeGroup title={`🧰 T${materialTier} 族系材料補給`} rewards={mats} shop={shop} tickets={tickets} busy={busy} onExchange={onExchange}/>{daily.length>0&&<PrizeGroup title="🧪 每日補給" rewards={daily} shop={shop} tickets={tickets} busy={busy} onExchange={onExchange}/>}<PrizeGroup title="🌟 每週珍藏" rewards={weekly} shop={shop} tickets={tickets} busy={busy} onExchange={onExchange}/></div></div>;
}
function PrizeGroup({title,rewards,shop,tickets,busy,onExchange}) { return <div className="s3-prizegroup"><h4 className="s3-grouptitle">{title}</h4>{rewards.map(r=>{const remain=getExchangeRemaining(shop,r.id),locked=(shop.level||1)<(r.unlockLevel||1),limit=r.period==="weekly"?r.weeklyLimit:r.dailyLimit,period=r.period==="weekly"?"本週":"今日",can=!locked&&remain>0&&tickets>=r.price,art=rewardArt(r);return <div className="s3-reward" key={r.id}><div className={`s3-rico ${locked?"locked":""}`} style={r.tierIndex?{borderColor:TIER[r.tierIndex]?.[0]}:undefined}><ArtIcon src={art} fallback={r.icon} alt={r.label} className="s3-rewardart"/>{locked&&<span className="s3-artlock" aria-hidden="true">🔒</span>}</div><div className="s3-rcopy"><b>{r.label}</b><span>{locked?`商店 Lv.${r.unlockLevel} 解鎖`:`${period}剩 ${remain}/${limit}・單次 ${r.price.toLocaleString()} 票券`}</span></div><button className="s3-buy" disabled={!can||busy} onClick={()=>onExchange(r)}>{locked?`Lv.${r.unlockLevel} 解鎖`:remain<=0?`${period}售罄`:`🎟️ ${r.price.toLocaleString()}`}</button></div>;})}</div>; }

function Renovation({ shop, tickets, levelInfo, busy, onBuy }) {
  const revenue=Math.floor(shop.stats?.totalRevenue||0),nextLevel=levelInfo.maxed?null:levelInfo.level+1,nextReward=nextLevel?getLevelReward(nextLevel):null,nextCustomer=SHOP_CUSTOMERS.find(c=>c.unlockLevel>shop.level);
  return <div className="s3-panel"><div className="s3-head"><div><h3>店鋪裝修工房</h3><p>營業額推動商店等級；票券投資的家具，下一輪開店就會直接改變營運節奏。</p></div><span className="s3-tag">🎟️ {tickets.toLocaleString()}</span></div><div className="s3-levelcard"><div className="s3-leveltop"><b>🏪 商店 Lv.{shop.level}</b><span>{revenue.toLocaleString()}{levelInfo.next?` / ${levelInfo.next.toLocaleString()}`:"・已滿級"}</span></div><div className="s3-progress"><i style={{width:`${levelInfo.pct}%`}}/></div><div className="s3-next">{levelInfo.maxed?"🏆 商店已達 Lv.30，所有等級成長獎勵都已開放。":<>下一級：{nextReward?.speed?`客速 +${nextReward.speed}% `:""}{nextReward?.cap?`顧客上限 +${nextReward.cap} `:""}{nextReward?.customer?`・新顧客 ${nextReward.customer}`:""}{nextReward?.milestone?`・${nextReward.milestone}`:""}{nextCustomer&&nextCustomer.unlockLevel!==nextLevel?`　下一位新顧客：Lv.${nextCustomer.unlockLevel} ${nextCustomer.name}`:""}</>}</div></div><div className="s3-furniture">{Object.values(FURNITURE_DEFS).map(f=>{const current=shop.furniture?.[f.id]||0,price=getFurniturePrice(f.id,current),maxed=price<=0,can=!maxed&&tickets>=price;return <div className="s3-frow" key={f.id}><div className="s3-fico">{f.icon}</div><div className="s3-fcopy"><b>{f.name}</b><p>{f.desc}</p><div className="lv">Lv.{current}/{f.maxLevel}・{f.effect}</div><div className="s3-liveeffect"><strong>營運</strong>{f.liveEffect}</div></div><button className="s3-buy" disabled={maxed||!can||busy} onClick={()=>onBuy(f.id)}>{maxed?"完成 ✓":`🎟️ ${price.toLocaleString()}`}</button></div>;})}</div></div>;
}

function CustomerBook({ shop, discovered }) {
  const groups=[["common","🐱 常見居民","每天都可能出現在店門口"],["rare","✨ 稀有訪客","商店成長後才會逐步來訪"],["legend","🌟 傳說顧客","高階商店才有機會遇見"]],next=SHOP_CUSTOMERS.find(c=>c.unlockLevel>shop.level);
  return <div className="s3-panel"><div className="s3-album"><b>🐾 喵喵顧客手冊　{discovered.size}/{SHOP_CUSTOMERS.length}</b><span>{next?`下一位可解鎖訪客：Lv.${next.unlockLevel} ${next.name}`:"所有顧客都已具備來訪資格。繼續營業把圖鑑補滿。"}</span></div>{groups.map(([tier,title,desc])=>{const list=SHOP_CUSTOMERS.filter(c=>c.tier===tier),met=list.filter(c=>discovered.has(c.id)).length;return <div className="s3-albumsection" key={tier}><div className="s3-albumtitle"><span>{title}</span><span>{met}/{list.length}</span></div><div style={{fontSize:12,color:"#89735f",marginBottom:5,fontWeight:750}}>{desc}</div>{list.map(c=>{const seen=discovered.has(c.id),unlocked=c.unlockLevel<=shop.level;return <div className="s3-customer" key={c.id}><CustomerPortrait customer={c} seen={seen} unlocked={unlocked} className="s3-face"/><div className="s3-ccopy"><b>{seen?c.name:unlocked?"尚未遇見":`Lv.${c.unlockLevel} 解鎖`}</b><span>{seen?`「${c.line}」`:unlocked?`${c.group}・已具備來店資格`:`${c.group}・商店等級不足`}</span></div><span className="s3-state">{seen?"已登錄":unlocked?"待相遇":"未解鎖"}</span></div>;})}</div>;})}</div>;
}

function ShelfPicker({ picker, stockList, shop, onClose, onPick }) {
  const sorted=[...stockList].sort((a,b)=>b.tier-a.tier||a.category.localeCompare(b.category));
  return <div className="s3-sheetbg" onClick={onClose}><div className="s3-sheet" role="dialog" aria-modal="true" aria-label="選擇展示商品" onClick={e=>e.stopPropagation()}><div className="s3-handle"/><h4>{picker.slot==="counter"?"🧺 檯面":"🗄️ 櫃子"}・第 {picker.index+1} 格</h4><p>挑一件倉庫裡有庫存的商品。料理放檯面仍沿用既有 +15% 吸引力規則。</p><button className="s3-pick" onClick={()=>onPick(picker.index,null)}><span style={{fontSize:22}}>🧹</span><span><b>清空這個展示格</b><span>把目前商品收回倉庫</span></span></button>{sorted.length===0?<div style={{padding:22,textAlign:"center",fontSize:8,color:"#89735f",fontWeight:800}}>倉庫沒有可上架商品，先到工坊製作。</div>:sorted.map(g=><button className="s3-pick" key={g.id} onClick={()=>onPick(picker.index,g.id)}><GoodVisual good={g} className="s3-pickgood" /><span><b>{g.name}</b><span>{TIER_LABELS[g.tier]}・售價 {g.price} 🎟️</span></span><span className="qty">×{shop.stock?.[g.id]||0}</span></button>)}</div></div>;
}

function Receipt({ result, onClose }) { const bonus=Math.max(0,result.missionBonus||0),awarded=result.awardedTickets??(result.totalTickets+bonus),isAuto=result.receiptKind==="auto"; return <div className="s3-modalbg" onClick={onClose}><div className="s3-receipt" role="dialog" aria-modal="true" aria-label={isAuto?"離線販售收益":"本次營業結算"} onClick={e=>e.stopPropagation()}><div className="s3-receipthead"><div className="mark">🧾</div><h3>{isAuto?"回到商店・離線販售收益":"喵喵雜貨舖・本次帳單"}</h3><div style={{marginTop:4,fontSize:12,color:"#856f5c",fontWeight:800}}>{isAuto?"離店期間以 5% 速度自動販售・":""}接待 {result.served} 位・售出 {result.totalItems} 件{result.disappointed>0?`・${result.disappointed} 位沒買到`:""}</div></div><div className="s3-total"><small>{isAuto?"離線期間實際入帳":"本次實際入帳"}</small><b>+{awarded.toLocaleString()} 🎟️</b>{bonus>0&&<div style={{marginTop:5,fontSize:12,color:"#7a5b2d",fontWeight:900}}>商品收入 {result.totalTickets.toLocaleString()} ＋ 委託獎勵 {bonus.toLocaleString()}</div>}</div>{result.mission&&<div style={{margin:"0 0 8px",padding:"9px 10px",borderRadius:11,background:result.mission.completed?"#e7f1d8":"#f2e6d2",border:`1px solid ${result.mission.completed?"#9bbc82":"#cfb28d"}`,fontSize:12,fontWeight:850,color:"#66503b"}}>📜 {result.mission.title}：{result.mission.completed?`完成，+${bonus} 🎟️`:`${result.mission.progress}/${result.mission.target}，未完成`}</div>}{result.sales.slice(0,12).map((sale,i)=>{const customer=SHOP_CUSTOMERS.find(c=>c.id===sale.customerId)||{id:sale.customerId,name:sale.customerName,emoji:sale.customerEmoji};return <div className="s3-sale" key={`${sale.customerId}-${i}`}><CustomerPortrait customer={customer} className="face"/><span className="copy"><b>{sale.customerName}</b><span>{sale.items.slice(0,3).map(it=>`${it.goodName}×${it.qty}`).join("、")}{sale.items.length>3?"…":""}</span></span><strong>+{sale.tickets}</strong></div>;})}{result.sales.length>12&&<div style={{padding:8,textAlign:"center",fontSize:12,color:"#89735f"}}>另外還有 {result.sales.length-12} 筆成交</div>}{result.sales.length===0&&<div style={{padding:18,textAlign:"center",fontSize:13,color:"#89735f",fontWeight:800}}>離店期間沒有成交。請確認貨架已陳列且商品仍有庫存。</div>}<button className="s3-close" onClick={onClose}>關閉帳本</button></div></div>; }

function SettlementError({ message, onClose }) {
  return <div className="s3-modalbg" onClick={onClose}><div className="s3-receipt" role="alertdialog" aria-modal="true" aria-label="營業結算失敗" onClick={event => event.stopPropagation()}>
    <div className="s3-receipthead"><div className="mark">⚠️</div><h3>營業結算尚未完成</h3></div>
    <div style={{padding:"18px 4px",fontSize:15,lineHeight:1.55,fontWeight:850,color:"#71483b"}}>{message}</div>
    <div style={{fontSize:13,lineHeight:1.5,color:"#806b59"}}>商品與票券沒有被變更，請返回營業畫面後重新點擊「結束營業」。</div>
    <button className="s3-close" onClick={onClose}>返回營業畫面</button>
  </div></div>;
}

function LevelUp({ result, onClose }) {
  const levels=Array.from({length:Math.max(0,result.newLevel-result.oldLevel)},(_,i)=>result.oldLevel+i+1);
  return <div className="s3-modalbg" style={{zIndex:240}} onClick={onClose}><div className="s3-levelup" role="dialog" aria-modal="true" aria-label="商店升級" onClick={e=>e.stopPropagation()}><div className="big">🏪✨</div><h3>商店升級！ Lv.{result.oldLevel} → Lv.{result.newLevel}</h3><p>累計營業額正在把小店一步一步變成貓村名店。</p><div className="s3-levelreward">{levels.map(lv=>{const r=getLevelReward(lv);return <div key={lv}><span>Lv.{lv}</span><span>{r?.speed?`客速 +${r.speed}% `:""}{r?.cap?`上限 +${r.cap} `:""}{r?.customer?`・${r.customer}`:""}{r?.milestone?`・${r.milestone}`:""}</span></div>;})}</div><button className="s3-close" style={{background:"#b1782c",borderColor:"#895d1f"}} onClick={onClose}>收下升級獎勵</button></div></div>;
}

function craftState(good, resources, coins, shop) {
  const stock=shop.stock?.[good.id]||0, room=Math.max(0,SHOP_GOOD_STOCK_CAP-stock);
  const materialCaps=good.recipe.map(r=>Math.floor((resources?.[`${r.resource}_t${r.tier}`]||0)/r.count));
  const goldCap=good.gold>0?Math.floor((coins||0)/good.gold):SHOP_GOOD_STOCK_CAP;
  return { stock, stockFull:room<=0, maxCraft:Math.max(0,Math.min(room,goldCap,...materialCaps)) };
}
function stockCount(shop) { return Object.values(shop?.stock||{}).reduce((sum,value)=>sum+(Number(value)||0),0); }
function shopInteriorArt(shop) {
  const units = stockCount(shop);
  if (units >= 120) return "/assets/shop/interior-stock-abundant.webp";
  if (units >= 30) return "/assets/shop/interior-stock-normal.webp";
  return "/assets/shop/interior-stock-low.webp";
}
