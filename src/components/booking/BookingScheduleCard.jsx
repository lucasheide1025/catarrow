// src/components/booking/BookingScheduleCard.jsx
// 「今日課表小卡」— 把某一天已排定的預約畫成一張 PNG 圖，教練可下載後貼到學生群組（LINE 等）。
//
// 版式（第三版・精簡）：依「開始時段」分組，同一時段的人併成同一列，每人一個小色牌，
// 只顯示「姓名（人數）」＋以顏色/🆕 區分新生(琥珀)／舊生(藍)，不顯示方案、不顯示時數
// （教練要的是「這時段有誰、是不是新生」，方案結帳時才需要）。
//
// 一律用 Canvas 2D 直接畫圖再 toBlob 匯出，不引入 html-to-image 之類套件（比照專案
// Web Audio 音效 / SVG 怪物的零相依哲學，跨裝置最穩）。資料只吃某天已載好的 bookings 陣列。
import { useEffect, useRef, useState } from "react";
import { Modal, Btn } from "../shared/UI";

const DOW = ["日", "一", "二", "三", "四", "五", "六"];
// 新生 / 舊生 兩種色牌樣式
const NEW_STYLE = { bg: "rgba(245,158,11,0.18)", border: "rgba(251,191,36,0.55)", text: "#fcd34d" };
const OLD_STYLE = { bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.5)",  text: "#bfdbfe" };

// 場館名稱：之後要改招牌只改這裡
const VENUE_NAME = "🎯 貓小隊射箭場";

const W = 460;
const PAD = 20;
const HEADER_H = 98;
const TIME_COL = 78;   // 左側時段標籤欄寬
const CHIP_H = 30;
const CHIP_GAP = 6;
const SLOT_GAP = 12;   // 時段之間的間距
const FOOTER_H = 30;
const CHIP_FONT = "700 14px system-ui, 'Segoe UI', sans-serif";

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

// 一個人色牌上的字：🆕(新生) + 姓名 + ×人數(多人時)
function chipLabel(b) {
  const name = b.memberName || "顧客";
  const withCount = (b.participantCount || 1) > 1 ? `${name}×${b.participantCount}` : name;
  return (b.isNewStudent ? "🆕" : "") + withCount;
}

function drawDot(ctx, x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// 把某天的 bookings 畫到 canvas；回傳這張圖的邏輯高度
function drawCard(canvas, date, rows, scale) {
  const ctx = canvas.getContext("2d");
  const contentW = W - PAD * 2 - TIME_COL;

  // ── 依開始時段分組（rows 已依 startTime→姓名 排序，Map 插入順序即為時段順序）──
  const order = [];
  const map = new Map();
  rows.forEach(b => {
    if (!map.has(b.startTime)) { map.set(b.startTime, []); order.push(b.startTime); }
    map.get(b.startTime).push(b);
  });

  // ── 版面量測（在設定 canvas 尺寸「之前」做，measureText 不依賴畫布大小）──
  ctx.font = CHIP_FONT;
  const groupData = order.map(time => {
    const chips = [];
    let x = 0, row = 0;
    map.get(time).forEach(b => {
      const label = ellipsize(ctx, chipLabel(b), contentW - 18);
      const w = Math.ceil(ctx.measureText(label).width) + 18;
      if (x > 0 && x + w > contentW) { row++; x = 0; } // 放不下就換行
      chips.push({ label, isNew: !!b.isNewStudent, x, row, w });
      x += w + CHIP_GAP;
    });
    const rowCount = (chips.length ? chips[chips.length - 1].row : 0) + 1;
    return { time, chips, height: rowCount * CHIP_H + (rowCount - 1) * CHIP_GAP };
  });

  const bodyH = rows.length
    ? groupData.reduce((s, g) => s + g.height, 0) + SLOT_GAP * (groupData.length - 1)
    : 52;
  const H = HEADER_H + bodyH + FOOTER_H + PAD;

  // ── 設定尺寸（會重置 ctx 狀態）→ 開始畫 ──
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  // 背景漸層
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b1220");
  bg.addColorStop(1, "#122040");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Header ─────────────────────────────
  ctx.fillStyle = "#93c5fd";
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText(VENUE_NAME + "　今日課表", PAD, PAD + 14);

  const d = new Date(date + "T00:00:00+08:00");
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 28px system-ui, sans-serif";
  const dateW = ctx.measureText(date).width; // 先在 28px 字級量好日期寬，別等切到 14px 才量（會量太窄）
  ctx.fillText(date, PAD, PAD + 46);

  const dowText = `週${DOW[d.getDay()]}`;
  ctx.font = "700 14px system-ui, sans-serif";
  const bw = ctx.measureText(dowText).width + 18;
  const badgeX = PAD + dateW + 12;
  roundRectPath(ctx, badgeX, PAD + 24, bw, 22, 11);
  ctx.fillStyle = "rgba(59,130,246,0.22)";
  ctx.fill();
  ctx.fillStyle = "#bfdbfe";
  ctx.fillText(dowText, badgeX + 9, PAD + 39);

  // 圖例：新生 / 舊生 顏色說明
  const lgy = PAD + 70;
  ctx.font = "600 12px system-ui, sans-serif";
  drawDot(ctx, PAD + 5, lgy - 4, NEW_STYLE.text);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("新生", PAD + 15, lgy);
  const ox = PAD + 15 + ctx.measureText("新生").width + 16;
  drawDot(ctx, ox, lgy - 4, OLD_STYLE.text);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("舊生", ox + 10, lgy);

  // ── Rows（時段分組）──────────────────────
  let y = HEADER_H;
  if (!rows.length) {
    roundRectPath(ctx, PAD, y, W - PAD * 2, 52, 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("今日尚無排定課程 🗒️", W / 2, y + 32);
    ctx.textAlign = "left";
  } else {
    groupData.forEach(g => {
      // 時段標籤（對齊第一列色牌）
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "800 16px system-ui, sans-serif";
      ctx.fillText(g.time, PAD, y + 20);
      // 色牌
      g.chips.forEach(c => {
        const cx = PAD + TIME_COL + c.x;
        const cy = y + c.row * (CHIP_H + CHIP_GAP);
        const st = c.isNew ? NEW_STYLE : OLD_STYLE;
        roundRectPath(ctx, cx, cy, c.w, CHIP_H, 8);
        ctx.fillStyle = st.bg;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = st.border;
        ctx.stroke();
        ctx.fillStyle = st.text;
        ctx.font = CHIP_FONT;
        ctx.fillText(c.label, cx + 9, cy + 20);
      });
      y += g.height + SLOT_GAP;
    });
  }

  // ── Footer ─────────────────────────────
  const totalPeople = rows.reduce((s, b) => s + (b.participantCount || 1), 0);
  ctx.fillStyle = "#475569";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillText(`共 ${totalPeople} 位 · 線上約課系統`, PAD, H - PAD + 4);

  return H;
}

export default function BookingScheduleCard({ date, bookings, onClose }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // 只留這一天、confirmed/completed，依開始時間排序（同時段內再依姓名穩定排序）
  const rows = (bookings || [])
    .filter(b => b.date === date && ["confirmed", "completed"].includes(b.status))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.memberName || "").localeCompare(b.memberName || ""));

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, date, rows, Math.min(2, window.devicePixelRatio || 1) * 2);
  }, [date, bookings, rows]);

  function download() {
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
  }

  return (
    <Modal open onClose={onClose} title="輸出今日課表小卡" wide>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/40 max-w-[460px] mx-auto w-full">
          <canvas ref={canvasRef} className="block w-full" />
        </div>
        <div className="text-slate-500 text-xs leading-relaxed">
          這張圖會顯示學生姓名與新／舊生，適合貼到自己的學生群組通知；請勿轉貼到不特定公開場合。
        </div>
        <Btn v="primary" onClick={download} disabled={busy}>
          {busy ? "產生中…" : "⬇ 下載 PNG 圖片"}
        </Btn>
      </div>
    </Modal>
  );
}
