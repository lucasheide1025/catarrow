// src/zombie/ui/theme.js
// ═══════════════════════════════════════════════════════════════
//  🎨 殭屍生存模式 — 集中化設計系統
//  所有 UI 元件共用同一套顏色、陰影、動畫與間距 token
// ═══════════════════════════════════════════════════════════════

// ── 基礎色板 ─────────────────────────────────────────────
export const COLORS = {
  // 背景
  bg: "#0a0e1a",
  bgGradient: "linear-gradient(135deg, #0a0e1a 0%, #1a0a0a 50%, #0a0e1a 100%)",
  bgGradientWarm: "linear-gradient(135deg, #0a0e1a 0%, #1f0f0f 50%, #0f0a1a 100%)",
  bgCard: "rgba(255,255,255,0.03)",

  // 玻璃效果
  glass: "rgba(255,255,255,0.04)",
  glassHover: "rgba(255,255,255,0.08)",
  glassActive: "rgba(255,255,255,0.10)",
  glassBorder: "rgba(255,255,255,0.08)",
  glassBorderHover: "rgba(255,255,255,0.15)",
  glassBorderActive: "rgba(239,68,68,0.4)",
  glassGlow: "rgba(239,68,68,0.12)",

  // 文字
  text: "#f1f5f9",
  textDim: "rgba(255,255,255,0.45)",
  textMuted: "rgba(255,255,255,0.22)",
  textBright: "#ffffff",

  // 語意色
  accent: "#ef4444",
  accentGlow: "rgba(239,68,68,0.25)",
  green: "#22c55e",
  greenGlow: "rgba(34,197,94,0.25)",
  amber: "#f59e0b",
  amberGlow: "rgba(245,158,11,0.25)",
  blue: "#3b82f6",
  blueGlow: "rgba(59,130,246,0.25)",
  purple: "#8b5cf6",
  purpleGlow: "rgba(139,92,246,0.25)",
  red: "#ef4444",
  redGlow: "rgba(239,68,68,0.25)",

  // 主要漸層
  gradientPrimary: "linear-gradient(135deg, #7c3aed, #2563eb)",
  gradientPrimaryHover: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
  gradientDanger: "linear-gradient(135deg, #dc2626, #ef4444)",
  gradientSuccess: "linear-gradient(135deg, #16a34a, #22c55e)",
  gradientAmber: "linear-gradient(135deg, #d97706, #f59e0b)",

  // 殭屍類型色
  zombieNormal: "#6b7280",
  zombieFast: "#f59e0b",
  zombieArmored: "#8b5cf6",
  zombieRanged: "#ef4444",
};

// ── 陰影 ─────────────────────────────────────────────────
export const SHADOWS = {
  sm: "0 1px 4px rgba(0,0,0,0.3)",
  md: "0 4px 16px rgba(0,0,0,0.4)",
  lg: "0 8px 32px rgba(0,0,0,0.5)",
  glow: (color = "rgba(124,58,237,0.35)") =>
    `0 2px 12px ${color}, 0 0 40px ${color.replace("0.35", "0.10")}`,
  innerGlow: "inset 0 1px 0 rgba(255,255,255,0.06)",
};

// ── 動畫 ─────────────────────────────────────────────────
export const ANIM = {
  fast: "0.12s ease",
  normal: "0.2s ease",
  slow: "0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  bounce: "0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
};

// ── 圓角 ─────────────────────────────────────────────────
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 9999,
};

// ── 字型 ─────────────────────────────────────────────────
export const FONT = {
  family: "'Inter', 'Noto Sans TC', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  size: {
    xs: 9,
    sm: 10,
    base: 11,
    md: 12,
    lg: 14,
    xl: 18,
    title: 28,
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
};

// ── 間距 ─────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

// ═════════════════════════════════════════════════════════════
//  共用樣式產生器（避免重複 inline styles）
// ═════════════════════════════════════════════════════════════

/** 玻璃卡片 */
export function glassCard(overrides = {}) {
  return {
    background: COLORS.glass,
    border: `1px solid ${COLORS.glassBorder}`,
    borderRadius: RADIUS.lg,
    backdropFilter: "blur(12px)",
    transition: `all ${ANIM.normal}`,
    ...overrides,
  };
}

/** 玻璃卡片（hover className 版） */
export function glassCardInteractive(overrides = {}) {
  return {
    ...glassCard(),
    cursor: "pointer",
    ...overrides,
  };
}

/** 玻璃卡片 hover CSS class — 用在 component 的 style 物件外層 */
export const GLASS_CARD_HOVER =
  `.glass-card-hover:hover { background: ${COLORS.glassHover}; border-color: ${COLORS.glassBorderHover}; }`;

/** 主要按鈕 */
export function primaryButton(disabled = false) {
  return {
    padding: `${SPACING.sm}px ${SPACING.lg}px`,
    borderRadius: RADIUS.md,
    fontSize: FONT.size.base,
    fontWeight: FONT.weight.bold,
    background: COLORS.gradientPrimary,
    border: "none",
    color: COLORS.textBright,
    boxShadow: SHADOWS.glow(),
    cursor: disabled ? "not-allowed" : "pointer",
    transition: `all ${ANIM.fast}`,
    opacity: disabled ? 0.35 : 1,
    whiteSpace: "nowrap",
  };
}

/** 次要按鈕 */
export function secondaryButton(disabled = false, active = false) {
  return {
    padding: `${SPACING.sm}px ${SPACING.lg}px`,
    borderRadius: RADIUS.md,
    fontSize: FONT.size.base,
    fontWeight: FONT.weight.bold,
    background: active ? "rgba(59,130,246,0.12)" : COLORS.glass,
    border: `1px solid ${active ? "rgba(59,130,246,0.3)" : COLORS.glassBorder}`,
    color: active ? COLORS.blue : COLORS.text,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: `all ${ANIM.fast}`,
    opacity: disabled ? 0.35 : 1,
    whiteSpace: "nowrap",
  };
}

/** 狀態徽章 */
export function badge(textColor, bgOpacity = 0.12) {
  return {
    padding: "3px 10px",
    borderRadius: RADIUS.sm,
    fontSize: FONT.size.xs,
    fontWeight: FONT.weight.bold,
    background: `${textColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, "0")}`,
    color: textColor,
    border: "1px solid currentColor",
  };
}

/** 區塊標題 */
export function sectionTitle() {
  return {
    fontSize: FONT.size.xs,
    fontWeight: FONT.weight.bold,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  };
}

/** 暗色分隔線 */
export function divider() {
  return {
    height: 1,
    background: COLORS.glassBorder,
    border: "none",
    margin: `${SPACING.md}px 0`,
  };
}
