// src/components/member/MemberProfile.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateMember, getCertRecords, subscribeCertification, subscribeDexGrants, getDexConfig } from "../../lib/db";
import { computeDexStats } from "../../lib/achievementDex";
import { getCohort, cohortLabel } from "../../lib/cohort";
import { calcAge, formatArcherNo, BOW_TYPES, getCertLevel, certLevelStyle } from "../../lib/constants";
import { Card, Btn, Inp, ST, BadgePip } from "../shared/UI";
import { EquipmentManager, ArmorManager, AccessoryManager, normalizeEquipment } from "../shared/Equipment";
import { auth } from "../../lib/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

const CERT_SHOW = ["recurve_bare", "compound", "traditional"];
const HALF_LABEL = { first:"上半年", second:"下半年" };

// ── 主題定義（與 MemberHome 相同）────────────────────────
const CARD_THEMES = [
  { id:"ocean",  label:"深海藍", bg:"linear-gradient(135deg,#1d4ed8,#1e3a8a)" },
  { id:"night",  label:"暗夜紫", bg:"linear-gradient(135deg,#4c1d95,#312e81)" },
  { id:"forest", label:"森林綠", bg:"linear-gradient(135deg,#065f46,#14532d)" },
  { id:"fire",   label:"烈火紅", bg:"linear-gradient(135deg,#9f1239,#7f1d1d)" },
  { id:"desert", label:"沙漠金", bg:"linear-gradient(135deg,#92400e,#78350f)" },
  { id:"aurora", label:"極光粉", bg:"linear-gradient(135deg,#be185d,#7e22ce)" },
  { id:"steel",  label:"鋼鐵灰", bg:"linear-gradient(135deg,#374151,#1f2937)" },
  { id:"cosmos", label:"宇宙黑", bg:"linear-gradient(135deg,#0f172a,#1e1b4b)" },
  { id:"bluebay", label:"藍灣綠", bg:"linear-gradient(135deg,#00a1b4,#097988)"},
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

export default function MemberProfile({ onPageChange }) {
  const { profile } = useAuth();
  const [eq,            setEq]            = useState(normalizeEquipment(profile?.equipment));
  const [armorSets,     setArmorSets]     = useState(profile?.armorSets     || []);
  const [accessorySets, setAccessorySets] = useState(profile?.accessorySets || []);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [equipTab,      setEquipTab]      = useState("bow");
  const [certRecords,   setCertRecords]   = useState([]);
  const [showHistory,   setShowHistory]   = useState(false);
  const [certification, setCertification] = useState(null);
  const [dexGrants,     setDexGrants]     = useState([]);
  const [dexConfig,     setDexConfig]     = useState({ physicalMax:10, pointMax:10 });
  const [cardTheme,     setCardTheme]     = useCardTheme();
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => {
    setEq(normalizeEquipment(profile?.equipment));
    setArmorSets(profile?.armorSets || []);
    setAccessorySets(profile?.accessorySets || []);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return;
    getCertRecords(profile.id).then(setCertRecords).catch(() => setCertRecords([]));
    const unsub  = subscribeCertification(profile.id, setCertification);
    getDexConfig().then(setDexConfig).catch(() => {});
    const unsub2 = subscribeDexGrants(profile.id, setDexGrants);
    return () => { unsub?.(); unsub2?.(); };
  }, [profile?.id]);

  async function saveEquip() {
    setSaving(true);
    await updateMember(profile.id, { equipment:eq, armorSets, accessorySets }, profile.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const thisYear = new Date().getFullYear();

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
        <div className="text-gray-600 text-xs font-bold mb-2">{g.year}年{HALF_LABEL[g.half]}</div>
        <div className="grid grid-cols-3 gap-3">
          {CERT_SHOW.map(bk => {
            const bt = BOW_TYPES[bk];
            const score = g.scores[bk] || 0;
            const level = getCertLevel(bk, score);
            return <CertChip key={bk} icon={bt.icon} name={bt.short} score={score} level={level} />;
          })}
        </div>
      </div>
    );
  }

  const quickLinks = [
    { id:"party",         icon:"👥", label:"組隊模式",  desc:"日常分享與組隊打怪" },
    { id:"materials",     icon:"🎒", label:"材料背包",  desc:"開箱、升級、合成" },
    { id:"monsterdex",    icon:"📖", label:"怪物圖鑑",  desc:"擊敗怪物的戰績" },
    { id:"notifications", icon:"🔔", label:"訊息中心",  desc:"公告與祝賀" },
    { id:"dex",           icon:"🎖️", label:"成就圖鑑",  desc:"我的數位收藏" },
    { id:"comps",         icon:"🎯", label:"年度檢定",  desc:"參加檢定考試" },
    { id:"learn",         icon:"📓", label:"學習紀錄",  desc:"查看教練回饋" },
    { id:"history",       icon:"📊", label:"成績歷史",  desc:"所有參賽紀錄" },
    { id:"msgs",          icon:"✉️", label:"留言教練",  desc:"傳送訊息給教練" },
    { id:"external",      icon:"🏅", label:"對外比賽",  desc:"申報外部成績" },
  ];

  const currentTheme = CARD_THEMES.find(t => t.id === cardTheme) || CARD_THEMES[0];

  return (
    <div className="p-4 flex flex-col gap-4">

      {/* ── 狀態卡（可換主題）─────────────────────────────── */}
      <div className="p-5 border-0 text-white relative "
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

        <div className="relative">
          <div className="flex justify-between mb-3">
            <div>
              <div className="text-white/60 text-xs mb-1">射手</div>
              <div className="font-black text-2xl">{profile?.nickname || profile?.name}</div>
              <div className="text-white/70 text-sm">{profile?.name}</div>
            </div>
            <div className="flex items-start gap-2">
              {/* 調色盤 */}
              <div className="relative">
                <button onClick={() => setShowThemePicker(v => !v)}
                  className="text-xl leading-none opacity-70 hover:opacity-100 transition-opacity"
                  title="更換主題">🎨</button>
                {showThemePicker && (
                  <div className="absolute right-0 top-8 z-50 bg-white rounded-2xl shadow-2xl p-3 w-48"
                    style={{ border:"1px solid #e2e8f0" }}>
                    <div className="text-gray-500 text-xs font-bold mb-2 px-1">選擇主題</div>
                    <div className="grid grid-cols-4 gap-2">
                      {CARD_THEMES.map(t => (
                        <button key={t.id} onClick={() => { setCardTheme(t.id); setShowThemePicker(false); }}
                          title={t.label}
                          className="flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all active:scale-90"
                          style={{ background:cardTheme===t.id?"#ede9fe":"transparent", border:cardTheme===t.id?"2px solid #7c3aed":"2px solid transparent" }}>
                          <div className="w-7 h-7 rounded-full" style={{ background:t.bg }} />
                          <span className="text-gray-600 text-[9px] font-bold leading-tight text-center">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-5xl">🏹</div>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-white/60 text-xs">
            <div>加入日期：{profile?.joinDate}</div>
            <div>射齡：{calcAge(profile?.joinDate)}{getCohort(profile?.joinDate) != null ? `　${cohortLabel(getCohort(profile?.joinDate))}` : ""}</div>
            {(() => {
              const ds = computeDexStats({ member:profile, certification, certRecords, checkinCount:profile?.dailyQuestCount||0, granted:dexGrants, physicalMax:dexConfig.physicalMax, pointMax:dexConfig.pointMax });
              return (
                <div className="flex items-center gap-3 flex-wrap mt-0.5">
                  <span>🎖️ 圖鑑 {ds.totalUnlocked}/{ds.totalAll}</span>
                  {(ds.gold+ds.silver+ds.bronze)>0 && <span>🥇{ds.gold} 🥈{ds.silver} 🥉{ds.bronze}</span>}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <ArcherCard profile={profile} certification={certification} onExam={() => onPageChange("certexam")} />

      {/* 年度檢定 */}
      <Card className="p-4">
        <ST>🎖️ 年度檢定級別</ST>
        {thisYearKeys.length === 0 ? (
          <div className="grid grid-cols-3 gap-3 mt-1">
            {CERT_SHOW.map(bk => {
              const bt = BOW_TYPES[bk];
              return <CertChip key={bk} icon={bt.icon} name={bt.short} score={0} level={null} />;
            })}
          </div>
        ) : (
          <div className="mt-1">{thisYearKeys.map(k => <CertBlock key={k} g={groups[k]} />)}</div>
        )}
        {pastKeys.length > 0 && (
          <div className="mt-2 border-t border-gray-100 pt-2">
            <button onClick={() => setShowHistory(!showHistory)} className="text-blue-600 text-xs font-bold">
              {showHistory ? "▲ 收起歷年檢定成績" : "▼ 查看歷年檢定成績"}
            </button>
            {showHistory && (
              <div className="mt-3">{pastKeys.map(k => <CertBlock key={k} g={groups[k]} />)}</div>
            )}
          </div>
        )}
      </Card>

      {/* 徽章 */}
      <Card className="p-4">
        <ST>徽章總覽</ST>
        <div className="flex flex-col gap-3">
          {[["🐱 肥貓章", profile?.fatCat,     ["gold","silver","bronze"], ["金","銀","銅"]],
            ["⭐ 積分章", profile?.score,       ["gold","silver","bronze"], ["金","銀","銅"]],
            ["🏆 成就章", profile?.achievement, ["black","gold","silver"],  ["黑","金","銀"]]
          ].map(([lbl, data, keys, names]) => (
            <div key={lbl}>
              <div className="text-gray-400 text-xs mb-1.5">{lbl}</div>
              <div className="flex gap-2">
                {keys.map((k,i) => <BadgePip key={k} label={names[i]} color={k} count={(data||{})[k]||0} />)}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="text-gray-500 text-xs">🎪 賽事積分</div>
            <div className="text-blue-600 font-black text-xl">{profile?.eventPoints || 0}</div>
          </div>
        </div>
      </Card>

      {/* 快捷連結 */}
      <div className="grid grid-cols-3 gap-3">
        {quickLinks.map(l => (
          <button key={l.id} onClick={() => onPageChange(l.id)}
            className="bg-white border border-gray-200 rounded-2xl p-3 text-center hover:border-blue-300 hover:bg-blue-50 transition-all active:scale-95">
            <div className="text-2xl mb-1">{l.icon}</div>
            <div className="text-gray-700 font-bold text-xs">{l.label}</div>
            <div className="text-gray-400 text-xs mt-0.5">{l.desc}</div>
          </button>
        ))}
      </div>

      {/* 裝備管理 */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <ST>🎒 我的裝備</ST>
          <span className="text-gray-400 text-xs">編輯後請按儲存</span>
        </div>
        <div className="flex gap-2 mb-4">
          {[{key:"bow",label:"🏹 弓組"},{key:"armor",label:"🛡️ 防具"},{key:"accessory",label:"✨ 飾品"}].map(t => (
            <button key={t.key} onClick={() => setEquipTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${equipTab===t.key?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {equipTab === "bow"       && <EquipmentManager value={eq} onChange={setEq} />}
          {equipTab === "armor"     && <ArmorManager value={armorSets} onChange={setArmorSets} />}
          {equipTab === "accessory" && <AccessoryManager value={accessorySets} onChange={setAccessorySets} />}
          <Btn v="primary" className="w-full py-3" onClick={saveEquip} disabled={saving}>
            {saving ? "儲存中…" : saved ? "✅ 已儲存" : "儲存裝備"}
          </Btn>
        </div>
      </Card>

      <AccountSettings profile={profile} />
    </div>
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
    setPwErr(""); setPwMsg("");
    if (!oldPw || !newPw || !newPw2) { setPwErr("請完整填寫舊密碼與新密碼"); return; }
    if (newPw.length < 6) { setPwErr("新密碼至少 6 個字元"); return; }
    if (newPw !== newPw2) { setPwErr("兩次輸入的新密碼不一致"); return; }
    const user = auth.currentUser;
    if (!user || !user.email) { setPwErr("無法取得登入資訊，請重新登入後再試"); return; }
    setSavingPw(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, oldPw);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPw);
      setPwMsg("✅ 密碼已更新");
      setOldPw(""); setNewPw(""); setNewPw2("");
      setTimeout(() => setPwMsg(""), 3000);
    } catch (e) {
      const code = e?.code || "";
      if (code==="auth/wrong-password"||code==="auth/invalid-credential") setPwErr("舊密碼不正確");
      else if (code==="auth/too-many-requests") setPwErr("嘗試次數過多，請稍後再試");
      else if (code==="auth/requires-recent-login") setPwErr("登入逾時，請登出後重新登入再修改");
      else setPwErr("更新失敗：" + (e?.message||""));
    }
    setSavingPw(false);
  }

  return (
    <Card className="p-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between">
        <ST>⚙️ 帳號設定</ST>
        <span className="text-gray-400 text-xs">{open?"▲ 收起":"▼ 修改暱稱 / 密碼"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-5 mt-3">
          <div className="flex flex-col gap-2">
            <div className="text-gray-600 text-xs font-bold">修改暱稱</div>
            <Inp label="暱稱" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="輸入新暱稱" />
            <Btn v="primary" className="w-full" onClick={saveNick} disabled={savingNick}>
              {savingNick?"儲存中…":"更新暱稱"}
            </Btn>
            {nickMsg && <div className={`text-xs ${nickMsg.startsWith("✅")?"text-green-600":"text-red-500"}`}>{nickMsg}</div>}
          </div>
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
            <div className="text-gray-600 text-xs font-bold">修改密碼</div>
            <Inp label="目前密碼" type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="輸入目前密碼" />
            <Inp label="新密碼（至少 6 字元）" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="輸入新密碼" />
            <Inp label="確認新密碼" type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} placeholder="再次輸入新密碼" />
            <Btn v="primary" className="w-full" onClick={changePw} disabled={savingPw}>
              {savingPw?"更新中…":"更新密碼"}
            </Btn>
            {pwErr && <div className="text-xs text-red-500">{pwErr}</div>}
            {pwMsg && <div className="text-xs text-green-600">{pwMsg}</div>}
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
  const cardBg = {
    none: "linear-gradient(135deg,#475569 0%,#334155 100%)",
    blue: "linear-gradient(135deg,#1e3a8a 0%,#2563eb 50%,#0e7490 100%)",
    gold: "linear-gradient(135deg,#78350f 0%,#b45309 40%,#f59e0b 100%)",
  };
  const levelLabel = { none:"灰證 · 未通過畢業考", blue:"藍證", gold:"金證" };
  const levelBadge = {
    none: "bg-gray-400 text-white",
    blue: "bg-blue-400 text-white",
    gold: "bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-900",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg"
      style={{ background: cardBg[level] || cardBg.none }}>
      <div className="absolute -right-6 -bottom-6 opacity-20" aria-hidden>
        <div style={{ width:120, height:120, borderRadius:"9999px",
          background:"radial-gradient(circle, #fbbf24 0 18%, #fff 18% 34%, #ef4444 34% 50%, #fff 50% 66%, #1e293b 66% 82%, #fff 82% 100%)" }} />
      </div>
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs tracking-[0.3em] text-cyan-100 font-bold">貓小隊射箭場 · 射手證</span>
          </div>
          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${levelBadge[level]}`}>
            🎖️ {levelLabel[level]}
          </span>
        </div>
        {hasNo ? (
          <>
            <div className="text-cyan-100 text-xs mb-1">證號 ARCHER ID</div>
            <div className="font-black text-3xl tracking-wider mb-3"
              style={{ fontFamily:"monospace", textShadow:"0 2px 8px rgba(0,0,0,.4)" }}>
              {formatArcherNo(profile.archerNo)}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-white font-bold text-lg leading-tight">{profile?.name}</div>
                {profile?.nickname && <div className="text-cyan-100 text-xs">「{profile.nickname}」</div>}
              </div>
              {profile?.archerNoDate && (
                <div className="text-right text-cyan-100 text-xs">
                  <div>領證日期</div>
                  <div className="font-bold text-white">{profile.archerNoDate}</div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="py-2">
            <div className="text-cyan-50 text-sm font-bold mb-1">尚未領取射手證</div>
            <div className="text-cyan-100/70 text-xs">完成檢定後，向教練申請專屬射手證號 🏹</div>
          </div>
        )}
        <button onClick={onExam}
          className="mt-4 w-full bg-white/15 hover:bg-white/25 backdrop-blur rounded-xl py-2.5 text-white text-sm font-bold border border-white/20 transition-all">
          {locked ? "🏆 已達最高級（金證）查看" : level==="blue" ? "🎖️ 挑戰金證畢業考 →" : level==="gold" ? "🏆 查看射手證" : "🎖️ 前往畢業考 →"}
        </button>
        {(certification?.blue?.grantedAt || certification?.gold?.grantedAt) && (
          <div className="mt-3 flex flex-col gap-2">
            {certification?.blue?.grantedAt && <CertDetailRow tier="藍證" tierColor="text-blue-100" data={certification.blue} />}
            {certification?.gold?.grantedAt && <CertDetailRow tier="金證" tierColor="text-amber-200" data={certification.gold} />}
          </div>
        )}
      </div>
    </div>
  );
}

function CertDetailRow({ tier, tierColor, data }) {
  const BOW_LABEL = { rental:"租借器材", traditional:"傳統弓", recurve_bare:"裸弓", recurve_full:"全配", compound:"美式獵弓" };
  function fmtGrant(ts) {
    if (!ts) return "—";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("zh-TW", { year:"numeric", month:"2-digit", day:"2-digit" });
  }
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/15">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-black ${tierColor}`}>🎖️ {tier}</span>
        <span className="text-cyan-100 text-xs">領證 {fmtGrant(data.grantedAt)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        {[["🏹 弓組", data.bowLabel||(BOW_LABEL[data.bowType])||"—"],
          ["🛡️ 防具", data.armorLabel||"—"],
          ["✨ 飾品", data.accessoryLabel||"—"]].map(([lbl,val]) => (
          <div key={lbl} className="bg-white/5 rounded-lg py-1.5 px-1">
            <div className="text-cyan-100/60 text-[9px] mb-0.5">{lbl}</div>
            <div className="text-white text-[10px] font-bold leading-tight">{val}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-white/5 rounded-lg py-1.5">
          <div className="text-cyan-100/60 text-[9px] mb-0.5">任務1 中靶</div>
          <div className="text-white text-xs font-bold">{data.task1?.hits!=null?`${data.task1.hits} 箭`:"—"}</div>
        </div>
        <div className="bg-white/5 rounded-lg py-1.5">
          <div className="text-cyan-100/60 text-[9px] mb-0.5">任務2 分數</div>
          <div className="text-white text-xs font-bold">{data.task2?.score!=null?`${data.task2.score} 分`:"—"}</div>
        </div>
      </div>
    </div>
  );
}

function CertChip({ icon, name, score, level }) {
  const has = score > 0;
  return (
    <div className={`rounded-xl p-3 text-center border ${level?"bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200":has?"bg-blue-50 border-blue-100":"bg-gray-50 border-gray-200"}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-gray-500 text-xs mb-1">{name}</div>
      {has ? (
        <>
          <div className="text-gray-800 font-black text-sm">{score} 分</div>
          <div className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${level?certLevelStyle(level,"solid"):"bg-gray-200 text-gray-500"}`}>
            {level||"未達標"}
          </div>
        </>
      ) : (
        <div className="inline-block bg-gray-200 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full mt-1">初心者</div>
      )}
    </div>
  );
}