// src/lib/sound.js
// 真實 mp3 音效（/sounds/*.mp3）+ Web Audio API 合成（其餘）
// 全域開關：fxSettings.getSoundEnabled() — ctx() 單點閘門，關閉時所有合成音效靜音

import { getSoundEnabled, getVibrationEnabled } from "./fxSettings";

// ── 真實錄音樣本（/sounds/*.mp3）────────────────────────────────
//
// ⚠️ 2026-07-26 發現：`public/sounds/` 裡有 8 個真實音檔（2026-06 加的），但 `playAudio`
//    **一個呼叫點都沒有**——全被後來的合成音效蓋過去，等於白放了一個月。
//
// 為什麼這件事重要：**合成音效有硬天花板**。現代手遊音效是錄音素材（真金屬、真布料、真撞擊）
// 經過 DAW 的多頻段壓縮／飽和／transient shaper 做出來的，用振盪器＋噪音永遠追不上——
// 尤其是「有機」的撞擊聲。UI 點擊、whoosh、科技感這類合成得出來，箭射中肉體則不行。
//
// 所以策略是**混合**：有樣本的用樣本，沒樣本的用合成當保底。
//   `sample(name, vol, fallback)` → 檔案播得出來就播檔案；載入失敗（或還沒解鎖）就跑合成版。
//   這樣新增音檔只要丟進 /sounds/ 再加一行對照，不必改任何呼叫端。
const _sfxCache = {};
const _sfxBroken = {};     // 載入失敗的檔名 → 之後直接走合成，不再重試

// ⚠️ 音檔快取策略（2026-07-27 作者提問：「會重複發生的部分，何必一直放在我們這裡」）
//    ——完全同意。`vercel.json` 已把 `/sounds/*` 設成 `max-age=31536000, immutable`，
//    所以每個音檔**第一次下載後就永久留在使用者裝置上**，之後 0 個請求。
//    但 immutable 有個代價：換了同名檔案，舊裝置永遠不會知道。
//    解法＝網址帶版本號。**換掉任何音檔後把 SFX_VERSION +1**，網址一變就會自動抓新的。
const SFX_VERSION = 1;

function playAudio(name, volume = 1) {
  if (!getSoundEnabled()) return false;
  if (_sfxBroken[name]) return false;
  try {
    if (!_sfxCache[name]) {
      const el = new Audio(`/sounds/${name}.mp3?v=${SFX_VERSION}`);
      el.preload = "auto";
      el.addEventListener("error", () => { _sfxBroken[name] = true; }, { once: true });
      _sfxCache[name] = el;
    }
    const a = _sfxCache[name].cloneNode();
    a.volume = Math.max(0, Math.min(1, volume));
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => {});   // 自動播放被擋 → 不當成壞檔，下次還能試
    return true;
  } catch {
    _sfxBroken[name] = true;
    return false;
  }
}

// 有樣本就用樣本，否則跑合成版（fallback）。
// ⚠️ 震動要傳進來：合成版的函式體裡本來就有 vibrate()，但走樣本時那段不會執行，
//    不補的話「用了真實音效反而沒有觸覺回饋」——這是實裝樣本時最容易漏的回歸。
function sample(name, volume, fallback, vib) {
  if (playAudio(name, volume)) { if (vib !== undefined) vibrate(vib); }
  else fallback?.();
}

// 進 App 時先把樣本抓下來，第一次觸發才不會有延遲
// 預載清單：**只放「高頻＋短」的音效**（2026-07-27）。
// 為什麼不是全部：public/sounds/ 現在有 2.4MB，光三個 boss_appear 就佔 1.55MB，
// 而它們一場活動只響一次、登場畫面前面還有 600ms 震動鋪陳 —— 預載它們等於讓每個學生
// 開 App 就先吃 1.5MB 流量換一個聽不出來的差別。
// 沒被預載的檔案照樣會播，只是**第一次觸發**要等它下載（40~80KB 在 4G 上約 100ms，
// 而那些都是有動畫鋪陳的大場面，感覺不出來）。
const SAMPLE_NAMES = [
  "ui_tap", "ui_switch", "ui_success",              // 介面：每天按幾百次
  "normal_atk", "crit", "monster_atk", "monster_crit", "miss",   // 戰鬥：每回合都響
  "round_end", "coin",                              // 回合/獎勵：頻繁
];
let _preloaded = false;
function preloadSamples() {
  if (_preloaded || typeof window === "undefined") return;
  _preloaded = true;
  for (const n of SAMPLE_NAMES) {
    try {
      const el = new Audio(`/sounds/${n}.mp3?v=${SFX_VERSION}`);
      el.preload = "auto";
      el.addEventListener("error", () => { _sfxBroken[n] = true; }, { once: true });
      _sfxCache[n] = el;
    } catch { _sfxBroken[n] = true; }
  }
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
  preloadSamples();   // 樣本也一起預載，第一次命中才不會延遲
}

let _gestured = false;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => { _gestured = true; }, { once: true });
}

export function vibrate(pattern = 30) {
  if (!getVibrationEnabled()) return;
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


// ═══════════════════════════════════════════════════════════════
// 現代化音效引擎（2026-07-26）
// ═══════════════════════════════════════════════════════════════
// 為什麼舊音效聽起來像電子琴 beep：
//   ① 每個音效**直接接 destination** → 沒有空間感、沒有整體壓縮，疊在一起就爆音
//   ② `tone()` 是**單一振盪器 + 線性 attack** → 這正是「beep」的來源
//   ③ `noiseBurst()` 的 lowpass 是**固定頻率** → 缺少厚度（現代衝擊音的重量來自濾波器包絡）
//   ④ 沒有 pitch envelope、沒有 detune → 聽起來很薄、很平
//
// 現代遊戲音效的三個關鍵，全部可以用 Web Audio 合成、**不需要任何音檔**：
//   A. **分層**：transient（點擊感）＋ body（音色）＋ air（高頻空氣感）＋ sub（低頻重量）
//   B. **包絡**：不只音量有包絡，**音高與濾波器也要有**（punch 感來自音高瞬降）
//   C. **總線**：共用 compressor（黏合、防爆）＋ convolution reverb（空間）＋ stereo pan
//
// ⚠️ 舊的 tone/noiseBurst/distTone 保留不動——還有二十幾個音效在用，不動就沒有回歸風險。
// ⚠️ 教練後台的三個提醒音（sfxCheckinAlert 等）**刻意不改**：它們是為了在工作電腦上穿透
//    環境噪音而設計的刺耳上行音，「現代化」會讓它變得不夠醒目＝功能退化。

let _bus = null;      // { ctx, in, send }

// 合成一段脈衝響應當殘響（不需要 IR 音檔）：指數衰減的噪音，兩耳用不同亂數 → 有立體寬度
function buildIR(c, seconds = 0.42, decay = 3.2) {
  const len = Math.max(1, Math.floor(c.sampleRate * seconds));
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const early = i < c.sampleRate * 0.008 ? 0.25 : 1;   // 前 8ms 壓低，避免糊掉 transient
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early;
    }
  }
  return buf;
}

// 總線：voice → busIn → compressor → master → destination
//                   ↘ send → convolver → wet ↗
function bus() {
  const c = ctx(); if (!c) return null;
  if (_bus && _bus.ctx === c) return _bus;
  try {
    const busIn = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;   // 稍微壓一下，多個音效同時觸發不會爆
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    const master = c.createGain();
    master.gain.value = 0.9;

    const send = c.createGain();
    send.gain.value = 1;
    const conv = c.createConvolver();
    conv.buffer = buildIR(c);
    const wet = c.createGain();
    wet.gain.value = 0.5;

    busIn.connect(comp);
    send.connect(conv); conv.connect(wet); wet.connect(comp);
    comp.connect(master); master.connect(c.destination);
    _bus = { ctx: c, in: busIn, send };
    return _bus;
  } catch { return null; }
}

// 一個「聲音」的出口：自帶音量、pan、以及往殘響送多少
function voice(gainVal = 0.2, pan = 0, sendAmt = 0.12) {
  const b = bus(); if (!b) return null;
  const c = b.ctx;
  const g = c.createGain();
  g.gain.value = gainVal;
  let out = g;
  if (pan && c.createStereoPanner) {
    const pn = c.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(pn); out = pn;
  }
  out.connect(b.in);
  if (sendAmt > 0) {
    const sg = c.createGain();
    sg.gain.value = sendAmt;
    out.connect(sg); sg.connect(b.send);
  }
  return { c, node: g };
}

// ── 原語 ──────────────────────────────────────────────────────

// punch：音高瞬降 → 現代 UI 與打擊音的「thock」感
function punch({ freq = 320, drop = 0.45, dur = 0.16, gain = 0.3, type = 'sine', pan = 0, send = 0.1, delay = 0 } = {}) {
  const v = voice(gain, pan, send); if (!v) return;
  const { c, node } = v;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * drop), t0 + dur * 0.8);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(1, t0 + 0.004);          // 極快 attack ＝ 有「點」
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env); env.connect(node);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

// pluck：兩顆微微失諧的鋸齒波 + lowpass 包絡 → 有質感的 UI 點擊（不再是 beep）
function pluck({ freq = 620, dur = 0.13, gain = 0.16, detune = 12, cut0 = 5200, cut1 = 700, pan = 0, send = 0.1, delay = 0 } = {}) {
  const v = voice(gain, pan, send); if (!v) return;
  const { c, node } = v;
  const t0 = c.currentTime + delay;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 1.1;
  filt.frequency.setValueAtTime(cut0, t0);
  filt.frequency.exponentialRampToValueAtTime(Math.max(80, cut1), t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(1, t0 + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  for (const d of [-detune, detune]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = d;
    osc.connect(filt);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  filt.connect(env); env.connect(node);
}

// impact：噪音 + lowpass **往下掃** → 衝擊音「重量」的來源
function impact({ dur = 0.26, cut0 = 7000, cut1 = 260, gain = 0.34, q = 0.9, pan = 0, send = 0.18, delay = 0 } = {}) {
  const v = voice(gain, pan, send); if (!v) return;
  const { c, node } = v;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.ceil(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass'; filt.Q.value = q;
  filt.frequency.setValueAtTime(cut0, t0);
  filt.frequency.exponentialRampToValueAtTime(Math.max(80, cut1), t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(1, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt); filt.connect(env); env.connect(node);
  src.start(t0);
}

// air：highpass 噪音 → 高頻空氣感，疊在衝擊上讓它變清脆
function air({ dur = 0.2, gain = 0.12, hp = 3600, pan = 0, send = 0.22, delay = 0 } = {}) {
  const v = voice(gain, pan, send); if (!v) return;
  const { c, node } = v;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.ceil(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass'; filt.frequency.value = hp;
  const env = c.createGain();
  env.gain.setValueAtTime(1, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt); filt.connect(env); env.connect(node);
  src.start(t0);
}

// sub：低頻正弦墊底。手機小喇叭聽不太到，但耳機/震動會有「胸口一沉」的重量
function sub({ freq = 72, dur = 0.24, gain = 0.5, delay = 0 } = {}) {
  const v = voice(gain, 0, 0); if (!v) return;
  const { c, node } = v;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.6, t0);
  osc.frequency.exponentialRampToValueAtTime(freq, t0 + dur * 0.6);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(1, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env); env.connect(node);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

// swell：往上/往下掃的帶通噪音 → 開關面板的 whoosh
function swell({ up = true, dur = 0.28, gain = 0.16, pan = 0, send = 0.18, delay = 0 } = {}) {
  const v = voice(gain, pan, send); if (!v) return;
  const { c, node } = v;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.ceil(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass'; filt.Q.value = 1.6;
  filt.frequency.setValueAtTime(up ? 500 : 4200, t0);
  filt.frequency.exponentialRampToValueAtTime(up ? 4200 : 500, t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(1, t0 + dur * 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt); filt.connect(env); env.connect(node);
  src.start(t0);
}

// 旋律/和弦：用 pluck 疊出來（比單音 tone 厚得多）
function notes(list, opts = {}) {
  list.forEach(([freq, delay, dur = 0.3], i) => {
    pluck({
      freq, dur, delay,
      gain: opts.gain === undefined ? 0.14 : opts.gain,
      cut0: 6500, cut1: 1200,
      send: opts.send === undefined ? 0.3 : opts.send,
      pan: opts.spread ? (i % 2 ? 0.18 : -0.18) : 0,
    });
  });
}

// ── UI 音效 ──────────────────────────────────────────────────

export function sfxTap() {
  sample("ui_tap", 0.55, sfxTapSynth, 8);
}

function sfxTapSynth() {
  // 分層：短 pluck 當「點」＋一絲 air 當「亮」。比單顆 sine 有質感又不吵。
  pluck({ freq: 880, dur: 0.075, gain: 0.13, cut0: 6000, cut1: 1400, send: 0.06 });
  air({ dur: 0.05, gain: 0.05, hp: 5000, send: 0.05 });
  vibrate(8);
}

export function sfxNotify() {
  sample("ui_notify", 0.7, sfxNotifySynth, [0, 30, 60, 30]);
}

function sfxNotifySynth() {
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
  sample("ui_switch", 0.5, sfxSwitchSynth, 6);
}

function sfxSwitchSynth() {
  pluck({ freq: 1180, dur: 0.06, gain: 0.11, cut0: 7000, cut1: 2000, send: 0.05 });
  punch({ freq: 240, drop: 0.7, dur: 0.05, gain: 0.06, send: 0 });
  vibrate(6);
}

// 彈窗開啟 — 上滑感
export function sfxOpen() {
  sample("ui_open", 0.6, sfxOpenSynth, 12);
}

function sfxOpenSynth() {
  swell({ up: true, dur: 0.26, gain: 0.13, send: 0.2 });
  pluck({ freq: 640, dur: 0.16, gain: 0.12, cut0: 4200, cut1: 1400, delay: 0.06, send: 0.18 });
  vibrate(12);
}

// 彈窗關閉 — 下滑感
export function sfxClose() {
  sample("ui_close", 0.55, sfxCloseSynth, 10);
}

function sfxCloseSynth() {
  swell({ up: false, dur: 0.22, gain: 0.12, send: 0.14 });
  punch({ freq: 300, drop: 0.5, dur: 0.12, gain: 0.14, delay: 0.03, send: 0.08 });
  vibrate(10);
}

// 錯誤/不可行操作 — 低音雙頓
export function sfxError() {
  sample("ui_error", 0.7, sfxErrorSynth, [0, 40, 50, 40]);
}

function sfxErrorSynth() {
  // 兩顆下行的失諧 punch：不用刺耳的高頻也能讓人知道「不行」
  punch({ freq: 300, drop: 0.55, dur: 0.14, gain: 0.24, type: 'triangle', pan: -0.12, send: 0.1 });
  punch({ freq: 224, drop: 0.55, dur: 0.2, gain: 0.22, type: 'triangle', pan: 0.12, delay: 0.09, send: 0.14 });
  impact({ dur: 0.14, cut0: 1800, cut1: 300, gain: 0.1, send: 0.1 });
  vibrate([0, 40, 50, 40]);
}

// ── 射箭音效 ─────────────────────────────────────────────────

// 普通命中
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxArrowHit() {
  sample("normal_atk", 0.85, sfxArrowHitSynth, 18);
}

function sfxArrowHitSynth() {
  // 命中＝transient(air) + 重量(impact 下掃) + 低頻(sub)。這三層就是「打到東西」的感覺。
  air({ dur: 0.05, gain: 0.1, hp: 5200, send: 0.08 });
  impact({ dur: 0.2, cut0: 5200, cut1: 300, gain: 0.3, send: 0.16 });
  sub({ freq: 84, dur: 0.14, gain: 0.32 });
  vibrate(18);
}

// 爆擊
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxCritBoom() {
  sample("crit", 0.9, sfxCritBoomSynth, [0, 55, 40, 70]);
}

function sfxCritBoomSynth() {
  // 暴擊＝同一套但每層都加大，並多送殘響（空間變大＝更有威力）
  air({ dur: 0.09, gain: 0.16, hp: 4600, send: 0.24 });
  impact({ dur: 0.42, cut0: 8000, cut1: 180, gain: 0.44, send: 0.3 });
  sub({ freq: 62, dur: 0.34, gain: 0.6 });
  punch({ freq: 420, drop: 0.28, dur: 0.24, gain: 0.18, type: 'triangle', delay: 0.02, send: 0.22 });
  vibrate([0, 55, 40, 70]);
}

// 器官/要害命中 — 低沉厚重
export function sfxOrganHit() {
  sample("cat_assist", 0.8, sfxOrganHitSynth, 14);
}

function sfxOrganHitSynth() {
  // 貓貓助攻/軟命中：比箭輕、比較「肉」，高頻少一點
  impact({ dur: 0.16, cut0: 3000, cut1: 400, gain: 0.22, send: 0.12 });
  punch({ freq: 340, drop: 0.5, dur: 0.1, gain: 0.12, type: 'triangle', send: 0.08 });
  vibrate(14);
}

// 脫靶
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxSoftFail() {
  sample("miss", 0.7, sfxSoftFailSynth, 8);
}

function sfxSoftFailSynth() {
  // 閃避/沒中：短的空氣感 + 一顆很輕的下行音，不要有衝擊
  air({ dur: 0.14, gain: 0.1, hp: 3000, send: 0.16 });
  punch({ freq: 400, drop: 0.6, dur: 0.1, gain: 0.08, type: 'sine', send: 0.1 });
  vibrate(8);
}

// 射箭弓弦聲
export function sfxArrowShoot() {
  sample("arrow_shoot", 0.8, sfxArrowShootSynth, 10);
}

function sfxArrowShootSynth() {
  // 弓弦：低頻 pluck（弦）＋ 往上掃的 air（箭離弦的颯）
  pluck({ freq: 196, dur: 0.09, gain: 0.16, detune: 26, cut0: 2600, cut1: 500, send: 0.06 });
  air({ dur: 0.16, gain: 0.14, hp: 2800, send: 0.12 });
  vibrate(10);
}

// ── 戰鬥音效 ─────────────────────────────────────────────────

// 怪物反擊
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxCounter() {
  sample("monster_atk", 0.85, sfxCounterSynth, [0, 45]);
}

function sfxCounterSynth() {
  // 被打：cutoff 壓得更低＝更「悶」，聽起來是自己吃了一下
  impact({ dur: 0.3, cut0: 2400, cut1: 160, gain: 0.36, send: 0.14 });
  sub({ freq: 58, dur: 0.26, gain: 0.5 });
  punch({ freq: 180, drop: 0.5, dur: 0.16, gain: 0.14, type: 'triangle', send: 0.08 });
  vibrate([0, 45]);
}

// 怪物爆擊反擊
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxCounterCrit() {
  sample("monster_crit", 0.9, sfxCounterCritSynth, [0, 70, 40, 90]);
}

function sfxCounterCritSynth() {
  impact({ dur: 0.46, cut0: 3200, cut1: 130, gain: 0.46, send: 0.24 });
  sub({ freq: 48, dur: 0.42, gain: 0.66 });
  punch({ freq: 150, drop: 0.4, dur: 0.3, gain: 0.2, type: 'triangle', delay: 0.03, send: 0.2 });
  vibrate([0, 70, 40, 90]);
}

// 怪物死亡 — 上行6音 + 最後爆炸
export function sfxMonsterDead() {
  sample("monster_dead", 0.85, sfxMonsterDeadSynth, [0, 30, 30, 50]);
}

function sfxMonsterDeadSynth() {
  // 擊倒：下行的失真吼叫 + 崩落的 impact 尾巴（多送殘響 → 有「散開」的感覺）
  punch({ freq: 260, drop: 0.22, dur: 0.34, gain: 0.2, type: 'sawtooth', send: 0.24 });
  impact({ dur: 0.4, cut0: 3400, cut1: 140, gain: 0.28, send: 0.28 });
  sub({ freq: 54, dur: 0.3, gain: 0.4, delay: 0.04 });
  vibrate([0, 30, 30, 50]);
}

// 施法/結算開始 — 上行鋸齒5音
export function sfxCast() {
  sample("cast", 0.8, sfxCastSynth, [0, 20, 30, 30]);
}

function sfxCastSynth() {
  // 施法：往上掃的 swell + 失諧和聲，最後一顆停在五度（有「蓄力完成」的感覺）
  swell({ up: true, dur: 0.36, gain: 0.14, send: 0.32 });
  notes([[440, 0.1], [659.3, 0.22, 0.45]], { gain: 0.12, send: 0.4 });
  vibrate([0, 20, 30, 30]);
}

// Buff — 12 顆隨機閃光
export function sfxBuff() {
  sample("buff", 0.75, sfxBuffSynth, [0, 18, 30, 18]);
}

function sfxBuffSynth() {
  notes([[659.3, 0], [880, 0.08], [1108.7, 0.16, 0.42]], { gain: 0.12, send: 0.36, spread: true });
  air({ dur: 0.34, gain: 0.06, hp: 5000, delay: 0.1, send: 0.34 });
  vibrate([0, 18, 30, 18]);
}

// Debuff — 下行失諧失真
export function sfxDebuff() {
  sample("debuff", 0.75, sfxDebuffSynth, [0, 40, 60, 40]);
}

function sfxDebuffSynth() {
  distTone(280, 140, 0.4, 0.2, 0);
  tone(220, 0.12, "sawtooth", 0.18, 0);
  tone(175, 0.20, "sawtooth", 0.20, 0.1);
  tone(140, 0.30, "sine",     0.18, 0.22);
  vibrate([0, 40, 60, 40]);
}

// 復活 — 7音上行爆發
export function sfxRevive() {
  sample("revive", 0.8, sfxReviveSynth, [0, 50, 80, 50, 80, 100]);
}

function sfxReviveSynth() {
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
  sample("ui_success", 0.75, sfxSuccessSynth, [0, 25, 40, 25]);
}

function sfxSuccessSynth() {
  // 大三和弦上行琶音 + 空間感（送較多殘響 → 有「完成」的餘韻）
  notes([[659.3, 0], [830.6, 0.07], [987.8, 0.14, 0.42]], { gain: 0.13, send: 0.34, spread: true });
  air({ dur: 0.3, gain: 0.06, hp: 4200, delay: 0.14, send: 0.3 });
  vibrate([0, 25, 40, 25]);
}

// 回合結算 — 3音輕快確認
export function sfxRoundEnd() {
  sample("round_end", 0.7, sfxRoundEndSynth, 12);
}

function sfxRoundEndSynth() {
  notes([[523.3, 0], [659.3, 0.08, 0.34]], { gain: 0.11, send: 0.3 });
  vibrate(12);
}

// 喝藥水 — 泡泡上升5音
export function sfxPotionDrink() {
  sample("potion", 0.75, sfxPotionDrinkSynth, [0, 20, 30, 20]);
}

function sfxPotionDrinkSynth() {
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
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxVictoryFanfare() {
  sample("victory", 0.85, sfxVictoryFanfareSynth, [0, 60, 60, 60, 60, 120]);
}

function sfxVictoryFanfareSynth() {
  // 開場一擊（impact + sub）→ 大三和弦上行 → 高八度收尾。用 pluck 疊比方波旋律厚得多。
  impact({ dur: 0.34, cut0: 6000, cut1: 200, gain: 0.34, send: 0.3 });
  sub({ freq: 66, dur: 0.4, gain: 0.5 });
  notes([
    [392.0, 0.18], [523.3, 0.30], [659.3, 0.42],
    [784.0, 0.56, 0.5], [1046.5, 0.72, 0.7],
  ], { gain: 0.15, send: 0.38, spread: true });
  air({ dur: 0.6, gain: 0.07, hp: 4000, delay: 0.56, send: 0.4 });
  vibrate([0, 60, 60, 60, 60, 120]);
}

// 保底大招 — 8音上行旋律（方波+三角諧波）
export function sfxEpic() {
  sample("epic", 0.85, sfxEpicSynth, [0, 50, 60, 50, 60, 80]);
}

function sfxEpicSynth() {
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
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxLevelUp() {
  sample("level_up", 0.85, sfxLevelUpSynth, [0, 40, 40, 40, 40, 100]);
}

function sfxLevelUpSynth() {
  // 升級：上行四音 + 每一階都往上加亮度，最後一顆送很多殘響（成就感的餘韻）
  notes([[523.3, 0], [659.3, 0.09], [784.0, 0.18], [1046.5, 0.28, 0.6]], { gain: 0.15, send: 0.36, spread: true });
  swell({ up: true, dur: 0.42, gain: 0.1, send: 0.3 });
  sub({ freq: 80, dur: 0.28, gain: 0.34, delay: 0.26 });
  vibrate([0, 40, 40, 40, 40, 100]);
}

// 開寶箱
// 有真實樣本就用樣本；載入失敗會自動退回下面的合成版（不會變成無聲）
export function sfxOpenChest() {
  sample("open_chest", 0.85, sfxOpenChestSynth, [0, 25, 40, 60]);
}

function sfxOpenChestSynth() {
  // 開箱：木頭吱一下（低 pluck）→ 掀開的 swell → 寶物閃光（高頻和弦）
  pluck({ freq: 140, dur: 0.14, gain: 0.16, detune: 30, cut0: 1800, cut1: 300, send: 0.1 });
  swell({ up: true, dur: 0.3, gain: 0.14, delay: 0.08, send: 0.26 });
  notes([[880, 0.26], [1174.7, 0.34], [1568, 0.42, 0.5]], { gain: 0.13, send: 0.38, spread: true });
  sub({ freq: 70, dur: 0.2, gain: 0.3, delay: 0.06 });
  vibrate([0, 25, 40, 60]);
}

// 大勝利
export function sfxVictory() {
  sample("victory_small", 0.8, sfxVictorySynth, [0, 50, 60, 80, 100, 80]);
}

function sfxVictorySynth() {
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
  sample("defeat", 0.8, sfxDefeatSynth, [0, 90, 60, 140]);
}

function sfxDefeatSynth() {
  // 失敗：小三和弦下行 + 悶掉的 impact（cutoff 很低）＋長 sub → 沉下去的感覺
  notes([[392.0, 0], [311.1, 0.2], [261.6, 0.4], [196.0, 0.62, 0.7]], { gain: 0.14, send: 0.34 });
  impact({ dur: 0.5, cut0: 1400, cut1: 110, gain: 0.24, delay: 0.02, send: 0.26 });
  sub({ freq: 44, dur: 0.7, gain: 0.44, delay: 0.5 });
  vibrate([0, 90, 60, 140]);
}

// 怪物嘶吼 — WaveShaper 失真低頻
export function sfxZombieRoar() {
  sample("zombie_roar", 0.85, sfxZombieRoarSynth, [0, 100, 50, 80, 30]);
}

function sfxZombieRoarSynth() {
  [0, 0.05, 0.1].forEach((d, i) => distTone(62 + i * 8, 40, 0.9, 0.3, d));
  noiseBurst(0, 0.6, 300, 0.5);
  vibrate([0, 100, 50, 80, 30]);
}

// 金幣掉落 — 叮鈴叮鈴
export function sfxCoinDrop() {
  sample("coin", 0.75, sfxCoinDropSynth, [0, 12, 25, 12]);
}

function sfxCoinDropSynth() {
  // 金幣：五顆高頻 pluck 左右散開，模擬硬幣彈跳（有 pan 才像散落而不是一坨）
  [1568, 2093, 1760, 2349, 1976].forEach((f, i) => {
    pluck({ freq: f, dur: 0.09, gain: 0.1, detune: 6, cut0: 9000, cut1: 3000,
      delay: i * 0.055, pan: (i % 2 ? 1 : -1) * (0.1 + i * 0.05), send: 0.26 });
  });
  air({ dur: 0.22, gain: 0.05, hp: 6000, delay: 0.05, send: 0.3 });
  vibrate([0, 12, 25, 12]);
}

// 商店購買 — 確認三音
export function sfxShopBuy() {
  sample("shop_buy", 0.75, sfxShopBuySynth, [0, 18, 30, 18]);
}

function sfxShopBuySynth() {
  // 購買：收銀機的「叮」＋紙袋感的短 impact
  pluck({ freq: 1318.5, dur: 0.1, gain: 0.12, cut0: 9000, cut1: 3500, send: 0.24 });
  pluck({ freq: 1760, dur: 0.14, gain: 0.1, delay: 0.06, cut0: 9000, cut1: 4000, send: 0.28 });
  impact({ dur: 0.1, cut0: 2200, cut1: 500, gain: 0.12, delay: 0.02, send: 0.1 });
  vibrate([0, 18, 30, 18]);
}

// 地下城開門 — 低頻嗡嗡 + 鏈條叮
export function sfxDoorOpen() {
  sample("door_open", 0.75, sfxDoorOpenSynth, [0, 30, 40, 60]);
}

function sfxDoorOpenSynth() {
  distTone(80, 55, 0.5, 0.22, 0);
  tone(1100, 0.06, "triangle", 0.15, 0.3);
  tone(880,  0.08, "triangle", 0.12, 0.36);
  tone(660,  0.12, "sine",     0.1,  0.42);
  vibrate([0, 30, 40, 60]);
}

// 路線確認 — 清脆雙音選擇
export function sfxPathSelect() {
  sample("ui_confirm", 0.7, sfxPathSelectSynth, [0, 20, 30]);
}

function sfxPathSelectSynth() {
  // 選定/接受：確認感來自「音高瞬降的 punch」，比單純的高音 beep 有份量
  punch({ freq: 520, drop: 0.62, dur: 0.14, gain: 0.2, type: 'triangle', send: 0.14 });
  pluck({ freq: 784, dur: 0.16, gain: 0.11, delay: 0.05, cut0: 6000, cut1: 1600, send: 0.22 });
  vibrate([0, 20, 30]);
}

// 進場戰鬥 — 緊張鼓點 + 張力上升（戰前氣氛）
export function sfxBattleIntro() {
  sample("battle_intro", 0.85, sfxBattleIntroSynth, [0, 60, 50, 60, 50, 100, 80, 200]);
}

function sfxBattleIntroSynth() {
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
// 世界王登場音依**族群**分三種（作者 2026-07-26 準備）：
//   怪物族（ghost/forest/poison/office/exam/western…）→ boss_appear
//   貓貓族 family="cat"                                → boss_appear1
//   教練群 family="coach"                              → boss_appear2
// 缺檔一律退回同一個合成版（不會無聲）。傳 family 或整個 boss 物件都可以。
const BOSS_APPEAR_FILE = { cat: "boss_appear1", coach: "boss_appear2" };

export function sfxWorldBossAppear(bossOrFamily) {
  const family = typeof bossOrFamily === "string" ? bossOrFamily : bossOrFamily?.family;
  const file = BOSS_APPEAR_FILE[family] || "boss_appear";
  sample(file, 0.9, sfxWorldBossAppearSynth, [0, 80, 60, 120]);
}

// 世界王登場（2026-08-06 重寫）。
//
// ⚠️ 舊版用的是**舊引擎**（noiseBurst／distTone／tone 直接接 destination）——
//    正是 changelog 2026-07-26 寫「聽起來像電子琴 beep」的那套：沒有分層、沒有濾波器包絡、
//    沒有總線壓縮與殘響，而且第三波還自己 connect(c.destination) 繞過了整條總線。
//    作者回報「音效單薄」有具體技術原因，不是錯覺。
//
// 新版用新引擎的分層原語，照手遊登場的四拍鋪陳：
//   0.00s 抽真空   swell(down) — 先把空間吸走，製造「有東西要來了」
//   0.35s 地鳴     sub + impact 低掃 — 重量
//   0.55s 破土     impact + punch 音高瞬降 — 衝擊
//   1.10s 警戒     兩聲下行雙音 — 手遊警報的語彙，不用連續上行尖叫（那是舊版最吵的部分）
//   1.60s 咆哮     長 sub + 帶通 swell — 尾韻，讓標題進場時底下還有東西撐著
function sfxWorldBossAppearSynth() {
  // ① 抽真空：先安靜再爆，對比才有震撼
  swell({ up: false, dur: 0.42, gain: 0.20, send: 0.3 });
  // ② 地鳴（低頻重量）
  sub({ freq: 44, dur: 0.9, gain: 0.62, delay: 0.35 });
  impact({ dur: 0.55, cut0: 2600, cut1: 90, gain: 0.42, q: 1.1, send: 0.32, delay: 0.35 });
  // ③ 破土衝擊
  impact({ dur: 0.38, cut0: 9000, cut1: 200, gain: 0.40, q: 0.8, send: 0.26, delay: 0.55 });
  punch({ freq: 220, drop: 0.28, dur: 0.34, gain: 0.42, type: "sawtooth", send: 0.22, delay: 0.55 });
  air({ dur: 0.30, gain: 0.16, hp: 4200, send: 0.34, delay: 0.58 });
  // ④ 警戒雙音（下行，左右分開）
  [0, 0.26].forEach((d, i) => {
    punch({ freq: 700, drop: 0.55, dur: 0.30, gain: 0.24, type: "square", pan: i ? 0.35 : -0.35, send: 0.3, delay: 1.10 + d });
    pluck({ freq: 350, dur: 0.26, gain: 0.13, cut0: 4200, cut1: 600, pan: i ? 0.35 : -0.35, send: 0.3, delay: 1.10 + d });
  });
  // ⑤ 咆哮尾韻：標題進場時底下還有東西撐著
  sub({ freq: 38, dur: 1.9, gain: 0.34, delay: 1.60 });
  swell({ up: true, dur: 1.1, gain: 0.13, send: 0.4, delay: 1.65 });
  impact({ dur: 0.9, cut0: 1400, cut1: 70, gain: 0.22, q: 1.4, send: 0.38, delay: 1.70 });
  vibrate([0, 90, 40, 140, 260, 70, 70, 70, 200, 320]);
}

// ── 扭蛋音效 ─────────────────────────────────────────────────

// 扭蛋機轉動（按下按鈕時）
export function sfxGachaRoll() {
  sample("gacha_roll", 0.8, sfxGachaRollSynth, [0, 30, 40, 30, 50]);
}

function sfxGachaRollSynth() {
  noiseBurst(0, 0.12, 900, 0.35);
  tone(180, 0.35, "sawtooth", 0.12, 0);
  tone(260, 0.25, "sawtooth", 0.10, 0.1);
  noiseBurst(0.25, 0.18, 1200, 0.28);
  tone(340, 0.20, "sawtooth", 0.08, 0.3);
  vibrate([0, 30, 40, 30, 50]);
}

// 扭蛋結果揭曉（有新卡=閃耀，普通=輕快）
export function sfxGachaReveal(isNew = false) {
  // 新卡與重複卡是兩種情緒，各給一個檔（缺檔就退回合成版）
  if (isNew) sample("gacha_reveal_new", 0.85, () => sfxGachaRevealSynth(true), [0, 50, 60, 80, 100]);
  else sample("gacha_reveal", 0.8, () => sfxGachaRevealSynth(false), [0, 30, 50]);
}

function sfxGachaRevealSynth(isNew) {
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
  sample("gather_click", 0.6, sfxGatherClickSynth);
}

function sfxGatherClickSynth() {
  noiseBurst(0, 0.07, 600, 0.22);
  tone(220, 0.10, "sine", 0.15, 0.04);
}
export function sfxGatherDefeat() {
  sample("gather_defeat", 0.8, sfxGatherDefeatSynth);
}

function sfxGatherDefeatSynth() {
  tone(440, 0.14, "triangle", 0.22, 0);
  tone(554, 0.18, "triangle", 0.20, 0.10);
  tone(659, 0.22, "triangle", 0.18, 0.20);
}
export function sfxGatherFail() {
  sample("gather_fail", 0.75, sfxGatherFailSynth);
}

function sfxGatherFailSynth() {
  tone(330, 0.18, "sine", 0.18, 0);
  tone(277, 0.22, "sine", 0.16, 0.15);
  tone(220, 0.30, "sine", 0.14, 0.35);
}
export function sfxGatherVictory() {
  sample("gather_victory", 0.8, sfxGatherVictorySynth, [0, 40, 60, 80]);
}

function sfxGatherVictorySynth() {
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
  // 六棟副本各有自己的工作聲。缺檔就退回原本的「隨機三種合成變體」——
  // 那個隨機性其實是刻意的（連續採集才不會聽起來像壞掉的迴圈），
  // 所以補檔時建議一棟準備 2~3 個變體檔名（council_mine / council_mine_2 …）由呼叫端輪替。
  const key = COUNCIL_SFX[buildingId] ? buildingId : "mine";
  sample(`council_${key}`, 0.7, () => sfxCouncilWorkSynth(buildingId), [0, 18]);
}

function sfxCouncilWorkSynth(buildingId) {
  const list = COUNCIL_SFX[buildingId] || COUNCIL_SFX.mine;
  const fn   = list[Math.floor(Math.random() * list.length)];
  fn();
  vibrate([0, 18]);
}

// ── 貓貓村 UI 音效 ───────────────────────────────────────────
export function sfxVillageCollect() {
  sample("village_collect", 0.75, sfxVillageCollectSynth, [0, 20, 30]);
}

function sfxVillageCollectSynth() {
  tone(659, 0.08, "triangle", 0.22, 0);
  tone(784, 0.10, "triangle", 0.20, 0.07);
  tone(1046, 0.14, "triangle", 0.18, 0.15);
  noiseBurst(0, 0.04, 1200, 0.14);
  vibrate([0, 20, 30]);
}
export function sfxVillageBuild() {
  sample("village_build", 0.75, sfxVillageBuildSynth, [0, 15, 25]);
}

function sfxVillageBuildSynth() {
  noiseBurst(0, 0.06, 400, 0.28);
  tone(440, 0.10, "sawtooth", 0.16, 0.06);
  tone(554, 0.12, "triangle", 0.18, 0.14);
  vibrate([0, 15, 25]);
}
export function sfxVillageExchange() {
  sample("village_exchange", 0.7, sfxVillageExchangeSynth, [0, 12]);
}

function sfxVillageExchangeSynth() {
  tone(523, 0.06, "triangle", 0.18, 0);
  tone(659, 0.08, "triangle", 0.16, 0.06);
  tone(523, 0.06, "triangle", 0.12, 0.14);
  vibrate([0, 12]);
}

// ── 地下城專用結算與寶藏室音效 ───────────────────────────────
export function sfxDungeonClearResult() {
  sample("MONSboss1", 0.85, sfxVictoryFanfareSynth, [0, 60, 60, 60, 60, 120]);
}

export function sfxDungeonTreasureRoom() {
  sample("monsw1", 0.8, sfxOpenChestSynth, [0, 25, 40, 60]);
}

// ── 冒險者公會戰鬥專用音色 ──────────────────────────────────────
// 刻意不經過 sample()/主線 MP3 映射，避免主線換檔時連帶改變公會戰鬥。
export function sfxGuildTap() {
  tone(720, 0.045, "triangle", 0.09);
}

export function sfxGuildArrowShoot() {
  pluck({ freq: 174, dur: 0.075, gain: 0.13, detune: 18, cut0: 2200, cut1: 480, send: 0.04 });
  air({ dur: 0.11, gain: 0.09, hp: 3200, send: 0.08 });
}

export function sfxGuildArrowHit() {
  impact({ dur: 0.13, cut0: 3600, cut1: 380, gain: 0.22, send: 0.1 });
  sub({ freq: 92, dur: 0.09, gain: 0.2 });
}

export function sfxGuildCritical() {
  impact({ dur: 0.24, cut0: 5600, cut1: 220, gain: 0.34, send: 0.18 });
  sub({ freq: 68, dur: 0.2, gain: 0.42 });
  tone(880, 0.08, "triangle", 0.1, 0.035);
}

export function sfxGuildMonsterDown() {
  punch({ freq: 220, drop: 0.3, dur: 0.22, gain: 0.15, type: "sawtooth", send: 0.14 });
  impact({ dur: 0.24, cut0: 2200, cut1: 160, gain: 0.2, send: 0.16 });
}

export function sfxGuildEnemyAttack() {
  impact({ dur: 0.19, cut0: 1900, cut1: 190, gain: 0.27, send: 0.08 });
  sub({ freq: 62, dur: 0.16, gain: 0.34 });
}

export function sfxGuildCatAssist() {
  notes([[784, 0], [1046.5, 0.055, 0.2]], { gain: 0.09, send: 0.2, spread: true });
  impact({ dur: 0.1, cut0: 2800, cut1: 500, gain: 0.12, delay: 0.035 });
}

export function sfxGuildHazard() {
  air({ dur: 0.12, gain: 0.08, hp: 2600, send: 0.1 });
  tone(260, 0.12, "triangle", 0.11);
}

export function sfxGuildWaveClear() {
  notes([[523.3, 0], [659.3, 0.065], [784, 0.13, 0.26]], { gain: 0.1, send: 0.24 });
}

export function sfxGuildVictory() {
  notes([[392, 0], [523.3, 0.09], [659.3, 0.18], [784, 0.3, 0.55]], { gain: 0.13, send: 0.3, spread: true });
}

export function sfxGuildDefeat() {
  tone(293.7, 0.15, "triangle", 0.13);
  tone(246.9, 0.18, "triangle", 0.13, 0.11);
  tone(196, 0.28, "sine", 0.15, 0.23);
}

export function sfxGuildError() {
  tone(310, 0.1, "triangle", 0.14);
  tone(232, 0.16, "triangle", 0.14, 0.08);
}

// ─────────────────────────────────────────────────────────────────────────────
// 貓貓村大富翁專屬（2026-07-30）。取向：手遊爽度——骰子有重量、走格有上行感、
// 開獎有鋪陳、大獎要炸。全部走 sample() 樣本優先，檔案放 public/sounds/ 即生效：
//   board_dice_roll / board_dice_land / board_step / board_land
//   board_reveal / board_reveal_item / board_jackpot / board_lap
// 沒放檔案就跑下面的合成保底，不會無聲。
// ─────────────────────────────────────────────────────────────────────────────

// 骰子翻滾：連續不規則的木頭撞擊，末段變密（要有「還在滾」的焦慮感）
export function sfxBoardDiceRoll() {
  sample("board_dice_roll", 0.6, sfxBoardDiceRollSynth, [0, 10, 40, 10, 40, 10]);
}
function sfxBoardDiceRollSynth() {
  [0, 0.075, 0.14, 0.195, 0.24, 0.28, 0.315, 0.345].forEach((d, i) => {
    impact({ dur: 0.05, cut0: 4200 - i * 120, cut1: 900, gain: 0.13 + i * 0.008,
      q: 1.1, delay: d, pan: (i % 2 ? 1 : -1) * 0.28, send: 0.1 });
  });
  vibrate([0, 10, 40, 10, 40, 10]);
}

// 骰子定格：一記帶低頻的落定，數字在這一刻出現
export function sfxBoardDiceLand() {
  sample("board_dice_land", 0.8, sfxBoardDiceLandSynth, [0, 45]);
}
function sfxBoardDiceLandSynth() {
  impact({ dur: 0.12, cut0: 5200, cut1: 420, gain: 0.34, q: 0.9, send: 0.18 });
  sub({ freq: 96, dur: 0.2, gain: 0.42 });
  pluck({ freq: 1318, dur: 0.1, gain: 0.1, cut0: 9000, cut1: 3200, delay: 0.03, send: 0.24 });
  vibrate([0, 45]);
}

// 棋子每一步。step 由呼叫端傳入（第幾步／共幾步）→ 音高遞增，走 6 格會有上行感。
// 原本 6 格都用同一顆 sfxTap，聽起來像在按鍵盤而不是在前進。
export function sfxBoardStep(step = 0, total = 1) {
  const ratio = total > 1 ? Math.min(1, step / (total - 1)) : 0;
  // 大三和弦往上疊：C→E→G→C，音階感比線性 freq 好聽
  const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5];
  const freq = scale[Math.min(scale.length - 1, Math.round(ratio * (scale.length - 1)))];
  if (playAudio("board_step", 0.5)) { vibrate(6); return; }
  pluck({ freq, dur: 0.085, gain: 0.11, detune: 8, cut0: 7200, cut1: 1400, send: 0.16 });
  impact({ dur: 0.045, cut0: 2600, cut1: 700, gain: 0.1, q: 1.2, send: 0.08 });
  vibrate(6);
}

// 踩定落點：比單步更重，讓「停在這一格」有實感
export function sfxBoardLand() {
  sample("board_land", 0.75, sfxBoardLandSynth, [0, 18, 30, 18]);
}
function sfxBoardLandSynth() {
  impact({ dur: 0.16, cut0: 4600, cut1: 380, gain: 0.3, q: 0.85, send: 0.2 });
  sub({ freq: 84, dur: 0.22, gain: 0.36 });
  air({ dur: 0.18, gain: 0.06, hp: 5200, delay: 0.04, send: 0.28 });
  vibrate([0, 18, 30, 18]);
}

// 開獎鋪陳：往上的懸念 swell（前置動畫那 0.95 秒）
export function sfxBoardReveal() {
  sample("board_reveal", 0.6, sfxBoardRevealSynth, [0, 12, 60, 12, 60, 20]);
}
function sfxBoardRevealSynth() {
  swell({ up: true, dur: 0.75, gain: 0.15, send: 0.3 });
  [0, 0.18, 0.36, 0.54].forEach((d, i) => {
    pluck({ freq: 659.3 + i * 110, dur: 0.09, gain: 0.07, cut0: 8000, cut1: 2600, delay: d, send: 0.26 });
  });
  vibrate([0, 12, 60, 12, 60, 20]);
}

// 每一項獎勵跳出來。index 遞增音高，連續掉 5 項會有「叮叮叮叮叮」的爽感。
export function sfxBoardRevealItem(index = 0) {
  const scale = [784, 880, 987.8, 1046.5, 1174.7, 1318.5, 1396.9];
  const freq = scale[Math.min(scale.length - 1, Math.max(0, Math.floor(index)))];
  if (playAudio("board_reveal_item", 0.55)) { vibrate(8); return; }
  pluck({ freq, dur: 0.11, gain: 0.12, detune: 6, cut0: 9500, cut1: 3000, send: 0.3 });
  vibrate(8);
}

// 大獎：寶箱抽到 4~5 箱、繞圈、或高階素材。要炸。
export function sfxBoardJackpot() {
  sample("board_jackpot", 0.85, sfxBoardJackpotSynth, [0, 40, 60, 40, 60, 90]);
}
function sfxBoardJackpotSynth() {
  sub({ freq: 110, dur: 0.34, gain: 0.44 });
  impact({ dur: 0.3, cut0: 9000, cut1: 500, gain: 0.3, q: 0.7, send: 0.3 });
  notes([[523.3, 0.02], [659.3, 0.1], [784, 0.18], [1046.5, 0.28, 0.5]], { gain: 0.15, send: 0.34 });
  air({ dur: 0.5, gain: 0.08, hp: 4200, delay: 0.1, send: 0.4 });
  vibrate([0, 40, 60, 40, 60, 90]);
}

// 繞完一圈
export function sfxBoardLap() {
  sample("board_lap", 0.8, sfxBoardLapSynth, [0, 30, 40, 30]);
}
function sfxBoardLapSynth() {
  notes([[392, 0], [523.3, 0.08], [659.3, 0.16], [880, 0.26, 0.42]], { gain: 0.14, send: 0.32 });
  sub({ freq: 98, dur: 0.26, gain: 0.34, delay: 0.02 });
  vibrate([0, 30, 40, 30]);
}

// 格子類型 → 落地音。用現成音效對應語意，不另做檔案；找不到就回 null 由呼叫端退回通用音。
export function sfxBoardTile(tileType) {
  switch (tileType) {
    case "coins":    return sfxCoinDrop();
    case "chest":    return sfxOpenChest();
    case "gacha":    return sfxGachaReveal();
    case "potion":   return sfxPotionDrink();
    case "material": return sfxVillageCollect();
    case "mining":   return sfxCouncilWork();
    case "arrowdew": return sfxVillageExchange();
    case "monster":  return sfxMonsterDead();
    case "start":    return sfxLevelUp();
    default:         return sfxSuccess();
  }
}

// ════════════════════════════════════════════════════════════════
//  世界王討伐（src/worldboss/）專屬音效
//  全部用現代合成器原語疊出來（punch/impact/sub/swell/notes），不加任何音檔。
//  設計原則：**輕重要拉開**——一般命中很輕，破防是全場最重的一個，
//  玩家光靠聽就知道剛剛發生的是大事還是小事。
// ════════════════════════════════════════════════════════════════

// 宣告部位：準星收束。短、乾、帶一點金屬味
export function sfxLockOn() {
  pluck({ freq: 1180, dur: 0.09, gain: 0.13, cut0: 7000, cut1: 2200, send: 0.08 });
  pluck({ freq: 1560, dur: 0.07, gain: 0.09, delay: 0.05, cut0: 8000, cut1: 3000, send: 0.06 });
}

// 王在蓄力：低頻漸強，讓人不安
export function sfxCharge() {
  swell({ up: true, dur: 0.7, gain: 0.13, send: 0.3 });
  sub({ freq: 54, dur: 0.75, gain: 0.32 });
}

// 命中弱點：這是玩家最想聽到的聲音——透、亮、有重量
export function sfxWeakHit() {
  impact({ dur: 0.2, cut0: 9000, cut1: 700, gain: 0.34, send: 0.16 });
  punch({ freq: 520, drop: 0.5, dur: 0.16, gain: 0.3, type: 'triangle', send: 0.14 });
  pluck({ freq: 1760, dur: 0.16, gain: 0.16, delay: 0.02, cut0: 9000, cut1: 2600, send: 0.24 });
  sub({ freq: 74, dur: 0.2, gain: 0.34 });
}

// 擦過：宣告失敗。金屬彈開，刺耳但短——要讓人「嘖」一聲
export function sfxDeflect() {
  pluck({ freq: 2400, dur: 0.08, gain: 0.14, detune: 40, cut0: 9000, cut1: 5000, send: 0.1 });
  pluck({ freq: 3100, dur: 0.06, gain: 0.1, delay: 0.03, cut0: 9000, cut1: 6000, send: 0.14 });
  impact({ dur: 0.1, cut0: 6000, cut1: 2400, gain: 0.12, send: 0.08 });
}

// 破防槽累積：音高隨進度上升，快滿的時候自己會緊張
export function sfxGaugeTick(progress = 0) {
  const p = Math.max(0, Math.min(1, progress));
  pluck({ freq: 620 + p * 780, dur: 0.07, gain: 0.1, cut0: 6000, cut1: 1800, send: 0.12 });
}

// 破防！全場最重的一個
export function sfxBreakthrough() {
  impact({ dur: 0.5, cut0: 11000, cut1: 180, gain: 0.44, send: 0.34 });
  sub({ freq: 46, dur: 0.62, gain: 0.55 });
  punch({ freq: 300, drop: 0.62, dur: 0.34, gain: 0.32, type: 'sawtooth', send: 0.2 });
  notes([[523.25, 0.08, 0.5], [659.25, 0.14, 0.5], [783.99, 0.2, 0.62], [1046.5, 0.26, 0.7]],
        { gain: 0.15, send: 0.4, spread: true });
}

// 打斷成功：蓄力條碎裂。要有「卡」一聲的中斷感
export function sfxInterrupt() {
  impact({ dur: 0.16, cut0: 8000, cut1: 900, gain: 0.32, send: 0.14 });
  punch({ freq: 760, drop: 0.7, dur: 0.12, gain: 0.26, type: 'square', send: 0.1 });
  pluck({ freq: 880, dur: 0.2, gain: 0.13, delay: 0.09, cut0: 7000, cut1: 1500, send: 0.28 });
  sub({ freq: 64, dur: 0.18, gain: 0.3 });
}

// 王的大招：沒斷成的代價
export function sfxBossUlt() {
  distTone(180, 48, 0.75, 0.3);
  impact({ dur: 0.55, cut0: 6000, cut1: 130, gain: 0.4, send: 0.3 });
  sub({ freq: 40, dur: 0.7, gain: 0.5 });
}

// 階段轉換：牠變了
export function sfxPhaseShift() {
  distTone(260, 120, 0.6, 0.24);
  swell({ up: false, dur: 0.5, gain: 0.16, send: 0.34 });
  sub({ freq: 50, dur: 0.5, gain: 0.4 });
}

// 連擊：音高遞增，連越多越爽
export function sfxCombo(count = 1) {
  const step = Math.min(11, Math.max(0, count - 1));
  pluck({ freq: 660 * Math.pow(2, step / 12), dur: 0.1, gain: 0.12, cut0: 7000, cut1: 2200, send: 0.2 });
}

// 王倒下：慢、重、然後放晴
export function sfxWorldBossFall() {
  distTone(200, 34, 1.3, 0.32);
  impact({ dur: 0.9, cut0: 5000, cut1: 90, gain: 0.42, send: 0.4, delay: 0.15 });
  sub({ freq: 38, dur: 1.1, gain: 0.55, delay: 0.1 });
  notes([[392, 0.85, 0.8], [523.25, 0.98, 0.8], [659.25, 1.1, 0.9], [783.99, 1.22, 1.2]],
        { gain: 0.16, send: 0.45, spread: true });
}

// 王的每一段命中：連擊時音高逐段上行，最後一段最重
export function sfxBossHit(index = 0, last = false) {
  const step = Math.min(6, index);
  impact({ dur: last ? 0.34 : 0.18, cut0: 7000, cut1: last ? 140 : 420,
    gain: last ? 0.38 : 0.26, send: 0.18 });
  punch({ freq: 220 + step * 40, drop: 0.5, dur: last ? 0.2 : 0.12,
    gain: last ? 0.3 : 0.2, type: "sawtooth", send: 0.12 });
  if (last) sub({ freq: 44, dur: 0.4, gain: 0.45 });
}

// 平砍的前搖：空氣被劃開
export function sfxBossSwing() {
  swell({ up: false, dur: 0.26, gain: 0.14, send: 0.2 });
}

// log 事件 → 音效。UI 只要照時間軸呼叫這一支，不必自己判斷。
export function sfxRaidEvent(event) {
  if (!event) return;
  switch (event.type) {
    case "intent":       return event.intent?.charging ? sfxCharge() : undefined;
    case "arrow":
      if (event.missed) return sfxSoftFail();
      if (event.grazed || event.blocked) return sfxDeflect();
      if (event.hit) { sfxWeakHit(); if (event.combo >= 3) sfxCombo(event.combo); return; }
      return sfxArrowHit();
    case "volley":
      // 齊射：只放一次音，三聲疊在一起會糊掉
      if (event.hits) { sfxWeakHit(); if (event.combo >= 3) sfxCombo(event.combo); return; }
      return sfxArrowHit();
    case "catVolley":  return sfxWeakHit();
    case "gauge":        return sfxGaugeTick((event.gauge?.gauge || 0) / 30);
    case "breakthrough": return sfxBreakthrough();
    case "interrupt":    return sfxInterrupt();
    case "ultCast":      return sfxBossUlt();
    case "ultHit":       return sfxBossHit(event.index || 0, event.last);
    case "statusApply":  return sfxDebuff();
    case "counterSwing": return sfxBossSwing();
    case "counter":      return sfxCounter();
    case "phaseShift":   return sfxPhaseShift();
    case "bossDown":     return sfxWorldBossFall();
    default:             return undefined;
  }
}
