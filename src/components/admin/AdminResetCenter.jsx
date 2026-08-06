// src/components/admin/AdminResetCenter.jsx — 重置中心（含地下城解鎖給予 + 報到取消排序）
import { useState, useEffect, useMemo } from "react";
import {
  getMembers,
  resetDungeonUsed, resetAllDungeonUsed,
  resetMonsterSession, resetAllMonsterSessions,
  resetCouncilDailyLimit, resetAllCouncilDailyLimits,
  forceEndTodayCheckins, resetCheckinCount, resetAllCheckinCounts,
} from "../../lib/db";
import {
  subscribeActiveWorldBoss,
  resetWorldBossAttack, resetAllWorldBossAttacks,
} from "../../lib/worldBossDb";
import { deleteAllDungeonRooms } from "../../lib/dungeonDb";
import { grantDungeonScroll, grantDungeonToMember, EXCAVATION_FAMILIES, MAX_SAVED_DUNGEONS } from "../../lib/dungeonExcavation";
import { deleteAllPartyRooms } from "../../lib/partyDb";
import { fmtDT } from "../../lib/constants";
import { Card, Btn, Modal, Spinner } from "../shared/UI";
import AdminPracticeLogRepair from "./AdminPracticeLogRepair";

const FAMILY_LABELS = {
  ghost:"幽冥系", mountain:"山嶺系", insect:"昆蟲系",
  workplace:"職場系", exam:"考試系", temple:"神廟系",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function getLoginTime(m) {
  const ts = m.lastLoginAt || m.lastCheckinAt || m.lastBookingAt || m.updatedAt || m.createdAt;
  if (!ts) return 0;
  return ts?.toMillis ? ts.toMillis() : new Date(ts).getTime();
}

// DUNGEON_REGIONS（綠洲遺跡／密林深處／古墓迷宮／火山地窟／冰原雪嶺）已於 2026-08-06 移除：
// 現行地下城用的是**族系**（幽冥／山嶺／昆蟲／職場／考試／神廟／寶箱），這五個地區在遊戲裡
// 從來不存在，是跟 dungeonProgress.{region}.maxFloor 一起留下來的舊設計殘骸。

export default function AdminResetCenter() {
  const [members,  setMembers]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busyD,    setBusyD]    = useState("");
  const [busyM,    setBusyM]    = useState("");
  const [busyWB,   setBusyWB]   = useState("");
  const [busyC,    setBusyC]    = useState("");
  const [busyK,    setBusyK]    = useState("");
  const [busyR,    setBusyR]    = useState("");
  const [msg,      setMsg]      = useState("");
  const [tab,      setTab]      = useState("checkin");
  const [wbEvent,  setWbEvent]  = useState(null);

  // 地下城指定給予 State
  const [selDungeonMember, setSelDungeonMember] = useState(null);
  const [scrollGrantQty, setScrollGrantQty]     = useState("");
  const [grantFamily, setGrantFamily]           = useState("random");
  const [grantDifficulty, setGrantDifficulty]   = useState("random");
  const [grantingDungeon, setGrantingDungeon]   = useState(false);

  const today = todayStr();

  useEffect(() => {
    getMembers().then(list => {
      // 按照登入順序降序排列（最新登入排在前面）
      list.sort((a, b) => getLoginTime(b) - getLoginTime(a));
      setMembers(list);
      setLoading(false);
    });
    const unsub = subscribeActiveWorldBoss(setWbEvent);
    return () => unsub();
  }, []);

  // 按登入順序排序的成員列表
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => getLoginTime(b) - getLoginTime(a));
  }, [members]);

  // ── 地下城重置 ───────────────────────────────────────────
  async function handleResetDungeonOne(id, name) {
    setBusyD(id); setMsg("");
    await resetDungeonUsed(id);
    setMembers(prev => prev.map(m => m.id === id ? { ...m, lastDungeonDate: null } : m));
    setMsg(`✅ ${name} 地下城次數已重置`);
    setBusyD("");
  }
  async function handleResetDungeonAll() {
    if (!window.confirm("確定重置所有成員的地下城次數？")) return;
    setBusyD("all"); setMsg("");
    await resetAllDungeonUsed();
    setMembers(prev => prev.map(m => ({ ...m, lastDungeonDate: null })));
    setMsg("✅ 全員地下城次數已重置");
    setBusyD("");
  }

  // ── 地下城給予/解鎖進度 ─────────────────────────────────
  // ⚠️ 2026-08-06 修正：這一整區原本寫 `dungeonScrollCount` 與 `dungeonProgress.{region}.maxFloor`
  //    兩個**前台從來沒讀過**的欄位（全專案零讀取點，是更早期地下城設計的殘留），
  //    所以後台顯示「給予成功」但玩家那邊完全沒東西。
  //    真正的模型是 `members.{id}.dungeonExcavation.scrolls` 與 `.savedDungeons`，
  //    現在一律呼叫 dungeonExcavation.js 的函式（與前台同一條路徑），不再自己 updateDoc。
  async function handleGrantDungeonScrolls() {
    const qty = Number(scrollGrantQty);
    if (!selDungeonMember || !scrollGrantQty || isNaN(qty) || qty <= 0) {
      setMsg("❌ 請選擇射手與有效數額");
      return;
    }
    setGrantingDungeon(true);
    try {
      // grantDungeonScroll 一次給一張（與前台世界王獎勵同一支），要 N 張就叫 N 次
      let last = { ok: true };
      for (let i = 0; i < qty; i += 1) {
        last = await grantDungeonScroll(selDungeonMember.id);
        if (!last.ok) break;
      }
      if (!last.ok) throw new Error(last.reason || "寫入失敗");
      setMembers(prev => prev.map(m => m.id === selDungeonMember.id
        ? { ...m, dungeonExcavation: { ...(m.dungeonExcavation || {}), scrolls: last.scrolls } }
        : m));
      setMsg(`✅ 已為 ${selDungeonMember.name || selDungeonMember.nickname} 給予卷軸 ×${qty}（目前共 ${last.scrolls} 張）`);
      setScrollGrantQty("");
    } catch (e) {
      setMsg("❌ 給予失敗：" + e.message);
    }
    setGrantingDungeon(false);
  }

  // 直接把一座地下城塞進玩家的儲存槽（取代原本寫死在死欄位上的「解鎖層數」）
  async function handleGrantDungeon() {
    if (!selDungeonMember) { setMsg("❌ 請先選擇射手"); return; }
    setGrantingDungeon(true);
    try {
      const res = await grantDungeonToMember(selDungeonMember.id, {
        family: grantFamily === "random" ? undefined : grantFamily,
        difficulty: grantDifficulty === "random" ? undefined : Number(grantDifficulty),
      });
      if (!res.ok) throw new Error(res.reason || "寫入失敗");
      setMembers(prev => prev.map(m => m.id === selDungeonMember.id
        ? { ...m, dungeonExcavation: { ...(m.dungeonExcavation || {}), savedDungeons: res.savedDungeons } }
        : m));
      setMsg(`✅ 已給 ${selDungeonMember.name || selDungeonMember.nickname} 一座「${FAMILY_LABELS[res.dungeon.family] || res.dungeon.family} T${res.dungeon.difficulty}」（儲存槽 ${res.savedDungeons.length}/${MAX_SAVED_DUNGEONS}）`);
    } catch (e) {
      setMsg("❌ 給予失敗：" + e.message);
    }
    setGrantingDungeon(false);
  }

  // ── 打怪次數重置 ─────────────────────────────────────────
  async function handleResetMonsterOne(id, name) {
    setBusyM(id); setMsg("");
    await resetMonsterSession(id);
    setMsg(`✅ ${name} 今日打怪次數已重置`);
    setBusyM("");
  }
  async function handleResetMonsterAll() {
    if (!window.confirm("確定重置所有成員的今日打怪次數？")) return;
    setBusyM("all"); setMsg("");
    await resetAllMonsterSessions();
    setMsg("✅ 全員打怪次數已重置");
    setBusyM("");
  }

  // ── 報到取消與次數重置 ───────────────────────────────────
  async function handleResetCheckinOne(id, name) {
    setBusyK(id); setMsg("");
    try {
      await forceEndTodayCheckins();
      await resetCheckinCount(id);
      setMembers(prev => prev.map(m => m.id === id ? { ...m, dailyQuestCount: 0 } : m));
      setMsg(`✅ ${name} 今日報到已取消且累積次數已歸零`);
    } catch (e) { setMsg("❌ 失敗：" + (e?.message || "")); }
    setBusyK("");
  }
  async function handleResetCheckinAll() {
    if (!window.confirm("確定要強制結束今日所有進行中的報到，並重置所有成員的報到累積次數？")) return;
    setBusyK("all"); setMsg("");
    try {
      const ended = await forceEndTodayCheckins();
      await resetAllCheckinCounts(members.map(m => m.id));
      setMembers(prev => prev.map(m => ({ ...m, dailyQuestCount: 0 })));
      setMsg(`✅ 全員報到次數已歸零${ended > 0 ? `（強制結束 ${ended} 人的進行中報到）` : ""}`);
    } catch (e) { setMsg("❌ 失敗：" + (e?.message || "")); }
    setBusyK("");
  }

  // ── 議會廳次數重置 ───────────────────────────────────────
  async function handleResetCouncilOne(id, name) {
    setBusyC(id); setMsg("");
    await resetCouncilDailyLimit(id);
    setMsg(`✅ ${name} 議會廳次數已重置（5次）`);
    setBusyC("");
  }
  async function handleResetCouncilAll() {
    if (!window.confirm("確定重置所有成員的今日議會廳次數？")) return;
    setBusyC("all"); setMsg("");
    await resetAllCouncilDailyLimits(members.map(m => m.id));
    setMsg("✅ 全員議會廳次數已重置");
    setBusyC("");
  }

  // ── 世界王重置 ───────────────────────────────────────────
  async function handleResetWBOne(memberId, name) {
    if (!wbEvent) return;
    setBusyWB(memberId); setMsg("");
    await resetWorldBossAttack(wbEvent.id, memberId);
    setMsg(`✅ ${name} 世界王今日出戰已重置`);
    setBusyWB("");
  }
  async function handleResetWBAll() {
    if (!wbEvent) return;
    if (!window.confirm("確定重置所有人今日的世界王出戰？")) return;
    setBusyWB("all"); setMsg("");
    await resetAllWorldBossAttacks(wbEvent.id);
    setMsg("✅ 全員世界王出戰已重置");
    setBusyWB("");
  }

  // ── 房間清除 ────────────────────────────────────────────────
  async function handleDeleteAllRooms() {
    if (!window.confirm("確定刪除所有房間（地下城 + 組隊）？所有進行中的戰鬥都會中斷。")) return;
    setBusyR("all"); setMsg("");
    const [nd, np] = await Promise.all([deleteAllDungeonRooms(), deleteAllPartyRooms()]);
    setMsg(`✅ 已刪除地下城 ${nd} 間 + 組隊 ${np} 間`);
    setBusyR("");
  }

  const dungeonUsedToday = sortedMembers.filter(m => m.lastDungeonDate === today);
  const dungeonFree      = sortedMembers.filter(m => m.lastDungeonDate !== today);

  const wbParts     = Object.entries(wbEvent?.participants || {});

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 text-slate-100">
      <div className="font-black text-xl text-white flex items-center gap-2">
        🔄 系統重置與地下城給予中心
      </div>

      {/* 分頁 */}
      <div className="grid grid-cols-3 sm:grid-cols-8 gap-2">
        {[
          { id: "checkin",      label: "📍 報到取消" },
          { id: "dungeonGrant", label: "🏰 地下城給予" },
          { id: "dungeon",      label: "🏰 地下城重置" },
          { id: "monster",      label: "⚔️ 打怪" },
          { id: "worldboss",    label: "🌍 世界王" },
          { id: "council",      label: "🏛️ 議會廳" },
          { id: "rooms",        label: "🚪 房間" },
          { id: "arrowRepair",  label: "🩹 箭數補正" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMsg(""); }}
            className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
              tab === t.id
                ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 訊息提示 */}
      {msg && (
        <div className={`p-3.5 rounded-xl text-xs font-bold ${
          msg.startsWith("✅")
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
        }`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">載入成員列表中…</div>
      ) : (
        <>
          {/* ── 1. 取消報到（按照登入順序排列） ───────────────── */}
          {tab === "checkin" && (
            <div className="space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 leading-relaxed">
                已按<b>最新登入時間排序</b>。點擊「取消報到/歸零」會先強制結束該成員今日進行中的報到，並將累積次數清零。
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  共 {sortedMembers.length} 位射手（最新登入排在最前方）
                </div>
                <Btn v="warn" size="sm" onClick={handleResetCheckinAll} disabled={!!busyK}>
                  {busyK === "all" ? "重置中…" : "⚡ 全員報到歸零"}
                </Btn>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {sortedMembers.map(m => {
                  const lastTime = getLoginTime(m);
                  return (
                    <Card key={m.id} className="p-3 bg-slate-800/90 border-slate-700/80 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{m.nickname || m.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {m.archerNo ? `CA-${String(m.archerNo).padStart(4,"0")}` : ""}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          報到次數：<span className="text-indigo-400 font-bold">{m.dailyQuestCount || 0} 次</span>
                          ・最新登入：{lastTime ? fmtDT(lastTime) : "未有紀錄"}
                        </div>
                      </div>

                      <Btn
                        v="secondary"
                        size="sm"
                        onClick={() => handleResetCheckinOne(m.id, m.name || m.nickname)}
                        disabled={!!busyK}
                      >
                        {busyK === m.id ? "…" : "取消報到/歸零"}
                      </Btn>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 2. 地下城指定給予與解鎖 ───────────────────────── */}
          {tab === "dungeonGrant" && (
            <Card className="p-5 bg-slate-800/90 border-slate-700/80 space-y-5">
              <div className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                🏰 地下城卷軸給予與指定進度解鎖
              </div>

              {/* 選擇射手 */}
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                  1. 選擇射手（按最新登入時間排序）
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {sortedMembers.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelDungeonMember(m)}
                      className={`p-2 rounded-xl text-xs font-bold border transition text-left ${
                        selDungeonMember?.id === m.id
                          ? "bg-amber-600/20 border-amber-500 text-amber-300"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="truncate text-white">{m.nickname || m.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        卷軸 {m.dungeonExcavation?.scrolls || 0} · 地城 {(m.dungeonExcavation?.savedDungeons || []).length}/{MAX_SAVED_DUNGEONS}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 給予卷軸 */}
              <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-700/70 space-y-3">
                <div className="text-xs font-bold text-slate-300">給予地下城探索卷軸</div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="輸入給予張數…"
                    value={scrollGrantQty}
                    onChange={e => setScrollGrantQty(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <Btn v="warn" size="sm" onClick={handleGrantDungeonScrolls} disabled={!selDungeonMember || grantingDungeon}>
                    {grantingDungeon ? "給予中…" : "🎁 給予卷軸"}
                  </Btn>
                </div>
              </div>

              {/* 直接給一座地下城 */}
              <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-700/70 space-y-3">
                <div className="text-xs font-bold text-slate-300">直接給一座地下城（不消耗卷軸）</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">族系</span>
                    <select
                      value={grantFamily}
                      onChange={e => setGrantFamily(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="random">🎲 隨機</option>
                      {EXCAVATION_FAMILIES.map(f => (
                        <option key={f} value={f}>{FAMILY_LABELS[f] || f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">難度</span>
                    <select
                      value={grantDifficulty}
                      onChange={e => setGrantDifficulty(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="random">🎲 隨機</option>
                      {[1, 2, 3, 4, 5, 6].map(t => (
                        <option key={t} value={t}>T{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Btn v="primary" size="sm" onClick={handleGrantDungeon} disabled={!selDungeonMember || grantingDungeon} className="w-full">
                  {grantingDungeon ? "給予中…" : "🏰 給予地下城"}
                </Btn>
                <div className="text-[10px] text-slate-500 leading-relaxed">
                  寫入 <code className="text-slate-400">dungeonExcavation.savedDungeons</code>，
                  與玩家用卷軸開出來的走同一條路徑，前台「地下城儲存槽」立刻看得到。
                  儲存槽上限 {MAX_SAVED_DUNGEONS} 座，滿了要先用掉。
                </div>
              </div>
            </Card>
          )}

          {/* ── 3. 地下城次數重置 ────────────────────────────── */}
          {tab === "dungeon" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  今日已使用 <span className="font-bold text-rose-400">{dungeonUsedToday.length}</span> 人
                </div>
                <Btn v="warn" size="sm" onClick={handleResetDungeonAll} disabled={!!busyD}>
                  {busyD === "all" ? "重置中…" : "全員地下城重置"}
                </Btn>
              </div>
              {dungeonUsedToday.map(m => (
                <Card key={m.id} className="p-3 bg-slate-800/90 border-slate-700/80 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{m.name || m.nickname}</span>
                  <Btn v="danger" size="sm" onClick={() => handleResetDungeonOne(m.id, m.name)} disabled={!!busyD}>
                    {busyD === m.id ? "…" : "重置次數"}
                  </Btn>
                </Card>
              ))}
            </div>
          )}

          {/* ── 4. 打怪次數重置 ─────────────────────────────── */}
          {tab === "monster" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">重置射手的今日打怪次數</div>
                <Btn v="warn" size="sm" onClick={handleResetMonsterAll} disabled={!!busyM}>
                  {busyM === "all" ? "重置中…" : "全員打怪次數重置"}
                </Btn>
              </div>
              {sortedMembers.map(m => (
                <Card key={m.id} className="p-3 bg-slate-800/90 border-slate-700/80 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{m.name || m.nickname}</span>
                  <Btn v="secondary" size="sm" onClick={() => handleResetMonsterOne(m.id, m.name)} disabled={!!busyM}>
                    {busyM === m.id ? "…" : "重置"}
                  </Btn>
                </Card>
              ))}
            </div>
          )}

          {/* ── 5. 議會廳次數重置 ────────────────────────────── */}
          {tab === "council" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">重置後可立即再進行採集（每日上限 5 次）</div>
                <Btn v="warn" size="sm" onClick={handleResetCouncilAll} disabled={!!busyC}>
                  {busyC === "all" ? "重置中…" : "全員議會廳重置"}
                </Btn>
              </div>
              {sortedMembers.map(m => (
                <Card key={m.id} className="p-3 bg-slate-800/90 border-slate-700/80 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{m.name || m.nickname}</span>
                  <Btn v="secondary" size="sm" onClick={() => handleResetCouncilOne(m.id, m.name)} disabled={!!busyC}>
                    {busyC === m.id ? "…" : "重置"}
                  </Btn>
                </Card>
              ))}
            </div>
          )}

          {/* ── 8. 舊箭數紀錄補正（2026-08-03） ──────────────── */}
          {tab === "arrowRepair" && <AdminPracticeLogRepair members={members} />}

          {/* ── 6. 世界王重置 ───────────────────────────────── */}
          {tab === "worldboss" && (
            <div className="space-y-3">
              {!wbEvent ? (
                <div className="text-center py-8 text-slate-500 text-xs">目前沒有活躍的世界王活動</div>
              ) : (
                <>
                  <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-300 font-bold">
                    🌍 {wbEvent.bossData?.name}｜累計參戰 {wbEvent.totalParticipants || 0} 人
                  </div>
                  {wbParts.map(([id, p]) => (
                    <Card key={id} className="p-3 bg-slate-800/90 border-slate-700/80 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{p.name}</div>
                        <div className="text-xs text-slate-400">累積傷害 {(p.totalDmg || 0).toLocaleString()}</div>
                      </div>
                      <Btn v="secondary" size="sm" onClick={() => handleResetWBOne(id, p.name)} disabled={!!busyWB}>
                        {busyWB === id ? "…" : "重置次數"}
                      </Btn>
                    </Card>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── 7. 房間清除 ─────────────────────────────────── */}
          {tab === "rooms" && (
            <Card className="p-4 bg-slate-800/90 border-slate-700/80 space-y-3">
              <div className="text-xs text-rose-400 leading-relaxed">
                ⚠️ 刪除房間後，所有正在進行的地下城或組隊戰鬥都會<b>立即中斷</b>。
              </div>
              <Btn v="danger" onClick={handleDeleteAllRooms} disabled={!!busyR} className="w-full py-3 font-black">
                {busyR === "all" ? "刪除中…" : "🚪 刪除所有房間（地下城 + 組隊）"}
              </Btn>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
