// src/components/cat/CatMsg.jsx — 貓咪助攻浮現訊息（共用）
import { useEffect } from "react";

export default function CatMsg({ msg, onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [msg, onDone]);

  if (!msg) return null;
  return (
    <div className="fixed left-4 right-4 z-50 pointer-events-none"
      style={{ bottom: 96 }}>
      <div className="bg-indigo-900/95 border border-indigo-400/50 rounded-2xl px-4 py-2.5 text-sm text-indigo-100 text-center shadow-xl"
        style={{ animation: "slideUp 0.3s ease-out" }}>
        {msg}
      </div>
    </div>
  );
}
