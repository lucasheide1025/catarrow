// src/components/booking/BookingScheduleCard.jsx
// 「今日課表小卡」— 把某一天已排定的預約畫成一張 PNG 圖，教練可下載後貼到學生群組（LINE 等）。
//
// 設計取向比照專案一貫做法：不引入 html-to-image / dom-to-image 之類套件，直接用 Canvas 2D
// 畫圖再 toBlob 匯出，純瀏覽器計算、零相依、跨裝置最穩（跟音效走 Web Audio 合成、
// 怪物走 SVG 是同一套哲學）。資料只吃「某一天已 confirmed/completed 的 bookings 陣列」，
// 不自己查 Firestore——呼叫端（AdminBooking 的 CalendarTab）本來就已經載好這天的資料了。
import { useEffect, useRef, useState, useCallback } from "react";
import { PLAN_TYPES, durationLabel } from "../../lib/bookingSchedule";
import { Modal, Btn } from "../shared/UI";

const DOW = ["日", "一", "二", "三", "四", "五", "六"];
// 每種方案一個識別色（左側色條 + 方案文字），跟行事曆的藍色系不同，這裡是給「對外分享」的成品用色
const PLAN_COLOR = {
  general:       "#3b82f6", // 藍
  discount:      "#10b981", // 綠
  own_equipment: "#f59e0b", // 橘
};
const PLAN_LABEL = Object.fromEntries(PLAN_TYPES.map(p => [p.id, p.label]));

// 場館名稱：之後要改招牌只改這裡
const VENUE_NAME = "🎯 貓小隊射箭場";

const W = 500;               // 邏輯寬（實際輸出會 ×scale 提高清晰度）
const PAD = 22;
const HEADER_H = 88;
const ROW_H = 52;
const ROW_GAP = 7;
const FOOTER_H = 34;

// Canvas 沒有跨瀏覽器保證的 roundRect，自己補一個路徑函式（OPPO 等舊 WebView 也吃得下）
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 超出寬度就截斷加「…」
function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

// 把某天的 bookings 畫到 canvas；回傳這張圖的邏輯高度
function drawCard(canvas, date, rows, scale) {
  const H = HEADER_H + (rows.length
    ? rows.length * ROW_H + (rows.length - 1) * ROW_GAP
    : 64) + FOOTER_H + PAD;

  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // 背景漸層
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#122040");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Header ─────────────────────────────
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#93c5fd";
  ctx.font = "700 15px system-ui, 'Segoe UI', sans-serif";
  ctx.fillText(VENUE_NAME + "　今日課表", PAD, PAD + 15);

  const d = new Date(date + "T00:00:00+08:00");
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 30px system-ui, 'Segoe UI', sans-serif";
  ctx.fillText(date, PAD, PAD + 50);

  // 週幾徽章
  const dowText = `週${DOW[d.getDay()]}`;
  ctx.font = "700 15px system-ui, sans-serif";
  const bw = ctx.measureText(dowText).width + 20;
  roundRectPath(ctx, PAD + ctx.measureText(date).width + 12, PAD + 26, bw, 24, 12);
  ctx.fillStyle = "rgba(59,130,246,0.22)";
  ctx.fill();
  ctx.fillStyle = "#bfdbfe";
  ctx.fillText(dowText, PAD + ctx.measureText(date).width + 22, PAD + 43);

  // ── Rows ───────────────────────────────
  let y = HEADER_H;
  const rw = W - PAD * 2;
  if (!rows.length) {
    roundRectPath(ctx, PAD, y, rw, 56, 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("今日尚無排定課程 🗒️", W / 2, y + 34);
    ctx.textAlign = "left";
  } else {
    rows.forEach(b => {
      const color = PLAN_COLOR[b.planType] || "#3b82f6";
      const x = PAD;
      // 底板
      roundRectPath(ctx, x, y, rw, ROW_H, 12);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      // 左側方案色條
      roundRectPath(ctx, x, y, 6, ROW_H, 3);
      ctx.fillStyle = color;
      ctx.fill();

      // 時間 + 時數
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 19px system-ui, sans-serif";
      ctx.fillText(`${b.startTime}–${b.endTime}`, x + 16, y + 24);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.fillText(durationLabel(b.durationHours || 1), x + 16, y + 43);

      // 姓名（右側）
      const nameX = x + 148;
      const people = (b.participantCount || 1) > 1 ? `（${b.participantCount}人）` : "";
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "800 18px system-ui, sans-serif";
      ctx.fillText(ellipsize(ctx, (b.memberName || "顧客") + people, rw - 148 - 16), nameX, y + 23);

      // 方案 + 新舊生
      ctx.fillStyle = color;
      ctx.font = "700 13px system-ui, sans-serif";
      const tag = `${PLAN_LABEL[b.planType] || b.planType}${b.isNewStudent ? " · 🆕新生" : ""}`;
      ctx.fillText(ellipsize(ctx, tag, rw - 148 - 16), nameX, y + 43);

      y += ROW_H + ROW_GAP;
    });
  }

  // ── Footer ─────────────────────────────
  ctx.fillStyle = "#475569";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillText(`共 ${rows.length} 堂 · 線上約課系統`, PAD, H - PAD + 4);

  return H;
}

export default function BookingScheduleCard({ date, bookings, onClose }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // 只留這一天、confirmed/completed，依開始時間排序（呼叫端多半已篩過，這裡再保險一次）
  const rows = (bookings || [])
    .filter(b => b.date === date && ["confirmed", "completed"].includes(b.status))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.memberName || "").localeCompare(b.memberName || ""));

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, date, rows, Math.min(2, window.devicePixelRatio || 1) * 2);
  }, [date, bookings, rows]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    canvas.toBlob(blob => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `課表_${date}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setBusy(false);
    }, "image/png");
  }, [date]);

  return (
    <Modal open onClose={onClose} title="輸出今日課表小卡" wide>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/40">
          <canvas ref={canvasRef} className="block w-full" />
        </div>
        <div className="text-slate-500 text-xs leading-relaxed">
          這張圖會顯示學生姓名與方案，適合貼到自己的學生群組通知；請勿轉貼到不特定公開場合。
        </div>
        <Btn v="primary" onClick={download} disabled={busy}>
          {busy ? "產生中…" : "⬇ 下載 PNG 圖片"}
        </Btn>
      </div>
    </Modal>
  );
}
