// src/lib/theme.js — 全站 App 主題定義
// 2026-07 UI 改版：收斂為單一深色主題（navy 深海金，值對齊 index.css design tokens）。
// API（getAppTheme/saveAppTheme）簽名不變；要復活多主題只需在 APP_THEMES 加回元素，
// MemberProfile 的主題選擇器會在 APP_THEMES.length > 1 時自動重新顯示。

export const APP_THEMES = [
  {
    id: "navy",
    label: "深海金",
    preview: ["#0f172a", "#f59e0b"],
    headerBg:      "linear-gradient(135deg,#0f172a 0%,#0c4a6e 100%)",
    headerBorder:  "rgba(255,255,255,0.06)",
    titleColor:    "#f1f5f9",
    subtitleColor: "#7dd3fc",
    usernameColor: "#cbd5e1",
    logoutStyle:   { background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"#94a3b8" },
    navActive:     "#1d4ed8",
    navIndicator:  "#f59e0b",
    partyBg:       "#1e3a5f",
  },
];

const KEY = "app_theme_id";

export function getAppTheme() {
  const id = localStorage.getItem(KEY);
  return APP_THEMES.find(t => t.id === id) || APP_THEMES[0];
}

export function saveAppTheme(id) {
  localStorage.setItem(KEY, id);
}
