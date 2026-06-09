// src/components/shared/UI.jsx
// 全站共用 UI 元件

// ─── 基礎元件 ──────────────────────────────────────────────
export function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Btn({ children, v = "primary", size = "md", className = "", ...p }) {
  const vs = {
    primary:   "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300",
    danger:    "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200",
    success:   "bg-green-600 hover:bg-green-700 text-white",
    warn:      "bg-orange-500 hover:bg-orange-600 text-white",
    ghost:     "text-blue-600 hover:text-blue-800 underline",
    cat:       "bg-amber-500 hover:bg-amber-600 text-white",   // 貓咪主題
  };
  const sz = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-3 text-base" };
  return (
    <button
      className={`font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 ${vs[v] || vs.primary} ${sz[size]} ${className}`}
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
        className={`bg-gray-50 border rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 placeholder-gray-400 transition-colors ${error ? "border-red-400" : "border-gray-300"}`}
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
        className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-400 resize-none"
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
        className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-blue-500"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pill({ status }) {
  const m = {
    "報名中": "bg-green-100 text-green-700",
    "進行中": "bg-blue-100 text-blue-700",
    "已結束": "bg-gray-100 text-gray-500",
    "結算完成": "bg-purple-100 text-purple-700",
    "upcoming": "bg-yellow-100 text-yellow-700",
    "settled":  "bg-purple-100 text-purple-700",
  };
  const labels = { upcoming:"即將開始", settled:"結算完成" };
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${m[status] || "bg-gray-100 text-gray-500"}`}>
      {labels[status] || status}
    </span>
  );
}

export function ST({ children }) {
  return <div className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{children}</div>;
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

export function Empty({ icon = "🐱", message = "沒有資料" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <span className="text-4xl mb-3">{icon}</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── 徽章元件 ──────────────────────────────────────────────
export function BadgePip({ label, color, count, size = "md" }) {
  const colorMap = {
    gold:   "bg-yellow-400 text-yellow-900 border-yellow-500",
    silver: "bg-gray-200 text-gray-700 border-gray-300",
    bronze: "bg-orange-500 text-white border-orange-600",
    black:  "bg-gray-800 text-white border-gray-900",
  };
  const sizeMap = {
    sm: "px-2 py-1 min-w-[40px]",
    md: "px-3 py-2 min-w-[52px]",
    lg: "px-4 py-3 min-w-[64px]",
  };
  return (
    <div className={`flex flex-col items-center rounded-xl border ${colorMap[color]} ${sizeMap[size]} shadow-sm`}>
      <span className="text-xs font-bold leading-none">{label}</span>
      <span className={`font-black leading-tight ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{count}</span>
    </div>
  );
}

// 貓咪圖示徽章（替代純色圓點）
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
      <p className="text-gray-600 text-sm mb-5">{message}</p>
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
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

// ─── Toast 通知 ────────────────────────────────────────────
// 使用方式：import { useToast } from "./UI"; const { toast, ToastContainer } = useToast();
import { useState, useCallback } from "react";
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);
  function ToastContainer() {
    return (
      <div className="fixed bottom-28 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-xl font-medium text-sm shadow-lg text-white ${t.type === "error" ? "bg-red-500" : t.type === "warn" ? "bg-orange-500" : "bg-gray-800"}`}>
            {t.message}
          </div>
        ))}
      </div>
    );
  }
  return { toast, ToastContainer };
}
