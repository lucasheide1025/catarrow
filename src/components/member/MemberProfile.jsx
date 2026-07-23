// src/components/member/MemberProfile.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateMember, getCertRecords, subscribeMaterials, upgradeEquipSlot } from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import { archerLevelFromXP, archerXPProgress, archerLevelBonus, MAX_ARCHER_LEVEL, TOTAL_XP_TO_MAX, getLevelStyle } from "../../lib/archerLevel";
import { getCohort, cohortLabel } from "../../lib/cohort";
import { calcAge, formatArcherNo, BOW_TYPES, getCertLevel, certLevelStyle, EQUIP_SLOT_DEFS, EQUIP_GRADES, getEquipSlotBonus } from "../../lib/constants";
import { KING_SEAL_BREAKTHROUGH_COST, EQUIP_UPGRADE_COST } from "../../lib/equipData";
import { WB_CARDS } from "../../lib/worldBossCards";
import { Card, Btn, Inp, ST, BadgePip } from "../shared/UI";
import { auth } from "../../lib/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { APP_THEMES } from "../../lib/theme";
import { getSoundEnabled, setSoundEnabled, getAnimEnabled, setAnimEnabled } from "../../lib/fxSettings";
import { sfxTap, sfxLevelUp } from "../../lib/sound";
import { PlayerAvatar, PLAYER_AVATAR_OPTIONS } from "../shared/PlayerAvatar";
import { calcArcherStats } from "../../lib/monsterData";
import { calcEquippedBonus, resolveEquippedCards, TIER_CARD_BONUS } from "../../lib/monsterCards";
import CardArtImage from "./cards/CardArt";
import EquipmentIcon from "../shared/EquipmentIcon";
import { MATERIALS } from "../../lib/monsterMaterials";
import { EXPANSION_MATERIALS } from "../../lib/monsterExpansionCatalog";

// 材料名稱查詢：涵蓋 legacy 家族素材（ghost_m4…）與擴充素材（mat_ghost_t4_normal_a…）。
// ⚠️ MATERIALS 是「陣列」不是 map，舊碼寫 MATERIALS[id] 永遠 undefined → 顯示原始 ID。
const MATERIAL_BY_ID = {};
[...MATERIALS, ...EXPANSION_MATERIALS].forEach(m => { if (m?.id && !MATERIAL_BY_ID[m.id]) MATERIAL_BY_ID[m.id] = m; });

// 專精與解鎖
import { SPECIALIZATION_TRACKS } from "../../lib/equipmentSpecializationCatalog";
import { getSpecializationEffect } from "../../lib/equipmentSpecializationEngine";
import { getEquipSpecializations } from "../../lib/equipSpecializationDb";

// 圖鑑常數
import { COLLECTIBLE_MAP } from "../../lib/dungeonCollectibles";
import { CAT_CARDS } from "../../lib/catCardData";

const CERT_SHOW = ["recurve_bare", "compound", "traditional"];
const HALF_LABEL = { first:"上半年", second:"下半年" };

const SLOTS = [
  { id: "weapon", label: "🏹 武器專精", color: "#f59e0b" },
  { id: "armor", label: "🛡️ 防具專精", color: "#38bdf8" },
  { id: "accessory", label: "💍 飾品專精", color: "#a78bfa" },
];

function effectText(trackId, level) {
  const e = getSpecializationEffect(trackId, level);
  switch (trackId) {
    case "precision": return `高品質命中傷害 +${e.highQualityDamagePct}%`;
    case "armorBreak": return `無視怪物防禦 ${e.defenseIgnorePct}%`;
    case "bossHunter": return `對王類傷害 +${e.bossDamagePct}%`;
    case "tenacity": return `受到傷害 -${e.finalDamageReductionPct}%`;
    case "immunity": return `異常強度 -${e.statusStrengthReductionPct}%${e.statusDurationReduction ? `、回合 -${e.statusDurationReduction}` : ""}`;
    case "guard": return `HP≤35% 時受傷 -${e.finalDamageReductionPct}%`;
    case "nutrition": return `最大 HP +${e.maxHpFlat}`;
    case "wellRested": return `回合末回復 ${e.endRoundHeal} HP`;
    case "support": return `貓咪攻擊/治療 +${e.companionAttackPct}%`;
    default: return "";
  }
}

// ── 主題定義 ──
const CARD_THEMES = [
  { id:"cosmos",  label:"宇宙黑", bg:"linear-gradient(135deg,#0f172a,#1e1b4b)" },
  { id:"ocean",  label:"深海藍", bg:"linear-gradient(135deg,#1d4ed8,#1e3a8a)" },
  { id:"night",  label:"暗夜紫", bg:"linear-gradient(135deg,#4c1d95,#312e81)" },
  { id:"forest", label:"森林綠", bg:"linear-gradient(135deg,#065f46,#14532d)" },
  { id:"fire",   label:"烈火紅", bg:"linear-gradient(135deg,#9f1239,#7f1d1d)" },
  { id:"desert", label:"沙漠金", bg:"linear-gradient(135deg,#92400e,#78350f)" },
  { id:"aurora", label:"極光粉", bg:"linear-gradient(135deg,#be185d,#7e22ce)" },
  { id:"steel",  label:"鋼鐵灰", bg:"linear-gradient(135deg,#374151,#1f2937)" },
  { id:"bluebay", label:"藍灣綠", bg:"linear-gradient(135deg,#00a1b4,#097988)"},
  { id: "bluebay1", label: "紅月豔", bg: "linear-gradient(135deg, #B91C1C 0%, #E11D48 25%, #9333EA 55%, #2563EB 80%, #06B6D4 100%)", dot: "#ff0000" }
];

function useCardTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("archerCardTheme") || "cosmos"; } catch { return "cosmos"; }
  });
  function setTheme(id) {
    setThemeState(id);
    try { localStorage.setItem("archerCardTheme", id); } catch {}
  }
  return [theme, setTheme];
}

export default function MemberProfile({
  onPageChange, appTheme, onAppThemeChange,
  certification = null,
  dexConfig = { physicalMax:10, pointMax:10 }, dexGrants = [],
  duelStats = null, monsterDex = {}, craftStats = {}, chestStats = {},
  potionDex = {}, cardData = { cards:{}, equipped:[] }
}) {
  const { profile } = useAuth();
  const [certRecords,    setCertRecords]   = useState([]);
  const [showHistory,   setShowHistory]   = useState(false);
  const [cardTheme,     setCardTheme]     = useCardTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  // 裝備與專精
  const [matInv, setMatInv] = useState({});
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [upgradingSlot, setUpgradingSlot] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [specializations, setSpecializations] = useState(null);

  useEffect(() => {
    if (profile?.id) {
      getCertRecords(profile.id).then(setCertRecords).catch(() => {});
      getEquipSpecializations(profile.id).then(setSpecializations).catch(() => {});
      return subscribeMaterials(profile.id, setMatInv);
    }
  }, [profile?.id]);

  const thisYear = new Date().getFullYear();

  // 世界王卡稱號
  const titleKey = cardData?.activeTitleBossKey || null;
  const activeTitle = titleKey
    ? (cardData?.wbCards?.[titleKey]?.title || WB_CARDS[titleKey]?.title || "")
    : "";

  function buildGroups() {
    const g = {};
    certRecords.forEach(r => {
      const key = `${r.year}_${r.half || "first"}`;
      if (!g[key]) g[key] = { year:r.year, half:r.half||"first", scores:{} };
      const prev = g[key].scores[r.bowType] || 0;
      if ((r.score||0) > prev) g[key].scores[r.bowType] = r.score||0;
    });
    return g;
  }
  const groups = buildGroups();
  const sortedKeys = Object.keys(groups).sort((a,b) => {
    const ga = groups[a], gb = groups[b];
    if (gb.year !== ga.year) return gb.year - ga.year;
    return (gb.half==="second"?1:0) - (ga.half==="second"?1:0);
  });
  const thisYearKeys = sortedKeys.filter(k => groups[k].year === thisYear);
  const pastKeys     = sortedKeys.filter(k => groups[k].year !== thisYear);

  function CertBlock({ g }) {
    return (
      <div className="mb-3 last:mb-0">
        <div className="text-white/70 text-xs font-bold mb-2">{g.year}年{HALF_LABEL[g.half]}</div>
        <div className="grid grid-cols-3 gap-3">
          {CERT_SHOW.map(bk => {
            const bt = BOW_TYPES[bk];
            const score = g.scores[bk] || 0;
            const level = getCertLevel(bk, score);
            return <CertChip key={bk} name={bt.short} score={score} level={level} />;
          })}
        </div>
      </div>
    );
  }

  const quickLinkGroups = [
    {
      title: "📌 常用功能",
      links: [
        { id:"learn",    icon:"📓", label:"學習紀錄",  desc:"查看教練回饋" },
        { id:"history",  icon:"📊", label:"成績歷史", desc:"所有參賽紀錄" },
        { id:"notifications", icon:"🔔", label:"訊息中心", desc:"公告與祝賀" },
      ],
    },
    {
      title: "🎖️ 檢定與申報",
      links: [
        { id:"certexam", icon:"🎖️", label:"射手證考試", desc:"檢定・級別晉升" },
        { id:"external", icon:"🏅", label:"對外比賽", desc:"申報外部成績" },
      ],
    },
    {
      title: "✉️ 溝通與設定",
      links: [
        { id:"msgs",       icon:"✉️", label:"留言教練", desc:"傳送訊息給教練" },
        { id:"bowsetting", icon:"🏹", label:"我的弓具", desc:"弓具・防具・配件設定" },
        { id:"guide",      icon:"📘", label:"使用說明", desc:"系統操作指引" },
      ],
    },
  ];

  const currentTheme = CARD_THEMES.find(t => t.id === cardTheme) || CARD_THEMES[0];

  async function chooseAvatar(avatarId) {
    if (!profile?.id || avatarSaving || avatarId === profile.avatarId) return;
    setAvatarSaving(true);
    try {
      await updateMember(profile.id, { avatarId }, profile.id);
    } finally {
      setAvatarSaving(false);
    }
  }

  // ── 數值與加成計算 ──
  const xp = profile?.archerXP || 0;
  const { level: archerLv, current, needed, pct } = archerXPProgress(xp);
  const lvBonus = archerLevelBonus(archerLv);
  const cardBonus = calcEquippedBonus(resolveEquippedCards(cardData));
  const ds = computeDexStats({
    member: profile, certification, certRecords,
    checkinCount: profile?.dailyQuestCount || 0,
    granted: dexGrants, physicalMax: dexConfig.physicalMax, pointMax: dexConfig.pointMax,
    monsterDex, craftStats, chestStats, potionDex, cardData, duelStats
  });
  const baseStats = calcArcherStats({ member: profile, certification, certRecords, dexStats: ds });
  const totalHP  = baseStats.hp  + lvBonus.hp  + cardBonus.hp;
  const totalATK = baseStats.atk + lvBonus.atk + cardBonus.atk;
  const totalDEF = baseStats.def + lvBonus.def + cardBonus.def;

  const totalXPToMax = TOTAL_XP_TO_MAX;
  const rpgEquip = profile?.rpgEquip || {};

  // 夥伴與卡片解析 (修正貓咪讀取 bug，應讀取 profile?.equippedCat?.catId)
  const activeCatId = profile?.equippedCat?.catId || null;
  const equippedCards = resolveEquippedCards(cardData);

  // ── 裝備升級與卸下事件 ──
  async function handleUpgrade() {
    if (!selectedSlot || !profile?.id || upgradingSlot) return;
    const slotDef = selectedSlot;
    const currentEquip = rpgEquip[slotDef.id] || {};
    const grade = currentEquip.grade || "common";
    const plus = currentEquip.plusLevel || 0;

    setUpgradingSlot(true);
    setUpgradeError("");

    try {
      let curMats = currentEquip.nextMats;
      const { generateRandomMats, isMatsCurveCurrent } = await import("../../lib/equipData");
      const { saveEquipNextMats } = await import("../../lib/db");
      
      if (!curMats || !isMatsCurveCurrent(curMats, grade, plus)) {
        curMats = generateRandomMats(grade, plus);
        await saveEquipNextMats(profile.id, slotDef.id, curMats);
      }

      const result = await upgradeEquipSlot(profile.id, slotDef.id, {
        equip: currentEquip,
        coins: profile.coins || 0,
        kingSeals: profile.kingSeals || 0,
        matItems: matInv,
        nextMats: curMats
      });

      if (!result.ok) {
        setUpgradeError(result.reason || "強化失敗");
        sfxTap();
      } else {
        sfxLevelUp();
        setSelectedSlot(null);
      }
    } catch (e) {
      setUpgradeError(e?.message || "強化異常");
    } finally {
      setUpgradingSlot(false);
    }
  }

  async function handleUnequip() {
    if (!selectedSlot || !profile?.id) return;
    const slotDef = selectedSlot;
    try {
      const { unequipSlot } = await import("../../lib/db");
      await unequipSlot(profile.id, slotDef.id);
      setSelectedSlot(null);
    } catch (e) {
      setUpgradeError("卸下失敗：" + e?.message);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-5 overflow-x-hidden animate-fade-in" style={{ minHeight:"100%", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      
      {/* ── CSS 動畫與流光定義 ── */}
      <style>{`
        @keyframes profile-fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: profile-fade-in-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .delay-75 { animation-delay: 75ms; }
        .delay-150 { animation-delay: 150ms; }
        .delay-225 { animation-delay: 225ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-375 { animation-delay: 375ms; }

        @keyframes anti-counterfeit-shine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .royal-card-shine::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            125deg,
            rgba(255, 255, 255, 0) 30%,
            rgba(255, 0, 128, 0.08) 38%,
            rgba(0, 255, 255, 0.12) 45%,
            rgba(255, 255, 0, 0.08) 52%,
            rgba(255, 255, 255, 0) 60%
          );
          background-size: 300% 300%;
          animation: anti-counterfeit-shine 7s ease infinite;
          pointer-events: none;
          mix-blend-mode: color-dodge;
          z-index: 5;
        }

        @keyframes wave-move {
          0% { transform: translateX(0) translateZ(0) scaleY(1); }
          50% { transform: translateX(-25%) translateZ(0) scaleY(0.9); }
          100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
        }
        .liquid-wave {
          animation: wave-move 8s linear infinite;
        }

        @keyframes float-bubble {
          0% { transform: translateY(100%) scale(0.6); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translateY(-20%) scale(1); opacity: 0; }
        }
        .bubble-particle {
          animation: float-bubble 4s ease-in-out infinite;
        }

        /* 3D Flip Card Styles */
        .perspective-1000 {
          perspective: 1000px;
        }
        .card-flipper {
          transition: transform 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-style: preserve-3d;
          position: relative;
        }
        .card-flipped {
          transform: rotateY(180deg);
        }
        .card-front, .card-back {
          backface-visibility: hidden;
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .card-back {
          transform: rotateY(180deg);
        }
      `}</style>

      {/* ── 大頭貼選擇彈窗 ── */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 max-w-sm w-full shadow-2xl relative animate-fade-in-up">
            <button onClick={() => setShowAvatarPicker(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm font-bold">✕</button>
            <ST>選擇冒險者大頭貼</ST>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">僅作為個人資料的小頭貼，不影響您的戰鬥角色 🏹</p>
            <div className="mt-5 grid grid-cols-4 gap-3 justify-items-center">
              {PLAYER_AVATAR_OPTIONS.map(option => {
                const selected = profile?.avatarId === option.id;
                return (
                  <button key={option.id} type="button" disabled={avatarSaving}
                    onClick={() => { chooseAvatar(option.id); setShowAvatarPicker(false); }}
                    className="rounded-full p-0.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                    style={{ border:selected ? "2px solid #fbbf24" : "2px solid transparent", boxShadow:selected ? "0 0 10px rgba(251,191,36,0.35)" : "none" }}>
                    <PlayerAvatar option={option} avatarId={option.id} size={48} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 裝備升級/詳細資訊彈窗 (點擊裝備槽位時觸發，支援手機端與直升功能) ── */}
      {selectedSlot && (() => {
        const slotDef = selectedSlot;
        const equipped = rpgEquip[slotDef.id] || {};
        const isEmpty = !equipped.itemId;
        const grade = equipped.grade || "common";
        const plus = equipped.plusLevel || 0;
        const idx = EQUIP_GRADES.findIndex(x => x.id === grade);
        const isMax = idx >= (EQUIP_GRADES.length - 1) && plus >= 4;
        const cost = EQUIP_UPGRADE_COST[grade];
        
        const mats = equipped.nextMats || {};
        const currentBonus = getEquipSlotBonus(slotDef, equipped);
        const nextGrade = plus >= 4 ? EQUIP_GRADES[idx + 1]?.id : grade;
        const nextEquip = nextGrade ? { ...equipped, grade: nextGrade, plusLevel: plus >= 4 ? 0 : plus + 1 } : null;
        const nextBonus = nextEquip ? getEquipSlotBonus(slotDef, nextEquip) : currentBonus;
        
        const myCoins = profile?.coins || 0;
        const mySeals = profile?.kingSeals || 0;
        
        const coinsOk = !cost || myCoins >= cost.gold;
        const matsOk = !mats.materials || mats.materials.every(m => (matInv[m.id] || 0) >= m.count);
        const sealCost = plus >= 4 && nextGrade ? (KING_SEAL_BREAKTHROUGH_COST[nextGrade] || 0) : 0;
        const sealsOk = mySeals >= sealCost;
        const canUpgrade = coinsOk && matsOk && sealsOk;
        const gConf = EQUIP_GRADES.find(x => x.id === grade) || EQUIP_GRADES[0];
        
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4" onClick={() => setSelectedSlot(null)}>
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 max-w-sm w-full shadow-2xl relative animate-fade-in-up" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedSlot(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm font-bold">✕</button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl border flex items-center justify-center bg-slate-950" style={{ borderColor: gConf.color }}>
                  <EquipmentIcon slotId={slotDef.id} size={36} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{slotDef.name}</h3>
                  <div className="text-[10px] text-slate-400">
                    {slotDef.stat === "hp" ? "❤️ 生命" : slotDef.stat === "atk" ? "⚔️ 攻擊" : "🛡️ 防禦"}屬性裝備
                  </div>
                </div>
              </div>
              
              {isEmpty ? (
                <div className="text-center py-6">
                  <span className="text-3xl opacity-40">🏪</span>
                  <p className="mt-3 text-xs text-slate-400 font-bold leading-relaxed">
                    目前該槽位沒有裝備物品。<br />請先前往金幣商店取得該部位物品！
                  </p>
                  <button onClick={() => { setSelectedSlot(null); onPageChange("coinshop"); }} className="mt-5 bg-amber-500 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl hover:bg-amber-400 active:scale-95 transition-all">
                    前往金幣商店 ›
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 當前資訊 */}
                  <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs font-black" style={{ color: gConf.color }}>{gConf.name}{slotDef.name} {plus > 0 ? `+${plus}` : ""}</span>
                      <span className="text-xs font-black text-slate-300">加成 +{currentBonus}</span>
                    </div>
                    {!isMax && (
                      <div className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded w-fit">
                        下次升級：+{currentBonus} → +{nextBonus}（提升 +{nextBonus - currentBonus}）
                      </div>
                    )}
                  </div>
                  
                  {/* 升級材料要求 */}
                  {!isMax ? (
                    <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 space-y-2">
                      <div className="text-[10px] font-black text-slate-400 border-b border-white/5 pb-1.5 mb-2 flex justify-between">
                        <span>⚒️ 升級材料要求</span>
                        <span>金幣：🪙 {myCoins}</span>
                      </div>
                      
                      {cost && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">金幣消耗</span>
                          <span className={`font-black ${coinsOk ? "text-slate-200" : "text-red-400"}`}>
                            🪙 {cost.gold} {coinsOk ? "" : " (不足)"}
                          </span>
                        </div>
                      )}
                      
                      {sealCost > 0 && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-bold">王之印記</span>
                          <span className={`font-black ${sealsOk ? "text-amber-400" : "text-red-400"}`}>
                            👑 {sealCost} / 目前 {mySeals} {sealsOk ? "" : " (不足)"}
                          </span>
                        </div>
                      )}
                      
                      {mats.materials?.map(m => {
                        const haveCount = matInv[m.id] || 0;
                        const info = MATERIAL_BY_ID[m.id];
                        const name = info ? `${info.icon || "🧩"} ${info.name}` : m.id;
                        const isOk = haveCount >= m.count;
                        return (
                          <div key={m.id} className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold truncate max-w-[150px]">{name}</span>
                            <span className={`font-black ${isOk ? "text-slate-200" : "text-red-400"}`}>
                              {haveCount} / {m.count} {isOk ? "✓" : " (不足)"}
                            </span>
                          </div>
                        );
                      })}
                      
                      {upgradeError && (
                        <div className="text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded mt-2">
                          ⚠️ 錯誤：{upgradeError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs font-bold text-amber-300">
                      🎉 該裝備已強化至極限（MAX）！
                    </div>
                  )}
                  
                  {/* 按鈕 */}
                  <div className="flex gap-2">
                    {!isMax && (
                      <button type="button" disabled={upgradingSlot || !canUpgrade} onClick={handleUpgrade}
                        className="flex-1 min-h-10 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 disabled:opacity-40 active:scale-95 transition-all">
                        {upgradingSlot ? "強化中..." : "確認進行強化 🔨"}
                      </button>
                    )}
                    <button type="button" disabled={upgradingSlot} onClick={handleUnequip}
                      className="px-4 min-h-10 rounded-xl border border-red-500/30 text-red-400 font-bold text-xs hover:bg-red-500/10 active:scale-95 transition-all">
                      卸下裝備
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

  {/* ── 頂部：狀態卡（可換主題與防偽流光）── */}
  <div className="p-5 border border-white/10 text-white relative overflow-hidden rounded-[2rem] shadow-xl royal-card-shine animate-fade-in-up"
    style={{ background: currentTheme.bg }}>

    {/* 宇宙黑：星星 */}
    {cardTheme === "cosmos" && (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_,i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{ width:Math.random()*2+1+"px", height:Math.random()*2+1+"px",
              top:Math.random()*100+"%", left:Math.random()*100+"%",
              opacity:Math.random()*0.7+0.3 }} />
        ))}
      </div>
    )}

    <div className="relative z-10">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-white/60 text-xs mb-0.5 tracking-wider">ADVENTURER</div>
          <div className="font-black text-2xl tracking-wide flex items-center gap-2">
            {profile?.nickname || profile?.name}
          </div>
          {activeTitle && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full text-amber-100"
              style={{ background:"linear-gradient(120deg,#b45309,#f59e0b,#fde68a,#f59e0b)", backgroundSize:"300% 300%", boxShadow:"0 0 6px rgba(251,191,36,0.55)" }}>
              👑 {activeTitle}
            </div>
          )}
          <div className="text-white/70 text-sm mt-1">本名：{profile?.name}</div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 調色盤 */}
          <div className="relative">
            <button onClick={() => setShowThemePicker(v => !v)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-lg border border-white/15"
              title="更換主題">🎨</button>
            {showThemePicker && (
              <div className="absolute right-0 top-10 z-50 rounded-2xl p-3 w-52 bg-slate-950 border border-slate-800 shadow-2xl">
                <div className="text-slate-400 text-xs font-bold mb-2 px-1">🃏 卡片主題</div>
                <div className="grid grid-cols-4 gap-2">
                  {CARD_THEMES.map(t => (
                    <button key={t.id} onClick={() => { setCardTheme(t.id); setShowThemePicker(false); }}
                      title={t.label}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all active:scale-90"
                      style={{ background:cardTheme===t.id?"rgba(124,58,237,0.25)":"transparent", border:cardTheme===t.id?"2px solid #7c3aed":"2px solid transparent" }}>
                      <div className="w-7 h-7 rounded-full" style={{ background:t.bg }} />
                      <span className="text-slate-300 text-[9px] font-bold leading-tight text-center">{t.label}</span>
                    </button>
                  ))}
                </div>
                {onAppThemeChange && APP_THEMES.length > 1 && (
                  <>
                    <div className="border-t border-white/10 my-2" />
                    <div className="text-slate-400 text-xs font-bold mb-2 px-1">🎨 App 主題</div>
                    <div className="flex gap-2 justify-center">
                      {APP_THEMES.map(t => (
                        <button key={t.id} onClick={() => { onAppThemeChange(t.id); setShowThemePicker(false); }}
                          title={t.label}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all active:scale-90"
                          style={{ background:appTheme?.id===t.id?"rgba(124,58,237,0.25)":"transparent", border:appTheme?.id===t.id?"2px solid #7c3aed":"2px solid transparent" }}>
                          <div className="w-8 h-8 rounded-full shadow-sm" style={{ background:`linear-gradient(135deg,${t.preview[0]},${t.preview[1]})` }} />
                          <span className="text-slate-300 text-[9px] font-bold leading-tight text-center">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* 大頭貼 (點擊開啟彈窗選擇) */}
          <div onClick={() => setShowAvatarPicker(true)} className="cursor-pointer group relative rounded-full overflow-hidden border-2 border-white/55 shadow-lg active:scale-95 transition-transform">
            {profile?.avatarId ? (
              <PlayerAvatar avatarId={profile.avatarId} size={54} />
            ) : (
              <div className="text-5xl p-1">🏹</div>
            )}
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white font-black">
              修改
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-white/60 text-xs border-t border-white/10 pt-3 mt-2">
        <div className="flex justify-between">
          <span>加入日期：{profile?.joinDate}</span>
          <span>射齡：{calcAge(profile?.joinDate)}{getCohort(profile?.joinDate) != null ? `　${cohortLabel(getCohort(profile?.joinDate))}` : ""}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-3">
            <span>🎖️ 圖鑑 {ds.totalUnlocked}/{ds.totalAll}</span>
            {(ds.gold+ds.silver+ds.bronze)>0 && <span className="text-slate-200">🥇{ds.gold} 🥈{ds.silver} 🥉{ds.bronze}</span>}
          </div>
          {(profile?.coins || 0) > 0 && <span className="text-yellow-300 font-black flex items-center gap-1">🪙 {profile.coins}</span>}
        </div>
      </div>
    </div>
  </div>

  {/* ── 核心：角色狀態與配裝面板 ── */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up delay-75">
    
    {/* 屬性面板 */}
    <Card className="p-5 flex flex-col gap-4 border border-white/5" style={{ background:"rgba(15,23,42,0.64)", backdropFilter:"blur(12px)" }}>
      <ST>⚔️ 冒險者戰鬥屬性</ST>
      <div className="space-y-3.5">
        {/* HP Bar */}
        <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 shadow-inner hover:border-emerald-500/20 transition-colors">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-black text-slate-300">❤️ 生命值 (HP)</span>
            <span className="text-sm font-black text-emerald-400">{totalHP}</span>
          </div>
          <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
            <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totalHP / 800) * 100)}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between font-bold">
            <span>基礎 {baseStats.hp}</span>
            <span>修煉 +{lvBonus.hp}</span>
            <span>卡牌 +{cardBonus.hp}</span>
          </div>
        </div>
        
        {/* ATK Bar */}
        <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 shadow-inner hover:border-orange-500/20 transition-colors">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-black text-slate-300">⚔️ 攻擊力 (ATK)</span>
            <span className="text-sm font-black text-orange-400">{totalATK}</span>
          </div>
          <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
            <div className="h-full bg-gradient-to-r from-orange-600 to-red-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totalATK / 160) * 100)}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between font-bold">
            <span>基礎 {baseStats.atk}</span>
            <span>修煉 +{lvBonus.atk}</span>
            <span>卡牌 +{cardBonus.atk}</span>
          </div>
        </div>
        
        {/* DEF Bar */}
        <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 shadow-inner hover:border-blue-500/20 transition-colors">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-black text-slate-300">🛡️ 防禦力 (DEF)</span>
            <span className="text-sm font-black text-blue-400">{totalDEF}</span>
          </div>
          <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
            <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totalDEF / 120) * 100)}%` }} />
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5 flex justify-between font-bold">
            <span>基礎 {baseStats.def}</span>
            <span>修煉 +{lvBonus.def}</span>
            <span>卡牌 +{cardBonus.def}</span>
          </div>
        </div>
      </div>
    </Card>

    {/* 裝備插槽欄位 (點擊開啟 Upgrade 彈窗) */}
    <Card className="p-5 flex flex-col gap-3 border border-white/5" style={{ background:"rgba(15,23,42,0.64)", backdropFilter:"blur(12px)" }}>
      <div className="flex items-center justify-between">
        <ST>🎒 角色配裝面板</ST>
        <span className="text-[10px] font-bold text-slate-400">點選欄位可直接進行強化 🔨</span>
      </div>
      
      <div className="grid grid-cols-5 gap-3 mt-1.5 justify-items-center">
        {EQUIP_SLOT_DEFS.map(slotDef => {
          const equipped = rpgEquip[slotDef.id] || {};
          const hasItem = !!equipped.itemId;
          const grade = equipped.grade || "common";
          const plus = equipped.plusLevel || 0;
          const gConf = EQUIP_GRADES.find(x => x.id === grade) || EQUIP_GRADES[0];
          
          return (
            <button key={slotDef.id} type="button" onClick={() => setSelectedSlot(slotDef)}
              className="relative group/slot flex flex-col items-center focus:outline-none">
              
              {/* Slot box */}
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center relative cursor-pointer overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 ${
                hasItem ? "" : "border-slate-800 bg-slate-950/20 opacity-35 border-dashed"
              }`}
              style={hasItem ? {
                borderColor: gConf.color,
                background: `linear-gradient(135deg, ${gConf.color}15 0%, #0c0f17 100%)`,
                boxShadow: `0 0 10px ${gConf.glow}20`
              } : undefined}>
                
                <EquipmentIcon slotId={slotDef.id} size={38} className={hasItem ? "brightness-110" : "grayscale opacity-60"} />
                
                {hasItem && plus > 0 && (
                  <span className="absolute top-0.5 right-1 text-[8px] font-black text-amber-300 px-1 bg-slate-950/80 rounded border border-amber-500/20 shadow scale-90 origin-top-right">
                    +{plus}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-slate-500 font-bold mt-1 scale-90">{slotDef.name}</span>
            </button>
          );
        })}
      </div>
    </Card>

  </div>

  {/* ── 中段：已裝備夥伴與卡牌 ── */}
  <Card className="p-5 flex flex-col gap-4 border border-white/5 animate-fade-in-up delay-150" style={{ background:"rgba(15,23,42,0.64)", backdropFilter:"blur(12px)" }}>
    <ST>🐱 夥伴與已裝備卡牌</ST>
    <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-stretch">
      
      {/* 左：陪練貓貓小卡 */}
      <div className="flex-1 w-full bg-slate-950/40 border border-white/5 rounded-2xl p-3.5 flex items-center gap-4">
        {activeCatId ? (
          <>
            <div className="w-14 h-18 rounded-lg overflow-hidden border border-amber-500/30 shrink-0 bg-indigo-950/50">
              <img
                src={`/cats/portraits/${activeCatId}.webp`}
                alt={activeCatId}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-[10px] font-black text-indigo-400">當前出戰陪練貓</div>
              <div className="text-white font-black text-base mt-0.5">
                {activeCatId === "baobao" ? "寶寶" : activeCatId === "daming" ? "大娘" : activeCatId === "diandian" ? "顛顛" : activeCatId === "gege" ? "哥哥" : activeCatId === "haji" ? "哈吉" : activeCatId === "meimei" ? "妹妹" : activeCatId === "niuniu" ? "妞妞" : activeCatId === "xiaoan" ? "小安" : "悠悠"}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                提供主動戰鬥技能與額外的屬性加持！
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-slate-500">
            <span className="text-2xl">🐱</span>
            <span className="text-xs font-bold mt-1.5">尚未攜帶任何陪練貓</span>
          </div>
        )}
      </div>

      {/* 右：裝備卡牌展示區域 */}
      <div className="flex-1 w-full bg-slate-950/40 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-center">
        <div className="text-[10px] font-black text-slate-400 mb-2 flex justify-between">
          <span>已裝備卡片圖鑑 ({equippedCards.length} 張)</span>
          <button onClick={() => onPageChange("cards")} className="text-[9px] text-violet-300 font-bold hover:underline">
            調整卡牌 ›
          </button>
        </div>
        
        {equippedCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-4 text-slate-500 border border-dashed border-slate-800 rounded-xl">
            <span className="text-xl">🎴</span>
            <span className="text-[9px] font-bold mt-1">尚未裝備任何卡片</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-start items-center max-h-[140px] overflow-y-auto pr-1">
            {equippedCards.map((card, idx) => {
              const tierConf = TIER_CARD_BONUS[card.tier] || TIER_CARD_BONUS.common;
              const isWB = card.tier === "worldboss";
              
              return (
                <div key={`${card.id || card.key || idx}`} className="relative group hover:scale-105 transition-transform duration-300" title={card.name}>
                  {/* Card Border with rarity color and subtle neon shadow */}
                  <div className="w-12 h-16 rounded-lg overflow-hidden border-2 relative shadow"
                    style={{
                      borderColor: tierConf.color,
                      boxShadow: `0 0 8px ${tierConf.color}35`,
                    }}>
                    <CardArtImage view={{ ...card, owned: true }} />
                    <div className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5 bg-black/60 text-center py-0.5">
                      {isWB ? (
                        <span className="text-[6px] text-yellow-300 font-black">WB</span>
                      ) : (
                        Array.from({ length: card.stars || 1 }).map((_, s) => (
                          <span key={s} className="text-[6px] text-amber-300">★</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </Card>

  {/* ── ⚒️ 裝備專精技能 ── */}
  <Card className="p-5 border border-white/5 animate-fade-in-up delay-150" style={{ background:"rgba(15,23,42,0.64)", backdropFilter:"blur(12px)" }}>
    <div className="flex items-center justify-between">
      <ST>⚒️ 當前裝備專精技能</ST>
      <button onClick={() => onPageChange("equipment")} className="text-[10px] font-bold text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-lg active:scale-95">
        管理專精頁面 ›
      </button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
      {SLOTS.map(slot => {
        const activeTrackId = specializations?.[slot.id]?.activeTrackId;
        const track = SPECIALIZATION_TRACKS.find(t => t.id === activeTrackId);
        const level = specializations?.[slot.id]?.tracks?.[activeTrackId]?.level || 0;
        
        return (
          <div key={slot.id} className="bg-slate-950/40 border border-white/5 rounded-2xl p-3 flex flex-col justify-between hover:border-slate-800 transition-colors">
            <div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: `${slot.color}15`, color: slot.color, border: `1px solid ${slot.color}25` }}>
                {slot.label}
              </span>
              {track ? (
                <div className="mt-2.5">
                  <div className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                    {track.name} <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Lv.{level}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-bold">
                    🔮 效果：{effectText(activeTrackId, level)}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500 mt-4 font-bold italic">
                  尚未啟用任何專精
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </Card>

  {/* ── 射手證與檢定歷史 ── */}
  <div className="animate-fade-in-up delay-225">
    <ArcherCard profile={profile} certification={certification} onExam={() => onPageChange("certexam")} />
  </div>

  {/* 年度檢定 */}
  <Card className="p-4 border border-white/5 animate-fade-in-up delay-225" style={{ background:"rgba(15,23,42,0.55)" }}>
    <ST>🎖️ 年度檢定級別</ST>
    {thisYearKeys.length === 0 ? (
      <div className="grid grid-cols-3 gap-3 mt-1">
        {CERT_SHOW.map(bk => {
          const bt = BOW_TYPES[bk];
          return <CertChip key={bk} name={bt.short} score={0} level={null} />;
        })}
      </div>
    ) : (
      <div className="mt-1">{thisYearKeys.map(k => <CertBlock key={k} g={groups[k]} />)}</div>
    )}
    {pastKeys.length > 0 && (
      <div className="mt-2 border-t border-white/20 pt-2">
        <button onClick={() => setShowHistory(!showHistory)} className="text-white/60 text-xs font-bold flex items-center gap-1">
          {showHistory ? "▲ 收起歷年檢定成績" : "▼ 查看歷年檢定成績"}
        </button>
        {showHistory && (
          <div className="mt-3">{pastKeys.map(k => <CertBlock key={k} g={groups[k]} />)}</div>
        )}
      </div>
    )}
  </Card>

  {/* ── 射手修煉等級 (液態經驗條) ── */}
  <Card className="p-4 border border-white/5 animate-fade-in-up delay-225" style={{ background:"rgba(15,23,42,0.55)" }}>
    <ST>⚔️ 射手修煉等級</ST>
    <div className="flex items-center justify-between mb-3 mt-1">
      <div>
        <div style={{
          fontSize: 16,
          fontWeight: 900,
          padding: "3px 14px",
          borderRadius: "99px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          display: "inline-block",
          marginBottom: 4,
          ...getLevelStyle(archerLv)
        }}>
          Lv. {archerLv}
        </div>
        <div className="text-slate-400 text-[10px] mt-0.5">已累積 {xp.toLocaleString()} XP</div>
      </div>
      
      <div className="flex gap-3 text-right text-[11px] font-bold">
        <span style={{ color:"#86efac" }}>HP +{lvBonus.hp}</span>
        <span style={{ color:"#fca5a5" }}>ATK +{lvBonus.atk}</span>
        <span style={{ color:"#93c5fd" }}>DEF +{lvBonus.def}</span>
      </div>
    </div>

    {/* 液態流沙經驗條 */}
    <div className="relative h-10 w-full bg-slate-950/70 rounded-2xl border border-white/10 overflow-hidden shadow-inner flex items-center justify-between px-4">
      <div className="absolute left-0 top-0 bottom-0 transition-all duration-700 overflow-hidden"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, rgba(168,85,247,0.7) 0%, rgba(236,72,153,0.85) 100%)"
        }}>
        <div className="absolute inset-0 w-[200%] h-full opacity-35 liquid-wave" 
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 20%, transparent 60%)",
            backgroundSize: "20px 20px"
          }}
        />
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute bottom-1 left-[15%] w-1.5 h-1.5 bg-white/40 rounded-full bubble-particle" style={{ animationDelay: "0s", animationDuration: "3s" }} />
          <span className="absolute bottom-1 left-[45%] w-2 h-2 bg-white/30 rounded-full bubble-particle" style={{ animationDelay: "1s", animationDuration: "4s" }} />
          <span className="absolute bottom-1 left-[75%] w-1 h-1 bg-white/50 rounded-full bubble-particle" style={{ animationDelay: "0.5s", animationDuration: "2.5s" }} />
        </div>
      </div>
      
      <span className="relative z-10 text-[10px] font-black text-white/90 drop-shadow">
        {archerLv >= MAX_ARCHER_LEVEL ? "已達滿等 🎉" : `修煉進度：${current.toLocaleString()} / ${needed.toLocaleString()} XP`}
      </span>
      <span className="relative z-10 text-[10px] font-black text-amber-300 drop-shadow">
        {Math.round(xp / totalXPToMax * 100)}% Overall
      </span>
    </div>

    <div className="text-[10px] text-slate-500 mt-2.5 text-center">
      💡 等級加成規則：每一級 +5 HP，每 5 級增加 1 點 ATK 與 DEF！
    </div>
  </Card>

  {/* ── 徽章牆 (博古展示架) ── */}
  <Card className="p-5 border border-white/5 animate-fade-in-up delay-300" style={{ background:"rgba(15,23,42,0.55)" }}>
    <div className="flex justify-between items-center mb-4">
      <ST>🏆 榮譽徽章博古架</ST>
      <div className="flex gap-3 text-xs font-bold text-slate-400">
        <span>賽事積分：<span className="text-amber-400 font-black">{profile?.eventPoints || 0}</span></span>
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { label: "🐱 肥貓章", data: profile?.fatCat, keys: ["gold", "silver", "bronze"], names: ["金", "銀", "銅"] },
        { label: "⭐ 積分章", data: profile?.score, keys: ["gold", "silver", "bronze"], names: ["金", "銀", "銅"] },
        { label: "🏆 成就章", data: profile?.achievement, keys: ["black", "gold", "silver"], names: ["黑", "金", "銀"] }
      ].map((row, idx) => (
        <div key={idx} className="bg-slate-950/30 border border-white/5 rounded-2xl p-3 shadow-inner relative overflow-hidden">
          <div className="text-[10px] font-black text-slate-400 mb-2.5 tracking-wider">{row.label}</div>
          <div className="flex gap-4 justify-around relative">
            {/* Shelf line */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded backdrop-blur border-t border-white/15 shadow-sm" />
            
            {row.keys.map((k, i) => {
              const count = row.data?.[k] || 0;
              const isBlack = k === "black";
              const medalBorder = k === "gold" ? "border-yellow-400/40" : k === "silver" ? "border-slate-300/40" : k === "bronze" ? "border-amber-600/40" : "border-violet-500/40";
              const medalBg = k === "gold" ? "from-yellow-400/20 to-amber-500/10" : k === "silver" ? "from-slate-400/20 to-slate-500/10" : k === "bronze" ? "from-amber-600/20 to-amber-800/10" : "from-violet-500/20 to-indigo-950/10";
              
              return (
                <div key={k} className="flex flex-col items-center pb-2.5 group/medal">
                  <div className={`w-11 h-11 rounded-full border flex items-center justify-center bg-gradient-to-b shadow transition-transform duration-700 hover:rotate-[360deg] cursor-pointer ${
                    count > 0 ? "brightness-110" : "opacity-20 grayscale"
                      } ${medalBorder} ${medalBg}`}>
                    <span className="text-lg">{isBlack ? "🏆" : "🏅"}</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 mt-1">{row.names[i]}級</span>
                  <span className="text-[10px] font-black text-white bg-slate-900/80 px-2 py-0.5 rounded-full mt-1 border border-white/5 shadow-sm min-w-[32px] text-center">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>

    {/* 圖鑑入口 */}
    {(() => {
      const dungeonKeys = Object.keys(profile?.dungeonCollectibles || {});
      const dungeonOwned = dungeonKeys.length;
      const dungeonTotal = Object.keys(COLLECTIBLE_MAP).length;
      const achOwned = ds.totalUnlocked;
      const achTotal = ds.totalAll;
      const ownedCatCards = profile?.catCards || {};
      const catOwned = Object.keys(ownedCatCards).filter(id => (ownedCatCards[id] || 0) > 0).length;
      const catTotal = CAT_CARDS.length;

      const cells = [
        { icon: "🗺️", label: "地下城圖鑑", owned: dungeonOwned, total: dungeonTotal, color: "#a78bfa", page: "dungeon" },
        { icon: "🎖️", label: "成就圖鑑", owned: achOwned, total: achTotal, color: "#fbbf24", page: "dex" },
        { icon: "🐱", label: "貓貓卡片圖鑑", owned: catOwned, total: catTotal, color: "#f472b6", page: "cats" }
      ];

      return (
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/10">
          {cells.map(c => (
            <button type="button" key={c.label} onClick={() => onPageChange(c.page)}
              className="flex flex-col items-center bg-slate-950/40 border border-white/5 hover:border-violet-500/25 rounded-2xl p-3 active:scale-95 transition-all text-center">
              <span className="text-xl mb-1">{c.icon}</span>
              <span className="text-xs font-black" style={{ color: c.color }}>
                {c.owned}<span className="text-[10px] text-slate-500 font-normal">/{c.total}</span>
              </span>
              <span className="text-[9px] text-slate-400 font-bold mt-0.5">{c.label}</span>
            </button>
          ))}
        </div>
      );
    })()}
  </Card>

  {/* ── 快捷連結 ── */}
  {quickLinkGroups.map((group, gIdx) => (
    <div key={group.title} className="animate-fade-in-up delay-300" style={{ animationDelay: `${300 + gIdx * 75}ms` }}>
      <div className="text-white/50 text-xs font-bold mb-2 px-1">{group.title}</div>
      <div className="grid grid-cols-3 gap-3">
        {group.links.map(l => (
          <button key={l.id} onClick={() => onPageChange(l.id)}
            className="rounded-2xl p-3 text-center active:scale-95 border border-white/10 hover:border-violet-500/25 transition-all shadow-md"
            style={{ background:"rgba(15,23,42,0.55)", backdropFilter:"blur(8px)" }}>
            <div className="text-2xl mb-1">{l.icon}</div>
            <div className="text-white font-bold text-xs">{l.label}</div>
            <div className="text-white/50 text-[10px] mt-0.5">{l.desc}</div>
          </button>
        ))}
      </div>
    </div>
  ))}

  <div className="animate-fade-in-up delay-375">
    <FxSettings />
  </div>
  <div className="animate-fade-in-up delay-375">
    <AccountSettings profile={profile} />
  </div>
</div>
);
}

// ── 音效與動畫開關 ──
function FxToggleRow({ icon, label, desc, on, onToggle }) {
  return (
    <button onClick={onToggle}
      className="w-full flex items-center gap-3 py-2 text-left active:opacity-80"
      style={{ minHeight: 44 }}>
      <span className="text-xl w-8 text-center">{icon}</span>
      <div className="flex-1">
        <div className="text-gray-200 text-sm font-bold">{label}</div>
        <div className="text-gray-400 text-xs">{desc}</div>
      </div>
      <span className="relative inline-block w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: on ? "var(--primary)" : "rgba(255,255,255,0.15)" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  );
}

function FxSettings() {
  const [sound, setSound] = useState(getSoundEnabled());
  const [anim,  setAnim]  = useState(getAnimEnabled());

  function toggleSound() {
    const v = !sound;
    setSound(v);
    setSoundEnabled(v);
    if (v) sfxTap();
  }
  function toggleAnim() {
    const v = !anim;
    setAnim(v);
    setAnimEnabled(v);
  }

  return (
    <Card className="p-4 border border-white/5" style={{ background:"rgba(15,23,42,0.55)" }}>
      <ST>🔊 音效與動畫</ST>
      <div className="flex flex-col divide-y divide-white/10">
        <FxToggleRow icon="🔊" label="音效與震動" desc="按鈕、戰鬥、獎勵等所有音效"
          on={sound} onToggle={toggleSound} />
        <FxToggleRow icon="✨" label="介面動畫" desc="關閉後減少畫面晃動與耗電"
          on={anim} onToggle={toggleAnim} />
      </div>
    </Card>
  );
}

function AccountSettings({ profile }) {
  const [open, setOpen]           = useState(false);
  const [nickname, setNickname]   = useState(profile?.nickname || "");
  const [savingNick, setSavingNick] = useState(false);
  const [nickMsg, setNickMsg]     = useState("");
  const [oldPw, setOldPw]         = useState("");
  const [newPw, setNewPw]         = useState("");
  const [newPw2, setNewPw2]       = useState("");
  const [savingPw, setSavingPw]   = useState(false);
  const [pwMsg, setPwMsg]         = useState("");
  const [pwErr, setPwErr]         = useState("");

  useEffect(() => { setNickname(profile?.nickname || ""); }, [profile?.id]);

  async function saveNick() {
    if (!nickname.trim()) { setNickMsg("暱稱不能空白"); return; }
    setSavingNick(true); setNickMsg("");
    try {
      await updateMember(profile.id, { nickname: nickname.trim() }, profile.id);
      setNickMsg("✅ 暱稱已更新");
      setTimeout(() => setNickMsg(""), 2500);
    } catch (e) { setNickMsg("更新失敗：" + (e?.message||"")); }
    setSavingNick(false);
  }

  async function changePw() {
    if (!oldPw || !newPw || !newPw2) { setPwErr("所有欄位均為必填"); return; }
    if (newPw !== newPw2) { setPwErr("兩次輸入的新密碼不一致"); return; }
    if (newPw.length < 6) { setPwErr("新密碼長度至少為 6 位"); return; }
    setSavingPw(true); setPwErr(""); setPwMsg("");
    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("使用者未登入");
      const cred = EmailAuthProvider.credential(user.email, oldPw);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPw);
      setPwMsg("✅ 密碼更新成功！");
      setOldPw(""); setNewPw(""); setNewPw2("");
    } catch (e) {
      if (e?.code === "auth/wrong-password") setPwErr("舊密碼不正確");
      else setPwErr(e?.message || "密碼更新失敗");
    }
    setSavingPw(false);
  }

  return (
    <Card className="p-4 border border-white/5" style={{ background:"rgba(15,23,42,0.55)" }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left focus:outline-none">
        <ST>⚙️ 帳戶與密碼設定</ST>
        <span className="text-white/60 text-xs">{open ? "收起 ▲" : "展開 ▼"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          <div>
            <label className="text-xs text-slate-400 font-bold block mb-1.5">修改暱稱</label>
            <div className="flex gap-2">
              <Inp value={nickname} onChange={e => setNickname(e.target.value)}
                placeholder="輸入新暱稱" disabled={savingNick} className="flex-1" />
              <Btn onClick={saveNick} disabled={savingNick} className="px-4">保存</Btn>
            </div>
            {nickMsg && <div className="text-xs text-amber-300 mt-1 font-bold">{nickMsg}</div>}
          </div>

          <div className="border-t border-white/5 pt-3">
            <label className="text-xs text-slate-400 font-bold block mb-2">修改登入密碼</label>
            <div className="space-y-2 max-w-sm">
              <Inp type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
                placeholder="輸入舊密碼" disabled={savingPw} />
              <Inp type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="輸入新密碼 (6位以上)" disabled={savingPw} />
              <Inp type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)}
                placeholder="確認新密碼" disabled={savingPw} />
              <Btn onClick={changePw} disabled={savingPw} className="w-full">確認變更密碼</Btn>
            </div>
            {pwErr && <div className="text-xs text-red-400 mt-1 font-bold">{pwErr}</div>}
            {pwMsg && <div className="text-xs text-green-400 mt-1 font-bold">{pwMsg}</div>}
          </div>
        </div>
      )}
    </Card>
  );
}

function ArcherCard({ profile, certification, onExam }) {
  const hasNo  = !!profile?.archerNo;
  const level  = certification?.level || "none";
  const locked = certification?.locked || false;
  const [flipped, setFlipped] = useState(false);
  
  const levelLabel = { none: "灰證 · 未通過畢業考", blue: "藍證", gold: "金證" };
  const levelBadge = {
    none: "bg-gray-500/80 border border-gray-400/40 text-gray-200",
    blue: "bg-blue-600/80 border border-blue-400/40 text-blue-100",
    gold: "bg-gradient-to-r from-yellow-500 to-amber-500 border border-yellow-400/40 text-slate-950",
  };

  let frontLevel = level;
  let backLevel = "gold_locked";
  
  if (level === "gold") {
    frontLevel = "gold";
    backLevel = "blue";
  } else if (level === "blue") {
    frontLevel = "blue";
    backLevel = "gold_locked";
  } else {
    frontLevel = "none";
    backLevel = "blue_locked";
  }

  function renderCardContent(cardLvl, isBack) {
    const isLocked = cardLvl.endsWith("_locked");
    const displayLvl = isLocked ? cardLvl.replace("_locked", "") : cardLvl;
    
    let borderStyle = "border-slate-500/50 shadow-[0_0_20px_rgba(148,163,184,0.15)]";
    let bgStyle = {
      background: "linear-gradient(135deg, #0f1218 0%, #232a36 50%, #12171e 100%)",
    };
    let badgeClass = levelBadge.none;
    let titleText = levelLabel[displayLvl] || "證照";
    
    if (displayLvl === "gold") {
      borderStyle = "border-amber-400/60 shadow-[0_0_35px_rgba(245,158,11,0.35)]";
      bgStyle = {
        background: "linear-gradient(135deg, #1f1406 0%, #523412 50%, #2b1c09 100%)",
      };
      badgeClass = levelBadge.gold;
    } else if (displayLvl === "blue") {
      borderStyle = "border-blue-400/60 shadow-[0_0_35px_rgba(59,130,246,0.35)]";
      bgStyle = {
        background: "linear-gradient(135deg, #060e22 0%, #152752 50%, #091228 100%)",
      };
      badgeClass = levelBadge.blue;
    }
    
    return (
      <div className={`relative overflow-hidden rounded-3xl p-6 text-white border backdrop-blur h-full flex flex-col justify-between royal-card-shine select-none ${borderStyle}`}
        style={bgStyle}>
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-300 via-transparent to-transparent" />
        
        <div className="relative z-10 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎯</span>
              <span className="text-[10px] tracking-[0.2em] text-slate-300 font-black">
                {isBack ? "🛡️ 榮譽副卡展示" : "🏹 冒險公會 · 射手證"}
              </span>
            </div>
            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${badgeClass}`}>
              {titleText}
            </span>
          </div>

          {isLocked ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-4 bg-slate-950/65 border border-dashed border-slate-800/80 rounded-2xl my-2">
              <span className="text-xl mb-1 filter drop-shadow">🔒</span>
              <span className="text-[10px] text-slate-400 font-black tracking-wide">尚未考取該證照</span>
              <span className="text-[9px] text-slate-500 font-bold mt-0.5">通過對應階級畢業考後即可開啟</span>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center py-1">
              {hasNo ? (
                <div>
                  <div className="text-slate-400 text-[9px] mb-0.5 tracking-wider font-bold">證號 ARCHER ID</div>
                  <div className="font-black text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-300"
                    style={{ fontFamily:"monospace", textShadow:"0 2px 8px rgba(0,0,0,.4)" }}>
                    {formatArcherNo(profile.archerNo)}
                  </div>
                  
                  <div className="flex items-end justify-between border-t border-white/5 pt-2 mt-2">
                    <div>
                      <div className="text-white font-black text-sm leading-tight">{profile?.name}</div>
                      {profile?.nickname && <div className="text-cyan-300 text-[10px] mt-0.5 font-bold">「{profile.nickname}」</div>}
                    </div>
                    {profile?.archerNoDate && (
                      <div className="text-right text-slate-400 text-[9px] font-bold">
                        <div className="text-[8px] text-slate-500">領證日期</div>
                        <div className="text-slate-200 mt-0.5">{profile.archerNoDate}</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-2 border-t border-white/5 mt-2">
                  <div className="text-slate-200 text-xs font-black mb-0.5">尚未領取射手證</div>
                  <div className="text-slate-400 text-[10px]">完成檢定後，向教練申請專屬射手證號 🏹</div>
                </div>
              )}
            </div>
          )}

          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExam();
            }}
            className="mt-3 w-full bg-white/10 hover:bg-white/20 active:scale-[0.98] rounded-xl py-3 text-white text-xs font-black border border-white/10 transition-all flex items-center justify-center gap-1">
            {locked ? "🏆 已達最高級（金證）" : level === "blue" ? "🎖️ 挑戰金證畢業考 →" : level === "gold" ? "🏆 查看射手證" : "🎖️ 前往畢業考 →"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="perspective-1000 w-full h-[240px] cursor-pointer" onClick={() => setFlipped(!flipped)}>
        <div className={`card-flipper w-full h-full relative transition-transform duration-700 ${flipped ? "card-flipped" : ""}`}>
          <div className="card-front absolute inset-0 w-full h-full">
            {renderCardContent(frontLevel, false)}
          </div>
          <div className="card-back absolute inset-0 w-full h-full">
            {renderCardContent(backLevel, true)}
          </div>
        </div>
      </div>
      <div className="text-center text-[10px] text-amber-200/90 font-black italic mt-0.5 drop-shadow animate-pulse">
        💡 點選證書卡面可進行 3D 翻轉展示 🔄
      </div>

      {/* ── 藍證 / 金證 詳情 ── */}
      {(certification?.blue?.grantedAt || certification?.gold?.grantedAt) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {certification?.blue?.grantedAt && <CertDetailRow tier="藍證" tierColor="text-blue-200" data={certification.blue} />}
          {certification?.gold?.grantedAt && <CertDetailRow tier="金證" tierColor="text-amber-200" data={certification.gold} />}
        </div>
      )}
    </div>
  );
}
function CertDetailRow({ tier, tierColor, data }) {
  const BOW_LABEL = { rental:"租借器材", traditional:"傳統弓", recurve_bare:"裸弓", recurve_full:"全配", compound:"美式獵弓" };
  const borderThemeColor = tier === "藍證" ? "rgba(59, 130, 246, 0.45)" : "rgba(245, 158, 11, 0.45)";
  const bgThemeColor = tier === "藍證" ? "rgba(59, 130, 246, 0.08)" : "rgba(245, 158, 11, 0.08)";
  const glowColor = tier === "藍證" ? "rgba(59, 130, 246, 0.2)" : "rgba(245, 158, 11, 0.2)";
  
  function fmtGrant(ts) {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("zh-TW", { year:"numeric", month:"2-digit", day:"2-digit" });
  }
  return (
    <div className="rounded-2xl border p-4 shadow flex flex-col justify-center gap-3 transition-all duration-300 hover:scale-[1.02]"
      style={{
        borderColor: borderThemeColor,
        background: `linear-gradient(135deg, ${bgThemeColor} 0%, rgba(15,23,42,0.92) 100%)`,
        boxShadow: `0 0 15px ${glowColor}`
      }}>
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className={`text-xs font-black ${tierColor} tracking-wide`}>🎖️ {tier}詳情</span>
        <span className="text-slate-400 text-[10px]">領證 {fmtGrant(data.grantedAt)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["🏹 弓組", data.bowLabel||(BOW_LABEL[data.bowType])||"—"],
          ["🛡️ 防具", data.armorLabel||"—"],
          ["✨ 飾品", data.accessoryLabel||"—"]].map(([lbl,val]) => (
          <div key={lbl} className="bg-slate-900/80 border border-white/5 rounded-xl py-2 px-1 hover:border-violet-500/25 transition-all">
            <div className="text-slate-400 text-[9px] mb-0.5">{lbl}</div>
            <div className="text-white text-[10px] font-black leading-tight truncate">{val}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-slate-900/80 border border-white/5 rounded-xl py-2 hover:border-violet-500/25 transition-all">
          <div className="text-slate-400 text-[9px] mb-0.5">任務1 中靶</div>
          <div className="text-white text-xs font-black">{data.task1?.hits!=null?`${data.task1.hits} 箭`:"—"}</div>
        </div>
        <div className="bg-slate-900/80 border border-white/5 rounded-xl py-2 hover:border-violet-500/25 transition-all">
          <div className="text-slate-400 text-[9px] mb-0.5">任務2 分數</div>
          <div className="text-white text-xs font-black">{data.task2?.score!=null?`${data.task2.score} 分`:"—"}</div>
        </div>
      </div>
    </div>
  );
}

const CERT_BG_PROFILE = {
  "":   "/ui/cert-empty.webp",
  入門:  "/ui/cert-novice.webp",
  初級:  "/ui/cert-beginner.webp",
  中級:  "/ui/cert-intermediate.webp",
  進階:  "/ui/cert-advanced.webp",
  精英:  "/ui/cert-elite.webp",
  菁英:  "/ui/cert-elite.webp",
};
const CERT_CHIP_STYLE = {
  "":   { bg:"rgba(0,0,0,0.30)",        border:"rgba(255,255,255,0.12)", title:"#9ca3af", score:"#d1d5db" },
  入門:  { bg:"rgba(251,191,36,0.18)",   border:"rgba(251,191,36,0.35)",  title:"#fde68a", score:"#fbbf24" },
  初級:  { bg:"rgba(16,185,129,0.18)",   border:"rgba(16,185,129,0.35)",  title:"#a7f3d0", score:"#6ee7b7" },
  中級:  { bg:"rgba(59,130,246,0.18)",   border:"rgba(59,130,246,0.35)",  title:"#bfdbfe", score:"#93c5fd" },
  進階:  { bg:"rgba(139,92,246,0.18)",   border:"rgba(139,92,246,0.35)",  title:"#ddd6fe", score:"#c4b5fd" },
  精英:  { bg:"rgba(245,158,11,0.20)",   border:"rgba(245,158,11,0.45)",  title:"#fcd34d", score:"#fbbf24" },
  菁英:  { bg:"rgba(245,158,11,0.20)",   border:"rgba(245,158,11,0.45)",  title:"#fcd34d", score:"#fbbf24" },
};

function CertChip({ name, score, level }) {
  const has = score > 0;
  const certImg = CERT_BG_PROFILE[level || ""] || CERT_BG_PROFILE[""];
  const ls = CERT_CHIP_STYLE[level || ""] || CERT_CHIP_STYLE[""];
  return (
    <div className="rounded-xl p-3 text-center relative overflow-hidden"
      style={{ backgroundImage:`url(${certImg})`, backgroundSize:"cover", backgroundPosition:"center",
        backgroundColor: ls.bg, border:`1px solid ${ls.border}` }}>
      <div className="relative z-10">
        <div style={{ fontSize:10, fontWeight:700, color:ls.title, marginBottom:2 }}>{name}</div>
        {has ? (
          <>
            <div style={{ fontWeight:900, fontSize:15, color:ls.score }}>{score}</div>
            <div style={{ fontSize:9, color:ls.title, marginTop:1 }}>分</div>
            <div className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${level ? certLevelStyle(level, "solid") : "bg-white/10 text-white/50"}`}>
              {level || "未達標"}
            </div>
          </>
        ) : (
          <div style={{ fontSize:10, color:ls.title, marginTop:4 }}>初心者</div>
        )}
      </div>
    </div>
  );
}
