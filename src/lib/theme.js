// src/lib/theme.js — 全站 App 主題定義

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
  {
    id: "dark",
    label: "暗夜紫",
    preview: ["#1e1b4b", "#818cf8"],
    headerBg:      "linear-gradient(135deg,#1e1b4b 0%,#4c1d95 100%)",
    headerBorder:  "rgba(255,255,255,0.06)",
    titleColor:    "#e0e7ff",
    subtitleColor: "#a5b4fc",
    usernameColor: "#c7d2fe",
    logoutStyle:   { background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"#a5b4fc" },
    navActive:     "#7c3aed",
    navIndicator:  "#818cf8",
    partyBg:       "#4c1d95",
  },
  {
    id: "warm",
    label: "橙焰貓",
    preview: ["#7c2d12", "#f97316"],
    headerBg:      "linear-gradient(135deg,#7c2d12 0%,#c2410c 100%)",
    headerBorder:  "rgba(255,255,255,0.06)",
    titleColor:    "#fef3c7",
    subtitleColor: "#fed7aa",
    usernameColor: "#fde68a",
    logoutStyle:   { background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.18)", color:"#fcd34d" },
    navActive:     "#ea580c",
    navIndicator:  "#f97316",
    partyBg:       "#c2410c",
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
