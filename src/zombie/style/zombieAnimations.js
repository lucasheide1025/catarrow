// src/zombie/style/zombieAnimations.js
// ═══════════════════════════════════════════════════════════════
//  🎬 殭屍生存 — 集中化 CSS 動畫庫
//  所有 keyframe 動畫統一管理，避免各元件重複定義
// ═══════════════════════════════════════════════════════════════

export const ZOMBIE_ANIMATIONS = `
/* ════════════════════════════════════════════════════════════
   警告 / 狀態脈衝
   ════════════════════════════════════════════════════════════ */

@keyframes za-pulse-warn {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes za-pulse-glow {
  0%, 100% { box-shadow: 0 0 0 rgba(239,68,68,0); }
  50% { box-shadow: 0 0 16px rgba(239,68,68,0.3); }
}

@keyframes za-pulse-green {
  0%, 100% { box-shadow: 0 0 0 rgba(34,197,94,0); }
  50% { box-shadow: 0 0 16px rgba(34,197,94,0.3); }
}

@keyframes za-pulse-blue {
  0%, 100% { box-shadow: 0 0 0 rgba(59,130,246,0); }
  50% { box-shadow: 0 0 16px rgba(59,130,246,0.3); }
}

/* ════════════════════════════════════════════════════════════
   入場動畫
   ════════════════════════════════════════════════════════════ */

@keyframes za-slide-in-left {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes za-slide-in-right {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes za-slide-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes za-slide-in-down {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes za-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes za-fade-in-slow {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes za-scale-in {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ════════════════════════════════════════════════════════════
   視覺特效
   ════════════════════════════════════════════════════════════ */

@keyframes za-glow-pulse {
  0%, 100% {
    filter: brightness(1) drop-shadow(0 0 4px currentColor);
  }
  50% {
    filter: brightness(1.2) drop-shadow(0 0 12px currentColor);
  }
}

@keyframes za-scanline-move {
  0% { background-position: 0 0; }
  100% { background-position: 0 4px; }
}

@keyframes za-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes za-shake {
  0%, 100% { transform: translateX(0); }
  10%, 50%, 90% { transform: translateX(-4px); }
  30%, 70% { transform: translateX(4px); }
}

@keyframes za-blood-drip {
  0% { height: 0; opacity: 0; }
  20% { opacity: 1; }
  100% { height: 80px; opacity: 0.1; }
}

/* ════════════════════════════════════════════════════════════
   數字計數動畫（結算畫面用）
   ════════════════════════════════════════════════════════════ */

@keyframes za-count-up {
  from { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.15); }
  to { opacity: 1; transform: scale(1); }
}

/* ════════════════════════════════════════════════════════════
   勝利 / 失敗特效
   ════════════════════════════════════════════════════════════ */

@keyframes za-victory-glow {
  0%, 100% {
    filter: drop-shadow(0 0 20px rgba(34,197,94,0.3));
  }
  50% {
    filter: drop-shadow(0 0 50px rgba(34,197,94,0.6));
  }
}

@keyframes za-defeat-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 20px rgba(239,68,68,0.3));
    opacity: 1;
  }
  50% {
    filter: drop-shadow(0 0 40px rgba(239,68,68,0.5));
    opacity: 0.6;
  }
}

@keyframes za-sparkle {
  0% { opacity: 0; transform: scale(0) rotate(0deg); }
  50% { opacity: 1; transform: scale(1) rotate(180deg); }
  100% { opacity: 0; transform: scale(0) rotate(360deg); }
}

@keyframes za-skull-float {
  0% { transform: translateY(0) rotate(0deg); opacity: 0; }
  30% { opacity: 0.6; }
  70% { opacity: 0.6; }
  100% { transform: translateY(-40px) rotate(20deg); opacity: 0; }
}

/* ════════════════════════════════════════════════════════════
   感染視覺效果
   ════════════════════════════════════════════════════════════ */

@keyframes za-infect-throb {
  0%, 100% { border-color: rgba(34,197,94,0.15); }
  50% { border-color: rgba(34,197,94,0.4); }
}

@keyframes za-infect-bar-pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* ════════════════════════════════════════════════════════════
   資源條動畫
   ════════════════════════════════════════════════════════════ */

@keyframes za-resource-flash {
  0%, 100% { background-color: rgba(239,68,68,0.08); }
  50% { background-color: rgba(239,68,68,0.2); }
}

@keyframes za-resource-low-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; text-shadow: 0 0 8px rgba(239,68,68,0.5); }
}
`;

// ── 動畫 CSS class helpers ────────────────────────────────
export const ANIM_CLASS = {
  // 入場
  slideInLeft: "za-slide-in-left",
  slideInRight: "za-slide-in-right",
  slideInUp: "za-slide-in-up",
  slideInDown: "za-slide-in-down",
  fadeIn: "za-fade-in",
  fadeInSlow: "za-fade-in-slow",
  scaleIn: "za-scale-in",

  // 狀態
  pulseWarn: "za-pulse-warn",
  pulseGlow: "za-pulse-glow",
  pulseGreen: "za-pulse-green",
  pulseBlue: "za-pulse-blue",
  glowPulse: "za-glow-pulse",
  float: "za-float",

  // 特效
  shake: "za-shake",
  bloodDrip: "za-blood-drip",
  scanline: "za-scanline-move",

  // 計數
  countUp: "za-count-up",

  // 勝利/失敗
  victoryGlow: "za-victory-glow",
  defeatPulse: "za-defeat-pulse",
  sparkle: "za-sparkle",
  skullFloat: "za-skull-float",

  // 感染
  infectThrob: "za-infect-throb",
  infectBar: "za-infect-bar-pulse",

  // 資源
  resourceFlash: "za-resource-flash",
  resourceLow: "za-resource-low-pulse",
};

// ── 動畫持續時間對照 ──────────────────────────────────────
export const ANIM_DURATION = {
  fast: "0.12s",
  normal: "0.25s",
  slow: "0.4s",
  entrance: "0.35s",
  float: "2s",
  pulse: "0.8s",
  label: "0.3s",
};
