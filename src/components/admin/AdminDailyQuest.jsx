// src/components/admin/AdminDailyQuest.jsx
// 後台：今日任務設定 + 報到核准 + 最終確認
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  getDailyQuestConfig, saveDailyQuestConfig,
  subscribePendingCheckins, approveCheckin, confirmCheckinReward,
} from "../../lib/db";
import { drawBuff } from "../../lib/buffPool";
import { Card, Btn, Inp, Sel, ST, useToast } from "../shared/UI";

export default function AdminDailyQuest({ mode = "all" }) {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [config, setConfig] = useState(null);
  const [pending, setPending] = useState([]);
  const [saving, setSaving] = useState(false);
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
    toast(`已核准 ${c.memberNickname || c.memberName}，加成：${buff.name}`);
  }

  async function confirm(c) {
    await confirmCheckinReward(c.id, c.memberId, profile.id);
    toast(`已確認 ${c.memberNickname || c.memberName} 完成今日任務 ✓`);
  }

  // mode="config" 只顯示設定；mode="list" 只顯示審核清單；mode="all" 全部
  const showConfigSection = mode === "config" || mode === "all";
  const showListSection = mode === "list" || mode === "all";

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
            <Card className="p-4 flex flex-col gap-3 border border-indigo-200">
              <ST>今日任務內容設定</ST>
              <Inp label="靶紙類型" value={config.targetName}
                onChange={e => setConfig({ ...config, targetName: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Inp label="箭數" type="number" value={config.arrowCount}
                  onChange={e => setConfig({ ...config, arrowCount: Number(e.target.value) })} />
                <Inp label="距離(米)" type="number" value={config.distance}
                  onChange={e => setConfig({ ...config, distance: Number(e.target.value) })} />
              </div>
              <Sel label="得分方式" value={config.targetType}
                onChange={e => setConfig({ ...config, targetType: e.target.value })}
                options={[{ value: "score", label: "總分達標" }, { value: "hits", label: "幾中幾完成" }]} />
              {config.targetType === "score" ? (
                <Inp label="目標總分" type="number" value={config.targetScore}
                  onChange={e => setConfig({ ...config, targetScore: Number(e.target.value) })} />
              ) : (
                <Inp label="目標中靶數" type="number" value={config.targetHits}
                  onChange={e => setConfig({ ...config, targetHits: Number(e.target.value) })} />
              )}
              <Inp label="滿幾次換成就銀章" type="number" value={config.rewardEvery}
                onChange={e => setConfig({ ...config, rewardEvery: Number(e.target.value) })} />
              <Btn v="primary" onClick={saveConfig} disabled={saving}>{saving ? "儲存中…" : "儲存設定"}</Btn>
            </Card>
          )}
        </>
      )}

      {showListSection && (
        <>
          <section>
            <ST>📍 報到待核准（{toApprove.length}）</ST>
            {toApprove.length === 0 ? (
              <div className="text-gray-400 text-sm py-2">沒有待核准的報到</div>
            ) : (
              <div className="flex flex-col gap-2">
                {toApprove.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl p-3">
                    <div>
                      <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                      <div className="text-gray-400 text-xs">點擊核准 → 隨機施放加成</div>
                    </div>
                    <Btn v="primary" size="sm" onClick={() => approve(c)}>🪄 核准施法</Btn>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <ST>🎉 任務達標待確認（{toConfirm.length}）</ST>
            {toConfirm.length === 0 ? (
              <div className="text-gray-400 text-sm py-2">沒有待確認的任務</div>
            ) : (
              <div className="flex flex-col gap-2">
                {toConfirm.map(c => (
                  <div key={c.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <div>
                      <div className="text-gray-800 text-sm font-bold">{c.memberNickname || c.memberName}</div>
                      <div className="text-amber-600 text-xs">
                        {c.questResult ? `${c.questResult.type === "score" ? "總分" : "中靶"} ${c.questResult.value}（目標 ${c.questResult.target}）` : "已達標"}
                        {c.failCount > 0 && `　挑戰 ${c.failCount + 1} 次`}
                      </div>
                    </div>
                    <Btn v="success" size="sm" onClick={() => confirm(c)}>✅ 確認完成</Btn>
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