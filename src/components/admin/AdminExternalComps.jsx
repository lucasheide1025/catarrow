// src/components/admin/AdminExternalComps.jsx
import { useState, useEffect } from "react";
import { reviewExternalComp } from "../../lib/db";
import { useAuth } from "../../hooks/useAuth";
import { fmtDT } from "../../lib/constants";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Card, Btn, Sel, Inp, Modal, ST, Spinner, Empty, useToast } from "../shared/UI";

const STATUS_LABEL = {
  pending_review: { label:"⏳ 待審核", cls:"bg-yellow-100 text-yellow-700" },
  approved:       { label:"✅ 已通過", cls:"bg-green-100 text-green-700"  },
  rejected:       { label:"❌ 未通過", cls:"bg-red-100 text-red-700"      },
};

export default function AdminExternalComps() {
  const { profile } = useAuth();
  const { toast, ToastContainer } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("pending_review");
  const [reviewModal, setReviewModal] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "externalComps"), orderBy("submittedAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = filter === "全部"
    ? records
    : records.filter(r => r.status === filter);

  const pendingCount = records.filter(r => r.status === "pending_review").length;

  if (loading) return <Spinner />;

  return (
    <div className="p-4 flex flex-col gap-4">
      <ToastContainer />
      <div className="flex justify-between items-center">
        <h2 className="text-gray-800 font-black text-xl">🏅 對外比賽審核</h2>
        {pendingCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {pendingCount} 待審核
          </span>
        )}
      </div>

      {/* 篩選 */}
      <div className="flex gap-2">
        {[["pending_review","待審核"],["approved","已通過"],["rejected","未通過"],["全部","全部"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${filter===v?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200"}`}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <Empty message="沒有符合的紀錄" />}

      {filtered.map(r => {
        const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending_review;
        return (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-gray-800 font-bold text-sm">{r.memberName}</span>
                  {r.memberNickname && <span className="text-gray-400 text-xs">（{r.memberNickname}）</span>}
                </div>
                <div className="text-gray-700 font-medium text-sm">{r.compName}</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  📅 {r.date}{r.location&&`　📍 ${r.location}`}
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${st.cls}`}>
                {st.label}
              </span>
            </div>

            <div className="flex gap-2 flex-wrap mb-3">
              <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">{r.category}</span>
              <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{r.rank}</span>
              {r.hasAward && <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-0.5 rounded-full">🏆 {r.awardKept?"獎項留箭場":"有獎項"}</span>}
            </div>

            {r.note && <div className="text-gray-500 text-xs italic mb-3">「{r.note}」</div>}

            {r.status === "approved" && r.badgeType && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">
                <div className="text-green-700 text-xs font-bold">
                  已發放：{r.badgeType==="fatCat"?"肥貓章":r.badgeType==="score"?"積分章":"成就章"}
                  　{r.badgeColor==="gold"?"金":r.badgeColor==="silver"?"銀":r.badgeColor==="black"?"黑":"銅"}章 × {r.badgeCount}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-gray-300 text-xs">{fmtDT(r.submittedAt)}</div>
              {r.status === "pending_review" && (
                <Btn v="primary" size="sm" onClick={() => setReviewModal(r)}>審核</Btn>
              )}
            </div>
          </Card>
        );
      })}

      {reviewModal && (
        <ReviewModal
          record={reviewModal}
          operatorId={profile.id}
          onClose={() => setReviewModal(null)}
          onDone={(msg) => { toast(msg); setReviewModal(null); }}
        />
      )}
    </div>
  );
}

function ReviewModal({ record: r, operatorId, onClose, onDone }) {
  const [decision, setDecision]   = useState("approved");
  const [badgeType, setBadgeType] = useState("fatCat");
  const [badgeColor, setBadgeColor] = useState("bronze");
  const [badgeCount, setBadgeCount] = useState(1);
  const [saving, setSaving]       = useState(false);

  async function submit() {
    setSaving(true);
    await reviewExternalComp(
      r.id,
      decision === "approved",
      decision === "approved" ? badgeType : null,
      decision === "approved" ? badgeColor : null,
      decision === "approved" ? Number(badgeCount) : 0,
      operatorId
    );
    onDone(decision === "approved" ? "已通過並發放徽章 ✓" : "已標記為未通過");
    setSaving(false);
  }

  return (
    <Modal open onClose={onClose} title={`審核申報 — ${r.memberName}`}>
      <div className="flex flex-col gap-4">
        {/* 申報資訊 */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-gray-700 font-bold text-sm mb-1">{r.compName}</div>
          <div className="text-gray-500 text-xs">
            {r.date}　{r.category}　{r.rank}
            {r.hasAward && `　${r.awardKept?"獎項留箭場":"有獎項"}`}
          </div>
          {r.note && <div className="text-gray-400 text-xs mt-1 italic">「{r.note}」</div>}
        </div>

        {/* 審核決定 */}
        <div className="flex gap-3">
          {[["approved","✅ 通過"],["rejected","❌ 不通過"]].map(([v,l])=>(
            <button key={v} onClick={()=>setDecision(v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all
                ${decision===v
                  ?(v==="approved"?"bg-green-600 text-white border-green-600":"bg-red-500 text-white border-red-500")
                  :"bg-white text-gray-600 border-gray-200"}`}>
              {l}
            </button>
          ))}
        </div>

        {/* 發章設定（通過才顯示）*/}
        {decision === "approved" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col gap-3">
            <ST>發放徽章設定</ST>
            <div className="grid grid-cols-3 gap-2">
              <Sel label="章別" value={badgeType} onChange={e=>setBadgeType(e.target.value)}
                options={[{value:"fatCat",label:"🐱 肥貓章"},{value:"score",label:"⭐ 積分章"},{value:"achievement",label:"🏆 成就章"}]} />
              <Sel label="等級" value={badgeColor} onChange={e=>setBadgeColor(e.target.value)}
                options={badgeType==="achievement"
                  ?[{value:"silver",label:"銀章"},{value:"gold",label:"金章"},{value:"black",label:"黑章"}]
                  :[{value:"bronze",label:"銅章"},{value:"silver",label:"銀章"},{value:"gold",label:"金章"}]} />
              <Inp label="數量" type="number" min="1" value={badgeCount}
                onChange={e=>setBadgeCount(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Btn v="secondary" className="flex-1" onClick={onClose}>取消</Btn>
          <Btn v={decision==="approved"?"success":"danger"} className="flex-1" onClick={submit} disabled={saving}>
            {saving ? "處理中…" : "確認送出"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
