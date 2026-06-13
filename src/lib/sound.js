// src/lib/sound.js
// 合成音效 + 震動（Web Audio API）
// iPhone 不支援震動會自動略過。AudioContext 已加 try-catch 防止 mobile 例外。

let _ctx = null;
function ctx() {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    }
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch { return null; }
}

function tone(freq, dur = 0.15, type = "sine", gain = 0.2, delay = 0) {
  try {
    const c = ctx();
    if (!c) return;
    const t0 = Math.max(c.currentTime, c.currentTime + delay);
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type  = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, 0.05));
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  } catch {}
}

export function vibrate(pattern = 30) {
  try { if (navigator?.vibrate) navigator.vibrate(pattern); } catch {}
}

// ── 基本 UI ───────────────────────────────────────────────

export function sfxTap() {
  tone(440, 0.08, "sine", 0.18, 0);
  vibrate(12);
}

export function sfxNotify() {
  tone(880, 0.12, "triangle", 0.2, 0);
  tone(1100, 0.2, "triangle", 0.18, 0.15);
  vibrate([0, 30, 60, 30]);
}

// ── 戰鬥音效 ─────────────────────────────────────────────

// 普通命中「咚！」（6~9 分）
export function sfxArrowHit() {
  tone(240, 0.06, "square", 0.22, 0);
  tone(170, 0.18, "sine",   0.20, 0.04);
  vibrate(18);
}

// 爆擊「嘭！」（頭部/高倍率）
export function sfxCritBoom() {
  tone(150, 0.06, "square", 0.30, 0);
  tone(300, 0.04, "square", 0.18, 0.04);
  tone(115, 0.28, "sine",   0.24, 0.07);
  vibrate([0, 25, 50, 30]);
}

// 器官命中「轟！」（心臟/腎/肺/要害）
export function sfxOrganHit() {
  tone(105, 0.10, "sawtooth", 0.32, 0);
  tone(80,  0.30, "sine",     0.26, 0.08);
  tone(660, 0.06, "triangle", 0.14, 0);
  vibrate([0, 50, 70, 40]);
}

// 脫靶「咻～」
export function sfxSoftFail() {
  tone(600, 0.08, "sawtooth", 0.10, 0);
  tone(440, 0.10, "sine",     0.14, 0.06);
  tone(330, 0.18, "sine",     0.12, 0.14);
  vibrate(15);
}

// 怪物反擊「嘎！」
export function sfxCounter() {
  tone(200, 0.05, "sawtooth", 0.22, 0);
  tone(150, 0.14, "sawtooth", 0.24, 0.04);
  tone(100, 0.22, "sine",     0.20, 0.12);
  vibrate([0, 35, 55, 30]);
}

// 怪物爆擊反擊「轟擊！」
export function sfxCounterCrit() {
  tone(120, 0.06, "square",   0.30, 0);
  tone(80,  0.06, "square",   0.22, 0.04);
  tone(200, 0.08, "sawtooth", 0.20, 0.08);
  tone(60,  0.35, "sine",     0.28, 0.12);
  vibrate([0, 60, 80, 60, 40]);
}

// 怪物死亡「噹噹噹～轟」
export function sfxMonsterDead() {
  tone(523,  0.10, "square",   0.18, 0);
  tone(659,  0.10, "square",   0.18, 0.10);
  tone(784,  0.10, "square",   0.18, 0.20);
  tone(1047, 0.40, "triangle", 0.24, 0.30);
  tone(180,  0.50, "sine",     0.16, 0.28);
  vibrate([0, 60, 80, 60, 80, 120]);
}

// 施法中「咻咻咻↑」（隨機事件觸發）
export function sfxCast() {
  tone(280, 0.10, "sawtooth", 0.12, 0);
  tone(390, 0.10, "sawtooth", 0.12, 0.07);
  tone(520, 0.10, "sawtooth", 0.12, 0.14);
  tone(650, 0.18, "sawtooth", 0.14, 0.22);
  vibrate(20);
}

// Buff 出現「叮！✨」
export function sfxBuff() {
  tone(880,  0.14, "triangle", 0.26, 0);
  tone(1100, 0.14, "triangle", 0.22, 0.05);
  tone(1320, 0.28, "triangle", 0.20, 0.11);
  vibrate([0, 25, 40, 25]);
}

// Debuff 出現「嗡嗡…」
export function sfxDebuff() {
  tone(220, 0.12, "sawtooth", 0.18, 0);
  tone(180, 0.18, "sawtooth", 0.22, 0.10);
  tone(140, 0.28, "sine",     0.18, 0.22);
  vibrate([0, 40, 60, 40]);
}

// 復活「爆發光！」
export function sfxRevive() {
  tone(440, 0.08, "square",   0.16, 0);
  tone(554, 0.08, "square",   0.16, 0.06);
  tone(659, 0.08, "square",   0.16, 0.12);
  tone(880, 0.40, "triangle", 0.28, 0.18);
  tone(1320,0.30, "triangle", 0.22, 0.32);
  vibrate([0, 50, 80, 50, 80, 100]);
}

// 勝利「噹噹噹↗」
export function sfxSuccess() {
  tone(659,  0.13, "triangle", 0.22, 0);
  tone(784,  0.13, "triangle", 0.22, 0.13);
  tone(1047, 0.40, "triangle", 0.28, 0.26);
  vibrate([0, 40, 50, 80]);
}

// 回合結算「咚↗」
export function sfxRoundEnd() {
  tone(350, 0.08, "sine", 0.18, 0);
  tone(440, 0.14, "sine", 0.20, 0.07);
  vibrate(18);
}

// 喝藥水「咕嘟！」
export function sfxPotionDrink() {
  tone(520, 0.06, "sine",     0.18, 0);
  tone(620, 0.06, "sine",     0.18, 0.05);
  tone(780, 0.16, "triangle", 0.22, 0.11);
  vibrate([0, 20, 30, 20]);
}

// 保底大招「澎湃！」
export function sfxEpic() {
  tone(523,  0.14, "square",   0.18, 0);
  tone(659,  0.14, "square",   0.18, 0.12);
  tone(784,  0.14, "square",   0.18, 0.24);
  tone(1047, 0.45, "triangle", 0.28, 0.36);
  vibrate([0, 50, 60, 50, 60, 80]);
}
