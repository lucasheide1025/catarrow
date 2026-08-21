// src/arcade/arcadeShare.js — 冒險戰績分享圖（原生 canvas 繪製）
// 無新依賴、可離線（Local First）、PWA 相容。手機用 Web Share API 原生分享，
// 不支援時自動降級為下載 PNG。

export const SHARE_CARD_W = 1080;
export const SHARE_CARD_H = 1620;

const C = {
  parchment: "#f5ecd7",
  panel: "#fffaf0",
  wood: "#6b4f2a",
  woodLight: "#8a6a3b",
  green: "#3a5a40",
  sub: "#8a6a3b",
  text: "#3b2f1e",
};
const F = (weight, size) =>
  `${weight} ${size}px 'Inter','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif`;

const DOSSIER_AXES = Object.freeze(["accuracy", "stability", "average", "power", "exploration"]);
const clampMetric = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

export function normalizeDossierMetrics(data = {}) {
  const source = data.metrics || data.radar || {};
  return {
    composite: clampMetric(data.composite),
    radar: Object.fromEntries(DOSSIER_AXES.map((axis) => [axis, clampMetric(source[axis])])),
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function gradeColors(grade) {
  return {
    S: { bg: "#f59e0b", border: "#e0b13c", label: "無傷大冒險！" },
    A: { bg: "#58a05f", border: "#bcd9be", label: "漂亮的冒險！" },
    B: { bg: "#4f6bd6", border: "#b9c4e6", label: "穩穩的冒險！" },
    C: { bg: "#a8865a", border: "#d8bd8a", label: "驚險的冒險！" },
  }[grade] || { bg: "#a8865a", border: "#d8bd8a", label: "冒險！" };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 繪製戰績卡片。
 * data: {
 *   nickname, cat: { name, image }, dungeonName,
 *   grade, label?,
 *   statsRows: [{ icon, label, value }]（最多 6 格）
 * }
 */
async function drawLegacyArcadeShareCard(canvas, data) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = SHARE_CARD_W;
  const H = SHARE_CARD_H;
  canvas.width = W;
  canvas.height = H;

  // 羊皮紙底 + 紙張紋理點
  ctx.fillStyle = C.parchment;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(120,84,35,0.07)";
  for (let y = 24; y < H; y += 26) {
    for (let x = 24; x < W; x += 26) {
      ctx.beginPath();
      ctx.arc(x + (y % 52 ? 13 : 0), y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 木質邊框
  ctx.strokeStyle = C.wood;
  ctx.lineWidth = 26;
  rr(ctx, 30, 30, W - 60, H - 60, 48);
  ctx.stroke();
  ctx.strokeStyle = C.woodLight;
  ctx.lineWidth = 6;
  rr(ctx, 54, 54, W - 108, H - 108, 36);
  ctx.stroke();

  const cx = W / 2;
  ctx.textAlign = "center";

  // 標頭
  ctx.fillStyle = C.sub;
  ctx.font = F(800, 30);
  ctx.fillText("CAT ARCHERY ADVENTURE", cx, 128);
  ctx.fillStyle = C.green;
  ctx.font = F(900, 54);
  ctx.fillText("🏹 貓小隊冒險", cx, 194);

  // 主標題
  ctx.fillStyle = C.text;
  ctx.font = F(1000, 88);
  ctx.fillText("🏆 冒險完成", cx, 322);

  // 評價徽章
  const gc = gradeColors(data.grade);
  const cy = 472;
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.fillStyle = gc.bg;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = gc.border;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = F(1000, 104);
  ctx.fillText(String(data.grade), cx, cy + 36);
  ctx.fillStyle = gc.bg === "#f59e0b" ? "#7c4a03" : "#ffffff";
  ctx.font = F(900, 36);
  ctx.fillText(data.label || gc.label, cx, cy + 142);

  // 同行貓（去背立繪 + 軟陰影）
  let img = null;
  try { img = await loadImage(data.cat.image); } catch { /* 離線時用 emoji */ }
  const catY = 648;
  const catSize = 330;
  ctx.fillStyle = "rgba(120,84,35,0.16)";
  ctx.beginPath();
  ctx.ellipse(cx, catY + catSize / 2 + 22, 148, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  if (img) {
    ctx.save();
    rr(ctx, cx - catSize / 2, catY, catSize, catSize, 38);
    ctx.clip();
    ctx.drawImage(img, cx - catSize / 2, catY, catSize, catSize);
    ctx.restore();
  } else {
    ctx.font = F(900, 170);
    ctx.fillText("🐱", cx, catY + catSize / 2 + 58);
  }

  // 玩家名 + 地下城
  ctx.fillStyle = C.text;
  ctx.font = F(1000, 56);
  ctx.fillText(`${data.nickname} 與 ${data.cat.name}`, cx, 1092);
  ctx.fillStyle = C.sub;
  ctx.font = F(900, 34);
  ctx.fillText(data.dungeonName, cx, 1144);

  // 戰績表格（最多 8 格；≤6 格用 2 列 × 3 欄，7~8 格用 2 列 × 4 欄）
  const rows = data.statsRows || [];
  const n = Math.min(rows.length, 8);
  const cols = n >= 7 ? 4 : 3;
  const cardW = n >= 7 ? 235 : 300;
  const cardH = 145;
  const gap = 20;
  const gridW = cols * cardW + (cols - 1) * gap;
  const startX = (W - gridW) / 2;
  const startY = 1200;
  rows.slice(0, n).forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    rr(ctx, x, y, cardW, cardH, 22);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#e2cd9d";
    ctx.stroke();
    ctx.fillStyle = C.sub;
    ctx.font = F(900, 28);
    ctx.fillText(`${s.icon} ${s.label}`, x + cardW / 2, y + 44);
    ctx.fillStyle = C.green;
    ctx.font = F(1000, 50);
    ctx.fillText(String(s.value), x + cardW / 2, y + 104);
  });

  // 頁尾
  ctx.fillStyle = C.sub;
  ctx.font = F(800, 30);
  ctx.fillText("貓小隊射箭場・訪客冒險 ｜ 掃 QR 一起冒險！", cx, H - 54);
}

function drawRadar(ctx, radar, cx, cy, radius) {
  const labels = ["命中", "穩定", "平均分", "火力", "探索"];
  const values = DOSSIER_AXES.map((axis) => radar[axis]);
  const point = (index, scale = 1) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 5;
    return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
  };
  for (let ring = 1; ring <= 4; ring += 1) {
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const [x, y] = point(i, ring / 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(85,199,243,.22)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  values.forEach((value, i) => {
    const [x, y] = point(i, value / 100);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(88,245,181,.30)";
  ctx.fill();
  ctx.strokeStyle = "#58f5b5";
  ctx.lineWidth = 6;
  ctx.stroke();
  labels.forEach((label, i) => {
    const [x, y] = point(i, 1.22);
    ctx.fillStyle = "#d8e4ef";
    ctx.font = F(900, 27);
    ctx.fillText(`${label} ${values[i]}`, x, y + 8);
  });
}

/** 1080×1620 貓弓冒險檔案；資料不足仍可完全離線產生。 */
export async function drawArcadeShareCard(canvas, data = {}) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = SHARE_CARD_W;
  canvas.height = SHARE_CARD_H;
  const { composite, radar } = normalizeDossierMetrics(data);
  const grade = String(data.grade || "C").toUpperCase();
  const gc = gradeColors(grade);
  const rows = (data.statsRows || []).slice(0, 3);

  const bg = ctx.createLinearGradient(0, 0, 0, SHARE_CARD_H);
  bg.addColorStop(0, "#070a12"); bg.addColorStop(.55, "#121827"); bg.addColorStop(1, "#1c1116");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SHARE_CARD_W, SHARE_CARD_H);
  ctx.strokeStyle = "#8a6a3b"; ctx.lineWidth = 18; rr(ctx, 28, 28, 1024, 1564, 32); ctx.stroke();
  ctx.strokeStyle = "#ffc83d"; ctx.lineWidth = 3; rr(ctx, 52, 52, 976, 1516, 24); ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#58f5b5"; ctx.font = F(900, 28); ctx.fillText("CAT ARCHERY DOSSIER", 540, 112);
  ctx.fillStyle = "#91a5b8"; ctx.font = F(800, 25); ctx.fillText(data.dungeonName || "未知地下城", 540, 154);

  ctx.textAlign = "left";
  ctx.fillStyle = "#fff8e8"; ctx.font = F(1000, 58); ctx.fillText(data.nickname || "小勇者", 90, 242);
  ctx.fillStyle = "#a8b8c9"; ctx.font = F(800, 28); ctx.fillText(`同行貓｜${data.cat?.name || "神秘貓咪"}`, 92, 286);
  ctx.fillStyle = "#ffc83d"; ctx.font = F(1000, 148); ctx.fillText(String(composite), 90, 450);
  ctx.fillStyle = "#91a5b8"; ctx.font = F(900, 25); ctx.fillText("COMPOSITE / 100", 98, 492);
  ctx.fillStyle = gc.bg; ctx.font = F(1000, 220); ctx.globalAlpha = .32; ctx.fillText(grade, 760, 455); ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff8e8"; ctx.font = F(1000, 40); ctx.fillText(data.label || gc.label, 94, 560);

  ctx.textAlign = "center";
  drawRadar(ctx, radar, 540, 880, 270);

  const cardW = 286; const gap = 22; const startX = 89;
  Array.from({ length: 3 }, (_, i) => rows[i] || { icon: "✦", label: "冒險紀錄", value: "—" }).forEach((row, i) => {
    const x = startX + i * (cardW + gap); const y = 1220;
    rr(ctx, x, y, cardW, 180, 18); ctx.fillStyle = "#182235"; ctx.fill(); ctx.strokeStyle = "rgba(244,231,197,.26)"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#9fb0c1"; ctx.font = F(900, 25); ctx.fillText(`${row.icon || "✦"} ${row.label || "紀錄"}`, x + cardW / 2, y + 55);
    ctx.fillStyle = "#58f5b5"; ctx.font = F(1000, 54); ctx.fillText(String(row.value ?? "—"), x + cardW / 2, y + 126);
  });

  let img = null;
  if (data.cat?.image) { try { img = await loadImage(data.cat.image); } catch { /* fallback mark below */ } }
  if (img) { ctx.globalAlpha = .18; ctx.drawImage(img, 750, 1060, 260, 260); ctx.globalAlpha = 1; }
  else { ctx.fillStyle = "rgba(244,231,197,.16)"; ctx.font = F(900, 120); ctx.fillText("🐱", 900, 1160); }
  ctx.fillStyle = "#91a5b8"; ctx.font = F(800, 25); ctx.fillText("拉弓・記分・和貓咪一起冒險", 540, 1490);
  ctx.fillStyle = "#55c7f3"; ctx.font = F(900, 24); ctx.fillText("student.catgroup.com.tw/?arcade", 540, 1534);
}

// 已備好的分享 PNG（結果頁一進來就自動截圖暫存，點分享零延遲）
const cachedShareBlobs = new WeakMap();

/** 自動截圖：把已繪好的戰績卡轉成 PNG 暫存。 */
export async function prepareShareBlob(canvas) {
  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) cachedShareBlobs.set(canvas, blob);
    return blob ? { ok: true } : { ok: false, reason: "no-blob" };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** 取得暫存的 PNG blob（沒暫存就現場產生）。 */
export async function getShareBlob(canvas) {
  const cached = cachedShareBlobs.get(canvas);
  if (cached) return cached;
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

// 訪客冒險固定入口網址（QR 印的就是這個）
export function getArcadeUrl() {
  const isLocal = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  return isLocal ? `${window.location.origin}/?arcade` : "https://student.catgroup.com.tw/?arcade";
}

/** 從結果資料組一段戰績文字（社群分享用）。 */
export function buildResultText(data) {
  const rows = (data.statsRows || []).map((s) => `  ${s.icon} ${s.label}：${s.value}`).join("\n");
  return [
    `🏹 ${data.nickname} 與 ${data.cat?.name || "貓貓"} 完成了「${data.dungeonName}」！`,
    `👑 評價 ${data.grade}${data.label ? `（${data.label}）` : ""}`,
    rows,
    `掃 QR 一起冒險 → ${getArcadeUrl()}`,
  ].join("\n");
}

/** 是否為手機（LINE 深層連結只在手機 LINE App 有效）。 */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

/**
 * 開啟 LINE 分享：用官方深層連結 `https://line.me/R/share?text=`
 * 開「分享到」畫面（可選群組/好友/多人聊天送出，LINE App 或網頁版都支援）。
 * 注意：`line://` 已被 LINE 官方棄用，且官方沒有「帶公開圖片網址分享」的深層連結——
 * 要帶圖片只能靠系統分享面板（Web Share）選 LINE，那是主分享按鈕的路徑。
 */
export function openLineShare(text) {
  const url = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
  if (isMobileDevice()) {
    window.location.href = url; // 手機：直接跳 LINE App「分享到」畫面
    return { via: "deep-link" };
  }
  window.open(url, "_blank", "noopener"); // 桌機：開網頁版分享
  return { via: "line-web" };
}

/** 複製戰績文字到剪貼簿（可貼到任何社群）。 */
export async function copyResultText(data) {
  const text = buildResultText(data);
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch {
    // 舊瀏覽器降級：textarea 選取複製
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return { ok: true };
    } catch {
      return { ok: false, reason: "clipboard" };
    }
  }
}

/** 下載戰績 PNG。 */
export function downloadCanvas(canvas) {
  try {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "cat-arcade-result.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error" };
  }
}

// 分享（Web Share API，手機原生分享面板可直接貼圖＋文字到 LINE/FB/IG）或降級下載 PNG
export async function shareOrDownloadCanvas(canvas, data) {
  return shareToSocial(canvas, data, "generic");
}

// 分享到指定管道：一律先試 Web Share（帶圖＋文字，手機面板直接貼），
// 不支援 files share 時按管道降級（LINE/FB 開網頁分享，其他下載 PNG）。
// 回傳 { ok, via: "share" | "line-web" | "fb-web" | "download" | "no-blob" }
export async function shareToSocial(canvas, data, channel = "generic") {
  const text = data ? buildResultText(data) : "掃 QR 一起冒險！";
  try {
    const blob = await getShareBlob(canvas);
    if (!blob) return { ok: false, reason: "no-blob" };
    const file = new File([blob], "cat-arcade-result.png", { type: "image/png" });
    if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "我的冒險戰績", text });
      return { ok: true, via: "share" };
    }
    if (channel === "line") {
      const r = openLineShare(text);
      return { ok: true, via: r.via === "deep-link" ? "line-deeplink" : "line-web" };
    }
    if (channel === "fb") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getArcadeUrl())}&quote=${encodeURIComponent(text)}`, "_blank", "noopener");
      return { ok: true, via: "fb-web" };
    }
    return downloadCanvas(canvas);
  } catch (e) {
    if (e && e.name === "AbortError") return { ok: false, reason: "cancelled" };
    return { ok: false, reason: "error" };
  }
}
