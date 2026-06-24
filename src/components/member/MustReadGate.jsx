// src/components/member/MustReadGate.jsx
// 強制閱讀彈窗：有未讀的 mustRead 訊息時，覆蓋全螢幕，讀了才能繼續
import { markNotificationRead } from "../../lib/db";

export default function MustReadGate({ memberId, notifications = [] }) {
  const queue = notifications.filter(n =>
    n.mustRead &&
    !(n.readBy    || []).includes(memberId) &&
    !(n.deletedBy || []).includes(memberId)
  );

  if (queue.length === 0) return null;
  const n = queue[0]; // 一次顯示一則

  async function confirm() {
    await markNotificationRead(n.id, memberId);
    // 標記後 subscribe 更新 queue，自動換下一則或關閉
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
      style={{ animation:"fadeIn .2s ease" }}>
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-sm text-center"
        style={{ animation:"popIn .3s cubic-bezier(.18,.89,.32,1.28)" }}>
        <div className="text-4xl mb-2">🎁</div>
        <div className="text-pink-600 text-xs font-black tracking-wider mb-1">優惠訊息</div>
        <div className="text-gray-800 font-black text-xl mb-2">{n.title}</div>
        <div className="text-gray-600 text-sm mb-5 whitespace-pre-wrap">{n.content}</div>
        {queue.length > 1 && (
          <div className="text-gray-400 text-xs mb-3">還有 {queue.length - 1} 則待閱讀</div>
        )}
        <button
          onClick={confirm}
          className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white font-black rounded-xl">
          我知道了
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { 0%{transform:scale(.8);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}
