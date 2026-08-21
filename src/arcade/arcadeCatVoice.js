// src/arcade/arcadeCatVoice.js — 九貓專屬喵叫聲（Web Audio 合成）
// 每隻貓有自己的音高/音色，四種情境（追擊/治療/格擋/救援）各有語調。
// 喵叫 ≈ 頻率先升後降的滑音（me-ow）＋ 細微顫音 ＋ 帶通濾波模擬口腔共鳴。
// 尊重全域開關：getSoundEnabled() 靜音、getVibrationEnabled() 關震動。

import { getSoundEnabled, getVibrationEnabled } from "../lib/fxSettings";

let _ctx = null;
function audioCtx() {
  if (typeof window === "undefined") return null;
  if (!getSoundEnabled()) return null;
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

function vibrate(pattern) {
  if (!getVibrationEnabled()) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignore */ }
}

// ── 九貓音色（真實貓咪性格映射到聲音）──────────────────────
const VOICES = {
  daming:   { name: "大娘",   base: 270, char: "deep",   gain: 0.22 }, // 霸氣老大姐：低沉的威嚴
  gege:     { name: "哥哥",   base: 330, char: "warm",   gain: 0.20 }, // 溫柔大哥：溫暖厚實
  meimei:   { name: "妹妹",   base: 540, char: "high",   gain: 0.20 }, // 活潑好動：高亢輕快
  niuniu:   { name: "妞妞",   base: 400, char: "crisp",  gain: 0.21 }, // 嚴格裁判：俐落精準
  haji:     { name: "哈吉",   base: 300, char: "soft",   gain: 0.15 }, // 安靜夢幻：軟綿綿
  baobao:   { name: "寶寶",   base: 620, char: "cute",   gain: 0.21 }, // 黏人小傢伙：奶聲奶氣
  youyou:   { name: "悠悠",   base: 350, char: "lazy",   gain: 0.19 }, // 慢悠悠：拖長音
  xiaoan:   { name: "小安",   base: 470, char: "small",  gain: 0.14 }, // 膽小卻勇敢：細小發抖
  diandian: { name: "顛顛",   base: 240, char: "mystic", gain: 0.20 }, // 神秘莫測：低沉嗡鳴
};

// 性格修飾
const CHAR_MOD = {
  deep:   { base: 0.85, formant: 0.72, dur: 1.1,  vibrato: 0.9, type: "sawtooth" },
  warm:   { base: 1.0,  formant: 1.0,  dur: 1.05, vibrato: 1.0, type: "sawtooth" },
  high:   { base: 1.0,  formant: 1.1,  dur: 0.9,  vibrato: 1.15, type: "sawtooth" },
  crisp:  { base: 1.0,  formant: 1.05, dur: 0.85, vibrato: 1.2, type: "sawtooth" },
  soft:   { base: 0.95, formant: 0.9,  dur: 1.1,  vibrato: 0.8, type: "triangle" },
  cute:   { base: 1.1,  formant: 1.2,  dur: 0.9,  vibrato: 1.25, type: "sawtooth" },
  lazy:   { base: 0.95, formant: 0.95, dur: 1.3,  vibrato: 0.75, type: "triangle" },
  small:  { base: 0.9,  formant: 1.05, dur: 0.85, vibrato: 1.4, type: "sawtooth" },
  mystic: { base: 0.85, formant: 0.7,  dur: 1.2,  vibrato: 0.85, type: "triangle" },
};

// 五種情境語調（攻擊/治療/格擋/救援/弱點命中）
const KINDS = {
  atk:    { count: 2, gap: 0.13, dur: 0.24, rise: 1.55, end: 0.72, vibrato: 9,  vibDepth: 0.05, formant0: 1200, formant1: 1900, gain: 0.24, vib: [0, 25, 35] },
  heal:   { count: 1, gap: 0,    dur: 0.52, rise: 1.15, end: 0.60, vibrato: 6,  vibDepth: 0.03, formant0: 1000, formant1: 1500, gain: 0.15, vib: [0, 20] },
  def:    { count: 1, gap: 0,    dur: 0.30, rise: 1.05, end: 0.52, vibrato: 5,  vibDepth: 0.02, formant0: 700,  formant1: 900,  gain: 0.22, vib: [0, 30, 30, 20] },
  rescue: { count: 1, gap: 0,    dur: 0.40, rise: 1.35, end: 0.78, vibrato: 7,  vibDepth: 0.04, formant0: 1100, formant1: 1700, gain: 0.20, vib: [0, 25, 25, 40] },
  // 弱點圈命中：興奮的連聲喵（更高更亮、上升更陡）——射中圈的爽感
  weak:   { count: 3, gap: 0.11, dur: 0.22, rise: 1.8,  end: 0.95, vibrato: 11, vibDepth: 0.06, formant0: 1400, formant1: 2400, gain: 0.26, vib: [0, 20, 30, 20, 40] },
};

// 單聲喵：頻率先升後降滑音 + 顫音 + 帶通共鳴 + 開頭氣音
function meow(c, { base, dur, rise, end, formant0, formant1, vibrato, vibDepth, gain, type, delay }) {
  const t0 = c.currentTime + (delay || 0);
  const t1 = t0 + dur * 0.45;
  const t2 = t0 + dur;

  const osc = c.createOscillator();
  osc.type = type || "sawtooth";
  osc.frequency.setValueAtTime(base * 0.85, t0);
  osc.frequency.exponentialRampToValueAtTime(base * rise, t1);
  osc.frequency.exponentialRampToValueAtTime(base * end, t2);

  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.value = vibrato;
  lg.gain.value = base * vibDepth;
  lfo.connect(lg);
  lg.connect(osc.frequency);

  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(formant0, t0);
  bp.frequency.exponentialRampToValueAtTime(formant1, t1);
  bp.frequency.exponentialRampToValueAtTime(formant0 * 0.92, t2);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.025);
  g.gain.setValueAtTime(gain, t1);
  g.gain.exponentialRampToValueAtTime(0.0001, t2);

  osc.connect(bp); bp.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t2 + 0.06);
  lfo.start(t0); lfo.stop(t2 + 0.06);

  // 開頭氣音（更真實的「喵」起音）
  const len = Math.max(1, Math.floor(c.sampleRate * 0.05));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const nb = c.createBiquadFilter(); nb.type = "bandpass"; nb.frequency.value = 1800; nb.Q.value = 0.7;
  const ng = c.createGain(); ng.gain.value = gain * 0.28;
  src.connect(nb); nb.connect(ng); ng.connect(c.destination);
  src.start(t0);
}

/**
 * 播放某隻貓的喵叫聲。
 * @param {string} catId 貓咪 id（daming/gege/meimei/niuniu/haji/baobao/youyou/xiaoan/diandian）
 * @param {string} kind atk（追擊）| heal（治療）| def（格擋）| rescue（救援）| weak（弱點圈命中）
 */
export function playCatVoice(catId, kind = "atk") {
  const voice = VOICES[catId] || VOICES.haji;
  const k = KINDS[kind] || KINDS.atk;
  const mod = CHAR_MOD[voice.char] || {};
  const base = Math.round(voice.base * (mod.base || 1));
  const c = audioCtx();
  for (let i = 0; i < (k.count || 1); i++) {
    if (c) {
      meow(c, {
        base,
        dur: k.dur * (mod.dur || 1),
        rise: k.rise,
        end: k.end,
        formant0: k.formant0 * (mod.formant || 1),
        formant1: k.formant1 * (mod.formant || 1),
        vibrato: k.vibrato * (mod.vibrato || 1),
        vibDepth: k.vibDepth,
        gain: (voice.gain || 0.2) * (k.gain || 1),
        type: mod.type || k.type || "sawtooth",
        delay: i * (k.gap || 0),
      });
    }
  }
  vibrate(k.vib);
}

export const CAT_VOICE_IDS = Object.keys(VOICES);
export const CAT_VOICE_KINDS = Object.keys(KINDS);
