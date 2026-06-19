// src/components/admin/AdminDailyQuest.jsx
// 後台：每日任務設定 + 打怪每日上限設定 + 報到核准 + 最終確認
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getDailyQuestConfig, saveDailyQuestConfig,
  getMonsterDailyConfig, saveMonsterDailyConfig,
  getMonsterEventConfig, saveMonsterEventConfig,
  subscribePendingCheckins, castBuff, cancelCheckin,
} from "../../lib/db";
import { Card, Btn, Inp, ST, useToast } from "../shared/UI";

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

  useEffect(() => {
    getDailyQuestConfig().then(setConfig);
    getMonsterDailyConfig().then(setMonsterCfg);
    getMonsterEventConfig().then(cfg => setEventCfg(cfg || { active: false, name: "", desc: "", battleMode: "score", mode: "student", distanceMode: "fixed", fixedDistance: 15, dynamicStart: 15 }));
    const unsub = subscribePendingCheckins(setPending);
    return () => unsub && unsub();
  }, []);

  if (!config) return null;

  const toCast    = pending.filter(c => !c.buff);
  const inProgress = pending.filter(c => c.buff);

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

  async function cast(c) {
    const buff = await castBuff(c.id, profile.id);
    toast(`已為 ${c.memberNickname || c.memberName} 施法：${buff.name}（降 ${buff.actualPower}%）`);
  }

  async function doCancel(c) {
    await cancelCheckin(c.id);
    toast(`已取消 ${c.memberNickname || c.memberName} 的報到`);
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
          {/* 待施法 */}
          <section>
            <ST>🪄 待施法（{toCast.length}）</ST>
            {toCast.length === 0 ? (
              <div className="text-gray-400 text-sm py-2">目前沒有等待施法的報到</div>
            ) : (
              <div className="flex flex-col gap-2">
                {toCast.map(c => (
                  <div key={c.id} className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                        <div className="text-gray-400 text-xs">點施法 → 隨機 10-50% 加成</div>
                      </div>
                      <div className="flex gap-2">
                        <Btn v="danger" size="sm" onClick={() => doCancel(c)}>✕</Btn>
                        <Btn v="primary" size="sm" onClick={() => cast(c)}>🪄 施法</Btn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 任務進行中（已施法）*/}
          {inProgress.length > 0 && (
            <section>
              <ST>🏹 任務進行中（{inProgress.length}）</ST>
              <div className="flex flex-col gap-2">
                {inProgress.map(c => {
                  const taskObj = c.tasks?.[c.chosenTask];
                  return (
                    <div key={c.id} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                          <div className="text-emerald-600 text-xs">
                            加成：{c.buff?.name}（降 {c.buff?.actualPower}%）
                          </div>
                          {taskObj && (
                            <div className="text-gray-500 text-xs">
                              {taskObj.label}・{taskObj.distance}米・{taskObj.target}
                            </div>
                          )}
                        </div>
                        <Btn v="danger" size="sm" onClick={() => doCancel(c)}>✕</Btn>
                      </div>
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
