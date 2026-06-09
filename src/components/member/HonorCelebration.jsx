// src/components/member/HonorCelebration.jsx
// 華麗慶祝彈窗：當事人達標/取證時跳出，灑彩帶+金光+彈性彈出，點「領取證書」跳到對應頁面
import { useState, useEffect, useRef } from "react";
import { subscribeNotifications, markNotificationRead } from "../../lib/db";
import { sfxEpic, sfxTap } from "../../lib/sound";

// 圖鑑成就稀有度 → 中文
const RARITY_ZH = { common:"普通", uncommon:"非凡", rare:"稀有", epic:"史詩", legendary:"傳說", mythic:"神話" };

export default function HonorCelebration({ memberId, onGoPage }) {
  const [queue, setQueue] = useState([]);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!memberId) return;
    const unsub = subscribeNotifications(memberId, list => {
      const mine = list.filter(n =>
        (n.type === "high_score" || n.type === "cert_pass") &&
        n.subjectMemberId === memberId &&
        !(n.readBy || []).includes(memberId) &&
        !(n.deletedBy || []).includes(memberId)
      );
      setQueue(mine);
    });
    return () => unsub && unsub();
  }, [memberId]);

  const current = queue[0] || null;

  // 灑彩帶動畫
  useEffect(() => {
    if (!current || !canvasRef.current) return;
    sfxEpic();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const colors = ["#fbbf24","#f59e0b","#fde68a","#fff","#fb7185","#60a5fa","#34d399"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: Math.random() * W, y: Math.random() * -H,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 2 + Math.random() * 4, vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI, vr: -0.2 + Math.random() * 0.4,
    }));
    let t = 0;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      pieces.forEach(p => {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr;
        if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      t++;
      if (t < 360) raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [current]);

  if (!current) return null;

  const isCert  = current.type === "cert_pass";
  const info    = current.subjectInfo || {};

  // 判斷是圖鑑成就通知（item 有值且 level 是英文 rarity）
  const isDexAchievement = !isCert && !!info.item && !!RARITY_ZH[info.level];

  // 顯示文字
  const mainText = isCert
    ? (info.level || "")                                        // 「藍證」/「金證」
    : isDexAchievement
      ? info.item                                               // 成就名稱，例：「初試啼聲」
      : `${info.bowLabel || info.bowType || ""}　${info.level || ""} 級`; // 檢定晉級

  const rarityText = isDexAchievement
    ? (RARITY_ZH[info.level] || "")                            // 稀有度中文
    : null;

  const titleText = isCert
    ? "🎉 恭喜取得證書！"
    : isDexAchievement
      ? "🎉 恭喜獲得新成就！"
      : "🎉 恭喜晉級！";

  async function claim() {
    sfxTap();
    await markNotificationRead(current.id, memberId);
    if (onGoPage) onGoPage("profile");
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background:"rgba(8,10,25,.75)", animation:"honorFade .3s ease" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <div className="relative w-full max-w-sm rounded-3xl p-7 text-center overflow-hidden"
        style={{
          background: isCert
            ? "linear-gradient(160deg,#78350f,#b45309 45%,#f59e0b)"
            : "linear-gradient(160deg,#1e3a8a,#7c3aed 50%,#db2777)",
          boxShadow: "0 20px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.1) inset",
          animation: "honorPop .55s cubic-bezier(.18,.89,.32,1.4)",
        }}>
        {/* 旋轉光芒 */}
        <div className="absolute left-1/2 top-1/2 pointer-events-none"
          style={{
            width:520, height:520, marginLeft:-260, marginTop:-260, opacity:.25,
            background:"conic-gradient(from 0deg, transparent 0 10deg, rgba(255,255,255,.9) 10deg 12deg, transparent 12deg 30deg, rgba(255,255,255,.7) 30deg 32deg, transparent 32deg)",
            animation:"honorSpin 12s linear infinite",
          }} />

        <div className="relative">
          <div className="text-6xl mb-2"
            style={{ animation:"honorBounce 1s ease infinite", filter:"drop-shadow(0 4px 12px rgba(0,0,0,.4))" }}>
            {isCert ? "🎖️" : isDexAchievement ? "🏅" : "🏆"}
          </div>
          <div className="text-amber-200 text-xs font-black tracking-[0.3em] mb-1">
            {isCert ? "ARCHER CERTIFICATION" : isDexAchievement ? "NEW ACHIEVEMENT" : "LEVEL UP"}
          </div>
          <div className="text-white font-black text-2xl mb-1"
            style={{ textShadow:"0 2px 12px rgba(0,0,0,.4)" }}>
            {titleText}
          </div>

          {/* 主成就名稱 */}
          <div className="my-4 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/15 backdrop-blur border border-white/30">
            <span className="text-white font-black text-xl">{mainText}</span>
            {rarityText && (
              <span className="text-amber-200 text-sm font-bold">{rarityText}</span>
            )}
          </div>

          {!isCert && !isDexAchievement && info.score != null && (
            <div className="text-amber-100 text-sm mb-1">成績 {info.score} 分</div>
          )}
          <div className="text-white/70 text-xs mb-5">
            {info.nickname ? `${info.nickname}，` : ""}你的努力被看見了！
          </div>

          <button onClick={claim}
            className="w-full py-3.5 rounded-2xl font-black text-base"
            style={{
              background:"linear-gradient(90deg,#fbbf24,#f59e0b)",
              color:"#7c2d12",
              boxShadow:"0 6px 20px rgba(251,191,36,.5)",
              animation:"honorGlow 1.6s ease infinite",
            }}>
            ✨ 領取成就，繼續前進 →
          </button>
        </div>
      </div>

      <style>{`
        @keyframes honorFade   { from { opacity:0 } to { opacity:1 } }
        @keyframes honorPop    { 0% { transform:scale(.6) translateY(40px);opacity:0 } 100% { transform:scale(1) translateY(0);opacity:1 } }
        @keyframes honorSpin   { to { transform:rotate(360deg) } }
        @keyframes honorBounce { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
        @keyframes honorGlow   { 0%,100% { box-shadow:0 6px 20px rgba(251,191,36,.5) } 50% { box-shadow:0 6px 32px rgba(251,191,36,.9) } }
      `}</style>
    </div>
  );
}