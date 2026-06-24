// src/components/member/HonorTicker.jsx
// 首頁頂部榮耀公告行：輪播最新 5 筆，最新一筆高亮，點了進訊息中心
import { useState, useEffect } from "react";
import { subscribeNotifications } from "../../lib/db";

export default function HonorTicker({ memberId, memberCreatedAt, onGoPage }) {
  const [honors, setHonors] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!memberId) return;
    // ✅ 補傳 memberCreatedAt，防止新會員看到舊通知
    const unsub = subscribeNotifications(memberId, list => {
      const h = list
        .filter(n => n.type === "high_score" || n.type === "cert_pass")
        .filter(n => !(n.deletedBy || []).includes(memberId))
        .slice(0, 5); // 最新 5 筆（list 已按 createdAt desc）
      setHonors(h);
    }, memberCreatedAt);
    return () => unsub && unsub();
  }, [memberId, memberCreatedAt]);

  // 輪播
  useEffect(() => {
    if (honors.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % honors.length), 3500);
    return () => clearInterval(t);
  }, [honors.length]);

  if (honors.length === 0) return null;

  const cur      = honors[idx] || honors[0];
  const isLatest = idx === 0; // 最新那筆（輪到第一筆時）高亮

  return (
    <button
      onClick={() => onGoPage && onGoPage("notifications")}
      className="w-full text-left overflow-hidden rounded-xl px-3 py-2 flex items-center gap-2 transition-all"
      style={{
        background: isLatest ? "linear-gradient(90deg,#fef3c7,#fde68a)" : "#f8fafc",
        border:     isLatest ? "1px solid #fcd34d" : "1px solid #e2e8f0",
        boxShadow:  isLatest ? "0 2px 10px rgba(251,191,36,.25)" : "none",
      }}>
      <span
        className="text-base flex-shrink-0"
        style={isLatest ? { animation:"tickerPulse 1.2s ease infinite" } : {}}>
        {cur.type === "cert_pass" ? "🎖️" : "🎯"}
      </span>
      <span className={`text-xs font-bold truncate flex-1 ${isLatest ? "text-amber-800" : "text-gray-500"}`}>
        {cur.title}
      </span>
      {honors.length > 1 && (
        <span className="flex gap-1 flex-shrink-0">
          {honors.map((_, i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full"
              style={{ background: i === idx ? "#f59e0b" : "#d1d5db" }} />
          ))}
        </span>
      )}
      <style>{`@keyframes tickerPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.25)} }`}</style>
    </button>
  );
}
