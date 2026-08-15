// src/components/member/VillageHomeScene.jsx — 貓貓村首頁「場景式」重設計（A+B+C）
// A：全景圖變成場景舞台（浮動收集按鈕＋秘書貓氣泡）＋村莊廣場場所入口
// B：資訊層級重組（村莊等級進度環＋智慧排序建築橫條＋可升級/缺材料徽章）
// C：村莊場所橫向列（取代原本的子功能網格）
import { useState, useEffect, useRef, useMemo } from "react";
import { setDisplayVillageLv } from "../../lib/db";
import {
  BUILDINGS, BUILDING_LIST, getBuildingStage,
  canUpgrade, UNLOCK_REQS, isBuildingUnlocked,
  getWorkerCatMultiplier, getVillageLastCollectedMs, MAX_COLLECT_HOURS,
} from "../../lib/villageData";
import { buildVillageCollectionResult } from "../../lib/villageCollectionResult";
import { CATS, getBondLevel } from "../../lib/catData";
import { sfxTap } from "../../lib/sound";
import CatVillageNavArt from "./CatVillageNavArt";

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

// ── 秘書貓台詞庫（從 CatVillage 移入）────────────────────────
const CAT_DAILY_QUOTES = {
  daming: [
    "今天的村莊由老大我親自巡視，誰敢偷懶？",
    "你放心去冒險，後方的後勤與村莊，老大我看著呢。",
    "別偷懶，採集與升級都要按部就班！",
    "村莊就交給我了，遇到硬骨頭怪物隨時叫我！",
    "這座村莊每棵樹、每塊石頭，都是大家一起建起來的霸氣領域！",
    "（滿意地看著村莊）哼，今天大家幹得還不錯！",
  ],
  gege: [
    "哥哥會好好守護村莊的，大家放心吧！",
    "今天的風向不錯，適合訓練與採集！",
    "村裡的大家都很努力，哥哥也不能輸！",
  ],
  meimei: [
    "喵～今天村莊也好熱鬧呢！",
    "大家採集完記得來找我玩喔！",
    "我最喜歡看到村莊慢慢變大的樣子了！",
  ],
  niuniu: [
    "統計顯示，今天的村莊產能提升了 5%。",
    "每棟建築的升級進度我都記錄得很清楚呢。",
    "數據不會說謊，村莊正在穩定成長中。",
  ],
  haji: [
    "喵～今天天氣真好，適合在村莊裡散步。",
    "村莊的陽光曬起來好舒服喔……",
    "嗯？你說要我幫忙巡視？等我睡飽再說～",
  ],
  baobao: [
    "村莊裡到處都是好玩的東西，我要到處探險！",
    "這裡的建築都好可愛，抱抱！",
    "嘿嘿，我把村莊每個角落都摸透啦！",
  ],
  youyou: [
    "慢慢來，比較快……村莊也是這樣成長的。",
    "我喜歡坐在屋頂上看整個村莊的風景。",
    "今天的風，聞起來有成長的味道呢。",
  ],
  xiaoan: [
    "村莊……好大喔，我有點緊張……",
    "雖然害怕，但我會努力幫上忙的！",
    "大家一起的話，我就不怕了！",
  ],
  diandian: [
    "這座村莊的每一塊磚，都在訴說故事呢。",
    "我感受到村莊的靈氣正在匯聚……",
    "夜晚的村莊，有另一種神秘的美。",
  ],
};

// 村莊場所（單一來源：導覽列＋廣場攤位共用）
export const VILLAGE_PLACES = [
  { id: "council",     label: "議事廳",   art: "tasks",       emoji: "🏛️", desc: "村莊任務與探索地圖" },
  { id: "forge",       label: "裝備鍛造", art: "forge",       emoji: "⚒️", desc: "打造貓貓專屬裝備" },
  { id: "potioncraft", label: "藥水製作", art: "potioncraft", emoji: "🧪", desc: "調製戰鬥藥水" },
  { id: "shop",        label: "商店",     art: "trade",       emoji: "🏪", desc: "販售商品・賺取票券" },
  { id: "gacha",       label: "貓咪扭蛋", art: "gacha",       emoji: "🎰", desc: "抽可愛貓貓夥伴" },
  { id: "cardmarket",  label: "卡片市集", art: "trade",       emoji: "🛒", desc: "買賣怪獸卡牌" },
];

function describeUnlockReq(buildingId) {
  if (buildingId === "market") return "海港或獵場 Lv.2";
  const req = UNLOCK_REQS[buildingId];
  if (!req) return "";
  return Object.entries(req)
    .map(([id, lv]) => `${BUILDINGS[id].name} Lv.${lv}`)
    .join(" 且 ");
}

// 單一建築的狀態判定（可升級 / 缺材料 / MAX）——與舊 BuildingCard 一致
function buildingStatus(buildingId, buildings, resources) {
  const level = buildings?.[buildingId] || 1;
  const maxed = level >= 20;
  const check = canUpgrade(buildingId, { [buildingId]: level }, resources);
  if (maxed) return { level, maxed: true, ok: false, label: "MAX" };
  return { level, maxed: false, ok: check.ok, label: check.ok ? "可升級" : "缺材料" };
}

// ── 全景場景（等級徽章＋秘書貓氣泡＋收集按鈕）───
const PANORAMA_FRAMES = ["a", "b", "c", "d", "e"];
const FRAME_INTERVAL_MS = 2000;

function PanoramaScene({ village, villageLevel, displayLv, memberId, buildings, resources, pending,
  collecting, onCollect, secretaryCat }) {
  const actualLv = Math.max(1, Math.min(20, villageLevel || 1));
  const showLv   = displayLv ? Math.max(1, Math.min(20, displayLv)) : actualLv;
  const pad      = String(showLv).padStart(2, "0");
  const baseSrc  = `/ui/village/panorama-lv${pad}`;

  const [frameIdx, setFrameIdx] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickerRef = useRef(null);

  const unlockedIds = useMemo(() =>
    BUILDING_LIST.filter(id => isBuildingUnlocked(id, buildings)),
  [buildings]);

  // 村莊等級進度環：平均等級的小數部分
  const levelProgress = useMemo(() => {
    if (unlockedIds.length === 0) return 0;
    const total = unlockedIds.reduce((s, id) => s + (buildings?.[id] || 1), 0);
    const avg = total / unlockedIds.length;
    return Math.min(1, Math.max(0, avg - Math.floor(avg)));
  }, [unlockedIds, buildings]);

  // 待收集總量（FAB 徽章）
  const pendingTotal = useMemo(() => {
    const v = Object.values(pending || {});
    if (!v.length) return 0;
    const sum = v.reduce((s, n) => s + (Number(n) || 0), 0);
    return Math.floor(sum);
  }, [pending]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const lastCollectedMs = useMemo(() => getVillageLastCollectedMs(village?.lastCollectedAt), [village?.lastCollectedAt]);
  const elapsedSec = useMemo(() => Math.min(MAX_COLLECT_HOURS * 3600,
    Math.max(0, Math.floor((Date.now() - lastCollectedMs) / 1000))), [lastCollectedMs, tick]);
  const nextCollectSec = useMemo(() => Math.max(0,
    Math.floor((lastCollectedMs + MAX_COLLECT_HOURS * 3600000 - Date.now()) / 1000)),
  [lastCollectedMs, tick]);
  const capacityPct = Math.min(100, Math.max(0, Math.round((elapsedSec / (MAX_COLLECT_HOURS * 3600)) * 100)));
  const isFull = capacityPct >= 100;

  // 幀切換
  useEffect(() => {
    if (hasError) return;
    const t = setInterval(() => setFrameIdx(i => (i + 1) % PANORAMA_FRAMES.length), FRAME_INTERVAL_MS);
    return () => clearInterval(t);
  }, [hasError, showLv]);
  useEffect(() => { setFrameIdx(0); setHasError(false); }, [showLv]);

  // 點擊外部關閉等級外觀 picker
  useEffect(() => {
    if (!showPicker) return;
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker]);

  async function handleSelectLevel(lv) {
    if (!memberId) return;
    setSaving(true);
    await setDisplayVillageLv(memberId, lv);
    setSaving(false);
    setShowPicker(false);
  }

  const curSrc = `${baseSrc}-${PANORAMA_FRAMES[frameIdx]}.webp`;
  const imgSrc = hasError ? `${baseSrc}.webp` : curSrc;
  const hasPending = pendingTotal > 0;

  const timeStr = useMemo(() => {
    if (nextCollectSec <= 0) return null;
    const h = Math.floor(nextCollectSec / 3600);
    const m = Math.floor((nextCollectSec % 3600) / 60);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  }, [nextCollectSec]);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl"
      style={{
        aspectRatio: "750 / 370",
        border: `2px solid ${C.border}`,
        boxShadow: "0 8px 24px rgba(92, 61, 46, 0.18)",
        background: "#EDE0CE",
        animation: "vhs-fade-in .6s ease-out both",
      }}>
      {/* 全景圖（多幀動畫） */}
      <img
        src={imgSrc}
        alt={`村莊 Lv${showLv}`}
        width="750" height="370" fetchPriority="high"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={() => setHasError(true)}
      />
      {/* 沉浸光效 Overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(60,35,15,0.4) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0.15) 100%), linear-gradient(45deg, rgba(251,191,36,0.1) 0%, transparent 60%)",
      }} />

      {/* 等級徽章（含進度環） */}
      <button type="button" onClick={() => { sfxTap(); setShowPicker(p => !p); }}
        style={{
          position: "absolute", top: 10, left: 12,
          background: "rgba(60,35,15,0.72)", backdropFilter: "blur(6px)",
          borderRadius: 20, padding: "5px 12px 5px 6px",
          color: "#FFF8F0", cursor: "pointer", userSelect: "none",
          display: "flex", alignItems: "center", gap: 8,
          border: "1px solid rgba(255,255,255,0.18)", boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
          animation: "vhs-slide-down .45s ease-out .08s both",
        }}>
        {/* 進度環 */}
        <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
          <circle cx="19" cy="19" r="15" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="4" />
          <circle cx="19" cy="19" r="15" fill="none"
            stroke={isFull ? "#F59E0B" : "#A0D090"} strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${levelProgress * 2 * Math.PI * 15} ${2 * Math.PI * 15}`}
            transform="rotate(-90 19 19)"
            style={{ transition: "stroke-dasharray .6s ease" }} />
          <text x="19" y="22" textAnchor="middle" fontSize="10" fontWeight="900" fill="#FFF8F0">Lv.{showLv}</text>
        </svg>
        <div className="text-left leading-tight">
          <div style={{ fontSize: 10, fontWeight: 900, color: "#D4C4A8" }}>🏡 村莊等級</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#A0D090" }}>
            解鎖 {unlockedIds.length}/9 {showLv !== actualLv && "・外觀自訂"}
          </div>
        </div>
      </button>

      {/* 等級外觀切換器 */}
      {showPicker && (
        <div ref={pickerRef} style={{
          position: "absolute", top: 54, left: 12,
          background: "rgba(60,35,15,0.93)", backdropFilter: "blur(10px)",
          borderRadius: 14, padding: "8px 10px", color: "#FFF8F0", zIndex: 100,
          minWidth: 180, boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        }}>
          <div className="text-[10px] font-bold mb-2" style={{ color: "#D4C4A8", textAlign: "center" }}>
            🎨 選擇村莊外觀
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {Array.from({ length: actualLv }, (_, i) => i + 1).map(lv => {
              const isActive = lv === showLv;
              return (
                <button key={lv} onClick={() => handleSelectLevel(lv)} disabled={saving}
                  style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: isActive ? C.sage : "rgba(255,255,255,0.10)",
                    color: isActive ? "#FFF" : "#D4C4A8",
                    border: isActive ? "2px solid #A0D090" : "1px solid rgba(255,255,255,0.15)",
                    fontSize: 12, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .15s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}>
                  {saving ? "…" : lv}
                </button>
              );
            })}
          </div>
          <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <button onClick={() => handleSelectLevel(null)} disabled={saving}
              style={{
                width: "100%", padding: "4px 0", borderRadius: 8,
                background: displayLv ? "rgba(255,255,255,0.08)" : C.sage,
                color: displayLv ? "#D4C4A8" : "#FFF",
                border: "none", fontSize: 11, fontWeight: 900, cursor: "pointer",
                transition: "all .15s",
              }}
              onMouseEnter={e => { if (displayLv) e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={e => { if (displayLv) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}>
              {saving ? "…" : displayLv ? "🔄 自動（跟隨實際等級）" : "✓ 自動跟隨中"}
            </button>
          </div>
          <div className="text-[9px] mt-1.5" style={{ color: "#A09080", textAlign: "center" }}>
            解鎖至 Lv.{actualLv}，可選 1~{actualLv}
          </div>
        </div>
      )}

      {/* 秘書貓氣泡（左下） */}
      {secretaryCat && (
        <SecretaryBubble cat={secretaryCat} />
      )}

      {/* 收集浮動按鈕＋容量條（右下） */}
      <div style={{
        position: "absolute", right: 12, bottom: 10,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
        animation: "vhs-pop .5s cubic-bezier(.34,1.56,.64,1) .24s both",
      }}>
        {/* 容量進度條 */}
        <div style={{
          width: 132, background: "rgba(35,20,10,0.55)", backdropFilter: "blur(4px)",
          borderRadius: 8, padding: "4px 7px", border: "1px solid rgba(255,255,255,0.15)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, fontWeight: 900, color: "#FFF8F0", marginBottom: 2 }}>
            <span>⏱️ 已累積 {Math.floor(elapsedSec / 3600)}h{Math.floor((elapsedSec % 3600) / 60)}m</span>
            <span style={{ color: isFull ? "#F59E0B" : "#A0D090" }}>{capacityPct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.2)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4, transition: "width .5s",
              width: `${capacityPct}%`,
              background: isFull ? "linear-gradient(90deg,#F59E0B,#EF4444)" : "linear-gradient(90deg,#6B8E5E,#10B981)",
            }} />
          </div>
        </div>

        {/* 收集按鈕 */}
        <button type="button" onClick={onCollect} disabled={collecting || !hasPending}
          className="active:scale-95 transition-transform"
          style={{
            minWidth: 132, padding: "9px 14px", borderRadius: 16,
            background: hasPending
              ? "linear-gradient(135deg,#5A9E50,#3D7834)"
              : "linear-gradient(135deg,#C9BFA8,#B0A48C)",
            color: hasPending ? "#FFF" : C.muted,
            fontWeight: 900, fontSize: 13, cursor: hasPending ? "pointer" : "default",
            boxShadow: hasPending
              ? "0 5px 16px rgba(90,158,80,0.55), 0 0 0 4px rgba(90,158,80,0.15)"
              : "0 3px 8px rgba(0,0,0,0.25)",
            border: hasPending ? "1.5px solid rgba(255,255,255,0.5)" : "1px solid rgba(0,0,0,0.15)",
            display: "flex", alignItems: "center", gap: 6, justifyContent: "center",
            animation: hasPending ? "vhs-collect-glow 1.6s ease-in-out infinite" : "none",
          }}>
          <span style={{ fontSize: 15 }}>✦</span>
          <span>
            {collecting ? "採集中…"
              : hasPending ? `一鍵採集 +${pendingTotal.toLocaleString()}`
              : (timeStr ? `${timeStr}後` : "已採集")}
          </span>
        </button>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#FFF8F0", textShadow: "0 1px 2px rgba(0,0,0,0.6)", marginTop: -2 }}>
          每 {MAX_COLLECT_HOURS} 小時可領取一次
        </div>
      </div>

      <style>{`
        @keyframes vhs-collect-glow {
          0%,100% { box-shadow: 0 5px 16px rgba(90,158,80,0.5), 0 0 0 3px rgba(90,158,80,0.12); }
          50%     { box-shadow: 0 5px 22px rgba(90,158,80,0.7), 0 0 0 6px rgba(90,158,80,0.22); }
        }
        @keyframes vhs-pulse {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.25); }
        }
        @keyframes vhs-bob {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-3px); }
        }
        @keyframes vhs-fade-in {
          from { opacity: 0; transform: scale(.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes vhs-slide-down {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vhs-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vhs-pop {
          from { opacity: 0; transform: scale(.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vhs-noanim, .vhs-noanim * { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── 秘書貓氣泡（場景內浮動）──────────────────────────────────
function SecretaryBubble({ cat }) {
  const catInfo = CATS[cat.catId];
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isClicking, setIsClicking] = useState(false);

  if (!catInfo) return null;
  const bondLv = getBondLevel(cat.bond || 0);
  const quotes = CAT_DAILY_QUOTES[cat.catId] || ["今天也要加油喔！"];
  const currentQuote = quotes[quoteIdx % quotes.length];

  const handleClick = () => {
    sfxTap();
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 200);
    setQuoteIdx(prev => (prev + 1) % quotes.length);
  };

  return (
    <div onClick={handleClick} role="button" aria-label="秘書貓對話（點擊切換）"
      className="cursor-pointer active:scale-95 transition-transform"
      style={{
        position: "absolute", left: 12, bottom: 10,
        display: "flex", alignItems: "flex-end", gap: 6, maxWidth: "62%",
        animation: "vhs-rise .5s ease-out .16s both",
      }}>
      <div style={{ position: "relative", flexShrink: 0, animation: "vhs-bob 2.6s ease-in-out infinite" }}>
        <img
          src={`/cats/portraits/${cat.catId}.webp`}
          alt={catInfo.name}
          style={{
            width: 46, height: 46, borderRadius: "50%", objectFit: "cover",
            border: `2.5px solid ${C.sage}`, background: catInfo.palette?.light || "#f5e6d0",
            boxShadow: isClicking ? "0 0 12px rgba(107,142,94,0.7)" : "0 3px 8px rgba(0,0,0,0.3)",
          }}
          onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
        />
        <div style={{
          display: "none", width: 46, height: 46, borderRadius: "50%",
          background: catInfo.palette?.light || "#f5e6d0",
          alignItems: "center", justifyContent: "center", fontSize: 22,
          border: `2.5px solid ${C.sage}`,
        }}>🐱</div>
        <div style={{
          position: "absolute", bottom: -2, right: -4,
          background: C.sage, borderRadius: 10, padding: "1px 6px",
          fontSize: 8, fontWeight: 900, color: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>Lv.{bondLv}</div>
      </div>
      <div style={{
        background: "rgba(255,252,244,0.94)", backdropFilter: "blur(4px)",
        borderRadius: "14px 14px 14px 4px", padding: "7px 11px",
        border: `1.5px solid ${C.border}`, color: C.brown,
        fontSize: 11, fontWeight: 700, lineHeight: 1.4, maxWidth: "100%",
        boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
      }}>
        「{currentQuote}」
      </div>
    </div>
  );
}

// ── 採集完成 modal（從舊 ResourceBar 移入）────────────────────
function CollectionResultModal({ collectedResult, onDismiss }) {
  const summary = useMemo(() => buildVillageCollectionResult(collectedResult || {}), [collectedResult]);
  if (summary.totalKinds <= 0) return null;
  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/95 px-4 py-6 text-white backdrop-blur"
      role="dialog" aria-modal="true" aria-labelledby="village-collection-title">
      <style>{`
        @keyframes villageRewardIn {
          from { opacity:0; transform:translateY(14px) scale(.96); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
        .village-reward-item { animation:villageRewardIn .36s both; }
        @media (prefers-reduced-motion: reduce) {
          .village-reward-item { animation:none; }
        }
      `}</style>
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col">
        <header className="relative overflow-hidden rounded-3xl border border-amber-200/25 bg-gradient-to-br from-amber-700 via-orange-900 to-slate-950 p-5 text-center shadow-2xl">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(/ui/cat-village/explore-map.png)", backgroundSize: "cover", backgroundPosition: "center" }} />
          <div className="relative">
            <div className="text-5xl" aria-hidden="true">🧺</div>
            <h2 id="village-collection-title" className="mt-2 text-2xl font-black text-amber-100">採集完成！</h2>
            <p className="mt-1 text-xs font-bold text-amber-200/80">
              帶回 {summary.totalKinds} 種資源・所有獎勵已存入村莊倉庫
            </p>
          </div>
        </header>

        <div className="mt-4 space-y-5">
          {summary.sections.map(section => (
            <section key={section.id}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="text-xl" aria-hidden="true">{section.icon}</span>
                <h3 className="text-sm font-black text-slate-200">{section.label}</h3>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-slate-400">{section.items.length} 項</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {section.items.map((item, index) => (
                  <article key={item.key} className="village-reward-item relative min-h-36 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-3 shadow-lg"
                    style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        <img src={item.art} alt="" className="h-full w-full object-cover"
                          onError={event => { event.currentTarget.style.display = "none"; }} />
                        <span className="flex h-full w-full items-center justify-center text-3xl" aria-hidden="true">{item.icon}</span>
                      </div>
                      {item.tier && <span className="rounded-lg bg-amber-400 px-2 py-1 text-xs font-black text-slate-950">T{item.tier}</span>}
                    </div>
                    <h4 className="mt-2 text-sm font-black leading-tight text-white">{item.name}</h4>
                    <div className="mt-1 text-2xl font-black text-emerald-300">+{item.amount.toLocaleString()}</div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>

        <button type="button" onClick={onDismiss}
          className="sticky bottom-3 mt-6 min-h-14 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-base font-black text-slate-950 shadow-xl transition-transform active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100">
          收下全部資源
        </button>
      </div>
    </div>
  );
}

// ── 智慧排序建築橫條（B：可升級優先 → MAX → 其他，鎖定在尾端）─
function BuildingStrip({ buildings, resources, village, myCats, onBuildingClick }) {
  const unlocked = useMemo(() =>
    BUILDING_LIST.filter(id => isBuildingUnlocked(id, buildings)),
  [buildings]);
  const locked = useMemo(() =>
    BUILDING_LIST.filter(id => !isBuildingUnlocked(id, buildings)),
  [buildings]);

  const sorted = useMemo(() => {
    const rank = id => {
      const st = buildingStatus(id, buildings, resources);
      return st.maxed ? 2 : st.ok ? 0 : 1;
    };
    return [...unlocked].sort((a, b) => {
      const r = rank(a) - rank(b);
      if (r !== 0) return r;
      return (buildings[b] || 1) - (buildings[a] || 1);
    });
  }, [unlocked, buildings, resources]);

  return (
    <div className="px-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-black" style={{ color: C.brown }}>
          🏗️ 村莊建築
        </div>
        <div className="text-[11px] font-black" style={{ color: C.mid }}>
          已解鎖 {unlocked.length} / 9
        </div>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "thin" }}>
        {sorted.map((id, index) => {
          const b = BUILDINGS[id];
          const level = buildings?.[id] || 1;
          const stage = getBuildingStage(level);
          const st = buildingStatus(id, buildings, resources);
          const workerCatId = village?.workers?.[id];
          const workerCatData = workerCatId ? myCats?.[workerCatId] : null;
          const workerCatInfo = workerCatId ? CATS[workerCatId] : null;
          const workerMult = getWorkerCatMultiplier(workerCatData);
          const statusColor = st.maxed ? C.muted : st.ok ? C.sage : "#D4933A";
          return (
            <button key={id} type="button" onClick={() => { sfxTap(); onBuildingClick(id); }}
              className="flex min-h-0 w-[132px] shrink-0 flex-col overflow-hidden rounded-2xl text-left transition-all active:scale-95"
              style={{
                background: "linear-gradient(180deg,#FFFFFF 0%,#FDF6EC 100%)",
                border: st.ok ? "2px solid #F59E0B" : `1.5px solid ${C.border}`,
                boxShadow: st.ok ? "0 6px 20px rgba(245,158,11,0.3)" : "0 4px 12px rgba(92,61,46,0.08)",
                animation: `vhs-rise .45s ease-out ${(0.15 + index * 0.05).toFixed(2)}s both`,
              }}>
              <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#F5EBD8", overflow: "hidden" }}>
                <img src={`/ui/village/building-${id}-stage${stage}.webp`} alt={b.name}
                  width="320" height="240" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  onError={e => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }} />
                <div style={{
                  display: "none", position: "absolute", inset: 0,
                  alignItems: "center", justifyContent: "center", fontSize: "30px",
                }}>{b.emoji}</div>
                <div style={{
                  position: "absolute", top: 5, right: 5,
                  background: "rgba(35,20,10,0.75)", borderRadius: 7, padding: "1px 6px",
                  color: "#FFF8F0", fontWeight: 900, fontSize: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}>Lv.{level}</div>
                {st.ok && (
                  <div style={{
                    position: "absolute", top: 5, left: 5,
                    background: "linear-gradient(135deg,#F59E0B,#EF4444)",
                    borderRadius: 7, padding: "1px 6px", color: "#FFF",
                    fontWeight: 900, fontSize: 9, boxShadow: "0 2px 6px rgba(245,158,11,0.5)",
                  }}>⚡ 可升級</div>
                )}
              </div>
              <div className="p-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs font-black truncate" style={{ color: C.brown }}>
                    {b.emoji} {b.name}
                  </div>
                  {workerCatInfo && (
                    <div className="flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)" }}>
                      <img src={`/cats/portraits/${workerCatId}.webp`} alt="" className="w-3 h-3 rounded-full object-cover" />
                      <span className="text-[9px] font-black text-amber-700">+{Math.round((workerMult - 1) * 100)}%</span>
                    </div>
                  )}
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                  <div className="text-[10px] font-bold truncate" style={{ color: C.mid }}>
                    {b.resourceName}
                  </div>
                  <div className="text-[10px] font-black shrink-0" style={{ color: statusColor }}>
                    ● {st.label}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {locked.map((id, index) => {
          const b = BUILDINGS[id];
          return (
            <div key={id} className="flex w-[132px] shrink-0 flex-col overflow-hidden rounded-2xl"
              style={{
                border: `1px solid ${C.lockBd}`, background: "#EDE0CE",
                animation: `vhs-rise .45s ease-out ${(0.15 + (sorted.length + index) * 0.05).toFixed(2)}s both`,
              }}>
              <div style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
                <img src={`/ui/village/building-${id}-stage1.webp`} alt={b.name} width="320" height="240" loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
                    filter: "grayscale(1) brightness(0.55)" }}
                  onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
                <div style={{
                  display: "none", position: "absolute", inset: 0,
                  alignItems: "center", justifyContent: "center", fontSize: 26,
                  filter: "grayscale(1)", opacity: 0.3,
                }}>{b.emoji}</div>
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                }}>
                  <div style={{ fontSize: 18 }}>🔒</div>
                  <div style={{
                    fontSize: 8, fontWeight: 900, color: "#FFF8F0",
                    background: "rgba(60,35,15,0.65)", borderRadius: 7,
                    padding: "1px 6px", textAlign: "center", maxWidth: "92%",
                  }}>{describeUnlockReq(id)}</div>
                </div>
              </div>
              <div className="p-2">
                <div className="text-xs font-black" style={{ color: C.mid }}>{b.emoji} {b.name}</div>
                <div className="mt-0.5 text-[10px] font-bold" style={{ color: C.muted }}>尚未解鎖</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 村莊廣場（場所入口：攤位卡，點擊跳轉對應功能）─────────────
function PlazaSection({ onNavigate }) {
  return (
    <div className="px-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-black flex items-center gap-1.5" style={{ color: C.brown }}>
          <span>🏮</span> 村莊廣場
        </div>
        <div className="text-[11px] font-black" style={{ color: C.mid }}>想去哪裡？</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {VILLAGE_PLACES.map((item, index) => (
          <button key={item.id} type="button" onClick={() => { sfxTap(); onNavigate(item.id); }}
            className="group relative overflow-hidden rounded-2xl text-left transition-all active:scale-95"
            style={{
              background: "linear-gradient(180deg,#FFFFFF 0%,#FDF6EC 100%)",
              border: `1.5px solid ${C.border}`,
              boxShadow: "0 4px 12px rgba(92,61,46,0.08)",
              animation: `vhs-rise .5s ease-out ${(0.3 + index * 0.07).toFixed(2)}s both`,
            }}>
            {/* 攤位遮陽棚 */}
            <div style={{
              height: 10, width: "100%",
              background: "repeating-linear-gradient(90deg, #E26D5C 0 12px, #FFF3E2 12px 24px)",
              opacity: 0.85,
            }} />
            <div className="flex items-center gap-2.5 p-3">
              <div className="relative shrink-0">
                <CatVillageNavArt name={item.art} size={38} />
                <span style={{
                  position: "absolute", right: -6, bottom: -4, fontSize: 13,
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                }}>{item.emoji}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black leading-tight truncate" style={{ color: C.brown }}>{item.label}</div>
                <div className="text-[10px] font-bold truncate mt-0.5" style={{ color: C.mid }}>{item.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 首頁場景組合 ─────────────────────────────────────────────
export default function VillageHomeScene({
  village, buildings, resources, pending, myCats, secretaryCat,
  villageLevel, displayLv, memberId, collectedResult, collecting,
  onCollect, onDismissCollected, onBuildingClick, onNavigate,
}) {
  return (
    <>
      <div className="px-4 pt-3">
        <PanoramaScene
          village={village}
          villageLevel={villageLevel}
          displayLv={displayLv}
          memberId={memberId}
          buildings={buildings}
          resources={resources}
          pending={pending}
          collecting={collecting}
          onCollect={onCollect}
          secretaryCat={secretaryCat}
        />
      </div>

      <div className="mt-3">
        <PlazaSection onNavigate={onNavigate} />
      </div>

      <div className="mt-3">
        <BuildingStrip
          buildings={buildings}
          resources={resources}
          village={village}
          myCats={myCats}
          onBuildingClick={onBuildingClick}
        />
      </div>

      <CollectionResultModal
        collectedResult={collectedResult}
        onDismiss={onDismissCollected}
      />
    </>
  );
}
