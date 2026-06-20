// src/lib/sound.js
// 真實 mp3 音效（/sounds/*.mp3）+ Web Audio API 合成（其餘）

// ── mp3 播放輔助 ──────────────────────────────────────────────
const _sfxCache = {};
function playAudio(name, volume = 1) {
  try {
    if (!_sfxCache[name]) _sfxCache[name] = new Audio(`/sounds/${name}.mp3`);
    const a = _sfxCache[name].cloneNode();
    a.volume = Math.max(0, Math.min(1, volume));
    a.play().catch(() => {});
  } catch {}
}

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

export function vibrate(pattern = 30) {
  try { if (navigator?.vibrate) navigator.vibrate(pattern); } catch {}
}

// ── 內部工具 ─────────────────────────────────────────────────

function tone(freq, dur = 0.15, type = "sine", gain = 0.2, delay = 0) {
  try {
    const c = ctx(); if (!c) return;
    const t0 = c.currentTime + Math.max(0, delay);
    const osc = c.createOscillator();
    const g   = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, 0.05));
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  } catch {}
}

// 噪音爆炸（用於爆擊/衝擊）
function noiseBurst(delay = 0, dur = 0.3, filterFreq = 400, gainVal = 1.0) {
  try {
    const c = ctx(); if (!c) return;
    const t0  = c.currentTime + Math.max(0, delay);
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src  = c.createBufferSource();
    const filt = c.createBiquadFilter();
    const g    = c.createGain();
    src.buffer = buf; filt.type = "lowpass"; filt.frequency.value = filterFreq;
    src.connect(filt); filt.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(gainVal, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.start(t0);
  } catch {}
}

// WaveShaper 失真振盪器（怪物嘶吼用）
function distTone(startFreq, endFreq, dur, gainVal, delay = 0) {
  try {
    const c = ctx(); if (!c) return;
    const t0   = c.currentTime + Math.max(0, delay);
    const osc  = c.createOscillator();
    const dist = c.createWaveShaper();
    const g    = c.createGain();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i * 2 / 256 - 1;
      curve[i] = x < 0 ? -Math.pow(-x, 0.7) : Math.pow(x, 0.7);
    }
    dist.curve = curve;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(dist); dist.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.1);
  } catch {}
}

// ── UI 音效 ──────────────────────────────────────────────────

export function sfxTap() {
  tone(520, 0.07, "sine", 0.2, 0);
  tone(780, 0.04, "triangle", 0.1, 0.02);
  vibrate(10);
}

export function sfxNotify() {
  tone(880,  0.1,  "triangle", 0.22, 0);
  tone(1100, 0.16, "triangle", 0.2,  0.13);
  tone(1320, 0.12, "triangle", 0.16, 0.26);
  vibrate([0, 30, 60, 30]);
}

// ── 射箭音效 ─────────────────────────────────────────────────

// 普通命中
export function sfxArrowHit() {
  playAudio("normal_atk", 0.85);
  vibrate(16);
}

// 爆擊
export function sfxCritBoom() {
  playAudio("crit", 0.9);
  vibrate([0, 30, 55, 35]);
}

// 器官/要害命中 — 低沉厚重
export function sfxOrganHit() {
  noiseBurst(0, 0.25, 200, 0.9);
  tone(100, 0.32, "sine",     0.3, 0.06);
  tone(660, 0.05, "triangle", 0.2, 0);
  vibrate([0, 50, 70, 40]);
}

// 脫靶
export function sfxSoftFail() {
  playAudio("miss", 0.8);
  vibrate(12);
}

// 射箭弓弦聲
export function sfxArrowShoot() {
  playAudio("normal_atk", 0.85);
  vibrate(12);
}

// ── 戰鬥音效 ─────────────────────────────────────────────────

// 怪物反擊
export function sfxCounter() {
  playAudio("monster_atk", 0.9);
  vibrate([0, 55, 75, 50]);
}

// 怪物爆擊反擊
export function sfxCounterCrit() {
  playAudio("monster_crit", 0.95);
  vibrate([0, 90, 110, 80, 60]);
}

// 怪物死亡 — 上行6音 + 最後爆炸
export function sfxMonsterDead() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [261, 329, 392, 523, 659, 784].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "square"; n.frequency.value = freq;
    const st = t + i * 0.09;
    g.gain.setValueAtTime(0.18, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.28);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.3);
  });
  noiseBurst(0.52, 0.4, 600, 0.8);
  tone(180, 0.5, "sine", 0.16, 0.48);
  vibrate([0, 60, 80, 60, 80, 120]);
}

// 施法/結算開始 — 上行鋸齒5音
export function sfxCast() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [280, 390, 520, 700, 880].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "sawtooth"; n.frequency.value = freq;
    const st = t + i * 0.07;
    g.gain.setValueAtTime(0.14, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.14);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.16);
  });
  vibrate(18);
}

// Buff — 12 顆隨機閃光
export function sfxBuff() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 12; i++) {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "sine";
    n.frequency.value = 600 + Math.random() * 900;
    const st = t + i * 0.06 + Math.random() * 0.03;
    g.gain.setValueAtTime(0.13, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.12);
  }
  vibrate([0, 25, 40, 25]);
}

// Debuff — 下行失諧失真
export function sfxDebuff() {
  distTone(280, 140, 0.4, 0.2, 0);
  tone(220, 0.12, "sawtooth", 0.18, 0);
  tone(175, 0.20, "sawtooth", 0.20, 0.1);
  tone(140, 0.30, "sine",     0.18, 0.22);
  vibrate([0, 40, 60, 40]);
}

// 復活 — 7音上行爆發
export function sfxRevive() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [440, 554, 659, 880, 1047, 1318, 1568].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "triangle"; n.frequency.value = freq;
    const st = t + i * 0.07;
    g.gain.setValueAtTime(0.2, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.38);
  });
  noiseBurst(0, 0.25, 2000, 0.5);
  vibrate([0, 50, 80, 50, 80, 100]);
}

// 勝利/成功 — 3音上行
export function sfxSuccess() {
  tone(659,  0.13, "triangle", 0.22, 0);
  tone(784,  0.13, "triangle", 0.22, 0.13);
  tone(1047, 0.40, "triangle", 0.28, 0.26);
  vibrate([0, 40, 50, 80]);
}

// 回合結算 — 3音輕快確認
export function sfxRoundEnd() {
  tone(440, 0.08, "triangle", 0.2,  0);
  tone(554, 0.12, "triangle", 0.22, 0.08);
  tone(659, 0.18, "sine",     0.18, 0.16);
  vibrate(16);
}

// 喝藥水 — 泡泡上升5音
export function sfxPotionDrink() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [520, 620, 740, 880, 1040].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "sine"; n.frequency.value = freq;
    const st = t + i * 0.055;
    g.gain.setValueAtTime(0.18, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.1);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.12);
  });
  vibrate([0, 20, 30, 20]);
}

// 保底大招 — 8音上行旋律（方波+三角諧波）
export function sfxEpic() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [261, 329, 392, 523, 659, 784, 988, 1047].forEach((freq, i) => {
    const st = t + i * 0.1;
    ["square", "triangle"].forEach((type, j) => {
      const n = c.createOscillator(); const g = c.createGain();
      n.type = type; n.frequency.value = freq * (j === 1 ? 2 : 1);
      g.gain.setValueAtTime(j === 0 ? 0.18 : 0.08, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.2);
      n.connect(g); g.connect(c.destination);
      n.start(st); n.stop(st + 0.22);
    });
  });
  vibrate([0, 50, 60, 50, 60, 80]);
}

// ── 新增音效 ─────────────────────────────────────────────────

// 升等/通過檢定
export function sfxLevelUp() {
  playAudio("level_up", 0.9);
  vibrate([0, 60, 80, 100]);
}

// 開寶箱
export function sfxOpenChest() {
  playAudio("open_chest", 0.9);
  vibrate([0, 40, 60, 80, 100]);
}

// 大勝利
export function sfxVictory() {
  playAudio("victory", 0.95);
  vibrate([0, 50, 60, 80, 100, 80]);
}

// 失敗/全滅 — 下行哀鳴 + 低頻衰退
export function sfxDefeat() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [[392,0],[311,0.22],[261,0.44],[196,0.7]].forEach(([freq, d]) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "sine";
    n.frequency.setValueAtTime(freq, t + d);
    n.frequency.linearRampToValueAtTime(freq * 0.82, t + d + 0.2);
    g.gain.setValueAtTime(0.32, t + d);
    g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.25);
    n.connect(g); g.connect(c.destination);
    n.start(t + d); n.stop(t + d + 0.28);
  });
  distTone(100, 50, 0.8, 0.18, 0.2);
  vibrate([0, 80, 100, 120]);
}

// 怪物嘶吼 — WaveShaper 失真低頻
export function sfxZombieRoar() {
  [0, 0.05, 0.1].forEach((d, i) => distTone(62 + i * 8, 40, 0.9, 0.3, d));
  noiseBurst(0, 0.6, 300, 0.5);
  vibrate([0, 100, 50, 80, 30]);
}

// 金幣掉落 — 叮鈴叮鈴
export function sfxCoinDrop() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [1200, 1600, 2000, 1600, 1200].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "triangle"; n.frequency.value = freq;
    const st = t + i * 0.06;
    g.gain.setValueAtTime(0.22, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.18);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.2);
  });
  vibrate([0, 15, 20]);
}

// 商店購買 — 確認三音
export function sfxShopBuy() {
  tone(440, 0.08, "sine",     0.2,  0);
  tone(660, 0.08, "sine",     0.2,  0.08);
  tone(880, 0.22, "triangle", 0.24, 0.16);
  vibrate([0, 20, 30, 40]);
}

// 地下城開門 — 低頻嗡嗡 + 鏈條叮
export function sfxDoorOpen() {
  distTone(80, 55, 0.5, 0.22, 0);
  tone(1100, 0.06, "triangle", 0.15, 0.3);
  tone(880,  0.08, "triangle", 0.12, 0.36);
  tone(660,  0.12, "sine",     0.1,  0.42);
  vibrate([0, 30, 40, 60]);
}

// 路線確認 — 清脆雙音選擇
export function sfxPathSelect() {
  tone(660,  0.1, "triangle", 0.2, 0);
  tone(880,  0.1, "triangle", 0.2, 0.1);
  tone(1100, 0.2, "sine",     0.18, 0.2);
  vibrate([0, 15, 25]);
}

// 進場戰鬥 — 緊張鼓點 + 張力上升（戰前氣氛）
export function sfxBattleIntro() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  // 三連低頻鼓擊
  [0, 0.18, 0.36].forEach(d => {
    noiseBurst(d, 0.12, 90, 0.75);
    tone(55, 0.14, "sawtooth", 0.28, d);
  });
  // 緊張上升旋律
  [110, 138, 165, 196, 220, 262].forEach((freq, i) => {
    tone(freq, 0.14, "sawtooth", 0.16, 0.6 + i * 0.1);
  });
  // 最終衝擊
  noiseBurst(1.22, 0.28, 80, 0.9);
  distTone(110, 165, 0.8, 0.4, 1.22);
  tone(220, 0.5, "square", 0.12, 1.32);
  vibrate([0, 60, 50, 60, 50, 100, 80, 200]);
}

// 世界王登場 — 震撼長音效（低頻轟炸 + 警報上升旋律 + 持續電流）
export function sfxWorldBossAppear() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  // 第一波：低頻震爆
  noiseBurst(0, 0.45, 80, 0.9);
  distTone(55, 110, 0.55, 0.5, 0.05);
  tone(55, 0.6, "sawtooth", 0.35, 0);
  // 第二波：警報尖叫上升
  [200, 280, 380, 500, 660, 880, 1100, 1400].forEach((freq, i) => {
    const st = t + 0.4 + i * 0.12;
    tone(freq, 0.18, "sawtooth", 0.22, 0.4 + i * 0.12);
    tone(freq * 1.5, 0.12, "square", 0.12, 0.4 + i * 0.12 + 0.04);
  });
  // 第三波：持續電流低鳴
  const osc = c.createOscillator();
  const g2  = c.createGain();
  osc.type = "sawtooth"; osc.frequency.value = 80;
  g2.gain.setValueAtTime(0.25, t + 1.5);
  g2.gain.linearRampToValueAtTime(0.15, t + 3.5);
  g2.gain.linearRampToValueAtTime(0, t + 4.2);
  osc.connect(g2); g2.connect(c.destination);
  osc.start(t + 1.5); osc.stop(t + 4.2);
  // 震動
  vibrate([0, 100, 80, 120, 80, 200, 100, 300]);
}
