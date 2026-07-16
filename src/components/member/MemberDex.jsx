// src/components/member/MemberDex.jsx
// 數位圖鑑牆（學生端）— 像素風徽章版 + 成就提示 + 公告系統
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { getCertRecords, getCertification, subscribeDexGrants, getDexConfig, subscribeMonsterDex, subscribeCraftStats, subscribeChestStats, subscribePotionDex, subscribeCardCollection } from "../../lib/db";
import { getDuelStats } from "../../lib/duelDb";
import { subscribeMyCats } from "../../lib/catDb";
import {
  AUTO_ACHIEVEMENTS, SPECIAL_GRANTS, DEX_CATEGORIES, RARITY_STYLE, RANK_STYLE,
  TIERED_ACHIEVEMENTS, computeTierProgress, getUnlockedKeys,
  buildRoundAchievements, computeDexStats, buildCohortAchievement,
} from "../../lib/achievementDex";
import { seedSeenIfFirstRun, seedNotifiedIfFirstRun, getUnseenKeys, markSeen } from "../../lib/dexSeen";

/* ─── 像素風 CSS ─────────────────────────────────────────── */
const PIXEL_BADGE_STYLE = `
  .px-badge { display:flex; align-items:center; justify-content:center; position:relative; }
  .px-badge::before {
    content:""; position:absolute; inset:-3px; border-radius:6px;
    border:3px solid transparent; z-index:1; pointer-events:none;
  }
  .px-badge.rarity-common::before   { border-color:#94a3b8; }
  .px-badge.rarity-uncommon::before { border-color:#22c55e; }
  .px-badge.rarity-rare::before     { border-color:#3b82f6; }
  .px-badge.rarity-epic::before     { border-color:#a855f7; }
  .px-badge.rarity-legendary::before{ border-color:#f59e0b; box-shadow:0 0 0 1px #fcd34d44; }
  .px-badge.rarity-mythic::before   { border-color:#ef4444; box-shadow:0 0 0 2px #fca5a544; animation:mythic-pulse 1.5s ease-in-out infinite; }
  .px-badge.locked::before          { border-color:#475569; }
  @keyframes mythic-pulse { 0%,100%{box-shadow:0 0 4px #ef444488;} 50%{box-shadow:0 0 14px #ef4444cc;} }
  .px-tile {
    width:36px; height:36px; border-radius:3px;
    display:flex; align-items:center; justify-content:center;
    font-size:20px; line-height:1; position:relative; overflow:hidden;
  }
  .px-tile.unlocked { background:#1e293b; box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),2px 2px 0 0 rgba(0,0,0,.5); }
  .px-tile.locked   { background:#334155; opacity:.45; box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
  .px-tile.legendary-shine::after {
    content:""; position:absolute; top:0; left:-40%; width:30%; height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent);
    animation:px-shine 3s ease-in-out infinite;
  }
  @keyframes px-shine { 0%,100%{left:-40%} 50%{left:110%} }

  /* 成就彈出提示動畫 */
  @keyframes dex-pop-in  { 0%{transform:translateY(80px) scale(.8);opacity:0} 60%{transform:translateY(-6px) scale(1.04)} 100%{transform:translateY(0) scale(1);opacity:1} }
  @keyframes dex-pop-out { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(30px)} }
  .dex-toast-in  { animation:dex-pop-in  .5s cubic-bezier(.34,1.56,.64,1) forwards; }
  .dex-toast-out { animation:dex-pop-out .4s ease-in forwards; }

  /* 屆數格子專用 */
  .round-cell { position:relative; overflow:hidden; }
  .round-cell::after {
    content:""; position:absolute; inset:0; border-radius:10px;
    background:linear-gradient(135deg,rgba(255,255,255,.08) 0%,transparent 60%);
    pointer-events:none;
  }
`;

const rarityClass = r => ({ common:"rarity-common", uncommon:"rarity-uncommon", rare:"rarity-rare", epic:"rarity-epic", legendary:"rarity-legendary", mythic:"rarity-mythic" }[r] || "rarity-common");
const rarityLabelColor = r => ({ common:"#64748b", uncommon:"#16a34a", rare:"#2563eb", epic:"#9333ea", legendary:"#d97706", mythic:"#dc2626" }[r] || "#64748b");

/* ─── 主元件 ─────────────────────────────────────────────── */
export default function MemberDex({ onBack, onDexViewed }) {
  const { profile } = useAuth();
  const [certRecords, setCertRecords]     = useState([]);
  const [certification, setCertification] = useState(null);
  const [granted, setGranted]             = useState([]);
  const [config, setConfig]               = useState({ physicalMax: 20, pointMax: 20 });
  const [monsterDex, setMonsterDex]       = useState({});
  const [craftStats, setCraftStats]       = useState({});
  const [chestStats, setChestStats]       = useState({});
  const [potionDex,  setPotionDex]        = useState({});
  const [cardData,   setCardData]         = useState({ cards: {}, equipped: [] });
  const [duelStats,  setDuelStats]        = useState({});
  const [cats,       setCats]             = useState([]);
  const [cat, setCat]                   = useState("start");
  const [detail, setDetail]             = useState(null);

  // 進圖鑑時「當下還沒看過」的 key 快照（凍結），驅動 NEW 角標；看過即標記已看清紅點
  const [newKeys, setNewKeys] = useState(() => new Set());
  const snapshotDoneRef = useRef(false);

  useEffect(() => {
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(() => {});
    getCertification(profile.id).then(setCertification).catch(() => {});
    getDexConfig().then(setConfig).catch(() => {});
    const unsub        = subscribeDexGrants(profile.id, setGranted);
    const unsubMon     = subscribeMonsterDex(profile.id, setMonsterDex);
    const unsubCraft   = subscribeCraftStats(profile.id, setCraftStats);
    const unsubChest   = subscribeChestStats(profile.id, setChestStats);
    const unsubPotion  = subscribePotionDex(profile.id, setPotionDex);
    const unsubCard    = subscribeCardCollection(profile.id, setCardData);
    const unsubCats    = subscribeMyCats(profile.id, obj => setCats(Object.values(obj || {})));
    getDuelStats(profile.id).then(setDuelStats).catch(() => {});
    return () => { unsub && unsub(); unsubMon(); unsubCraft(); unsubChest(); unsubPotion(); unsubCard(); unsubCats && unsubCats(); };
  }, [profile?.id]);

  // 卡片相關成就（card_collect / card_mythic / card_all6fam）的 check/getValue 讀的是
  // cardCount / mythicCards / cardFamilies，這裡要從 cardData 推導出來，否則卡片格恆為 0
  // （與 computeDexStats 內部同一套算法）。
  const _cards        = cardData?.cards || {};
  const cardCount     = Object.keys(_cards).length;
  const mythicCards   = Object.values(_cards).filter(c => c.tier === "mythic").length;
  const cardFamilies  = [...new Set(Object.values(_cards).map(c => c.family).filter(Boolean))];
  const ctx   = { member: profile, certification, certRecords, checkinCount: profile?.dailyQuestCount || 0, monsterDex, craftStats, chestStats, potionDex, cardData, cardCount, mythicCards, cardFamilies, duelStats, cats };
  const stats = computeDexStats({ ...ctx, granted, physicalMax: config.physicalMax, pointMax: config.pointMax });
  // 快取給首頁/我的頁面使用，避免重複讀取
  if (profile?.id) { try { sessionStorage.setItem(`dex_stats_${profile.id}`, JSON.stringify({ totalUnlocked: stats.totalUnlocked, totalAll: stats.totalAll, gold: stats.gold, silver: stats.silver, bronze: stats.bronze })); } catch {} }

  // ── 進圖鑑＝去看了：把「當下沒看過」的 key 凍結成 NEW 快照，然後全部標記已看（清紅點）──
  // 提醒（toast/popup）由 App 層 MemberApp 負責，這裡只做「看過」清除與 NEW 高亮，兩者不重複。
  useEffect(() => {
    if (!profile?.id) return;
    const keys = getUnlockedKeys(ctx);
    // 首次基準：避免既有成就被誤判成新的（跟 App 層各自 idempotent，init flag 只跑一次）
    seedSeenIfFirstRun(profile.id, keys);
    seedNotifiedIfFirstRun(profile.id, keys);
    if (!keys.length) return;                 // 資料還沒載入完，等有東西再快照
    if (!snapshotDoneRef.current) {
      snapshotDoneRef.current = true;
      setNewKeys(new Set(getUnseenKeys(profile.id, keys)));  // 凍結這批「新」的
    }
    markSeen(profile.id, keys);               // 看過了 → 清紅點
    onDexViewed && onDexViewed();             // 通知 App 層重算 nav 紅點
  }, [profile?.id, certification, certRecords, granted, monsterDex, craftStats, chestStats, potionDex, cardData, duelStats, cats]); // eslint-disable-line

  // 某個格子是否為「新」（unlocked 且其 key 在快照內）。tiered 格子 id 對應 `${id}#*`
  function isCellNew(a) {
    if (!a.unlocked || newKeys.size === 0) return false;
    if (newKeys.has(a.id)) return true;
    const prefix = a.id + "#";
    for (const k of newKeys) if (k.startsWith(prefix)) return true;
    return false;
  }
  // 哪些分類含有「新」成就（給分類頁籤紅點）
  const newCatSet = new Set();
  newKeys.forEach(k => {
    const id = k.includes("#") ? k.split("#")[0] : k;
    const t = TIERED_ACHIEVEMENTS.find(x => x.id === id);
    const catId = t ? t.cat : AUTO_ACHIEVEMENTS.find(x => x.id === id)?.cat;
    if (catId) newCatSet.add(catId);
  });

  function cellsFor(catId) {
    if (catId === "cohort")   { const c = buildCohortAchievement(profile?.joinDate); return c ? [c] : []; }
    if (catId === "physical" || catId === "point") {
      const max = catId === "physical" ? config.physicalMax : config.pointMax;
      return buildRoundAchievements(catId, max, granted);
    }
    if (catId === "special") {
      const ids = new Set(granted.filter(g => g.type === "special").map(g => g.id));
      return SPECIAL_GRANTS.map(a => ({ ...a, unlocked: ids.has(a.id) }));
    }
    // 階段式成就：從 TIERED_ACHIEVEMENTS 過濾
    const tieredForCat = TIERED_ACHIEVEMENTS.filter(t => t.cat === catId);
    // 收集被階段式成就取代的舊成就 id
    const replacedIds = new Set();
    tieredForCat.forEach(t => (t.replacesIds || []).forEach(id => replacedIds.add(id)));

    // 一般成就：排除已被階段式取代的
    const flat = AUTO_ACHIEVEMENTS
      .filter(a => a.cat === catId && !replacedIds.has(a.id))
      .map(a => ({ ...a, unlocked: a.check(ctx) }));

    // 階段式成就：加上 tierProgress
    const tiered = tieredForCat.map(t => {
      const prog = computeTierProgress(t, ctx);
      const curTier = prog.currentTier || t.tiers[0];
      return {
        id: t.id,
        cat: t.cat,
        icon: curTier ? curTier.icon : t.icon,
        name: t.name,
        rarity: curTier ? curTier.rarity : t.tiers[0].rarity,
        desc: t.desc,
        unlocked: prog.currentTierIndex >= 0,
        // 附加 tierProgress 供彈窗使用
        tierProgress: prog,
      };
    });

    return [...tiered, ...flat];
  }

  const cells   = cellsFor(cat);
  const isRound = cat === "physical" || cat === "point";

  return (
    <div className="p-4 flex flex-col gap-4">
      <style>{PIXEL_BADGE_STYLE}</style>

      {onBack && <button onClick={onBack} className="text-gray-400 text-sm self-start py-1">← 返回</button>}

      {/* 標題 */}
      <div className="rounded-2xl p-5 text-white" style={{ background:"linear-gradient(135deg,#1e293b,#0e7490)" }}>
        <div className="text-xs tracking-widest text-cyan-200 font-black mb-1">數位圖鑑</div>
        <div className="text-2xl font-black mb-3">🎖️ 我的成就收藏</div>
        <div className="flex items-center gap-4">
          <div>
            <div className="text-cyan-200 text-xs">收集進度</div>
            <div className="font-black text-xl">{stats.totalUnlocked} / {stats.totalAll}</div>
          </div>
          <div className="flex gap-2 ml-auto text-sm font-black">
            <span>🥇 {stats.gold}</span>
            <span>🥈 {stats.silver}</span>
            <span>🥉 {stats.bronze}</span>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full" style={{ width:`${stats.totalAll ? (stats.totalUnlocked/stats.totalAll*100) : 0}%` }} />
        </div>
      </div>

      {/* 分類標籤 */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DEX_CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={`relative px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${cat===c.id ? "bg-blue-600 text-white border-blue-600" : "bg-white/10 text-gray-300 border-white/15"}`}>
            {c.label}
            {newCatSet.has(c.id) && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-[#0f172a]" />
            )}
          </button>
        ))}
      </div>

      {/* 格子牆 */}
      {isRound ? (
        <RoundGrid cells={cells} catLabel={cat==="physical" ? "實體賽" : "積分賽"} onTap={setDetail} />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {cells.length === 0 && cat === "cohort" && (
            <div className="col-span-4 text-gray-400 text-sm text-center py-6">尚未設定加入日期，無法判定期數</div>
          )}
          {cells.map(a => <DexCell key={a.id} a={a} isNew={isCellNew(a)} onTap={() => setDetail(a)} />)}
        </div>
      )}

      {detail && <DexDetailModal a={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ─── 像素風成就格 ────────────────────────────────────────── */
function DexCell({ a, onTap, isNew }) {
  const unlocked  = a.unlocked;
  const isHidden  = a.hidden && !unlocked;
  const isLegendary = (a.rarity === "legendary" || a.rarity === "mythic") && unlocked;

  return (
    <button onClick={onTap}
      className="relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-transform active:scale-95"
      style={{
        background: unlocked ? "#0f172a" : "rgba(255,255,255,0.05)",
        border: `1.5px solid ${unlocked ? (RARITY_STYLE[a.rarity]?.ring || "#94a3b8") : "rgba(255,255,255,0.12)"}`,
      }}>
      {isNew && (
        <span className="absolute -top-1 -right-1 z-10 px-1 rounded-md bg-red-500 text-white font-black leading-none"
          style={{ fontSize: "8px", padding: "2px 3px" }}>NEW</span>
      )}
      <div className={`px-badge ${unlocked ? rarityClass(a.rarity) : "locked"}`}>
        <div className={`px-tile ${unlocked ? "unlocked" : "locked"} ${isLegendary ? "legendary-shine" : ""}`}>
          {isHidden ? "❓" : a.icon}
        </div>
      </div>
      <div style={{ fontSize:"10px", fontWeight:700, color: unlocked ? "#e2e8f0" : "#94a3b8",
        maxWidth:"100%", overflow:"hidden", display:"-webkit-box",
        WebkitLineClamp:2, WebkitBoxOrient:"vertical", textAlign:"center", lineHeight:1.3 }}>
        {isHidden ? "???" : a.name}
      </div>
      {unlocked
        ? <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ background: RARITY_STYLE[a.rarity]?.ring || "#94a3b8" }} />
        : !isHidden && <div style={{ fontSize:"10px", color:"#94a3b8" }}>🔒</div>
      }
    </button>
  );
}

/* ─── 屆數格（華麗重設計）────────────────────────────────── */
const ROUND_BG = {
  1: "linear-gradient(135deg,#7c3aed,#4f46e5)",   // 冠軍：紫藍
  2: "linear-gradient(135deg,#475569,#334155)",   // 亞軍：鋼鐵銀
  3: "linear-gradient(135deg,#92400e,#78350f)",   // 季軍：古銅棕
  0: "linear-gradient(135deg,#0369a1,#0c4a6e)",   // 參賽：深藍
};
const ROUND_BG_LOCKED = "linear-gradient(135deg,#1e293b,#0f172a)";

function RoundGrid({ cells, catLabel, onTap }) {
  const [open, setOpen] = useState(true);
  const unlockedCount = cells.filter(c => c.unlocked).length;

  return (
    <div className="border border-white/15 rounded-2xl overflow-hidden bg-white/5">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-white/5">
        <span className="text-gray-200 font-black text-sm">{catLabel}　已收集 {unlockedCount}/{cells.length} 屆</span>
        <span className="text-gray-400 text-xs">{open ? "▲ 收起" : "▼ 展開"}</span>
      </button>
      {open && (
        <div className="p-3 grid grid-cols-4 gap-2">
          {cells.map(c => {
            const rk = c.unlocked ? (RANK_STYLE[c.rank] || RANK_STYLE[0]) : null;
            const bg = c.unlocked ? (ROUND_BG[c.rank ?? 0] || ROUND_BG[0]) : ROUND_BG_LOCKED;
            return (
              <button key={c.id} onClick={() => onTap(c)}
                className="round-cell aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95"
                style={{
                  background: bg,
                  border: `2px solid ${c.unlocked ? (rk.ring + "aa") : "#1e293b"}`,
                  boxShadow: c.unlocked ? rk.glow : "none",
                }}>
                {c.unlocked ? (
                  <>
                    <div className="text-2xl leading-none">{rk.icon}</div>
                    <div style={{ fontSize:"11px", fontWeight:800, color:"#fff", textShadow:"0 1px 3px rgba(0,0,0,.8)" }}>
                      第{c.round}屆
                    </div>
                    <div style={{ fontSize:"9px", fontWeight:700, color:"rgba(255,255,255,.7)" }}>{rk.label}</div>
                  </>
                ) : (
                  <>
                    <div className="text-lg opacity-30">🔒</div>
                    <div style={{ fontSize:"10px", fontWeight:700, color:"rgba(255,255,255,.3)" }}>第{c.round}屆</div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── 詳情彈窗 ───────────────────────────────────────────── */
function DexDetailModal({ a, onClose }) {
  // 階段式成就 → 進度條顯示
  if (a.tierProgress) {
    return <TieredDetailContent a={a} onClose={onClose} />;
  }

  // 一次性成就（原有邏輯）
  const unlocked = a.unlocked;
  const isHidden = a.hidden && !unlocked;
  const rs = RARITY_STYLE[a.rarity] || RARITY_STYLE.common;
  const isRound = a.round != null;
  const rk = isRound && unlocked ? (RANK_STYLE[a.rank] || RANK_STYLE[0]) : null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="rounded-3xl p-6 w-full max-w-xs text-center"
        style={{ background:"var(--bg-surface)", border:"1px solid var(--border-card)", boxShadow:"var(--shadow-elevated)" }}
        onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 w-20 h-20 rounded-2xl flex items-center justify-center text-5xl"
          style={{
            background: unlocked ? "#0f172a" : "rgba(255,255,255,0.06)",
            border: `3px solid ${unlocked ? (isRound ? rk?.ring : (rs?.ring || "#94a3b8")) : "rgba(255,255,255,0.12)"}`,
            filter: unlocked ? "none" : "grayscale(1) opacity(.4)",
          }}>
          {isHidden ? "❓" : isRound ? (unlocked ? rk.icon : "🔒") : a.icon}
        </div>

        <div className="font-black text-xl text-gray-100 mb-1">
          {isHidden ? "??? 隱藏成就"
            : isRound ? `${a.cat==="physical" ? "實體賽" : "積分賽"} 第 ${a.round} 屆`
            : a.name}
        </div>

        {!isRound && !isHidden && (
          <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2"
            style={{ background:(rs?.ring||"#94a3b8")+"22", color:rarityLabelColor(a.rarity) }}>
            {rs?.label}
          </span>
        )}
        {isRound && unlocked && (
          <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 bg-amber-500/15 text-amber-300">{rk.label}</span>
        )}

        <div className="text-gray-400 text-sm mt-2">
          {isHidden ? (a.riddle || "達成隱藏條件即可解鎖")
            : isRound ? (unlocked ? "恭喜參與這一屆賽事！" : "參加這一屆即可點亮")
            : a.desc}
        </div>

        {unlocked && !isRound && !isHidden && <div className="text-emerald-400 text-sm font-bold mt-3">✅ 已解鎖</div>}
        {!unlocked && !isHidden && <div className="text-gray-400 text-sm mt-3">🔒 尚未解鎖</div>}

        <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-white/10 text-gray-300 font-bold border border-white/15">關閉</button>
      </div>
    </div>
  );
}

/* ─── 階段式成就詳情彈窗（含進度條 + 里程碑列表）─────────── */
function TieredDetailContent({ a, onClose }) {
  const p = a.tierProgress; // computeTierProgress 的回傳值
  const [milestonesOpen, setMilestonesOpen] = useState(true);

  // 預設展開邏輯：全部完成時收起，其他展開
  useEffect(() => {
    setMilestonesOpen(!p.progress.isComplete);
  }, [p.progress.isComplete]);

  // 當前 tier 的稀有度樣式
  const currentRarity = p.currentTier ? p.currentTier.rarity : (a.rarity || "common");
  const rs = RARITY_STYLE[currentRarity] || RARITY_STYLE.common;
  const currentIcon = p.currentTier ? p.currentTier.icon : a.icon;
  const currentName = p.currentTier ? p.currentTier.name : "尚未解鎖";

  // 激勵文字
  function gapMessage() {
    if (p.progress.isComplete) return "🎉 完美達成！全部里程碑已解鎖！";
    if (!p.nextTier) return "🎯 繼續加油！";
    const gap = p.progress.gap;
    const name = p.nextTier.name;
    if (gap <= 1) return `🔥 再 ${gap} 次！就差一步就能達成「${name}」！`;
    if (gap <= 3) return `⚡ 再 ${gap} 次即可達成「${name}」！`;
    if (gap <= 9) return `🎯 再 ${gap} 次就能解鎖「${name}」`;
    return `🏹 繼續努力，離「${name}」還有 ${gap} 次`;
  }

  // 進度條漸層 class
  const rarityProgressClass = ({
    common:    "from-slate-400 to-slate-300",
    uncommon:  "from-green-600 to-green-400",
    rare:      "from-blue-600 to-blue-400",
    epic:      "from-purple-600 to-purple-400",
    legendary: "from-amber-600 to-yellow-400",
    mythic:    "from-red-600 to-red-400",
  })[currentRarity] || "from-slate-400 to-slate-300";

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-6" onClick={onClose}>
      <div className="rounded-3xl p-6 w-full max-w-xs text-left"
        style={{ background:"var(--bg-surface)", border:"1px solid var(--border-card)", boxShadow:"var(--shadow-elevated)" }}
        onClick={e => e.stopPropagation()}>

        {/* 圖示 + 名稱 + 稀有度 */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0"
            style={{
              background: p.currentTierIndex >= 0 ? "#0f172a" : "rgba(255,255,255,0.06)",
              border: `2px solid ${p.currentTierIndex >= 0 ? rs.ring : "rgba(255,255,255,0.12)"}`,
              boxShadow: p.currentTierIndex >= 0 ? rs.glow : "none",
            }}>
            {currentIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-lg text-gray-100 truncate">{a.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm">{currentIcon}</span>
              <span className="text-sm font-bold truncate" style={{ color: rarityLabelColor(currentRarity) }}>
                {currentName}
              </span>
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: rs.ring + "22", color: rarityLabelColor(currentRarity) }}>
                {rs.label}
              </span>
            </div>
          </div>
        </div>

        {/* 進度條 */}
        <div className="mb-3">
          <div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${rarityProgressClass} transition-all duration-700 ease-out`}
              style={{ width: `${p.progress.percent}%` }}
            />
            {/* 里程碑圓點標記 */}
            {p.tiers.map((t, i) => {
              const pct = ((t.count - 0) / (p.tiers[p.tiers.length - 1].count)) * 100;
              const isDone = t.unlocked;
              const isNext = t.isCurrent;
              return (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all duration-300"
                  style={{
                    left: `${Math.min(100, pct)}%`,
                    background: isDone ? rs.ring : "transparent",
                    borderColor: isNext ? rs.ring : (isDone ? rs.ring : "rgba(255,255,255,0.2)"),
                    boxShadow: isNext ? `0 0 8px ${rs.ring}` : "none",
                    zIndex: isNext ? 3 : 1,
                  }}
                />
              );
            })}
          </div>
          {/* 進度數字 */}
          <div className="flex justify-between mt-1.5 text-xs text-gray-400">
            <span className="font-bold" style={{ color: rarityLabelColor(currentRarity) }}>
              {p.progress.currentLabel}
            </span>
            {!p.progress.isComplete && (
              <span className="text-gray-500">
                / {p.progress.nextLabel}
              </span>
            )}
          </div>
        </div>

        {/* 激勵文字 */}
        <div className="text-sm font-bold text-center py-2 px-3 rounded-xl mb-3"
          style={{
            background: p.progress.isComplete
              ? "rgba(34,197,94,0.12)"
              : "rgba(59,130,246,0.10)",
            color: p.progress.isComplete ? "#4ade80" : "#60a5fa",
          }}>
          {gapMessage()}
        </div>

        {/* 里程碑列表 — 展開/收起 */}
        <button
          onClick={() => setMilestonesOpen(o => !o)}
          className="w-full flex items-center justify-between py-2 px-3 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
        >
          <span>
            {milestonesOpen ? "▲" : "▼"} 里程碑列表（{p.unlockedCount}/{p.totalTiers}）
          </span>
          <span className="text-gray-500">{p.progress.isComplete ? "🎉" : "🏹"}</span>
        </button>

        {milestonesOpen && (
          <div className="flex flex-col gap-1 mt-1 mb-2 pb-2 max-h-64 overflow-y-auto">
            {p.tiers.map((t, i) => {
              const isDone = t.unlocked;
              const isNext = t.isCurrent;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-300"
                  style={{
                    background: isNext
                      ? `rgba(59,130,246,0.12)`
                      : isDone
                        ? "rgba(34,197,94,0.06)"
                        : "transparent",
                    borderLeft: isNext ? `3px solid ${rs.ring}` : "3px solid transparent",
                    opacity: isDone ? 1 : 0.6,
                  }}>
                  {/* 狀態圖示 */}
                  <div className="w-5 text-center flex-shrink-0">
                    {isNext ? "▶" : isDone ? "✅" : "🔒"}
                  </div>
                  {/* tier 圖示 */}
                  <div className="text-lg flex-shrink-0">{t.icon}</div>
                  {/* 名稱 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-200 text-xs truncate">{t.name}</div>
                    <div className="text-gray-500 text-xs truncate">{t.desc}</div>
                  </div>
                  {/* 門檻 */}
                  <div className="text-xs font-bold flex-shrink-0"
                    style={{ color: isDone ? rarityLabelColor(t.rarity) : "#64748b" }}>
                    {t.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 關閉按鈕 */}
        <button onClick={onClose}
          className="mt-3 w-full py-2.5 rounded-xl bg-white/10 text-gray-300 font-bold border border-white/15 hover:bg-white/20 transition-colors">
          關閉
        </button>
      </div>
    </div>
  );
}