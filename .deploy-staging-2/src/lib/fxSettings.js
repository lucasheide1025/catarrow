// src/lib/fxSettings.js
// 音效 / 動畫全域開關（批次 A 基礎設施）
// - localStorage 持久化：fx_sound / fx_anim（"1" 開 / "0" 關，預設開）
// - 動畫關閉（手動或系統 prefers-reduced-motion）→ <html> 加 .no-anim
//   由 index.css 的 .no-anim 規則統一抑制 animation/transition
// - sound.js 的 ctx()/playAudio()/vibrate() 讀 getSoundEnabled() 做總閘門

const KEY_SOUND = "fx_sound";
const KEY_ANIM  = "fx_anim";

function read(key) {
  try { return localStorage.getItem(key) !== "0"; } catch { return true; }
}
function write(key, on) {
  try { localStorage.setItem(key, on ? "1" : "0"); } catch {}
}

// ── 音效 ─────────────────────────────────────────────────────
export function getSoundEnabled() { return read(KEY_SOUND); }
export function setSoundEnabled(on) { write(KEY_SOUND, on); }

// ── 動畫 ─────────────────────────────────────────────────────
function prefersReducedMotion() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

export function getAnimEnabled() { return read(KEY_ANIM); }

export function setAnimEnabled(on) {
  write(KEY_ANIM, on);
  applyAnimClass();
}

function applyAnimClass() {
  try {
    const off = !getAnimEnabled() || prefersReducedMotion();
    document.documentElement.classList.toggle("no-anim", off);
  } catch {}
}

// ── 初始化（index.js render 前呼叫一次）──────────────────────
export function initFxSettings() {
  applyAnimClass();
  try {
    // 系統設定變更時即時跟進
    window.matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", applyAnimClass);
  } catch {}
}
