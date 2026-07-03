// src/components/member/MemberExternalComp.jsx
import { useState, useEffect } from "react";
import { addExternalComp, subscribeExternalComps } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { today, fmtDT } from "../../lib/constants";
import { Card, Btn, Inp, Sel, TA, ST, Spinner, Empty, useToast } from "../shared/UI";

const CATEGORIES = [
  "裸弓 - 室內18米",
  "裸弓 - 室外30米",
  "裸弓 - 野外射箭",
  "全配 - 室內18米",
  "全配 - 室外70米",
  "獵弓 - 室內18米",
  "獵弓 - 野外射箭",
  "傳統弓 - 室外",
  "傳統弓 - 野外射箭",
  "其他",
].map(v => ({ value: v, label: v }));

const RANKS = [
  "第1名", "第2名", "第3名",
  "前8名", "前16名", "參賽",
].map(v => ({ value: v, label: v }));

// 深色原生：語意 token 淡色底 + 同色系文字（style 疊在玻璃卡上，不再依賴覆寫層）
const STATUS_STYLE = {
  pending_review: {
    style: { background: "linear-gradient(0deg, var(--warn-bg), var(--warn-bg)), var(--glass-bg)", borderColor: "rgba(251,191,36,0.3)" },
    text: "text-yellow-300", label: "⏳ 審核中",
  },
  approved: {
    style: { background: "linear-gradient(0deg, var(--success-bg), var(--success-bg)), var(--glass-bg)", borderColor: "rgba(74,222,128,0.3)" },
    text: "text-green-300", label: "✅ 已通過",
  },
  rejected: {
    style: { background: "linear-gradient(0deg, var(--danger-bg), var(--danger-bg)), var(--glass-bg)", borderColor: "rgba(248,113,113,0.3)" },
    text: "text-red-300", label: "❌ 未通過",
  },
};

export default function MemberExternalComp() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    compName: "", date: today(), location: "",
    category: "裸弓 - 室內18米", rank: "第1名",
    hasAward: false, awardKept: false, note: "",
  });

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeExternalComps(profile.id, data => {
      setRecords(data); setLoading(false);
    });
    return unsub;
  }, [profile?.id]);

  async function submit() {
    if (!form.compName.trim()) { toast("請填寫比賽名稱", "error"); return; }
    setSaving(true);
    await addExternalComp(profile.id, {
      ...form,
      memberName: profile.name,
      memberNickname: profile.nickname,
    });
    toast("申報已送出，等待教練審核 ✓");
    setAdding(false);
    setForm({ compName:"", date:today(), location:"", category:"裸弓 - 室內18米", rank:"第1名", hasAward:false, awardKept:false, note:"" });
    setSaving(false);
  }

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <div className="flex justify-between items-center">
        <h2 className="text-gray-100 font-black text-xl">🏅 對外比賽</h2>
        {!adding && <Btn v="primary" size="sm" onClick={() => setAdding(true)}>+ 新增申報</Btn>}
      </div>

      <div className="rounded-xl p-3" style={{ background: "var(--info-bg)", border: "1px solid rgba(96,165,250,0.25)" }}>
        <div className="text-blue-300 text-xs font-bold mb-1">📋 說明</div>
        <div className="text-blue-200 text-xs leading-relaxed">
          參加對外比賽後，填寫申報表送給教練審核。通過後系統會自動依名次發放對應徽章。
        </div>
      </div>

      {/* 申報表單 */}
      {adding && (
        <Card className="p-4 flex flex-col gap-3">
          <ST>對外比賽申報</ST>
          <Inp label="比賽名稱" value={form.compName}
            onChange={e => setForm(p=>({...p, compName:e.target.value}))}
            placeholder="例如：2025年台南市射箭錦標賽" />
          <div className="grid grid-cols-2 gap-3">
            <Inp label="比賽日期" type="date" value={form.date}
              onChange={e => setForm(p=>({...p, date:e.target.value}))} />
            <Inp label="比賽地點" value={form.location}
              onChange={e => setForm(p=>({...p, location:e.target.value}))}
              placeholder="例如：台南市立體育館" />
          </div>
          <Sel label="參賽組別" value={form.category}
            onChange={e => setForm(p=>({...p, category:e.target.value}))}
            options={CATEGORIES} />
          <Sel label="最終名次" value={form.rank}
            onChange={e => setForm(p=>({...p, rank:e.target.value}))}
            options={RANKS} />

          {/* 獎狀獎牌 */}
          <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-2">
            <div className="text-xs font-bold text-gray-400">獎狀/獎牌</div>
            <label className="flex items-center gap-2 text-gray-200 text-sm cursor-pointer">
              <input type="checkbox" checked={form.hasAward}
                onChange={e => setForm(p=>({...p, hasAward:e.target.checked}))}
                className="accent-blue-600" />
              有獲得獎狀/獎牌
            </label>
            {form.hasAward && (
              <label className="flex items-center gap-2 text-gray-200 text-sm cursor-pointer ml-5">
                <input type="checkbox" checked={form.awardKept}
                  onChange={e => setForm(p=>({...p, awardKept:e.target.checked}))}
                  className="accent-blue-600" />
                獎狀/獎牌留在箭場展示
              </label>
            )}
          </div>

          <TA label="備註（選填）" value={form.note} rows={3}
            placeholder="其他說明、比賽心得…"
            onChange={e => setForm(p=>({...p, note:e.target.value}))} />

          <div className="flex gap-2">
            <Btn v="secondary" className="flex-1" onClick={() => setAdding(false)}>取消</Btn>
            <Btn v="primary" className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "送出中…" : "送出申報"}
            </Btn>
          </div>
        </Card>
      )}

      {/* 申報紀錄 */}
      <ST>申報紀錄</ST>
      {records.length === 0 && <Empty icon="🏅" message="尚無對外比賽申報紀錄" />}
      {records.map(r => {
        const st = STATUS_STYLE[r.status] || STATUS_STYLE.pending_review;
        return (
          <Card key={r.id} className="p-4" style={st.style}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="text-gray-100 font-bold text-sm">{r.compName}</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  📅 {r.date}
                  {r.location && `　📍 ${r.location}`}
                </div>
              </div>
              <span className={`text-xs font-bold ml-2 flex-shrink-0 ${st.text}`}>
                {st.label}
              </span>
            </div>

            <div className="flex gap-2 flex-wrap mb-2">
              <span className="text-xs bg-white/10 border border-white/15 text-gray-300 font-medium px-2 py-0.5 rounded-full">
                {r.category}
              </span>
              <span className="text-xs bg-blue-500/15 text-blue-300 font-bold px-2 py-0.5 rounded-full">
                {r.rank}
              </span>
              {r.hasAward && (
                <span className="text-xs bg-yellow-500/15 text-yellow-300 font-bold px-2 py-0.5 rounded-full">
                  🏆 {r.awardKept ? "獎項留箭場" : "有獎項"}
                </span>
              )}
            </div>

            {r.note && (
              <div className="text-gray-400 text-xs bg-white/5 rounded-lg px-3 py-2 mb-2 italic">
                「{r.note}」
              </div>
            )}

            {/* 教練審核結果 */}
            {r.status === "approved" && r.badgeType && (
              <div className="bg-green-500/15 border border-green-400/30 rounded-lg px-3 py-2">
                <div className="text-green-300 text-xs font-bold">
                  🎖️ 已發放：
                  {r.badgeType==="fatCat"?"肥貓章":r.badgeType==="score"?"積分章":"成就章"}
                  　{r.badgeColor==="gold"?"金":r.badgeColor==="silver"?"銀":r.badgeColor==="black"?"黑":"銅"}章
                  × {r.badgeCount}
                </div>
              </div>
            )}
            {r.status === "rejected" && (
              <div className="bg-red-500/15 border border-red-400/30 rounded-lg px-3 py-2">
                <div className="text-red-400 text-xs">未通過審核，請聯繫教練了解原因</div>
              </div>
            )}

            <div className="text-gray-500 text-xs mt-2">{fmtDT(r.submittedAt)}</div>
          </Card>
        );
      })}
    </div>
  );
}
