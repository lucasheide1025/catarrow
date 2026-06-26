// src/components/shared/UI.jsx
// 全站共用 UI 元件

// ─── 基礎元件 ──────────────────────────────────────────────
export function Card({ children, className = "", style }) {
  return (
    <div className={`rounded-2xl border border-white/20 shadow-[0_2px_12px_rgba(0,0,0,0.25)] backdrop-blur-sm ${className}`} style={{ background:"rgba(255,255,255,0.88)", ...style }}>
      {children}
    </div>
  );
}

export function Btn({ children, v = "primary", size = "md", className = "", ...p }) {
  const vs = {
    primary:   "bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white shadow-sm shadow-blue-900/30",
    secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm",
    danger:    "bg-gradient-to-b from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-600 border border-red-200",
    success:   "bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white shadow-sm shadow-emerald-900/30",
    warn:      "bg-gradient-to-b from-orange-400 to-orange-600 hover:from-orange-300 hover:to-orange-500 text-white shadow-sm shadow-orange-900/30",
    ghost:     "text-blue-600 hover:text-blue-800 underline underline-offset-2",
    cat:       "bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-white shadow-sm shadow-amber-900/30",
    // 深色背景 variant
    "dark-primary":  "bg-gradient-to-b from-indigo-600 to-blue-700 hover:from-indigo-500 hover:to-blue-600 text-white shadow-sm shadow-indigo-900/40",
    "dark-ghost":    "bg-transparent hover:bg-white/10 text-gray-300 border border-white/20 hover:border-white/40",
    "dark-danger":   "bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white shadow-sm shadow-red-900/40",
    "dark-success":  "bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-sm shadow-emerald-900/40",
    "dark-warn":     "bg-gradient-to-b from-orange-500 to-orange-700 hover:from-orange-400 hover:to-orange-600 text-white shadow-sm shadow-orange-900/40",
  };
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

export function Inp({ label, hint, error, ...p }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-500 font-semibold">{label}</label>}
      <input
        className={`bg-white border rounded-xl px-3 py-2.5 text-gray-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder-gray-300 transition-all shadow-sm ${error ? "border-red-400 focus:border-red-400 focus:ring-red-100" : "border-gray-200"}`}
        {...p}
      />
      {hint  && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export function TA({ label, ...p }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-500 font-semibold">{label}</label>}
      <textarea
        className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder-gray-300 resize-none shadow-sm transition-all"
        {...p}
      />
    </div>
  );
}

export function Sel({ label, options, ...p }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-gray-500 font-semibold">{label}</label>}
      <select
        className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all"
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
        className={`bg-white rounded-2xl shadow-2xl shadow-black/20 w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h2 className="font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-2xl leading-none transition-colors">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pill({ status }) {
  const m = {
    "報名中":   "bg-emerald-50 text-emerald-700 border border-emerald-200",
    "進行中":   "bg-blue-50 text-blue-700 border border-blue-200",
    "已結束":   "bg-gray-100 text-gray-400 border border-gray-200",
    "結算完成": "bg-purple-50 text-purple-700 border border-purple-200",
    "upcoming": "bg-amber-50 text-amber-700 border border-amber-200",
    "settled":  "bg-purple-50 text-purple-700 border border-purple-200",
  };
  const labels = { upcoming:"即將開始", settled:"結算完成" };
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${m[status] || "bg-gray-100 text-gray-500"}`}>
      {labels[status] || status}
    </span>
  );
}

export function ST({ children }) {
  return <div className="text-gray-400 text-[11px] font-bold uppercase tracking-widest mb-2">{children}</div>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-[3px] border-gray-100 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export function Empty({ icon = "🐱", message = "沒有資料" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-300">
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
      <p className="text-gray-500 text-sm mb-5 leading-relaxed">{message}</p>
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all placeholder-gray-300"
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
    const styles = {
      success: "bg-gray-900 text-white border border-gray-700",
      error:   "bg-red-600 text-white border border-red-500",
      warn:    "bg-amber-500 text-white border border-amber-400",
    };
    return (
      <div className="fixed bottom-28 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
        {toasts.map(t => (
          <div key={t.id}
            className={`px-4 py-3 rounded-2xl font-medium text-sm shadow-xl ${styles[t.type] || styles.success}`}
            style={{ animation:"toast-in .25s cubic-bezier(0.34,1.56,0.64,1) both" }}>
            {t.message}
          </div>
        ))}
      </div>
    );
  }
  return { toast, ToastContainer };
}
