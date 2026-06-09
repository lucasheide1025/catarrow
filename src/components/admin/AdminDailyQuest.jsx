// src/components/admin/AdminDailyQuest.jsx
// 後台：每日任務設定 + 報到核准 + 最終確認
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getDailyQuestConfig, saveDailyQuestConfig,
  subscribePendingCheckins, approveCheckin, confirmCheckinReward, cancelCheckin,
} from "../../lib/db";
import { drawBuff } from "../../lib/buffPool";
import { Card, Btn, Inp, ST, useToast } from "../shared/UI";

export default function AdminDailyQuest({ mode = "all" }) {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [config,     setConfig]     = useState(null);
  const [pending,    setPending]    = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    getDailyQuestConfig().then(setConfig);
    const unsub = subscribePendingCheckins(setPending);
    return () => unsub && unsub();
  }, []);

  if (!config) return null;

  const toApprove = pending.filter(c => c.status === "pending");
  const toConfirm = pending.filter(c => c.questDone && !c.finalConfirmed);

  async function saveConfig() {
    setSaving(true);
    await saveDailyQuestConfig(config, profile.id);
    toast("今日任務設定已儲存 ✓");
    setSaving(false);
  }

  async function approve(c) {
    const buff = drawBuff(0);
    await approveCheckin(c.id, buff, profile.id);
    toast(`已核准 ${c.memberNickname || c.memberName}，加成：${buff.name}（降 ${buff.actualPower >= 999 ? "直接過關" : buff.actualPower + "%"}）`);
  }

  async function confirm(c) {
    await confirmCheckinReward(c.id, c.memberId, profile.id);
    toast(`已確認 ${c.memberNickname || c.memberName} 完成今日任務，賽事積分 +1 ✓`);
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
        </>
      )}

      {showListSection && (
        <>
          {/* 報到待核准 */}
          <section>
            <ST>📍 報到待核准（{toApprove.length}）</ST>
            {toApprove.length === 0 ? (
              <div className="text-gray-400 text-sm py-2">沒有待核准的報到</div>
            ) : (
              <div className="flex flex-col gap-2">
                {toApprove.map(c => (
                  <div key={c.id} className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                        <div className="text-gray-400 text-xs">點核准 → 隨機施放加成</div>
                      </div>
                      <div className="flex gap-2">
                        <Btn v="danger" size="sm" onClick={() => doCancel(c)}>✕ 取消</Btn>
                        <Btn v="primary" size="sm" onClick={() => approve(c)}>🪄 核准施法</Btn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 任務達標待確認 */}
          <section>
            <ST>🎉 任務達標待確認（{toConfirm.length}）</ST>
            {toConfirm.length === 0 ? (
              <div className="text-gray-400 text-sm py-2">沒有待確認的任務</div>
            ) : (
              <div className="flex flex-col gap-2">
                {toConfirm.map(c => (
                  <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                        <div className="text-amber-600 text-xs">
                          {c.questResult
                            ? `${c.questResult.type === "score" ? "總分" : "中靶"} ${c.questResult.value}（目標 ${c.questResult.target}）`
                            : "已達標"}
                          {c.failCount > 0 && `　挑戰 ${c.failCount + 1} 次`}
                        </div>
                        {/* 顯示學生選的任務 */}
                        {c.tasks && c.chosenTask != null && c.tasks[c.chosenTask] && (
                          <div className="text-gray-500 text-xs mt-0.5">
                            任務：{c.tasks[c.chosenTask].label}
                            　{c.tasks[c.chosenTask].distance}米
                            　{c.tasks[c.chosenTask].target}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Btn v="danger" size="sm" onClick={() => doCancel(c)}>✕ 取消</Btn>
                        <Btn v="success" size="sm" onClick={() => confirm(c)}>✅ 確認完成</Btn>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}