// src/components/shared/UI.jsx
// 全站共用 UI 元件

// ─── 基礎元件 ──────────────────────────────────────────────
// Card 元件 — 深色原生（dark-first, 2026-07 UI 改版）
// theme prop 保留向後相容，但 light/dark 皆輸出同一組深色玻璃卡 token 樣式
// （樣式定義在 index.css 的 .ui-card，讀 --glass-bg / --glass-border 等變數）
const CARD_THEMES = {
  light: "ui-card",
  dark:  "ui-card",
};

export function Card({ children, className = "", style, theme = "light" }) {
  const base = CARD_THEMES[theme] || CARD_THEMES.light;
  return (
    <div className={`${base} ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Btn({ children, v = "primary", size = "md", className = "", ...p }) {
  // 深色原生 variant（2026-07 UI 改版）：
  // 淺色系（secondary/danger/ghost）改為深色版視覺；
  // dark-* 系列保留為 alias，指向對應基礎 variant（API 向後相容）。
  const vs = {
    primary:   "bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white shadow-sm shadow-blue-900/30",
    secondary: "bg-white/10 hover:bg-white/15 text-gray-200 border border-white/15 shadow-sm",
    danger:    "bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white shadow-sm shadow-red-900/40",
    success:   "bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white shadow-sm shadow-emerald-900/30",
    warn:      "bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 text-white shadow-sm shadow-orange-900/30",
    ghost:     "text-blue-400 hover:text-blue-300 underline underline-offset-2",
    outline:   "bg-transparent hover:bg-white/10 text-gray-300 border border-white/20 hover:border-white/40",
    cat:       "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-white shadow-sm shadow-amber-900/30",
  };
  // dark-* alias（呼叫點不需改動）
  vs["dark-primary"] = vs.primary;
  vs["dark-ghost"]   = vs.outline; // dark-ghost 是帶框透明鈕，對應 outline（非底線 ghost）
  vs["dark-danger"]  = vs.danger;
  vs["dark-success"] = vs.success;
  vs["dark-warn"]    = vs.warn;
  const sz = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-3 text-base" };
  return (
    <button
      className={`font-bold rounded-xl transition-all active:scale-95 active:brightness-95 disabled:opacity-40 ${vs[v] || vs.primary} ${sz[size]} ${className}`}
      {...p}
    >
      {children}
    </button>
  );
}

// 表單元件底層樣式定義在 index.css 的 .ui-input（token 驅動，含 focus/placeholder）
const FIELD_LABEL = "text-xs font-semibold";
const FIELD_LABEL_STYLE = { color: "var(--text-secondary)" };

export function Inp({ label, hint, error, ...p }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className={FIELD_LABEL} style={FIELD_LABEL_STYLE}>{label}</label>}
      <input
        className={`ui-input px-3 py-2.5 text-sm shadow-sm ${error ? "ui-input-error" : ""}`}
        {...p}
      />
      {hint  && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      {error && <p className="text-xs" style={{ color: "var(--danger-fg)" }}>{error}</p>}
    </div>
  );
}

export function TA({ label, ...p }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className={FIELD_LABEL} style={FIELD_LABEL_STYLE}>{label}</label>}
      <textarea
        className="ui-input px-3 py-2.5 text-sm resize-none shadow-sm"
        {...p}
      />
    </div>
  );
}

export function Sel({ label, options, ...p }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className={FIELD_LABEL} style={FIELD_LABEL_STYLE}>{label}</label>}
      <select
        className="ui-input px-3 py-2.5 text-sm shadow-sm"
        {...p}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className={`rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto`}
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-card)", boxShadow: "var(--shadow-elevated)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 backdrop-blur-sm z-10"
          style={{ background: "rgba(30,41,59,0.95)", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none transition-colors"
            style={{ color: "var(--text-muted)" }}>×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pill({ status }) {
  // 語意 token 淡色底版本（fg 文字 + bg 淡色底）
  const PURPLE = { color: "#c084fc", background: "rgba(168,85,247,0.12)" };
  const m = {
    "報名中":   { color: "var(--success-fg)", background: "var(--success-bg)" },
    "進行中":   { color: "var(--info-fg)",    background: "var(--info-bg)" },
    "已結束":   { color: "var(--text-muted)", background: "rgba(255,255,255,0.06)" },
    "結算完成": PURPLE,
    "upcoming": { color: "var(--warn-fg)",    background: "var(--warn-bg)" },
    "settled":  PURPLE,
  };
  const labels = { upcoming:"即將開始", settled:"結算完成" };
  const s = m[status] || { color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)" };
  return (
    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
      style={{ ...s, border: "1px solid var(--border-subtle)" }}>
      {labels[status] || status}
    </span>
  );
}

export function ST({ children }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-widest mb-2"
      style={{ color: "var(--text-secondary)" }}>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 rounded-full animate-spin"
        style={{ border: "3px solid var(--border-card)", borderTopColor: "var(--primary)" }} />
    </div>
  );
}

export function Empty({ icon = "🐱", message = "沒有資料" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
      <span className="text-4xl mb-3 opacity-60">{icon}</span>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ─── 徽章元件 ──────────────────────────────────────────────
const BADGE_FRAME = {
  gold:   "/ui/badge-frame-gold.webp",
  silver: "/ui/badge-frame-silver.webp",
  bronze: "/ui/badge-frame-bronze.webp",
  black:  "/ui/badge-frame-black.webp",
};

export function BadgePip({ label, color, count, size = "md" }) {
  const colorMap = {
    gold:   "bg-gradient-to-b from-yellow-300 to-yellow-500 text-yellow-900 border-yellow-400 shadow-yellow-200",
    silver: "bg-gradient-to-b from-gray-100 to-gray-200 text-gray-600 border-gray-300 shadow-gray-100",
    bronze: "bg-gradient-to-b from-orange-400 to-orange-600 text-white border-orange-500 shadow-orange-200",
    black:  "bg-gradient-to-b from-gray-700 to-gray-900 text-white border-gray-800 shadow-gray-400",
  };
  const sizeMap = {
    sm: "px-2 py-1 min-w-[40px]",
    md: "px-3 py-2 min-w-[52px]",
    lg: "px-4 py-3 min-w-[64px]",
  };
  return (
    <div className={`relative flex flex-col items-center rounded-xl border shadow-sm overflow-hidden ${colorMap[color]} ${sizeMap[size]}`}>
      {/* 徽章框紋路覆蓋層（圖片不存在時自動透明） */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`url(${BADGE_FRAME[color] || ""})`,
        backgroundSize:"cover", backgroundPosition:"center",
        opacity:0.35, mixBlendMode:"overlay",
      }} />
      <span className="relative z-10 text-xs font-bold leading-none">{label}</span>
      <span className={`relative z-10 font-black leading-tight ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{count}</span>
    </div>
  );
}

export const CAT_ICONS = {
  fatCat:      "🐱",
  score:       "⭐",
  achievement: "🏆",
  event:       "🎪",
};

// ─── 確認對話框 ────────────────────────────────────────────
export function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmLabel = "確認", confirmVariant = "danger" }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{message}</p>
      <div className="flex gap-3">
        <Btn v="secondary" className="flex-1" onClick={onCancel}>取消</Btn>
        <Btn v={confirmVariant} className="flex-1" onClick={onConfirm}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

// ─── 搜尋列 ────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = "搜尋…" }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="ui-input w-full pl-9 pr-4 py-2.5 text-sm shadow-sm"
      />
    </div>
  );
}

// ─── 全螢幕覆蓋彈窗（版本更新/報到/緊急任務共用）─────────────
export function OverlayModal({ open, onClose, children, zIndex = 99990, bg = "rgba(0,0,0,0.65)" }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose || undefined}
      style={{
        position: "fixed", inset: 0, zIndex,
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Toast 通知 ────────────────────────────────────────────
import { useState, useCallback } from "react";
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);
  function ToastContainer() {
    // token 化：success 用 elevated 深底；error/warn 維持實色（提示需高對比）
    const styles = {
      success: { background: "var(--bg-elevated)", color: "var(--text-primary)", border: "1px solid var(--border-card)" },
      error:   { background: "#dc2626", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" },
      warn:    { background: "var(--accent)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" },
    };
    return (
      <div className="fixed bottom-28 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
        {toasts.map(t => (
          <div key={t.id}
            className="px-4 py-3 rounded-2xl font-medium text-sm shadow-xl"
            style={{
              ...(styles[t.type] || styles.success),
              boxShadow: "var(--shadow-elevated)",
              animation: "toast-in .25s cubic-bezier(0.34,1.56,0.64,1) both",
            }}>
            {t.message}
          </div>
        ))}
      </div>
    );
  }
  return { toast, ToastContainer };
}
