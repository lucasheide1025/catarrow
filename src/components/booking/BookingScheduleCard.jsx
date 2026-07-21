// src/components/booking/BookingScheduleCard.jsx
// 「今日課表小卡」— 把某一天已排定的預約畫成一張 PNG 圖，教練可下載後貼到學生群組（LINE 等）。
//
// 版式（第三版・精簡）：依「開始時段」分組，同一時段的人併成同一列，每人一個小色牌，
// 多人預約時依人數展開為獨立色牌格子（例：張三 (1/2)、張三 (2/2)），
// 只顯示「姓名（人數）」＋以顏色/🆕 區分新生(琥珀)／舊生(藍)。
import { useEffect, useRef, useState } from "react";
import { Modal, Btn } from "../shared/UI";

const DOW = ["日", "一", "二", "三", "四", "五", "六"];
// 新生 / 舊生 兩種色牌樣式
const NEW_STYLE = { bg: "rgba(245,158,11,0.18)", border: "rgba(251,191,36,0.55)", text: "#fcd34d" };
const OLD_STYLE = { bg: "rgba(96,165,250,0.15)", border: "rgba(96,165,250,0.5)",  text: "#bfdbfe" };

// 場館名稱：之後要改招牌只改這裡
const VENUE_NAME = "🎯 貓小隊射箭場";

const PAD = 20;
const HEADER_H = 98;
const TIME_COL = 78;   // 左側時段標籤欄寬
const CHIP_GAP = 6;
const SLOT_GAP = 12;   // 時段之間的間距
const FOOTER_H = 30;

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

function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

function drawDot(ctx, x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

const SLOT_ROW_H = 48; // 一個小時格的基準高度
const PLAN_SHORT_LABEL = { general: "單人一般", discount: "兒童/學生/敬老", own_equipment: "自備器材" };

// 把某天的 bookings 畫到 canvas；回傳這張圖的邏輯高度
function drawCard(canvas, date, rows, scale) {
  const ctx = canvas.getContext("2d");

  // ── 1. 收集當天所有有活動的小時格，按時間排序 ──
  const activeHoursSet = new Set();
  rows.forEach(b => {
    const startH = Number((b.startTime || "10:00").split(":")[0]);
    const duration = b.durationHours || 1;
    for (let i = 0; i < duration; i++) {
      const h = startH + i;
      activeHoursSet.add(`${String(h).padStart(2, "0")}:00`);
    }
  });

  const order = Array.from(activeHoursSet).sort();

  // ── 2. 為每個 hour 格計算 top Y 座標 ──
  const slotY = {};
  let curY = HEADER_H;
  order.forEach(t => {
    slotY[t] = curY;
    curY += SLOT_ROW_H + SLOT_GAP;
  });

  // ── 3. 為每筆預約配置不重疊的 lane (欄位) ──
  const occupiedLanesAtHour = new Map();
  const bPlacements = rows.map(b => {
    const startH = Number((b.startTime || "10:00").split(":")[0]);
    const duration = b.durationHours || 1;
    const hours = Array.from({ length: duration }, (_, i) => startH + i);

    let lane = 0;
    while (hours.some(h => occupiedLanesAtHour.get(h)?.has(lane))) {
      lane++;
    }
    hours.forEach(h => {
      if (!occupiedLanesAtHour.has(h)) occupiedLanesAtHour.set(h, new Set());
      occupiedLanesAtHour.get(h).add(lane);
    });

    const name = b.displayMemberName || b.memberName || "顧客";
    const title = (b.isNewStudent ? "🆕 " : "") + name;
    return { booking: b, lane, title, duration, startH };
  });

  // 動態計算 Canvas 寬度 W，確保多人展開後各格子不爆框
  const maxLanes = Math.max(1, ...bPlacements.map(p => p.lane + 1));
  const targetLaneW = maxLanes <= 2 ? 160 : maxLanes === 3 ? 120 : 105;
  const contentW = Math.max(342, maxLanes * targetLaneW + (maxLanes - 1) * CHIP_GAP);
  const W = contentW + PAD * 2 + TIME_COL;
  const laneW = Math.floor((contentW - (maxLanes - 1) * CHIP_GAP) / maxLanes);

  const bodyH = rows.length
    ? (order.length * SLOT_ROW_H + (order.length - 1) * SLOT_GAP)
    : 52;
  const H = HEADER_H + bodyH + FOOTER_H + PAD;

  // ── 設定尺寸 ──
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
  const dateW = ctx.measureText(date).width;
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

  // 圖例
  const lgy = PAD + 70;
  ctx.font = "600 12px system-ui, sans-serif";
  drawDot(ctx, PAD + 5, lgy - 4, NEW_STYLE.text);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("新生", PAD + 15, lgy);
  const ox = PAD + 15 + ctx.measureText("新生").width + 16;
  drawDot(ctx, ox, lgy - 4, OLD_STYLE.text);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("舊生", ox + 10, lgy);

  // ── Rows ─────────────────────────────
  if (!rows.length) {
    roundRectPath(ctx, PAD, HEADER_H, W - PAD * 2, 52, 12);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("今日尚無排定課程 🗒️", W / 2, HEADER_H + 32);
    ctx.textAlign = "left";
  } else {
    order.forEach(t => {
      const ty = slotY[t];
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "800 15px system-ui, sans-serif";
      ctx.fillText(t, PAD, ty + 28);

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(PAD + TIME_COL, ty + SLOT_ROW_H + SLOT_GAP / 2, contentW, 1);
    });

    bPlacements.forEach(({ booking: b, lane, title, duration, startH }) => {
      const startT = b.startTime;
      const endH = startH + duration - 1;
      const endT = `${String(endH).padStart(2, "0")}:00`;

      const topY = slotY[startT];
      const bottomY = (slotY[endT] || topY) + SLOT_ROW_H;
      const blockH = bottomY - topY;

      const leftX = PAD + TIME_COL + lane * (laneW + CHIP_GAP);
      const st = b.isNewStudent ? NEW_STYLE : OLD_STYLE;

      roundRectPath(ctx, leftX, topY, laneW, blockH, 10);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = st.border;
      ctx.stroke();

      // 第一行：姓名 (包含 1/2 人數標記)
      ctx.fillStyle = st.text;
      ctx.font = "700 13px system-ui, sans-serif";
      const displayTitle = ellipsize(ctx, title, laneW - 12);
      ctx.fillText(displayTitle, leftX + 8, topY + 20);

      // 第二行：時間起迄
      if (blockH >= 40) {
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.fillStyle = b.isNewStudent ? "rgba(253,230,138,0.85)" : "rgba(191,219,254,0.85)";
        const timeRangeText = `${b.startTime}–${b.endTime}${duration > 1 ? ` (${duration}hr)` : ''}`;
        ctx.fillText(ellipsize(ctx, timeRangeText, laneW - 12), leftX + 8, topY + 36);
      }

      // 第三行：方案名稱
      if (blockH >= 70) {
        ctx.font = "500 10px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        const planText = PLAN_SHORT_LABEL[b.planType] || b.planType || "";
        ctx.fillText(ellipsize(ctx, planText, laneW - 12), leftX + 8, topY + 52);
      }
    });
  }

  // ── Footer ─────────────────────────────
  ctx.fillStyle = "#475569";
  ctx.font = "500 12px system-ui, sans-serif";
  ctx.fillText(`共 ${rows.length} 人次 · 線上約課系統`, PAD, H - PAD + 4);

  return H;
}

export default function BookingScheduleCard({ date, bookings, onClose }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);

  // 若一個帳號預約了多人 (participantCount > 1)，展開為獨立的相應個數格子！
  const expandedRows = [];
  (bookings || [])
    .filter(b => b.date === date && ["confirmed", "completed"].includes(b.status))
    .forEach(b => {
      const count = Math.max(1, b.participantCount || 1);
      for (let p = 0; p < count; p++) {
        expandedRows.push({
          ...b,
          participantIndex: p,
          displayMemberName: count > 1 ? `${b.memberName || "顧客"} (${p + 1}/${count})` : (b.memberName || "顧客"),
        });
      }
    });

  expandedRows.sort((a, b) =>
    a.startTime.localeCompare(b.startTime) ||
    (a.displayMemberName || "").localeCompare(b.displayMemberName || "")
  );

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, date, expandedRows, Math.min(2, window.devicePixelRatio || 1) * 2);
  }, [date, bookings, expandedRows]);

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
          這張圖會顯示學生姓名與新／舊生（多人預約已自動展開為獨立格子），適合貼到自己的學生群組通知。
        </div>
        <Btn v="primary" onClick={download} disabled={busy}>
          {busy ? "產生中…" : "⬇ 下載 PNG 圖片"}
        </Btn>
      </div>
    </Modal>
  );
}
