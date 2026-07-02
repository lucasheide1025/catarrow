// src/components/shared/Widgets.jsx
// 儀表板/導覽用小元件 — token 驅動、深色原生（2026-07 UI 改版）
// ⚠️ 本檔不從 UI.jsx import / re-export 任何常數（避免循環 import）

// ─── 區塊標題列 ────────────────────────────────────────────
// <SectionHeader icon="🏹" title="今日訓練" action={<button>更多</button>} />
export function SectionHeader({ icon, title, action }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        {icon && <span className="text-base leading-none">{icon}</span>}
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</span>
      </div>
      {action && <div className="flex items-center">{action}</div>}
    </div>
  );
}

// ─── 通用進度條（HP/XP 類）─────────────────────────────────
// <StatBar value={hp} max={maxHP} color="var(--success-fg)" label="HP" height={8} />
export function StatBar({ value = 0, max = 100, color = "var(--primary)", label, height = 8 }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>{label}</span>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
            {value}/{max}
          </span>
        </div>
      )}
      <div className="w-full overflow-hidden"
        style={{ height, borderRadius: height, background: "rgba(255,255,255,0.08)" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: height,
          background: color, transition: "width .4s ease",
        }} />
      </div>
    </div>
  );
}

// ─── SVG 圓環進度 ──────────────────────────────────────────
// <ProgressRing value={xp} max={20} size={48} stroke={4} color="var(--accent)">Lv.3</ProgressRing>
export function ProgressRing({ value = 0, max = 100, size = 48, stroke = 4, color = "var(--accent)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .4s ease" }} />
      </svg>
      {children != null && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}

// ─── 深色 shimmer 載入骨架 ─────────────────────────────────
// <Skeleton h={16} w="60%" />（keyframes 定義在 index.css：skeleton-shimmer）
export function Skeleton({ h = 16, w = "100%", className = "" }) {
  return (
    <div className={className} style={{
      height: h, width: w, borderRadius: "var(--r-sm)",
      background: "linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.4s ease-in-out infinite",
    }} />
  );
}

// ─── Hub 入口卡（CSS 漸層底，取代 cell-*.webp）─────────────
// <HubTile icon="⚔️" title="打怪" desc="單人戰鬥" badge={3} accent="#f59e0b" onClick={...} />
// ⚠️ accent 必須是 6 碼 hex（內部以 `${accent}26` 疊 15% 透明度），不可傳 var(--xxx)
export function HubTile({ icon, title, desc, badge, onClick, accent = "#f59e0b" }) {
  return (
    <button onClick={onClick}
      className="relative flex flex-col items-start gap-1 p-4 text-left transition-all active:scale-95 w-full"
      style={{
        minHeight: 96,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--glass-border)",
        background: `linear-gradient(135deg, ${accent}26 0%, var(--glass-bg) 55%)`,
        boxShadow: "var(--shadow-card)",
      }}>
      {badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white"
          style={{ background: "#dc2626" }}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-sm font-bold mt-1" style={{ color: "var(--text-primary)" }}>{title}</span>
      {desc && <span className="text-[11px] leading-tight" style={{ color: "var(--text-secondary)" }}>{desc}</span>}
    </button>
  );
}
