// src/components/admin/AdminPracticeLogRepair.jsx
// 🩹 舊箭數紀錄補正（2026-08-03）
//
// 背景：三個寫入端的 bug 已經修好，但**已經寫進去的舊紀錄不會自己變對**。
//   ① 練習模式的 totalArrows 其實是對的，錯的是讀取端（已修）
//   ② 舊版世界王的簡略紀錄缺 date → 查詢直接跳過它
//   ③ 而那些簡略紀錄多半是重複的——**補了 date 反而會讓箭數翻倍**
//
// ⚠️ 所以這個工具一定是「先掃描看清楚 → 再決定要不要套用」，
//    絕對不做一鍵全自動。判重的邏輯在 lib/practiceLogRepair.js（12 條測試）。
import { useState } from "react";
import { applyPracticeLogRepair, scanPracticeLogsForRepair } from "../../lib/db";
import { repairCount } from "../../lib/practiceLogRepair";
import { Btn, Card } from "../shared/UI";

const Stat = ({ label, value, tone = "text-slate-300", hint }) => (
  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
    <div className="text-[10px] font-bold text-slate-500 mb-1">{label}</div>
    <div className={`text-xl font-black ${tone}`}>{value}</div>
    {hint && <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{hint}</div>}
  </div>
);

export default function AdminPracticeLogRepair({ members = [] }) {
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);   // { plan, scanned }
  const [msg, setMsg] = useState("");

  const member = members.find(m => m.id === memberId);
  const plan = result?.plan;
  const willChange = plan ? repairCount(plan) : 0;

  const scan = async () => {
    setBusy("scan"); setMsg(""); setResult(null);
    try {
      setResult(await scanPracticeLogsForRepair(memberId));
    } catch (e) {
      setMsg(`⚠️ ${e?.code === "cost-control/blocked" ? "成本防護啟用中，維護操作已暫停" : e?.message || "掃描失敗"}`);
    }
    setBusy("");
  };

  const apply = async () => {
    setBusy("apply"); setMsg("");
    try {
      const { updated } = await applyPracticeLogRepair(memberId, plan);
      setMsg(`✅ 已補正 ${updated} 筆。再按一次「掃描」可確認已經歸零。`);
      setResult(null);
    } catch (e) {
      setMsg(`⚠️ ${e?.message || "補正失敗"}`);
    }
    setBusy("");
  };

  return (
    <div className="space-y-3">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 leading-relaxed">
        修的是<b>舊資料</b>。新的紀錄從 2026-08-03 起已經是對的，不用再跑這裡。<br />
        ⚠️ 舊版世界王有一批<b>重複紀錄</b>，它們因為缺 date 目前是隱形的——
        這個工具會<b>刻意不補</b>它們，補了會讓箭數翻倍。
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={memberId}
          onChange={e => { setMemberId(e.target.value); setResult(null); setMsg(""); }}
          className="flex-1 min-w-[180px] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
        >
          <option value="">選擇射手…</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <Btn v="secondary" size="sm" disabled={!memberId || !!busy} onClick={scan}>
          {busy === "scan" ? "掃描中…" : "🔍 掃描"}
        </Btn>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-xs font-bold ${
          msg.startsWith("✅")
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
        }`}>{msg}</div>
      )}

      {plan && (
        <Card className="p-3 bg-slate-900/70 border-slate-700 space-y-3">
          <div className="text-xs text-slate-400 font-bold">
            {member?.name}：掃描 {result.scanned} 筆紀錄
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="要補日期" value={plan.fixDate.length} tone="text-amber-300"
              hint="缺 date，查詢一直撈不到" />
            <Stat label="要補箭數" value={plan.fixArrows.length} tone="text-sky-300"
              hint="totalArrows 缺或算錯" />
            <Stat label="刻意跳過" value={plan.duplicates.length} tone="text-rose-300"
              hint="舊版世界王重複紀錄，補了會翻倍" />
            <Stat label="本來就對" value={plan.ok} tone="text-emerald-300" />
          </div>

          {plan.unfixable.length > 0 && (
            <div className="text-[11px] text-slate-500 leading-relaxed">
              另有 {plan.unfixable.length} 筆<b>無法修</b>：既沒有 date 也沒有 createdAt，
              沒有任何依據可以推算日期——不會瞎編一個塞進去。
            </div>
          )}

          {willChange === 0 ? (
            <div className="text-xs text-emerald-300 font-bold">這位射手的紀錄已經全部正確 ✓</div>
          ) : (
            <Btn v="warn" size="sm" disabled={!!busy} onClick={apply}>
              {busy === "apply" ? "補正中…" : `套用補正（${willChange} 筆）`}
            </Btn>
          )}
        </Card>
      )}
    </div>
  );
}
