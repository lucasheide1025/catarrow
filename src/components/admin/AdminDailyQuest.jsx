// src/components/admin/AdminDailyQuest.jsx
// 後台：每日任務設定 + 打怪每日上限設定 + 報到核准 + 最終確認
import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import {
  getDailyQuestConfig, saveDailyQuestConfig,
  getMonsterDailyConfig, saveMonsterDailyConfig,
  getMonsterEventConfig, saveMonsterEventConfig,
  subscribePendingCheckins, cancelCheckin,
  approveCheckin, rejectCheckin,
  adminDismissCheckin, addBillingRecord,
} from "../../lib/db";
import { Card, Btn, Inp, ST, useToast } from "../shared/UI";
import { completeBookingFromCheckin } from "../../lib/bookingDb";

const PLANS_EQUIP = [
  { id:"自訂一小時", price:200 },
  { id:"自訂三小時", price:400 },
  { id:"月卡",       price:0   },
];
const PLANS_NO_EQUIP = [
  { id:"早鳥折扣", price:200 },
  { id:"單一",     price:300 },
  { id:"單三",     price:600 },
];
const PAY_METHODS = ["現金", "轉帳"];

export default function AdminDailyQuest({ mode = "all" }) {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [config,     setConfig]     = useState(null);
  const [monsterCfg, setMonsterCfg] = useState(null);
  const [eventCfg,   setEventCfg]   = useState(null);
  const [pending,    setPending]    = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [savingMon,  setSavingMon]  = useState(false);
  const [savingEvt,  setSavingEvt]  = useState(false);
  const [showConfig,  setShowConfig]  = useState(false);
  const [showMonster, setShowMonster] = useState(false);
  const [showEvent,   setShowEvent]   = useState(false);
  const [approveState, setApproveState] = useState({}); // { checkinId: { busy } }
  const [billState,   setBillState]   = useState({}); // { checkinId: { plan, payMethod, busy } }

  useEffect(() => {
    getDailyQuestConfig().then(setConfig);
    getMonsterDailyConfig().then(setMonsterCfg);
    getMonsterEventConfig().then(cfg => setEventCfg(cfg || { active: false, name: "", desc: "", battleMode: "score", mode: "student", distanceMode: "fixed", fixedDistance: 15, dynamicStart: 15 }));
    const unsub = subscribePendingCheckins(setPending);
    return () => unsub && unsub();
  }, []);

  if (!config) return null;

  const toApprove  = pending.filter(c => c.status === "pending");
  const inProgress = pending.filter(c => c.status === "active" && !c.classEnded);
  const done       = pending.filter(c => c.classEnded || c.type === "simple");

  async function saveConfig() {
    setSaving(true);
    await saveDailyQuestConfig(config, profile.id);
    toast("今日任務設定已儲存 ✓");
    setSaving(false);
  }

  async function saveMonsterConfig() {
    if (!monsterCfg) return;
    const max = Number(monsterCfg.dailyMax);
    if (isNaN(max) || max < 1 || max > 99) {
      toast("每日上限請輸入 1～99 之間的數字");
      return;
    }
    setSavingMon(true);
    await saveMonsterDailyConfig({ dailyMax: max }, profile.id);
    toast(`打怪每日上限已設為 ${max} 次 ✓`);
    setSavingMon(false);
  }

  async function saveEventConfig() {
    if (!eventCfg) return;
    setSavingEvt(true);
    await saveMonsterEventConfig(eventCfg, profile.id);
    toast(`賽事模式設定已儲存 ${eventCfg.active ? "✓（已開啟）" : "✓（已關閉）"}`);
    setSavingEvt(false);
  }

  async function doApprove(c) {
    setApproveState(s => ({ ...s, [c.id]: { busy: true } }));
    try {
      await approveCheckin(c.id, profile.id);
      toast(`✅ 已核准 ${c.memberNickname || c.memberName} 的報到！`);
    } catch (e) { toast("核准失敗：" + (e?.message || ""), "error"); }
    setApproveState(s => { const n = { ...s }; delete n[c.id]; return n; });
  }

  async function doReject(c) {
    setApproveState(s => ({ ...s, [c.id]: { busy: true } }));
    try {
      await rejectCheckin(c.id, profile.id);
      toast(`已駁回 ${c.memberNickname || c.memberName} 的報到`);
    } catch (e) { toast("駁回失敗：" + (e?.message || ""), "error"); }
    setApproveState(s => { const n = { ...s }; delete n[c.id]; return n; });
  }

  async function doCancel(c) {
    await cancelCheckin(c.id);
    toast(`已取消 ${c.memberNickname || c.memberName} 的報到`);
  }

  async function openBill(c) {
    let defaultPlan = null;
    let hasEquip = false;
    let earlyBird = false;
    if (c.memberId) {
      try {
        const snap = await getDoc(doc(db, "members", c.memberId));
        if (snap.exists()) {
          const data = snap.data();
          hasEquip  = Object.values(data.equipment || {}).some(Boolean);
          earlyBird = !!data.archerNo;
          defaultPlan = data.defaultPlan || null;
        }
      } catch {}
    }
    const plans = hasEquip ? PLANS_EQUIP : PLANS_NO_EQUIP;
    if (!plans.find(p => p.id === defaultPlan)) defaultPlan = plans[0].id;
    setBillState(s => ({ ...s, [c.id]: { plan: defaultPlan, payMethod: "現金", busy: false, hasEquip, earlyBird } }));
  }

  async function confirmBill(c) {
    const bs = billState[c.id];
    if (!bs) return;
    setBillState(s => ({ ...s, [c.id]: { ...s[c.id], busy: true } }));
    try {
      const plans = bs.hasEquip ? PLANS_EQUIP : PLANS_NO_EQUIP;
      const planObj = plans.find(p => p.id === bs.plan);
      const payMethod = bs.plan === "月卡" ? "月卡" : bs.payMethod;
      const basePrice = planObj?.price || 0;
      const discount  = (bs.plan !== "月卡" && bs.earlyBird) ? 50 : 0;
      const finalPrice = bs.plan === "月卡" ? 0 : Math.max(0, basePrice - discount);
      const dateStr = new Date().toISOString().slice(0, 10);
      const [y, m, d] = dateStr.split("-").map(Number);
      let billingId = bs.billingRecordId || null;
      if (!billingId) {
        const billingRef = await addBillingRecord({
        memberName:    c.memberNickname || c.memberName,
        memberId:      c.memberId || null,
        plan:          bs.plan,
        basePrice,
        discount,
        finalPrice,
        paymentMethod: payMethod,
        date: dateStr, year: y, month: m, day: d,
        note: "",
        createdByName: profile?.nickname || profile?.name || "教練",
        createdBy:     profile?.id || null,
        bookingId:     c.bookingId || null,
        checkinId:     c.id,
        });
        billingId = billingRef.id;
        setBillState(s => ({ ...s, [c.id]:{ ...s[c.id], billingRecordId:billingId, busy:true } }));
      }
      if (c.bookingId) {
        const linked = await completeBookingFromCheckin(c.bookingId, c.id, billingId);
        if (!linked.ok) throw new Error(`帳務已建立，但預約連動失敗：${linked.reason || "未知錯誤"}`);
      }
      if (c.memberId) {
        updateDoc(doc(db, "members", c.memberId), { defaultPlan: bs.plan }).catch(() => {});
      }
      await adminDismissCheckin(c.id);
      const discNote = discount > 0 ? ` 早鳥-${discount}` : "";
      toast(`✅ ${c.memberNickname || c.memberName}：已記帳（${bs.plan}${discNote} / ${payMethod} NT$${finalPrice}）`);
    } catch (e) {
      toast("記帳失敗：" + (e?.message || ""), "error");
      setBillState(s => ({ ...s, [c.id]: { ...s[c.id], busy: false } }));
      return;
    }
    setBillState(s => { const n = { ...s }; delete n[c.id]; return n; });
  }

  async function skipBill(c) {
    setBillState(s => { const n = { ...s }; delete n[c.id]; return n; });
    if (c.bookingId) {
      const linked = await completeBookingFromCheckin(c.bookingId, c.id);
      if (!linked.ok) { toast("完成預約連動失敗：" + (linked.reason || ""), "error"); return; }
    }
    await adminDismissCheckin(c.id);
    toast(`已完成 ${c.memberNickname || c.memberName} 的紀錄（未記帳）`);
  }

  function num(val) { return isNaN(Number(val)) ? 0 : Number(val); }

  const showConfigSection = mode === "config" || mode === "all";
  const showListSection   = mode === "list"   || mode === "all";

  return (
    <div className="flex flex-col gap-4">
      <ToastContainer />

      {showConfigSection && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-gray-800 font-black text-xl">📍 每日任務設定</h2>
            <button onClick={() => setShowConfig(v => !v)}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-white">
              {showConfig ? "✕ 收起" : "⚙️ 展開設定"}
            </button>
          </div>
          {showConfig && (
            <Card className="p-4 flex flex-col gap-4 border border-indigo-200">
              <ST>🎲 任務隨機範圍設定</ST>
              <div className="bg-blue-50 rounded-xl px-3 py-2 text-blue-700 text-xs">
                系統每次會隨機產生三個任務讓學生三選一，以下設定決定隨機的範圍。
              </div>

              {/* 箭數 + 換章門檻 */}
              <div className="grid grid-cols-2 gap-2">
                <Inp label="箭數（每任務）" type="number" min="1" max="20"
                  value={config.arrowCount || 6}
                  onChange={e => setConfig({ ...config, arrowCount: num(e.target.value) })} />
                <Inp label="滿幾次換成就銀章" type="number" min="1"
                  value={config.rewardEvery || 10}
                  onChange={e => setConfig({ ...config, rewardEvery: num(e.target.value) })} />
              </div>

              {/* 射程範圍 */}
              <div>
                <div className="text-gray-600 text-xs font-bold mb-1.5">📍 射程範圍（米）</div>
                <div className="grid grid-cols-2 gap-2">
                  <Inp label="最小距離" type="number" min="1" max="50"
                    value={config.distanceMin || 1}
                    onChange={e => setConfig({ ...config, distanceMin: num(e.target.value) })} />
                  <Inp label="最大距離" type="number" min="1" max="50"
                    value={config.distanceMax || 15}
                    onChange={e => setConfig({ ...config, distanceMax: num(e.target.value) })} />
                </div>
              </div>

              {/* 分數範圍 */}
              <div>
                <div className="text-gray-600 text-xs font-bold mb-1.5">🎯 目標分數範圍</div>
                <div className="grid grid-cols-2 gap-2">
                  <Inp label="最低分數" type="number" min="1"
                    value={config.scoreMin || 1}
                    onChange={e => setConfig({ ...config, scoreMin: num(e.target.value) })} />
                  <Inp label="最高分數" type="number" min="1"
                    value={config.scoreMax || 100}
                    onChange={e => setConfig({ ...config, scoreMax: num(e.target.value) })} />
                </div>
              </div>

              {/* 命中數範圍 */}
              <div>
                <div className="text-gray-600 text-xs font-bold mb-1.5">💥 目標命中數範圍</div>
                <div className="grid grid-cols-2 gap-2">
                  <Inp label="最少命中" type="number" min="1"
                    value={config.hitsMin || 1}
                    onChange={e => setConfig({ ...config, hitsMin: num(e.target.value) })} />
                  <Inp label="最多命中" type="number" min="1"
                    value={config.hitsMax || 6}
                    onChange={e => setConfig({ ...config, hitsMax: num(e.target.value) })} />
                </div>
              </div>

              <Btn v="primary" onClick={saveConfig} disabled={saving}>
                {saving ? "儲存中…" : "儲存設定"}
              </Btn>
            </Card>
          )}

          {/* ── 打怪每日上限設定 ──────────────────────── */}
          <div className="flex items-center justify-between">
            <h2 className="text-gray-800 font-black text-xl">⚔️ 打怪每日上限</h2>
            <button onClick={() => setShowMonster(v => !v)}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-white">
              {showMonster ? "✕ 收起" : "⚙️ 展開設定"}
            </button>
          </div>
          {showMonster && (
            <Card className="p-4 flex flex-col gap-4 border border-rose-200">
              <ST>👹 每位射手每天可以打幾次怪</ST>
              <div className="bg-rose-50 rounded-xl px-3 py-2 text-rose-700 text-xs leading-relaxed">
                射手帳號每天打怪次數達到上限後，當天就不能再開新戰鬥（隔天自動重置）。
                訪客體驗模式不受此限制。如要幫個別學生重置今日次數，到「會員管理」按「⚔️ 重置打怪」。
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Inp label="每日上限（次）" type="number" min="1" max="99"
                    value={monsterCfg?.dailyMax ?? 5}
                    onChange={e => setMonsterCfg({ ...(monsterCfg || {}), dailyMax: e.target.value })} />
                </div>
                <div className="flex-1">
                  <Btn v="primary" onClick={saveMonsterConfig} disabled={savingMon || !monsterCfg}>
                    {savingMon ? "儲存中…" : "儲存上限"}
                  </Btn>
                </div>
              </div>
              <div className="text-gray-400 text-xs">
                目前設定：每天最多 <b className="text-gray-600">{Number(monsterCfg?.dailyMax) || 5}</b> 次
              </div>
            </Card>
          )}

          {/* ── 賽事模式設定 ──────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-gray-800 font-black text-xl">🏆 賽事打怪模式</h2>
              {eventCfg?.active && <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">開啟中</span>}
            </div>
            <button onClick={() => setShowEvent(v => !v)}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 bg-white">
              {showEvent ? "✕ 收起" : "⚙️ 展開設定"}
            </button>
          </div>
          {showEvent && eventCfg && (
            <Card className="p-4 flex flex-col gap-4 border border-amber-200">
              <ST>🏆 賽事模式設定（前台射手可直接使用，跳過手動選難度流程）</ST>

              {/* 開關 */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className={`w-12 h-6 rounded-full transition-colors ${eventCfg.active ? "bg-emerald-500" : "bg-gray-300"}`}
                  onClick={() => setEventCfg(c => ({ ...c, active: !c.active }))}>
                  <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${eventCfg.active ? "translate-x-6" : "translate-x-0"}`} />
                </div>
                <span className="text-sm font-black text-gray-700">{eventCfg.active ? "🟢 賽事模式已開啟" : "⚫ 賽事模式已關閉"}</span>
              </label>

              <Inp label="賽事名稱" value={eventCfg.name || ""}
                onChange={e => setEventCfg(c => ({ ...c, name: e.target.value }))}
                placeholder="例：六月月考 / 暑期挑戰賽" />

              <Inp label="說明文字（選填）" value={eventCfg.desc || ""}
                onChange={e => setEventCfg(c => ({ ...c, desc: e.target.value }))}
                placeholder="例：固定15米分數靶，考驗基本功！" />

              {/* 靶紙模式 */}
              <div>
                <div className="text-xs font-black text-gray-500 mb-2">靶紙模式</div>
                <div className="flex gap-2">
                  {[{ v:"score", label:"🎯 分數靶紙" }, { v:"zombie", label:"🧟 殭屍靶紙" }].map(o => (
                    <button key={o.v} onClick={() => setEventCfg(c => ({ ...c, battleMode: o.v }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${eventCfg.battleMode === o.v ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 難度 */}
              <div>
                <div className="text-xs font-black text-gray-500 mb-2">難度</div>
                <div className="flex gap-2">
                  {[{ v:"novice", label:"🟢 新手" }, { v:"student", label:"🎓 學生" }, { v:"veteran", label:"🟠 老手" }].map(o => (
                    <button key={o.v} onClick={() => setEventCfg(c => ({ ...c, mode: o.v }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${eventCfg.mode === o.v ? "bg-purple-600 text-white border-purple-600" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 距離模式 */}
              <div>
                <div className="text-xs font-black text-gray-500 mb-2">距離模式</div>
                <div className="flex gap-2 mb-3">
                  {[{ v:"fixed", label:"📍 固定距離" }, { v:"dynamic", label:"🏃 動態起始" }].map(o => (
                    <button key={o.v} onClick={() => setEventCfg(c => ({ ...c, distanceMode: o.v }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-black border transition-all ${eventCfg.distanceMode === o.v ? "bg-orange-500 text-white border-orange-500" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
                {eventCfg.distanceMode === "fixed" ? (
                  <Inp label="固定距離（米）" type="number" min="1" max="90"
                    value={eventCfg.fixedDistance ?? 15}
                    onChange={e => setEventCfg(c => ({ ...c, fixedDistance: Number(e.target.value) }))} />
                ) : (
                  <Inp label="動態起始距離（米）" type="number" min="5" max="90"
                    value={eventCfg.dynamicStart ?? 15}
                    onChange={e => setEventCfg(c => ({ ...c, dynamicStart: Number(e.target.value) }))} />
                )}
              </div>

              <Btn v="primary" onClick={saveEventConfig} disabled={savingEvt}>
                {savingEvt ? "儲存中…" : "💾 儲存賽事設定"}
              </Btn>

              <div className="bg-amber-50 rounded-xl px-3 py-2 text-amber-700 text-xs">
                目前：{eventCfg.active ? "🟢 開啟" : "⚫ 關閉"} ／
                {eventCfg.battleMode === "zombie" ? " 殭屍靶" : " 分數靶"} ／
                {eventCfg.mode === "novice" ? " 新手" : eventCfg.mode === "student" ? " 學生" : " 老手"} ／
                {eventCfg.distanceMode === "fixed" ? ` 固定 ${eventCfg.fixedDistance ?? 15}米` : ` 動態起始 ${eventCfg.dynamicStart ?? 15}米`}
              </div>
            </Card>
          )}
        </>
      )}

      {showListSection && (
        <>
          {/* 待審核 */}
          <section>
            <ST>⏳ 待審核（{toApprove.length}）</ST>
            {toApprove.length === 0 ? (
              <div className="text-gray-400 text-sm py-2">目前沒有待審核的報到</div>
            ) : (
              <div className="flex flex-col gap-2">
                {toApprove.map(c => {
                  const busy = approveState[c.id]?.busy;
                  return (
                    <div key={c.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                          <div className="text-yellow-600 text-xs">等待審核中</div>
                        </div>
                        <div className="flex gap-2">
                          <Btn v="danger" size="sm" onClick={() => doReject(c)} disabled={busy}>❌ 不通過</Btn>
                          <Btn v="success" size="sm" onClick={() => doApprove(c)} disabled={busy}>✅ 通過</Btn>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 上課中 */}
          {inProgress.length > 0 && (
            <section>
              <ST>🏹 上課中（{inProgress.length}）</ST>
              <div className="flex flex-col gap-2">
                {inProgress.map(c => (
                  <div key={c.id} className="rounded-xl p-3 border border-emerald-600/30" style={{ background:"rgba(5,150,105,0.12)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-emerald-200 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                        <div className="text-emerald-400/70 text-xs">練習中，等待下課…</div>
                      </div>
                      <div className="flex gap-2">
                        <Btn v="danger" size="sm" onClick={() => doCancel(c)}>✕</Btn>
                        {c.memberId && (
                          <button onClick={async () => {
                            try {
                              const { submitClassEnd } = await import("../../lib/db");
                              await submitClassEnd(c.memberId, c.id);
                              toast(`✅ ${c.memberNickname || c.memberName} 已強制下課`);
                            } catch (e) { toast("下課失敗：" + (e?.message || ""), "error"); }
                          }} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-orange-500/50 text-orange-300" style={{ background:"rgba(255,255,255,0.06)" }}>
                            ⏹ 強制下課
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 今日已完成 */}
          {done.length > 0 && (
            <section>
              <ST>✅ 今日已完成（{done.length}）</ST>
              <div className="flex flex-col gap-2">
                {done.map(c => {
                  const bs = billState[c.id];
                  return (
                    <div key={c.id} className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                      {/* 基本資訊列 */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                          <div className="text-teal-600 text-xs">
                            {c.type === "simple" ? "純報到 ✓" : "已下課 ✓"}
                          </div>
                        </div>
                        {!bs && (
                          <Btn v="primary" size="sm" onClick={() => openBill(c)}>💰 記帳</Btn>
                        )}
                      </div>

                      {/* 快速記帳面板 */}
                      {bs && (
                        <div className="mt-3 pt-3 border-t border-teal-200 flex flex-col gap-2">
                          {/* 方案（依是否有自訂裝備顯示不同組）*/}
                          <div className="text-xs font-black text-gray-500 mb-0.5">
                            方案{bs.hasEquip ? "（自訂裝備）" : ""}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(bs.hasEquip ? PLANS_EQUIP : PLANS_NO_EQUIP).map(p => (
                              <button key={p.id}
                                onClick={() => setBillState(s => ({ ...s, [c.id]: { ...s[c.id], plan: p.id } }))}
                                className={`py-1.5 rounded-lg text-xs font-black border transition-all ${
                                  bs.plan === p.id
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-600 border-gray-200"
                                }`}>
                                {p.id}
                                <div className={`text-[10px] font-normal ${bs.plan === p.id ? "text-blue-200" : "text-gray-400"}`}>
                                  {p.price === 0 ? "月卡" : `$${p.price}`}
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* 付款方式（月卡方案不需選）*/}
                          {bs.plan !== "月卡" && (
                            <>
                              <div className="text-xs font-black text-gray-500 mb-0.5">付款方式</div>
                              <div className="flex gap-1.5">
                                {PAY_METHODS.map(pm => (
                                  <button key={pm}
                                    onClick={() => setBillState(s => ({ ...s, [c.id]: { ...s[c.id], payMethod: pm } }))}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-black border transition-all ${
                                      bs.payMethod === pm
                                        ? "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-white text-gray-600 border-gray-200"
                                    }`}>
                                    {pm}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {/* 早鳥折扣（非月卡方案才顯示）*/}
                          {bs.plan !== "月卡" && (
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input type="checkbox"
                                checked={!!bs.earlyBird}
                                onChange={e => setBillState(s => ({ ...s, [c.id]: { ...s[c.id], earlyBird: e.target.checked } }))}
                                className="w-4 h-4 accent-amber-500 cursor-pointer" />
                              <span className="text-xs font-black text-amber-700">
                                🌅 早鳥折扣 -50元
                              </span>
                              {bs.earlyBird && <span className="text-[10px] text-amber-500">（已有射手證號或手動套用）</span>}
                            </label>
                          )}

                          {/* 金額預覽 */}
                          {(() => {
                            const planObj2 = (bs.hasEquip ? PLANS_EQUIP : PLANS_NO_EQUIP).find(p => p.id === bs.plan);
                            const base2 = planObj2?.price || 0;
                            const disc2 = (bs.plan !== "月卡" && bs.earlyBird) ? 50 : 0;
                            const final2 = bs.plan === "月卡" ? 0 : Math.max(0, base2 - disc2);
                            return (
                              <div className="text-xs text-gray-500 bg-white rounded-lg px-3 py-1.5 border border-gray-100">
                                {bs.plan}・{bs.plan === "月卡" ? "月卡扣除" : bs.payMethod}
                                {disc2 > 0 && <span className="text-amber-600 ml-1">早鳥-{disc2}</span>}
                                ・<span className="font-black text-gray-800">NT${final2}</span>
                              </div>
                            );
                          })()}

                          {/* 按鈕 */}
                          <div className="flex gap-2">
                            <button onClick={() => skipBill(c)} disabled={bs.busy}
                              className="px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-gray-200 bg-white disabled:opacity-40">
                              跳過記帳
                            </button>
                            <Btn v="success" size="sm" className="flex-1"
                              onClick={() => confirmBill(c)} disabled={bs.busy || !bs.plan}>
                              {bs.busy ? "處理中…" : "✅ 記帳 + 完成"}
                            </Btn>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
