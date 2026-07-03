// src/components/shared/Confetti.jsx
// 全螢幕彩帶粒子（批次 C 慶祝層）— canvas 實作、零依賴
// - 尊重動畫開關：<html class="no-anim"> 時直接跳過（立即 onDone）
// - 播完自動停止 rAF；unmount 自動清理
// 用法：{celebrating && <Confetti onDone={() => setCelebrating(false)} />}
import { useEffect, useRef } from "react";

export default function Confetti({ pieces = 120, duration = 2600, colors, onDone }) {
  const canvasRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // 動畫關閉（手動或系統 reduced-motion）→ 不播，直接結束
    if (typeof document !== "undefined" && document.documentElement.classList.contains("no-anim")) {
      const t = setTimeout(() => onDoneRef.current && onDoneRef.current(), 0);
      return () => clearTimeout(t);
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    const palette = colors || ["#fbbf24", "#f472b6", "#60a5fa", "#4ade80", "#a78bfa", "#f87171"];

    const parts = Array.from({ length: pieces }, () => ({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.35,          // 從畫面上方灑落
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vx: -1.5 + Math.random() * 3,
      vy: 2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      vr: -0.15 + Math.random() * 0.3,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));

    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const elapsed = t - t0;
      ctx.clearRect(0, 0, W, H);
      // 最後 500ms 淡出
      ctx.globalAlpha = elapsed > duration - 500 ? Math.max(0, (duration - elapsed) / 500) : 1;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vy += 0.02; // 輕微重力
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < duration) raf = requestAnimationFrame(tick);
      else onDoneRef.current && onDoneRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line

  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 400 }} />
  );
}
