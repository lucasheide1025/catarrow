// src/lib/sound.js
// 真實 mp3 音效（/sounds/*.mp3）+ Web Audio API 合成（其餘）
// 全域開關：fxSettings.getSoundEnabled() — ctx() 單點閘門，關閉時所有合成音效靜音

import { getSoundEnabled } from "./fxSettings";

// ── mp3 播放輔助 ──────────────────────────────────────────────
const _sfxCache = {};
function playAudio(name, volume = 1) {
  if (!getSoundEnabled()) return;
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
  if (!getSoundEnabled()) return null; // 總閘門：所有合成音效（tone/noiseBurst/distTone/直接用 ctx 的函式）都會靜音
  try {
    if (!_ctx || _ctx.state === "closed") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    }
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch { return null; }
}

// 確保 AudioContext 解鎖（在使用者互動後呼叫）
export function unlockAudio() {
  ctx();
}

let _gestured = false;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => { _gestured = true; }, { once: true });
}

export function vibrate(pattern = 30) {
  if (!getSoundEnabled()) return; // 震動跟隨音效開關
  try { if (_gestured && navigator?.vibrate) navigator.vibrate(pattern); } catch {}
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

// ── 教練後台大聲提示音（工作電腦保持開啟用，比 sfxNotify 大聲、三種彼此可辨識）──
// 每日報到待審：明亮上行三連音（加大音量版）
export function sfxCheckinAlert() {
  tone(784,  0.20, "triangle", 0.82, 0);
  tone(988,  0.22, "triangle", 0.80, 0.18);
  tone(1319, 0.28, "triangle", 0.76, 0.38);
  vibrate([0, 45, 60, 45]);
}
// 新預約：門鈴「叮—咚」雙音下行＋明亮尾音（跟報到明顯不同）
export function sfxNewBookingAlert() {
  tone(1047, 0.24, "sine",     0.86, 0);    // 叮
  tone(784,  0.30, "sine",     0.84, 0.22); // 咚
  tone(1568, 0.18, "triangle", 0.68, 0.52); // 尾音
  vibrate([0, 55, 40, 55, 40]);
}
// 下一小時提醒：急促重複三短音（時鐘/催促感，跟前兩者都不同）
export function sfxNextHourAlert() {
  tone(660, 0.13, "square", 0.72, 0);
  tone(660, 0.13, "square", 0.72, 0.18);
  tone(880, 0.20, "square", 0.76, 0.36);
  vibrate([0, 30, 30, 30, 30, 30]);
}

// tab / 開關切換 — 短促雙音（比 sfxTap 更輕）
export function sfxSwitch() {
  tone(600, 0.05, "triangle", 0.14, 0);
  tone(900, 0.04, "sine",     0.10, 0.03);
  vibrate(8);
}

// 彈窗開啟 — 上滑感
export function sfxOpen() {
  tone(440, 0.06, "sine",     0.14, 0);
  tone(660, 0.08, "triangle", 0.12, 0.05);
  vibrate(10);
}

// 彈窗關閉 — 下滑感
export function sfxClose() {
  tone(660, 0.05, "sine",     0.12, 0);
  tone(440, 0.07, "triangle", 0.10, 0.04);
}

// 錯誤/不可行操作 — 低音雙頓
export function sfxError() {
  tone(220, 0.09, "square", 0.14, 0);
  tone(185, 0.14, "square", 0.14, 0.11);
  vibrate([0, 40, 40, 40]);
}

// ── 射箭音效 ─────────────────────────────────────────────────

// 普通命中
export function sfxArrowHit() {
  noiseBurst(0, 0.06, 1200, 0.4);
  tone(220, 0.08, "sine", 0.18, 0);
  tone(440, 0.05, "triangle", 0.12, 0.04);
  vibrate(16);
}

// 爆擊
export function sfxCritBoom() {
  noiseBurst(0, 0.18, 800, 0.8);
  tone(440, 0.10, "sine", 0.28, 0);
  tone(660, 0.08, "triangle", 0.22, 0.07);
  tone(880, 0.16, "sine", 0.16, 0.14);
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
  tone(180, 0.12, "sine", 0.12, 0);
  tone(150, 0.15, "sawtooth", 0.08, 0.08);
  vibrate(12);
}

// 射箭弓弦聲
export function sfxArrowShoot() {
  noiseBurst(0, 0.05, 1500, 0.35);
  tone(260, 0.06, "triangle", 0.18, 0);
  tone(520, 0.04, "sine", 0.10, 0.03);
  vibrate(12);
}

// ── 戰鬥音效 ─────────────────────────────────────────────────

// 怪物反擊
export function sfxCounter() {
  distTone(120, 80, 0.35, 0.35, 0);
  noiseBurst(0.08, 0.12, 250, 0.5);
  tone(80, 0.30, "sawtooth", 0.18, 0);
  vibrate([0, 55, 75, 50]);
}

// 怪物爆擊反擊
export function sfxCounterCrit() {
  noiseBurst(0,    0.40, 120, 1.2);   // 重擊低頻衝擊
  noiseBurst(0.05, 0.15, 700, 0.7);   // 高頻撕裂瞬間
  distTone(200, 70, 0.45, 0.9, 0);    // 下行嘶吼
  tone(55, 0.55, "sine", 0.45, 0.05); // 深沉 bass 震動
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

// 打怪/世界王勝利 — 爆炸聲 + 8音上行凱旋旋律（sfxVictory 為別名）
export function sfxVictoryFanfare() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  // 開場爆炸音
  noiseBurst(0, 0.25, 300, 0.9);
  distTone(110, 220, 0.35, 0.5, 0);
  // 8音上行旋律（方波+三角和聲）
  [261, 329, 392, 523, 659, 784, 988, 1047].forEach((freq, i) => {
    const st = t + 0.25 + i * 0.1;
    ["square", "triangle"].forEach((type, j) => {
      const n = c.createOscillator(); const g = c.createGain();
      n.type = type; n.frequency.value = freq * (j === 1 ? 2 : 1);
      g.gain.setValueAtTime(j === 0 ? 0.22 : 0.10, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.25);
      n.connect(g); g.connect(c.destination);
      n.start(st); n.stop(st + 0.28);
    });
  });
  // 最後持續長音
  tone(1047, 0.8, "triangle", 0.18, 1.15);
  vibrate([0, 60, 50, 80, 50, 120, 80, 200]);
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
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [440, 554, 659, 880].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "triangle"; n.frequency.value = freq;
    const st = t + i * 0.09;
    g.gain.setValueAtTime(0.22, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.28);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.3);
  });
  vibrate([0, 60, 80, 100]);
}

// 開寶箱
export function sfxOpenChest() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [660, 880, 1100].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "triangle"; n.frequency.value = freq;
    const st = t + i * 0.08;
    g.gain.setValueAtTime(0.24, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.20);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.22);
  });
  noiseBurst(0.02, 0.12, 2000, 0.28);
  vibrate([0, 40, 60, 80, 100]);
}

// 大勝利
export function sfxVictory() {
  const c = ctx(); if (!c) return;
  const t = c.currentTime;
  [523, 659, 784, 1047, 1318].forEach((freq, i) => {
    const n = c.createOscillator(); const g = c.createGain();
    n.type = "triangle"; n.frequency.value = freq;
    const st = t + i * 0.10;
    g.gain.setValueAtTime(0.26, st);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
    n.connect(g); g.connect(c.destination);
    n.start(st); n.stop(st + 0.38);
  });
  noiseBurst(0.45, 0.25, 1500, 0.5);
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

// ── 扭蛋音效 ─────────────────────────────────────────────────

// 扭蛋機轉動（按下按鈕時）
export function sfxGachaRoll() {
  noiseBurst(0, 0.12, 900, 0.35);
  tone(180, 0.35, "sawtooth", 0.12, 0);
  tone(260, 0.25, "sawtooth", 0.10, 0.1);
  noiseBurst(0.25, 0.18, 1200, 0.28);
  tone(340, 0.20, "sawtooth", 0.08, 0.3);
  vibrate([0, 30, 40, 30, 50]);
}

// 扭蛋結果揭曉（有新卡=閃耀，普通=輕快）
export function sfxGachaReveal(isNew = false) {
  if (isNew) {
    noiseBurst(0, 0.15, 2000, 0.4);
    [523, 659, 784, 1047, 1318].forEach((f, i) => tone(f, 0.22, "triangle", 0.22, i * 0.08));
    vibrate([0, 50, 60, 80, 100]);
  } else {
    tone(523, 0.10, "triangle", 0.20, 0);
    tone(659, 0.18, "triangle", 0.20, 0.10);
    tone(784, 0.25, "sine",     0.18, 0.20);
    vibrate([0, 30, 50]);
  }
}


// ── 議會廳採集音效 ──────────────────────────────────────────
export function sfxGatherClick() {
  noiseBurst(0, 0.07, 600, 0.22);
  tone(220, 0.10, "sine", 0.15, 0.04);
}
export function sfxGatherDefeat() {
  tone(440, 0.14, "triangle", 0.22, 0);
  tone(554, 0.18, "triangle", 0.20, 0.10);
  tone(659, 0.22, "triangle", 0.18, 0.20);
}
export function sfxGatherFail() {
  tone(330, 0.18, "sine", 0.18, 0);
  tone(277, 0.22, "sine", 0.16, 0.15);
  tone(220, 0.30, "sine", 0.14, 0.35);
}
export function sfxGatherVictory() {
  [523, 659, 784, 880, 1047].forEach((f, i) =>
    tone(f, 0.22, "triangle", 0.20, i * 0.09)
  );
  vibrate([0, 40, 60, 80]);
}

// ── 採集任務：各建築工具音效（每種 3 隨機變體）──────────────
const COUNCIL_SFX = {
  mine: [
    () => { noiseBurst(0, 0.06, 300, 0.5); tone(90, 0.18, "sawtooth", 0.28, 0.04); noiseBurst(0.06, 0.10, 200, 0.3); },
    () => { noiseBurst(0, 0.08, 250, 0.55); tone(75, 0.22, "sawtooth", 0.32, 0.06); noiseBurst(0.08, 0.12, 180, 0.28); },
    () => { noiseBurst(0, 0.05, 350, 0.48); tone(100, 0.15, "sawtooth", 0.25, 0.03); noiseBurst(0.05, 0.09, 240, 0.35); },
  ],
  farm: [
    () => { noiseBurst(0, 0.04, 500, 0.28); tone(180, 0.14, "sine", 0.18, 0.03); noiseBurst(0.06, 0.08, 400, 0.18); },
    () => { noiseBurst(0, 0.05, 450, 0.32); tone(160, 0.16, "sine", 0.20, 0.04); tone(220, 0.12, "sine", 0.10, 0.12); },
    () => { noiseBurst(0, 0.04, 550, 0.25); tone(200, 0.12, "triangle", 0.16, 0.03); noiseBurst(0.05, 0.07, 380, 0.15); },
  ],
  harbor: [
    () => { noiseBurst(0, 0.12, 800, 0.22); tone(140, 0.30, "sine", 0.16, 0); tone(100, 0.40, "sine", 0.12, 0.08); },
    () => { noiseBurst(0, 0.10, 700, 0.28); tone(120, 0.25, "sine", 0.18, 0.02); noiseBurst(0.12, 0.18, 600, 0.12); },
    () => { tone(110, 0.35, "sine", 0.20, 0); noiseBurst(0, 0.08, 900, 0.18); tone(160, 0.20, "sine", 0.10, 0.15); },
  ],
  hunting: [
    () => { noiseBurst(0, 0.05, 400, 0.30); tone(260, 0.08, "triangle", 0.14, 0); noiseBurst(0.06, 0.12, 300, 0.22); },
    () => { noiseBurst(0, 0.04, 380, 0.28); tone(240, 0.10, "triangle", 0.16, 0.02); noiseBurst(0.05, 0.10, 280, 0.20); },
    () => { noiseBurst(0, 0.06, 420, 0.32); tone(300, 0.07, "triangle", 0.12, 0); noiseBurst(0.07, 0.14, 320, 0.24); },
  ],
  market: [
    () => { tone(880, 0.06, "triangle", 0.18, 0); tone(1046, 0.08, "triangle", 0.14, 0.05); tone(784, 0.10, "triangle", 0.10, 0.10); },
    () => { tone(1046, 0.05, "triangle", 0.16, 0); tone(880, 0.07, "triangle", 0.12, 0.04); noiseBurst(0, 0.03, 2000, 0.10); },
    () => { tone(784, 0.07, "triangle", 0.20, 0); tone(987, 0.06, "triangle", 0.15, 0.06); tone(1174, 0.05, "triangle", 0.10, 0.12); },
  ],
  warehouse: [
    () => { noiseBurst(0, 0.07, 200, 0.45); tone(80, 0.20, "sawtooth", 0.22, 0.05); noiseBurst(0.08, 0.14, 160, 0.25); },
    () => { noiseBurst(0, 0.08, 220, 0.42); tone(70, 0.18, "sawtooth", 0.20, 0.06); noiseBurst(0.09, 0.16, 180, 0.22); },
    () => { noiseBurst(0, 0.06, 240, 0.48); tone(90, 0.16, "sawtooth", 0.24, 0.04); noiseBurst(0.07, 0.12, 200, 0.28); },
  ],
};

export function sfxCouncilWork(buildingId) {
  const list = COUNCIL_SFX[buildingId] || COUNCIL_SFX.mine;
  const fn   = list[Math.floor(Math.random() * list.length)];
  fn();
  vibrate([0, 18]);
}

// ── 貓貓村 UI 音效 ───────────────────────────────────────────
export function sfxVillageCollect() {
  tone(659, 0.08, "triangle", 0.22, 0);
  tone(784, 0.10, "triangle", 0.20, 0.07);
  tone(1046, 0.14, "triangle", 0.18, 0.15);
  noiseBurst(0, 0.04, 1200, 0.14);
  vibrate([0, 20, 30]);
}
export function sfxVillageBuild() {
  noiseBurst(0, 0.06, 400, 0.28);
  tone(440, 0.10, "sawtooth", 0.16, 0.06);
  tone(554, 0.12, "triangle", 0.18, 0.14);
  vibrate([0, 15, 25]);
}
export function sfxVillageExchange() {
  tone(523, 0.06, "triangle", 0.18, 0);
  tone(659, 0.08, "triangle", 0.16, 0.06);
  tone(523, 0.06, "triangle", 0.12, 0.14);
  vibrate([0, 12]);
}
