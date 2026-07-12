// src/components/shared/BattleSoundIndicator.jsx
// 小型音效模式指示器：戰鬥畫面內顯示目前 debug / live 狀態，可點擊切換

import { useState } from "react";
import { getBattleSoundMode, toggleBattleSoundMode } from "../../lib/battleSound";

export default function BattleSoundIndicator({ compact = false }) {
  const [mode, setMode] = useState(getBattleSoundMode);

  const handleToggle = () => {
    toggleBattleSoundMode();
    setMode(getBattleSoundMode());
  };

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        title={`音效模式：${mode === "live" ? "播放中" : "除錯"}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 6px", borderRadius: 6,
          border: "1px solid " + (mode === "live" ? "rgba(132,204,22,.4)" : "rgba(255,255,255,.15)"),
          background: mode === "live" ? "rgba(132,204,22,.12)" : "rgba(255,255,255,.06)",
          color: mode === "live" ? "#bef264" : "#9fb0cf",
          fontSize: 9, fontWeight: 800, lineHeight: 1,
          cursor: "pointer", transition: "all .15s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.2)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
      >
        {mode === "live" ? "🎵" : "🔇"}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
        padding: "8px 14px", borderRadius: 10,
        border: "1px solid " + (mode === "live" ? "rgba(132,204,22,.5)" : "rgba(255,255,255,.12)"),
        background: mode === "live" ? "rgba(132,204,22,.12)" : "rgba(255,255,255,.05)",
        color: mode === "live" ? "#bef264" : "#9fb0cf",
        fontSize: 12, fontWeight: 800,
        cursor: "pointer", transition: "all .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
    >
      {mode === "live" ? "🎵" : "🔧"} {mode === "live" ? "音效播放中" : "音效除錯"}
    </button>
  );
}
