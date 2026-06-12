// src/lib/sound.js
// 合成音效 + 震動（Web Audio API，不需音效檔）
// 之後開寶箱、打怪都能共用。iPhone 不支援震動會自動略過。

let _ctx = null;
function ctx() {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  // 手機需在使用者互動後 resume
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

// 播一個音（頻率、長度、波形、音量）
function tone(freq, dur = 0.15, type = "sine", gain = 0.2, delay = 0) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// 震動（Android 有效，iPhone 自動略過）
export function vibrate(pattern = 30) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

// ── 預設音效 ──────────────────────────────────────────

// 施法中：上升的「咻」
export function sfxCast() {
  tone(330, 0.12, "sawtooth", 0.12, 0);
  tone(440, 0.12, "sawtooth", 0.12, 0.08);
  tone(550, 0.18, "sawtooth", 0.12, 0.16);
  vibrate(20);
}

// Buff 出現：清亮「叮!」
export function sfxBuff() {
  tone(880, 0.15, "triangle", 0.25, 0);
  tone(1320, 0.25, "triangle", 0.2, 0.06);
  vibrate([0, 30, 40, 30]);
}

// 保底大招 / 史詩：更澎湃的「噹噹↗」
export function sfxEpic() {
  tone(523, 0.15, "square", 0.18, 0);
  tone(659, 0.15, "square", 0.18, 0.12);
  tone(784, 0.15, "square", 0.18, 0.24);
  tone(1047, 0.4, "triangle", 0.25, 0.36);
  vibrate([0, 50, 60, 50, 60, 80]);
}

// 達標 / 成功：勝利「噹噹噹↗」
export function sfxSuccess() {
  tone(659, 0.13, "triangle", 0.22, 0);
  tone(784, 0.13, "triangle", 0.22, 0.13);
  tone(1047, 0.35, "triangle", 0.25, 0.26);
  vibrate([0, 40, 50, 80]);
}

// 點擊 / 開始：短「咚」
export function sfxTap() {
  tone(440, 0.08, "sine", 0.18, 0);
  vibrate(15);
}

// 失敗（不刺耳，溫和下降，因為要高情緒價值）
export function sfxSoftFail() {
  tone(440, 0.12, "sine", 0.15, 0);
  tone(370, 0.18, "sine", 0.15, 0.1);
  vibrate(20);
}

// 後台新通知：兩聲叮
export function sfxNotify() {
  tone(880, 0.12, "triangle", 0.2, 0);
  tone(1100, 0.2, "triangle", 0.18, 0.15);
  vibrate([0, 30, 60, 30]);
}

// 箭矢命中「咚！」（分數 6~9 一般命中）
export function sfxArrowHit() {
  tone(260, 0.07, "square", 0.24, 0);
  tone(180, 0.16, "sine", 0.2, 0.05);
  vibrate(20);
}

// 爆擊「嘭！」（頭部/高倍率部位）
export function sfxCritBoom() {
  tone(150, 0.07, "square", 0.3, 0);
  tone(300, 0.04, "square", 0.18, 0.05);
  tone(115, 0.24, "sine", 0.22, 0.08);
  vibrate([0, 30, 55]);
}

// 器官命中「轟！」（心臟/腎/肺/要害）
export function sfxOrganHit() {
  tone(105, 0.1, "sawtooth", 0.3, 0);
  tone(80, 0.28, "sine", 0.24, 0.09);
  tone(660, 0.07, "triangle", 0.12, 0);
  vibrate([0, 50, 70, 40]);
}

// 怪物反擊「嘎！」
export function sfxCounter() {
  tone(220, 0.06, "sawtooth", 0.2, 0);
  tone(165, 0.12, "sawtooth", 0.22, 0.05);
  tone(110, 0.18, "sine", 0.18, 0.14);
  vibrate([0, 35, 55, 30]);
}

// 怪物死亡「噹噹噹～轟」
export function sfxMonsterDead() {
  tone(523, 0.1, "square", 0.18, 0);
  tone(659, 0.1, "square", 0.18, 0.1);
  tone(784, 0.1, "square", 0.18, 0.2);
  tone(1047, 0.35, "triangle", 0.22, 0.3);
  tone(180, 0.45, "sine", 0.15, 0.28);
  vibrate([0, 60, 80, 60, 80, 100]);
}
