// src/components/member/MemberHome.jsx
import { useState, useEffect } from "react";
import { getMemberResults, subscribeBadgeLogs, submitMonthlyCardRequest, subscribeMyMonthlyRequests, checkExpireMonthlyCard, getCertRecords } from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import { getCohort, cohortLabel } from "../../lib/cohort";
import { useAuth } from "../../hooks/useAuth";
import { calcAge, formatArcherNo, fmtDT, BOW_TYPES, getCertLevel, COMP_TYPE_COLOR, certLevelStyle, EQUIP_SLOT_DEFS } from "../../lib/constants";
import { levelFromXP, rankFromLevel } from "../../lib/adventurerSystem";
import { archerLevelFromXP, archerXPProgress, archerLevelBonus, MAX_ARCHER_LEVEL } from "../../lib/archerLevel";
import { catLevelFromXP, catXPProgress } from "../../lib/catLevel";
import { getBondLevel, calcCatEquipBonus, CAT_SKILL_GROUPS, CAT_TYPES } from "../../lib/catData";
import { useCatCompanion } from "../../hooks/useCatCompanion";
import { calcEquippedBonus, resolveEquippedCards } from "../../lib/monsterCards";
import { calcArcherStats } from "../../lib/monsterData";
import { COLLECTIBLE_MAP } from "../../lib/dungeonCollectibles";
import { CAT_CARDS } from "../../lib/catCardData";
import { ALL_MILESTONES } from "../../lib/arrowMilestone";
import { EXPEDITION_MISSIONS, fmtCountdown } from "../../lib/expeditionData";
import { subscribeActiveGoal } from "../../lib/villageGoalDb";
import { GOAL_TYPE_MAP, buildGoalTitle } from "../../lib/villageGoalData";
import { Card, ST } from "../shared/UI";
import { SectionHeader, StatBar, ProgressRing, HubTile } from "../shared/Widgets";
import ShareCard from "./ShareCard";

const CERT_SHOW = ["recurve_bare", "compound", "traditional"];

// ── 4 大功能 Hub 入口（HubTile CSS 漸層底，取代 cell-*.webp）──
const HOME_HUBS = [
  { page:"training-hub",  icon:"🏹", title:"每日功能", desc:"練箭・比賽",         accent:"#0d9488" },
  { page:"adventure-hub", icon:"🗺️", title:"冒險出發", desc:"打怪・地城・世界王", accent:"#7c3aed" },
  { page:"inventory-hub", icon:"🎒", title:"我的背包", desc:"戰利品・消耗品・素材", accent:"#d97706" },
  { page:"records-hub",   icon:"🏆", title:"我的戰績", desc:"成就圖鑑・排行榜",   accent:"#2563eb" },
];

// ── 快速入口（常用功能捷徑）─────────────────────────────
const QUICK_LINKS = [
  { page:"guide",       icon:"📘", label:"說明書" },
  { page:"monster",     icon:"⚔️", label:"打怪" },
  { page:"practice",    icon:"🎯", label:"自主練習" },
  { page:"coinshop",    icon:"🛒", label:"商店" },
  { page:"equipment",   icon:"🛡️", label:"我的裝備" },
];

// Firestore Timestamp / Date / string → ms
function tsToMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v.seconds != null) return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

// ── 主題定義 ──────────────────────────────────────────────
const CARD_THEMES = [
  { id:"ocean",  label:"深海藍", bg:"linear-gradient(135deg,#1d4ed8,#1e3a8a)",    dot:"#93c5fd" },
  { id:"night",  label:"暗夜紫", bg:"linear-gradient(135deg,#4c1d95,#312e81)",    dot:"#a78bfa" },
  { id:"forest", label:"森林綠", bg:"linear-gradient(135deg,#065f46,#14532d)",    dot:"#6ee7b7" },
  { id:"fire",   label:"烈火紅", bg:"linear-gradient(135deg,#9f1239,#7f1d1d)",    dot:"#fca5a5" },
  { id:"desert", label:"沙漠金", bg:"linear-gradient(135deg,#92400e,#78350f)",    dot:"#fcd34d" },
  { id:"aurora", label:"極光粉", bg:"linear-gradient(135deg,#be185d,#7e22ce)",    dot:"#f9a8d4" },
  { id:"steel",  label:"鋼鐵灰", bg:"linear-gradient(135deg,#374151,#1f2937)",    dot:"#d1d5db" },
  { id:"cosmos", label:"宇宙黑", bg:"linear-gradient(135deg,#0f172a,#1e1b4b)",    dot:"#818cf8" },
  { id:"bluebay", label:"藍灣綠", bg:"linear-gradient(135deg,#00a1b4,#097988)",    dot:"#00a1b4" },
  { id: "bluebay1", label: "紅月豔", bg: "linear-gradient(135deg, #B91C1C 0%, #E11D48 25%, #9333EA 55%, #2563EB 80%, #06B6D4 100%)", dot: "#ff0000" }
];

function useCardTheme() {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem("archerCardTheme") || "ocean"; } catch { return "ocean"; }
  });
  function setTheme(id) {
    setThemeState(id);
    try { localStorage.setItem("archerCardTheme", id); } catch {}
  }
  return [theme, setTheme];
}

export default function MemberHome({
  onPageChange, onJoinParty, notifications = [],
  certification = null,
  dexConfig = { physicalMax:10, pointMax:10 }, dexGrants = [],
  duelStats = null, monsterDex = {}, craftStats = {}, chestStats = {},
  potionDex = {}, cardData = { cards:{}, equipped:[] }, todayArrows = 0,
  todayCheckin,       // 今日報到（MemberApp/AdminApp 既有訂閱下傳；undefined=載入中, null=未報到）
  worldBoss = null,   // 世界王事件（MemberApp/AdminApp 既有訂閱下傳）
}) {
  const { profile } = useAuth();
  const { catHP, catATK, catDEF, hasCat } = useCatCompanion();
  const [certRecords, setCertRecords]     = useState([]);
  const [results, setResults]             = useState([]);
  const [badgeLogs, setBadgeLogs]         = useState([]);
  const [showShare, setShowShare]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [cardTheme, setCardTheme]         = useCardTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);
  // 月卡
  const [monthlyReqs, setMonthlyReqs]     = useState([]);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardHours, setCardHours]         = useState(1);
  const [cardBusy, setCardBusy]           = useState(false);
  const [cardMsg, setCardMsg]             = useState("");
  const [notifCat, setNotifCat]           = useState("全部");
  // 進行中卡資料
  const [villageGoal, setVillageGoal]     = useState(null);
  const [nowMs, setNowMs]                 = useState(Date.now());

  // 村目標（重用 villageGoalDb 既有訂閱函式）
  useEffect(() => subscribeActiveGoal(setVillageGoal), []);

  // ── 遠征 3 槽（expeditions map；舊欄位 expedition 向後兼容顯示為 slot 0）──
  const expSlots = (() => {
    const exps = profile?.expeditions || {};
    const slots = ["0", "1", "2"]
      .filter(k => exps[k]?.catId)
      .map(k => ({ slot: Number(k), ...exps[k] }));
    if (!exps["0"] && profile?.expedition?.catId) {
      slots.unshift({ slot: 0, ...profile.expedition });
    }
    return slots;
  })();

  // 倒數計時器：只在有遠征/村目標時每 30 秒 tick 一次
  const needTick = expSlots.length > 0 || !!villageGoal;
  useEffect(() => {
    if (!needTick) return;
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, [needTick]);

  useEffect(() => {
    if (!profile?.id) return;
    checkExpireMonthlyCard(profile.id).catch(() => {});
    getMemberResults(profile.id).then(r => setResults(r)).catch(() => {});
    getCertRecords(profile.id).then(setCertRecords).catch(() => {});
    const unsub  = subscribeBadgeLogs(profile.id, setBadgeLogs);
    const unsub5 = subscribeMyMonthlyRequests(profile.id, setMonthlyReqs);
    return () => { unsub?.(); unsub5?.(); };
  }, [profile?.id]); // eslint-disable-line

  const unreadNotif = notifications.filter(x =>
    !(x.readBy    || []).includes(profile?.id) &&
    !(x.deletedBy || []).includes(profile?.id)
  ).length;

  const pendingBadges = badgeLogs.filter(l => l.status === "pending_claim");
  const recentResults = [...results]
    .sort((a,b) => (b.submittedAt?.seconds||0) - (a.submittedAt?.seconds||0))
    .slice(0, 5);
  const thisYear = new Date().getFullYear();

  function certOf(bowType) {
    const recs = certRecords.filter(r => r.bowType === bowType && r.year === thisYear);
    if (recs.length === 0) return { score: 0, level: null };
    const best = Math.max(...recs.map(r => r.score || 0));
    return { score: best, level: getCertLevel(bowType, best) };
  }

  const currentTheme = CARD_THEMES.find(t => t.id === cardTheme) || CARD_THEMES[0];

  async function submitCardRequest() {
    setCardBusy(true); setCardMsg("");
    const hasPending = monthlyReqs.some(r => r.status === "pending");
    const res = await submitMonthlyCardRequest(
      profile.id, profile.nickname || profile.name, cardHours,
      profile?.monthlyCard || null, hasPending
    );
    if (res.ok) { setCardMsg("✅ 已送出，等待教練審核"); }
    else { setCardMsg("❌ " + res.reason); }
    setCardBusy(false);
  }

  return (
    <div className="p-4 flex flex-col gap-4" style={{ minHeight:"100%", backgroundImage:"url(/ui/page-bg.webp)", backgroundSize:"cover", backgroundPosition:"top center", backgroundAttachment:"local" }}>
      {showShare && <ShareCard onClose={() => setShowShare(false)} />}

      {/* 月卡申請 Modal */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => !cardBusy && setShowCardModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="font-black text-gray-800 text-lg mb-1">🎫 月卡扣抵使用</div>
            <div className="text-gray-500 text-sm mb-4">選擇本次練習時數，送出後等待教練核准，核准後扣除 1 次月卡。</div>
            <div className="flex gap-3 mb-4">
              {[1, 2].map(h => (
                <button key={h} onClick={() => setCardHours(h)}
                  className={`flex-1 py-4 rounded-2xl font-black text-lg border-2 transition-all active:scale-95 ${
                    cardHours === h ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}>
                  {h} 小時
                </button>
              ))}
            </div>
            {cardMsg && (
              <div className={`text-sm font-bold mb-3 ${cardMsg.startsWith("✅") ? "text-emerald-700" : "text-red-600"}`}>
                {cardMsg}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCardModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">
                取消
              </button>
              <button onClick={submitCardRequest} disabled={cardBusy || cardMsg.startsWith("✅")}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-black text-sm disabled:opacity-40 active:scale-95 transition-transform">
                {cardBusy ? "送出中…" : "送出申請"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 教練新回饋通知 ── */}
      {profile?.hasNewLearnLog && (
        <button onClick={() => onPageChange("learn")}
          className="w-full p-3 flex items-center gap-3 active:scale-98 transition-transform text-left"
          style={{ background:"var(--warn-bg)", border:"1px solid rgba(251,191,36,0.35)", borderRadius:"var(--r-md)" }}>
          <span className="text-xl flex-shrink-0">📓</span>
          <div className="flex-1 min-w-0">
            <div className="font-black text-sm" style={{ color:"var(--warn-fg)" }}>教練有新的學習回饋！</div>
            <div className="text-xs" style={{ color:"var(--text-secondary)" }}>點此查看教練的指導內容</div>
          </div>
          <span className="text-xs font-bold flex-shrink-0" style={{ color:"var(--warn-fg)" }}>查看 →</span>
        </button>
      )}

      {/* ── 今日卡：報到狀態＋今日箭數＋下一里程碑 ─────────────── */}
      {(() => {
        const checkinMeta = (() => {
          if (todayCheckin === undefined) return { icon:"⏱", label:"讀取中…",      fg:"var(--text-muted)",     bg:"rgba(255,255,255,0.06)" };
          if (todayCheckin === null)      return { icon:"⚪", label:"尚未報到",     fg:"var(--text-secondary)", bg:"rgba(255,255,255,0.06)" };
          if (todayCheckin.classEnded)    return { icon:"🏁", label:"今日已下課",   fg:"var(--info-fg)",        bg:"var(--info-bg)" };
          if (todayCheckin.status === "pending")  return { icon:"⏳", label:"等待教練確認", fg:"var(--warn-fg)",   bg:"var(--warn-bg)" };
          if (todayCheckin.status === "rejected") return { icon:"❌", label:"報到未通過",   fg:"var(--danger-fg)", bg:"var(--danger-bg)" };
          return { icon:"✅", label:"上課中", fg:"var(--success-fg)", bg:"var(--success-bg)" };
        })();
        const nextDaily = ALL_MILESTONES.find(m => m.arrows > todayArrows) || null;
        const prevDailyArrows = [...ALL_MILESTONES].reverse().find(m => m.arrows <= todayArrows)?.arrows || 0;
        const ringVal = nextDaily ? todayArrows - prevDailyArrows : 1;
        const ringMax = nextDaily ? nextDaily.arrows - prevDailyArrows : 1;
        return (
          <Card className="p-4">
            <SectionHeader icon="📋" title="今日狀態" action={
              <button onClick={() => onPageChange("training-hub")}
                style={{ fontSize:11, color:"var(--text-accent)", fontWeight:700, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                前往練箭 →
              </button>
            } />
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ flexShrink:0 }}>
                <ProgressRing value={ringVal} max={ringMax} size={72} stroke={6} color="var(--success-fg)">
                  <div style={{ textAlign:"center", lineHeight:1.1 }}>
                    <div style={{ fontSize:18, fontWeight:900, color:"var(--text-primary)" }}>{todayArrows}</div>
                    <div style={{ fontSize:9, color:"var(--text-muted)" }}>箭</div>
                  </div>
                </ProgressRing>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:800, color:checkinMeta.fg, background:checkinMeta.bg, borderRadius:999, padding:"3px 10px" }}>
                  {checkinMeta.icon} {checkinMeta.label}
                </span>
                <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:6 }}>
                  {nextDaily
                    ? <>下一里程碑 <b style={{ color:"var(--success-fg)" }}>{nextDaily.arrows} 箭</b>（還差 {nextDaily.arrows - todayArrows} 箭）</>
                    : "🏆 今日里程碑全數達成！"}
                </div>
                {nextDaily?.catBoxes > 0 && (
                  <div style={{ fontSize:10, color:"var(--text-gold)", marginTop:2 }}>🎁 達成可獲得貓貓禮盒！</div>
                )}
              </div>
            </div>
          </Card>
        );
      })()}

      {/* ── 進行中卡：世界王／遠征倒數／村目標（有內容才顯示）──── */}
      {(() => {
        const wbActive = worldBoss && worldBoss.status === "active";
        if (!wbActive && expSlots.length === 0 && !villageGoal) return null;
        const rowStyle = (bg, border) => ({
          display:"flex", alignItems:"center", gap:10, width:"100%",
          background:bg, border:`1px solid ${border}`, borderRadius:"var(--r-md)",
          padding:"8px 12px", cursor:"pointer", textAlign:"left",
        });
        return (
          <Card className="p-4">
            <SectionHeader icon="⏳" title="進行中" />
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {wbActive && (
                <button onClick={() => onPageChange("worldboss")} style={rowStyle("var(--danger-bg)", "rgba(239,68,68,0.35)")}>
                  <span style={{ fontSize:20, flexShrink:0 }}>👑</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:900, color:"var(--danger-fg)" }}>
                      世界王現身！{worldBoss.bossData?.name || ""}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-secondary)" }}>全體射手協力討伐</div>
                  </div>
                  <span style={{ fontSize:11, color:"var(--danger-fg)", fontWeight:700, flexShrink:0 }}>參戰 →</span>
                </button>
              )}
              {expSlots.map(e => {
                const mission = EXPEDITION_MISSIONS.find(m => m.tier === e.missionTier);
                const left = tsToMs(e.endsAt) - nowMs;
                const done = left <= 0;
                return (
                  <button key={e.slot} onClick={() => onPageChange("gacha")}
                    style={rowStyle(done ? "var(--success-bg)" : "rgba(255,255,255,0.05)", done ? "rgba(34,197,94,0.35)" : "var(--glass-border)")}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{mission?.emoji || "🐾"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {e.catName || "貓咪"}・{mission?.label || `遠征 T${e.missionTier}`}
                      </div>
                      <div style={{ fontSize:10, color:"var(--text-secondary)" }}>遠征隊 槽位 {e.slot + 1}</div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:900, flexShrink:0, color: done ? "var(--success-fg)" : "var(--text-gold)" }}>
                      {done ? "✅ 可領取" : `⏱ ${fmtCountdown(left)}`}
                    </span>
                  </button>
                );
              })}
              {villageGoal && (() => {
                const meta = GOAL_TYPE_MAP[villageGoal.goalType] || {};
                const goalLeft = tsToMs(villageGoal.endAt) - nowMs;
                return (
                  <button onClick={() => onPageChange("gacha")}
                    style={{ ...rowStyle("rgba(255,255,255,0.05)", "var(--glass-border)"), flexDirection:"column", alignItems:"stretch", gap:6 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ flex:1, minWidth:0, fontSize:12, fontWeight:800, color:"var(--text-primary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {villageGoal.customTitle || buildGoalTitle(villageGoal.goalType, villageGoal.targetValue)}
                      </div>
                      <span style={{ fontSize:10, color:"var(--text-muted)", flexShrink:0 }}>
                        {goalLeft > 0 ? `剩 ${fmtCountdown(goalLeft)}` : "結算中"}
                      </span>
                    </div>
                    <StatBar value={Math.min(villageGoal.currentValue || 0, villageGoal.targetValue || 0)}
                      max={villageGoal.targetValue || 1} height={6}
                      color={meta.color || "var(--info-fg)"} />
                    <div style={{ fontSize:10, color:"var(--text-secondary)", textAlign:"right" }}>
                      {(villageGoal.currentValue || 0).toLocaleString()} / {(villageGoal.targetValue || 0).toLocaleString()} {meta.contributionLabel || ""}
                    </div>
                  </button>
                );
              })()}
            </div>
          </Card>
        );
      })()}

      {/* ── 4 大功能 Hub（HubTile 格線）───────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {HOME_HUBS.map(hub => (
          <HubTile key={hub.page} icon={hub.icon} title={hub.title} desc={hub.desc}
            accent={hub.accent} onClick={() => onPageChange(hub.page)} />
        ))}
      </div>

      {/* 廣播訊息（分類篩選）*/}
      {notifications.length > 0 && (
        <Card className="p-4" style={{ background:"rgba(15,23,42,0.55)" }}>
          <ST>📢 最新廣播</ST>
          {/* 分類篩選 */}
          {(() => {
            const TYPE_CAT = {
              promo:"優惠", important:"重要", cert_pass:"考證", high_score:"考證",
              achievement:"成就", dungeon:"地下城", worldboss:"世界王",
              loot:"掉寶", new_comp:"一般", comp_result:"一般", general:"一般",
            };
            const CATS = ["全部","優惠","重要","考證","成就","地下城","世界王","一般","掉寶"];
            const TYPE_ICON = {
              important:"🔴", promo:"🎉", new_comp:"🏆",
              cert_pass:"🏅", high_score:"⭐", comp_result:"📊",
              achievement:"🎖️", dungeon:"🗺️", worldboss:"👑", loot:"💎", general:"📢",
            };
            const filtered = notifCat === "全部"
              ? notifications
              : notifications.filter(n => (TYPE_CAT[n.type] || "一般") === notifCat);
            return (
              <>
                <div className="flex gap-1.5 flex-wrap mb-3 -mt-1">
                  {CATS.map(c => (
                    <button key={c} onClick={() => setNotifCat(c)}
                      style={{
                        fontSize:10, padding:"2px 8px", borderRadius:999, fontWeight:700, border:"none", cursor:"pointer",
                        background: notifCat === c ? "#3b82f6" : "rgba(255,255,255,0.1)",
                        color: notifCat === c ? "white" : "rgba(255,255,255,0.55)",
                        transition:"all 0.15s",
                      }}>
                      {c}
                    </button>
                  ))}
                </div>
                {filtered.slice(0, 5).map(n => {
                  const unread = !(n.readBy||[]).includes(profile?.id);
                  return (
                    <div key={n.id} style={{
                      padding: unread ? "10px 16px" : "10px 0",
                      margin: unread ? "0 -16px" : "0",
                      borderBottom:"1px solid rgba(255,255,255,0.06)",
                      background: unread ? "rgba(59,130,246,0.08)" : "transparent",
                      borderRadius: unread ? 10 : 0,
                    }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                        <span style={{ fontSize:13, marginTop:1 }}>{TYPE_ICON[n.type] || "📢"}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight: unread ? 900 : 700, color: unread ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)", lineHeight:1.3 }}>
                            {n.title}
                          </div>
                          {n.content && (
                            <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:2, lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                              {n.content}
                            </div>
                          )}
                        </div>
                        {unread && <span style={{ flexShrink:0, width:7, height:7, background:"#f87171", borderRadius:"50%", marginTop:4 }} />}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", textAlign:"center", padding:"12px 0" }}>此分類暫無訊息</div>
                )}
              </>
            );
          })()}
          <button onClick={() => onPageChange("notifications")}
            style={{ fontSize:11, color:"#60a5fa", fontWeight:700, marginTop:8, background:"none", border:"none", cursor:"pointer", padding:0 }}>
            查看全部訊息 →
          </button>
        </Card>
      )}

      {pendingBadges.length > 0 && (
        <Card className="p-4" style={{ border:"1px solid rgba(251,191,36,0.30)" }}>
          <div className="font-bold text-sm mb-2" style={{ color:"var(--warn-fg)" }}>🎖️ 你有 {pendingBadges.length} 個徽章待確認領取！</div>
          {pendingBadges.map(b => (
            <div key={b.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor:"rgba(255,255,255,0.08)" }}>
              <div className="text-sm" style={{ color:"var(--text-primary)" }}>
                {b.badgeType==="fatCat"?"🐱 肥貓章":b.badgeType==="score"?"⭐ 積分章":"🏆 成就章"}
                　{b.color==="gold"?"金":b.color==="silver"?"銀":b.color==="black"?"黑":"銅"}章 × {b.count}
              </div>
              <div className="flex gap-2">
                <ClaimBtn logId={b.id} memberId={profile.id} />
                <DisputeBtn logId={b.id} memberId={profile.id} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── 射手狀態卡（可換主題）──────────────────────────── */}
      <div className="p-5 border-0 text-white relative overflow-hidden"
        style={{ background: currentTheme.bg }}>

        {/* 宇宙黑主題：星星背景 */}
        {cardTheme === "cosmos" && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_,i) => (
              <div key={i} className="absolute rounded-full bg-white"
                style={{
                  width: Math.random() * 2 + 1 + "px",
                  height: Math.random() * 2 + 1 + "px",
                  top: Math.random() * 100 + "%",
                  left: Math.random() * 100 + "%",
                  opacity: Math.random() * 0.7 + 0.3,
                }} />
            ))}
          </div>
        )}

        <div className="relative">
          <div className="flex justify-between mb-4">
            <div>
              <div className="text-white/60 text-xs mb-1">射手</div>
              <div className="font-black text-2xl">{profile.nickname || profile.name}</div>
              <div className="text-white/70 text-sm">{profile.name}</div>
              <div className="text-white/60 text-xs mt-1 flex items-center gap-2 flex-wrap">
                <span>
                  {formatArcherNo(profile.archerNo)}　射齡 {calcAge(profile.joinDate)}
                  {getCohort(profile.joinDate) != null ? `　${cohortLabel(getCohort(profile.joinDate))}` : ""}
                </span>
                <CertLevelPip level={certification?.level || "none"} />
                {(() => {
                  const gLv = levelFromXP(profile?.adventurerXP || 0);
                  const gRank = rankFromLevel(gLv);
                  return (
                    <span style={{ fontSize:10, fontWeight:900, color:gRank.color, background:"rgba(255,255,255,0.1)", borderRadius:999, padding:"1px 7px" }}>
                      {gRank.icon} 公會 Lv.{gLv}
                    </span>
                  );
                })()}
              </div>
              {(() => {
                const ds = computeDexStats({ member: profile, certification, certRecords, checkinCount: profile?.dailyQuestCount || 0, granted: dexGrants, physicalMax: dexConfig.physicalMax, pointMax: dexConfig.pointMax, monsterDex, craftStats, chestStats, potionDex, cardData, duelStats });
                try { if (profile?.id) sessionStorage.setItem(`dex_stats_${profile.id}`, JSON.stringify(ds)); } catch {}
                return (
                  <div className="text-white/60 text-xs mt-1 flex items-center gap-3 flex-wrap">
                    <span>🎖️ 圖鑑 {ds.totalUnlocked}/{ds.totalAll}</span>
                    {(ds.gold + ds.silver + ds.bronze) > 0 && (
                      <span>🥇{ds.gold} 🥈{ds.silver} 🥉{ds.bronze}</span>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="flex items-start gap-2">
              {/* 調色盤按鈕 */}
              <div className="relative">
                <button onClick={() => setShowThemePicker(v => !v)}
                  className="text-xl leading-none opacity-70 hover:opacity-100 transition-opacity"
                  title="更換卡片主題">🎨</button>
                {showThemePicker && (
                  <div className="absolute right-0 top-8 z-50 bg-white rounded-2xl shadow-2xl p-3 w-48"
                    style={{ border:"1px solid #e2e8f0" }}>
                    <div className="text-gray-500 text-xs font-bold mb-2 px-1">選擇主題</div>
                    <div className="grid grid-cols-4 gap-2">
                      {CARD_THEMES.map(t => (
                        <button key={t.id} onClick={() => { setCardTheme(t.id); setShowThemePicker(false); }}
                          title={t.label}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all active:scale-90"
                          style={{ background: cardTheme === t.id ? "#ede9fe" : "transparent", border: cardTheme === t.id ? "2px solid #7c3aed" : "2px solid transparent" }}>
                          <div className="w-7 h-7 rounded-full" style={{ background: t.bg }} />
                          <span className="text-gray-600 text-[9px] font-bold leading-tight text-center">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setShowShare(true)} className="text-2xl leading-none opacity-70 hover:opacity-100" title="生成分享卡">📸</button>
              <button onClick={() => onPageChange("notifications")} className="relative text-3xl leading-none" title="訊息中心">
                🔔
                {unreadNotif > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                    {unreadNotif > 9 ? "9+" : unreadNotif}
                  </span>
                )}
              </button>
              <div className="text-5xl">🏹</div>
            </div>
          </div>

        </div>
      </div>

      {/* 射手等級 */}
      {(() => {
        const xp = profile?.archerXP || 0;
        const { level, current, needed, pct } = archerXPProgress(xp);
        const lvBonus = archerLevelBonus(level);
        const cardBonus = calcEquippedBonus(resolveEquippedCards(cardData));
        const _ds = computeDexStats({ member: profile, certification, certRecords, checkinCount: profile?.dailyQuestCount || 0, granted: dexGrants, physicalMax: dexConfig.physicalMax, pointMax: dexConfig.pointMax, monsterDex, craftStats, chestStats, potionDex, cardData, duelStats });
        const archerStats = calcArcherStats({ member: profile, certification, certRecords, dexStats: _ds });
        const totalHP  = archerStats.hp  + lvBonus.hp  + cardBonus.hp;
        const totalATK = archerStats.atk + lvBonus.atk + cardBonus.atk;
        const totalDEF = archerStats.def + lvBonus.def + cardBonus.def;
        const arrowdew  = profile?.village?.resources?.arrowdew || 0;
        const coins     = profile?.coins || 0;
        const gachaCoins = profile?.gachaCoins || 0;
        return (
          <Card className="p-4" style={{ background:"rgba(15,23,42,0.55)" }}>
            {/* 等級標題列 */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
              <div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:700 }}>⚔️ 射手等級</div>
                <div style={{ fontSize:22, fontWeight:900, color:"#f472b6" }}>Lv. {level} <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:400 }}>/ {MAX_ARCHER_LEVEL}</span></div>
              </div>
              {/* 實際數值 */}
              <div style={{ display:"flex", gap:8, fontSize:12 }}>
                <span style={{ color:"#f87171", fontWeight:700 }}>❤️{totalHP}</span>
                <span style={{ color:"#fb923c", fontWeight:700 }}>⚔️{totalATK}</span>
                <span style={{ color:"#60a5fa", fontWeight:700 }}>🛡️{totalDEF}</span>
              </div>
            </div>
            {/* XP 進度條 */}
            <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:6, height:6, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#ec4899,#a855f7)", borderRadius:6, transition:"width 0.4s" }} />
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:3, textAlign:"right" }}>
              {level >= MAX_ARCHER_LEVEL ? "已滿等" : `${current} / ${needed} XP`}
            </div>            {/* ── 貓貓陪練資訊 ── */}
            {(() => {
              const ec = profile?.equippedCat;
              if (!ec?.catId) {
                return (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
                      🐱 尚未裝備貓夥伴 — 前往貓村領養
                    </div>
                  </div>
                );
              }
              const catXP = ec.catXP || 0;
              const cLv = catLevelFromXP(catXP);
              const xpProg = catXPProgress(catXP);
              const bondLv = getBondLevel(ec.bond || 0);
              const equipBonus = calcCatEquipBonus(ec.equip || {});
              const skillGroup = CAT_SKILL_GROUPS[ec.catId] || null;
              const typeInfo = CAT_TYPES[ec.type] || CAT_TYPES.allround;
              const typeColors = { attack: "#ef4444", defense: "#3b82f6", allround: "#22c55e" };
              const tColor = typeColors[ec.type] || "#22c55e";
              const skillLabels = { heal: "💚 治療", atk: "⚡ 攻擊", def: "🛡️ 防禦" };
              const totalEquip = equipBonus.atkBonus + equipBonus.defBonus + equipBonus.hpBonus;
              return (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <img src={`/cats/portraits/${ec.catId}.webp`}
                        alt={ec.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: `2px solid ${tColor}` }} />
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 900, color: "#f1f5f9" }}>{ec.name}</span>
                        <span style={{ fontSize: 9, color: tColor, fontWeight: 700, marginLeft: 4 }}>
                          {typeInfo.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#f472b6" }}>Lv.{cLv}</span>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>羈絆{bondLv}</span>
                      {skillGroup && (
                        <span style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700, background: "rgba(251,191,36,0.15)", padding: "1px 5px", borderRadius: 4 }}>
                          {skillLabels[skillGroup] || skillGroup}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* XP 進度條 */}
                  <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${xpProg.pct}%`, background: `linear-gradient(90deg,${tColor},${tColor}88)`, borderRadius: 4 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, marginBottom: 6 }}>
                    <span>{xpProg.current} / {xpProg.needed} XP</span>
                    <span>
                      {equipBonus.atkBonus > 0 && <>⚔️+{equipBonus.atkBonus} </>}
                      {equipBonus.defBonus > 0 && <>🛡️+{equipBonus.defBonus} </>}
                      {equipBonus.hpBonus > 0 && <>❤️+{equipBonus.hpBonus} </>}
                      {totalEquip === 0 && "無裝備"}
                    </span>
                  </div>
                  {/* HP / ATK / DEF */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {[["❤️", "HP", catHP, "#4ade80"], ["⚔️", "ATK", catATK, "#f87171"], ["🛡️", "DEF", catDEF, "#60a5fa"]].map(([icon, lbl, val, clr]) => (
                      <div key={lbl} style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "3px 0", textAlign: "center" }}>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.4)" }}>{icon} {lbl}</div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: clr }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {/* ── 總射箭里程 ── */}
            {(() => {
              const total = profile?.totalArrowsAllTime || 0;
              const MILESTONES = [
                { arrows: 100,   label: "🎯 破百射手" },
                { arrows: 500,   label: "⭐ 五百箭射手" },
                { arrows: 1000,  label: "🔥 千箭射手" },
                { arrows: 5000,  label: "💫 五千箭射手" },
                { arrows: 10000, label: "⚡ 萬箭射手" },
                { arrows: 50000, label: "🏆 五萬箭傳說" },
              ];
              const nextMs = MILESTONES.find(m => m.arrows > total);
              const prevMs = [...MILESTONES].reverse().find(m => m.arrows <= total);
              const nextCount = nextMs?.arrows || 0;
              const prevCount = prevMs?.arrows ?? 0;
              const milePct = nextCount > 0 ? Math.min(100, Math.round((total - prevCount) / (nextCount - prevCount) * 100)) : 100;
              return (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>🏹 總射箭里程</span>
                    <span style={{ color: "#86efac", fontWeight: 900 }}>{total.toLocaleString()} 箭</span>
                  </div>
                  {nextCount > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
                        {prevMs ? prevMs.label : "起步"}
                      </span>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 4, height: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${milePct}%`, background: "linear-gradient(90deg,#86efac,#22c55e)", borderRadius: 4, transition: "width 0.4s" }} />
                      </div>
                      <span style={{ fontSize: 9, color: "#86efac", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {nextMs ? `目指 ${nextMs.label}` : "🏆 已達成"}
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: "#fbbf24", fontWeight: 700, textAlign: "center" }}>
                      🏆 已達成所有里程！
                    </div>
                  )}
                </div>
              );
            })()}
            {/* 資源列 */}
            <div style={{ display:"flex", gap:10, marginTop:8, flexWrap:"wrap" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"rgba(251,191,36,0.12)", borderRadius:8, padding:"4px 10px", minWidth:54 }}>
                <span style={{ fontSize:16 }}>🪙</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#fbbf24" }}>{coins.toLocaleString()}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>金幣</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"rgba(96,165,250,0.12)", borderRadius:8, padding:"4px 10px", minWidth:54 }}>
                <span style={{ fontSize:16 }}>💧</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#60a5fa" }}>{arrowdew.toLocaleString()}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>箭露</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"rgba(167,139,250,0.12)", borderRadius:8, padding:"4px 10px", minWidth:54 }}>
                <span style={{ fontSize:16 }}>🎰</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#a78bfa" }}>{gachaCoins.toLocaleString()}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>轉蛋幣</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"rgba(134,239,172,0.12)", borderRadius:8, padding:"4px 10px", minWidth:54 }}>
                <span style={{ fontSize:16 }}>🏹</span>
                <span style={{ fontSize:11, fontWeight:700, color:"#86efac" }}>{todayArrows}</span>
                <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)" }}>今日箭數</span>
              </div>
            </div>
            {/* 收藏進度列 */}
            {(() => {
              const dungeonOwned  = Object.keys(profile?.dungeonCollectibles || {}).length;
              const dungeonTotal  = Object.keys(COLLECTIBLE_MAP).length;
              const achOwned      = _ds.totalUnlocked;
              const achTotal      = _ds.totalAll;
              const ownedCatCards = profile?.catCards || {};
              const catOwned      = Object.keys(ownedCatCards).filter(id => (ownedCatCards[id] || 0) > 0).length;
              const catTotal      = CAT_CARDS.length;
              const cells = [
                { icon:"🗺️", label:"地下城圖鑑", owned:dungeonOwned, total:dungeonTotal, color:"#a78bfa" },
                { icon:"🎖️", label:"成就圖鑑",   owned:achOwned,    total:achTotal,    color:"#fbbf24" },
                { icon:"🐱", label:"貓貓卡片",   owned:catOwned,    total:catTotal,    color:"#f472b6" },
              ];
              return (
                <div style={{ display:"flex", gap:10, marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.08)", flexWrap:"wrap" }}>
                  {cells.map(c => (
                    <div key={c.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"rgba(255,255,255,0.06)", borderRadius:8, padding:"4px 10px", minWidth:72, flex:1 }}>
                      <span style={{ fontSize:14 }}>{c.icon}</span>
                      <span style={{ fontSize:11, fontWeight:900, color:c.color }}>{c.owned}<span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontWeight:400 }}>/{c.total}</span></span>
                      <span style={{ fontSize:8, color:"rgba(255,255,255,0.4)", textAlign:"center" }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* 月卡資訊 */}
            {(() => {
              const card = profile?.monthlyCard;
              const expires = card?.expiresAt?.toDate ? card.expiresAt.toDate() : null;
              const days = expires ? Math.ceil((expires - Date.now()) / 86400000) : null;
              const active = card?.active && days !== null && days > 0;
              const hasPending = monthlyReqs.some(r => r.status === "pending");
              if (!active) return null;
              return (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8, paddingTop:8, borderTop:"1px solid rgba(255,255,255,0.08)" }}>
                  <div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", fontWeight:700 }}>🎫 月卡</div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)" }}>到期 {expires.getMonth()+1}/{expires.getDate()}（剩{days}天）</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:18, fontWeight:900, color:"white" }}>{card.sessions} <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontWeight:400 }}>次</span></span>
                    {hasPending ? (
                      <span style={{ fontSize:10, background:"rgba(251,191,36,0.2)", color:"#fde68a", fontWeight:700, padding:"3px 8px", borderRadius:8 }}>⏳ 審核中</span>
                    ) : card.sessions > 0 ? (
                      <button onClick={() => { setShowCardModal(true); setCardMsg(""); setCardHours(1); }}
                        style={{ fontSize:10, background:"rgba(255,255,255,0.15)", color:"white", fontWeight:900, padding:"4px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.25)", cursor:"pointer" }}>
                        申請使用
                      </button>
                    ) : (
                      <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>次數已用完</span>
                    )}
                  </div>
                </div>
              );
            })()}
          </Card>
        );
      })()}

      {/* ── 快速入口（常用功能捷徑）───────────────────────────── */}
      <div>
        <SectionHeader icon="⚡" title="快速入口" />
        <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fit, minmax(64px, 1fr))" }}>
          {QUICK_LINKS.map(q => (
            <button key={q.page} onClick={() => onPageChange(q.page)}
              className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
              style={{ minHeight:64, borderRadius:"var(--r-md)", border:"1px solid var(--glass-border)", background:"var(--glass-bg)", boxShadow:"var(--shadow-card)", cursor:"pointer" }}>
              <span style={{ fontSize:20 }}>{q.icon}</span>
              <span style={{ fontSize:10, fontWeight:700, color:"var(--text-secondary)" }}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

function ClaimBtn({ logId, memberId }) {
  const [done, setDone] = useState(false);
  async function claim() {
    const { claimBadge } = await import("../../lib/db");
    await claimBadge(logId, memberId);
    setDone(true);
  }
  if (done) return <span className="text-green-600 text-xs font-bold">✅ 已確認</span>;
  return <button onClick={claim} className="text-xs bg-green-600 text-white font-bold px-2 py-1 rounded-lg">確認領取</button>;
}

function DisputeBtn({ logId, memberId }) {
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");
  async function submit() {
    const { reportBadgeError } = await import("../../lib/db");
    await reportBadgeError(logId, memberId, reason);
    setShow(false);
  }
  if (show) return (
    <div className="flex gap-1">
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="說明原因"
        className="text-xs border border-gray-300 rounded px-2 py-1 w-24" />
      <button onClick={submit} className="text-xs bg-red-500 text-white px-2 py-1 rounded">回報</button>
      <button onClick={() => setShow(false)} className="text-xs text-gray-400">取消</button>
    </div>
  );
  return <button onClick={() => setShow(true)} className="text-xs text-red-400 font-medium">有誤？</button>;
}

function CertLevelPip({ level }) {
  const map = {
    none: { label:"灰證", cls:"bg-gray-400/40 text-white" },
    blue: { label:"藍證", cls:"bg-blue-400 text-white" },
    gold: { label:"金證", cls:"bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-900" },
  };
  const s = map[level] || map.none;
  return <span className={`text-xs font-black px-2 py-0.5 rounded-full ${s.cls}`}>🎖️ {s.label}</span>;
}
