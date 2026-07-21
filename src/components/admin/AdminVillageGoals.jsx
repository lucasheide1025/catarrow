// src/components/admin/AdminVillageGoals.jsx — 教練後台「村目標」獨立設定與發放中心
import { useState, useEffect } from "react";
import {
  adminCreateCustomGoal,
  adminCancelGoal,
  adminForceCompleteGoal,
  adminUpdateGoal,
  adminBackfillVillageGoalRewards,
  subscribeActiveGoal,
} from "../../lib/villageGoalDb";
import { GOAL_TYPES, GOAL_TYPE_MAP } from "../../lib/villageGoalData";
import { Card, Btn, Inp, Spinner, Empty } from "../shared/UI";

export default function AdminVillageGoals() {
  const [activeGoal, setActiveGoal]     = useState(null);
  const [busy, setBusy]                 = useState(false);
  const [msg, setMsg]                   = useState("");
  const [goalEditMode, setGoalEditMode] = useState(false);
  const [goalForm, setGoalForm]         = useState({
    goalType: "total_arrows",
    targetValue: 5000,
    durationHours: 24,
    rewardArrowdew: 200,
    rewardCoins: 100,
    rewardGachaToken: 3,
    customTitle: "",
    customDescription: "",
  });

  useEffect(() => {
    const unsub = subscribeActiveGoal(g => setActiveGoal(g));
    return unsub;
  }, []);

  function flash(text) {
    setMsg(text);
    setTimeout(() => setMsg(""), 3000);
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#f8fafc",
    fontSize: 13,
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 text-slate-100">
      {/* 標題說明列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/60 p-5 rounded-2xl backdrop-blur shadow-lg">
        <div>
          <h1 className="text-xl font-black text-amber-400 flex items-center gap-2">
            🎯 貓村全體目標管理中心
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            設定全體村民合作目標、挑戰獎勵，並可補發歷史發放紀錄。
          </p>
        </div>
        {msg && (
          <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-xs rounded-xl animate-fade-in">
            {msg}
          </div>
        )}
      </div>

      {/* 補發歷史遺漏獎勵區塊 */}
      <Card className="p-4 border-amber-500/30 bg-amber-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-amber-300 font-bold text-sm flex items-center gap-1.5">
              🎁 歷史村目標獎勵補發掃描
            </div>
            <div className="text-slate-400 text-xs mt-0.5 leading-relaxed">
              掃描所有已完成/過期的村目標，自動為尚未領取的參與者發放獎勵。已領取的玩家會自動跳過。
            </div>
          </div>
          <Btn
            v="warn"
            size="sm"
            onClick={async () => {
              if (!window.confirm("確定要掃描所有歷史村目標並補發尚未領取的獎勵嗎？")) return;
              setBusy(true);
              try {
                const r = await adminBackfillVillageGoalRewards();
                if (r.ok) flash(`✓ 掃描了 ${r.goalsScanned} 個目標，補發給 ${r.membersGranted} 人次`);
                else flash("❌ " + (r.reason || "失敗"));
              } catch (e) {
                flash("❌ " + e.message);
              }
              setBusy(false);
            }}
            disabled={busy}
            className="shrink-0"
          >
            🎁 掃描並補發獎勵
          </Btn>
        </div>
      </Card>

      {/* 當前進行中的目標 */}
      {activeGoal ? (
        <Card className="p-5 border-emerald-500/40 bg-slate-800/90 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {GOAL_TYPE_MAP[activeGoal.goalType]?.icon || "🏡"}
              </span>
              <div>
                <div className="font-black text-base text-white">
                  {activeGoal.title || GOAL_TYPE_MAP[activeGoal.goalType]?.name || activeGoal.goalType}
                </div>
                <div className="text-slate-400 text-xs">
                  {activeGoal.description || "全體村民共同目標"}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              進行中
            </span>
          </div>

          {/* 進度條 */}
          <div>
            <div className="flex justify-between text-xs text-slate-300 font-bold mb-1.5">
              <span>進度：{activeGoal.currentValue || 0} / {activeGoal.targetValue}</span>
              <span>
                {Math.min(100, Math.round(((activeGoal.currentValue || 0) / activeGoal.targetValue) * 100))}%
              </span>
            </div>
            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((activeGoal.currentValue || 0) / activeGoal.targetValue) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* 獎勵說明 */}
          <div className="flex gap-4 text-xs font-bold text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
            <span>💧 露水：+{activeGoal.rewards?.arrowdew || 0}</span>
            <span>🪙 貓幣：+{activeGoal.rewards?.coins || 0}</span>
            <span>🎫 轉蛋券：+{activeGoal.rewards?.gachaToken || 0}</span>
          </div>

          {/* 快捷操作按鈕 */}
          <div className="flex gap-2 pt-2 border-t border-slate-700/60 flex-wrap">
            <Btn
              v="warn"
              size="sm"
              onClick={async () => {
                if (!window.confirm("確定要強制完成此村目標並發放全體獎勵嗎？")) return;
                setBusy(true);
                try {
                  await adminForceCompleteGoal(activeGoal.id);
                  flash("✓ 已強制完成目標並發放獎勵");
                } catch (e) {
                  flash("❌ " + e.message);
                }
                setBusy(false);
              }}
              disabled={busy}
            >
              ⚡ 強制完成並領獎
            </Btn>

            <Btn
              v="danger"
              size="sm"
              onClick={async () => {
                if (!window.confirm("確定要取消此村目標嗎？")) return;
                setBusy(true);
                try {
                  await adminCancelGoal(activeGoal.id);
                  flash("✓ 已取消村目標");
                } catch (e) {
                  flash("❌ " + e.message);
                }
                setBusy(false);
              }}
              disabled={busy}
            >
              ✕ 取消此目標
            </Btn>

            <Btn
              v="secondary"
              size="sm"
              onClick={() => {
                setGoalEditMode(!goalEditMode);
                setGoalForm(p => ({
                  ...p,
                  targetValue: activeGoal.targetValue,
                  currentValue: activeGoal.currentValue,
                  rewardArrowdew: activeGoal.rewards?.arrowdew || 0,
                  rewardCoins: activeGoal.rewards?.coins || 0,
                  rewardGachaToken: activeGoal.rewards?.gachaToken || 0,
                }));
              }}
            >
              ✏️ {goalEditMode ? "關閉編輯" : "微調進度與獎勵"}
            </Btn>
          </div>

          {/* 編輯面板 */}
          {goalEditMode && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-700 space-y-3 mt-3 animate-fade-in">
              <div className="text-xs font-bold text-amber-300">微調目標進度數值</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400">當前進度值</label>
                  <input
                    type="number"
                    min={0}
                    value={goalForm.currentValue ?? activeGoal.currentValue}
                    onChange={e => setGoalForm(p => ({ ...p, currentValue: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">目標完成值</label>
                  <input
                    type="number"
                    min={1}
                    value={goalForm.targetValue}
                    onChange={e => setGoalForm(p => ({ ...p, targetValue: Number(e.target.value) }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Btn
                  v="primary"
                  size="sm"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await adminUpdateGoal(activeGoal.id, {
                        targetValue: goalForm.targetValue,
                        currentValue: goalForm.currentValue,
                        rewards: {
                          arrowdew: goalForm.rewardArrowdew,
                          coins: goalForm.rewardCoins,
                          gachaToken: goalForm.rewardGachaToken,
                        },
                      });
                      flash("✓ 已更新目標數據");
                      setGoalEditMode(false);
                    } catch (e) {
                      flash("❌ " + e.message);
                    }
                    setBusy(false);
                  }}
                  disabled={busy}
                >
                  儲存微調
                </Btn>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Empty icon="🎯" message="目前沒有進行中的全體村目標，可以在下方發起新目標！" />
      )}

      {/* 發起新村目標設定 */}
      <Card className="p-5 border-slate-700/80 bg-slate-800/80 space-y-4">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          🚀 發起新的全體村目標
        </h2>

        <div>
          <label className="text-xs text-slate-400 font-bold mb-1.5 block">1. 選擇目標類型</label>
          <div className="flex gap-2 flex-wrap">
            {GOAL_TYPES.map(g => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoalForm(p => ({ ...p, goalType: g.id }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  goalForm.goalType === g.id
                    ? "bg-amber-600 border-amber-500 text-white shadow-md"
                    : "bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white"
                }`}
              >
                {g.icon} {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 font-bold mb-1 block">2. 目標完成數值</label>
            <input
              type="number"
              min={1}
              value={goalForm.targetValue}
              onChange={e => setGoalForm(p => ({ ...p, targetValue: Number(e.target.value) }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 font-bold mb-1 block">3. 限時持續時間（小時）</label>
            <input
              type="number"
              min={1}
              max={720}
              value={goalForm.durationHours}
              onChange={e => setGoalForm(p => ({ ...p, durationHours: Number(e.target.value) }))}
              style={inputStyle}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-bold mb-1.5 block">4. 完成全體獎勵設定</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[11px] text-slate-400">💧 箭露水</span>
              <input
                type="number"
                min={0}
                value={goalForm.rewardArrowdew}
                onChange={e => setGoalForm(p => ({ ...p, rewardArrowdew: Number(e.target.value) }))}
                style={inputStyle}
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-400">🪙 貓幣</span>
              <input
                type="number"
                min={0}
                value={goalForm.rewardCoins}
                onChange={e => setGoalForm(p => ({ ...p, rewardCoins: Number(e.target.value) }))}
                style={inputStyle}
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-400">🎫 轉蛋券</span>
              <input
                type="number"
                min={0}
                value={goalForm.rewardGachaToken}
                onChange={e => setGoalForm(p => ({ ...p, rewardGachaToken: Number(e.target.value) }))}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-400 font-bold block">5. 客製化活動標題與說明（選填）</label>
          <input
            type="text"
            placeholder="標題（例如：🏆 全體合作打破十萬大關！）"
            value={goalForm.customTitle}
            onChange={e => setGoalForm(p => ({ ...p, customTitle: e.target.value }))}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="描述（例如：只要全村民合作射滿總箭數，即可全員獲得大量露水獎勵！）"
            value={goalForm.customDescription}
            onChange={e => setGoalForm(p => ({ ...p, customDescription: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <Btn
          v="primary"
          onClick={async () => {
            setBusy(true);
            try {
              await adminCreateCustomGoal({
                goalType: goalForm.goalType,
                targetValue: goalForm.targetValue,
                durationHours: goalForm.durationHours,
                rewards: {
                  arrowdew: goalForm.rewardArrowdew,
                  coins: goalForm.rewardCoins,
                  gachaToken: goalForm.rewardGachaToken,
                },
                title: goalForm.customTitle || undefined,
                description: goalForm.customDescription || undefined,
              });
              flash("✓ 已發起新村目標");
            } catch (e) {
              flash("❌ " + e.message);
            }
            setBusy(false);
          }}
          disabled={busy}
          className="w-full py-3"
        >
          🚀 發起全體村目標
        </Btn>
      </Card>
    </div>
  );
}
