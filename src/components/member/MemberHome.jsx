// src/components/member/MemberHome.jsx
import { useState, useEffect } from "react";
import { getMemberResults, subscribeBadgeLogs, getCertRecords, subscribeCertification, subscribeNotifications, subscribeDexGrants, getDexConfig } from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import { getCohort, cohortLabel } from "../../lib/cohort";
import { useAuth } from "../../hooks/useAuth";
import { calcAge, formatArcherNo, fmtDT, BOW_TYPES, getCertLevel, COMP_TYPE_COLOR, certLevelStyle } from "../../lib/constants";
import { Card, ST, Spinner, BadgePip } from "../shared/UI";
import HonorTicker from "./HonorTicker";
import HonorCelebration from "./HonorCelebration";
import ShareCard from "./ShareCard";
import DailyQuest from "./DailyQuest";

const CERT_SHOW = ["recurve_bare", "compound", "traditional"];

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

export default function MemberHome({ onPageChange }) {
  const { profile } = useAuth();
  const [results, setResults]             = useState([]);
  const [badgeLogs, setBadgeLogs]         = useState([]);
  const [certRecords, setCertRecords]     = useState([]);
  const [certification, setCertification] = useState(null);
  const [unreadNotif, setUnreadNotif]     = useState(0);
  const [showShare, setShowShare]         = useState(false);
  const [dexGrants, setDexGrants]         = useState([]);
  const [dexConfig, setDexConfig]         = useState({ physicalMax: 10, pointMax: 10 });
  const [loading, setLoading]             = useState(true);
  const [cardTheme, setCardTheme]         = useCardTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    Promise.all([getMemberResults(profile.id), getCertRecords(profile.id)]).then(([r, c]) => {
      setResults(r); setCertRecords(c); setLoading(false);
    });
    const unsub  = subscribeBadgeLogs(profile.id, setBadgeLogs);
    const unsub2 = subscribeCertification(profile.id, setCertification);
    const unsub3 = subscribeNotifications(profile.id, list => {
      const n = list.filter(x =>
        !(x.readBy    || []).includes(profile.id) &&
        !(x.deletedBy || []).includes(profile.id)
      ).length;
      setUnreadNotif(n);
    }, profile?.createdAt);
    getDexConfig().then(setDexConfig).catch(() => {});
    const unsub4 = subscribeDexGrants(profile.id, setDexGrants);
    return () => { unsub?.(); unsub2?.(); unsub3?.(); unsub4?.(); };
  }, [profile?.id]); // eslint-disable-line

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

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      {showShare && <ShareCard onClose={() => setShowShare(false)} />}

      <HonorCelebration
        memberId={profile?.id}
        memberCreatedAt={profile?.createdAt}
        onGoPage={onPageChange}
      />
      <HonorTicker memberId={profile?.id} memberCreatedAt={profile?.createdAt} onGoPage={onPageChange} />
      <DailyQuest />

      {/* 打怪快捷入口 */}
      <button onClick={() => onPageChange("monster")}
        className="w-full rounded-2xl p-4 text-left relative overflow-hidden active:scale-95 transition-transform"
        style={{ background:"linear-gradient(135deg,#7c3aed,#1e3a8a)" }}>
        <div className="absolute -right-4 -bottom-4 text-8xl opacity-20 pointer-events-none">👹</div>
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-xs font-black tracking-widest text-purple-200 mb-0.5">⚔️ RPG 打怪模式</div>
            <div className="text-white font-black text-base">選怪物，射箭打怪，開寶箱！</div>
          </div>
          <div className="bg-white/20 text-white text-xs font-black px-3 py-1.5 rounded-full flex-shrink-0">立即挑戰 →</div>
        </div>
      </button>

      {pendingBadges.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-amber-700 font-bold text-sm mb-2">🎖️ 你有 {pendingBadges.length} 個徽章待確認領取！</div>
          {pendingBadges.map(b => (
            <div key={b.id} className="flex items-center justify-between py-2 border-b border-amber-100 last:border-0">
              <div className="text-amber-800 text-sm">
                {b.badgeType==="fatCat"?"🐱 肥貓章":b.badgeType==="score"?"⭐ 積分章":"🏆 成就章"}
                　{b.color==="gold"?"金":b.color==="silver"?"銀":b.color==="black"?"黑":"銅"}章 × {b.count}
              </div>
              <div className="flex gap-2">
                <ClaimBtn logId={b.id} memberId={profile.id} />
                <DisputeBtn logId={b.id} memberId={profile.id} />
              </div>
            </div>
          ))}
        </div>
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
              </div>
              {(() => {
                const ds = computeDexStats({
                  member: profile, certification, certRecords,
                  checkinCount: profile?.dailyQuestCount || 0,
                  granted: dexGrants,
                  physicalMax: dexConfig.physicalMax,
                  pointMax: dexConfig.pointMax,
                });
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

          <div className="bg-white/15 rounded-xl p-3 flex flex-col gap-3">
            {[
              ["🐱 肥貓章", profile.fatCat,     ["gold","silver","bronze"], ["金","銀","銅"]],
              ["⭐ 積分章", profile.score,       ["gold","silver","bronze"], ["金","銀","銅"]],
              ["🏆 成就章", profile.achievement, ["black","gold","silver"],  ["黑","金","銀"]],
            ].map(([lbl, data, keys, names]) => (
              <div key={lbl}>
                <div className="text-white/60 text-xs mb-1.5">{lbl}</div>
                <div className="flex gap-2">
                  {keys.map((k,i) => <BadgePip key={k} label={names[i]} color={k} count={(data||{})[k]||0} />)}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 border-t border-white/20">
              <div className="text-white/60 text-xs">🎪 賽事積分</div>
              <div className="text-white font-black text-xl">{profile.eventPoints || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 年度檢定 */}
      <Card className="p-4">
        <ST>{thisYear} 年度檢定</ST>
        <div className="grid grid-cols-3 gap-3 mt-1">
          {CERT_SHOW.map(bk => {
            const bt = BOW_TYPES[bk];
            const { score, level } = certOf(bk);
            const has = score > 0;
            const frameByLevel = {
              入門:"bg-gray-50 border-gray-200", 初級:"bg-emerald-50 border-emerald-200",
              中級:"bg-blue-50 border-blue-200", 進階:"bg-purple-50 border-purple-200",
              精英:"bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-300",
              菁英:"bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-300",
            };
            const frame = level ? (frameByLevel[level] || "bg-gray-50 border-gray-200")
              : (has ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-200");
            return (
              <div key={bk} className={`rounded-xl p-3 text-center border ${frame}`}>
                <div className="text-2xl mb-1">{bt.icon}</div>
                <div className="text-gray-500 text-xs mb-1">{bt.short}</div>
                {has ? (
                  <>
                    <div className="text-gray-800 font-black text-sm">{score} 分</div>
                    <div className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${level ? certLevelStyle(level, "solid") : "bg-gray-200 text-gray-500"}`}>
                      {level || "未達標"}
                    </div>
                  </>
                ) : (
                  <div className="inline-block bg-gray-200 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full mt-1">初心者</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {recentResults.length > 0 && (
        <Card className="p-4">
          <ST>最近成績</ST>
          {recentResults.map(r => {
            const tc = COMP_TYPE_COLOR[r.compType] || {};
            return (
              <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <div className="text-gray-700 text-sm font-medium">{r.compTitle || "—"}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {r.compType && <span className={`text-xs font-bold ${tc.text}`}>{r.compType}</span>}
                    <span className="text-gray-400 text-xs">{r.submittedAt ? fmtDT(r.submittedAt) : (r.date||"")}</span>
                  </div>
                </div>
                <div className="text-blue-600 font-black text-2xl">{r.total}</div>
              </div>
            );
          })}
          <button onClick={() => onPageChange("history")} className="text-blue-600 text-xs font-semibold mt-2">查看全部成績 →</button>
        </Card>
      )}
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