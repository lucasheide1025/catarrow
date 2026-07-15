import { COST_CONTROL_LEVELS } from "./costControl";

// Version persisted state so future severity/schema changes cannot reuse a
// stale observation and accidentally suppress or trigger an alert.
const STORAGE_VERSION = "v1";
const ENABLED_KEY = `costControl:${STORAGE_VERSION}:alertSoundEnabled`;
const OBSERVED_LEVEL_KEY = `costControl:${STORAGE_VERSION}:lastObservedAlertLevel`;
let audioContext;

function browserStorage() {
  try { return window.localStorage; }
  catch { return null; }
}

export function isCostAlertSoundEnabled(storage = browserStorage()) {
  if (!storage) return false;
  try { return storage.getItem(ENABLED_KEY) === "true"; }
  catch { return false; }
}

export function setCostAlertSoundEnabled(enabled, storage = browserStorage()) {
  if (!storage) return;
  try { storage.setItem(ENABLED_KEY, enabled ? "true" : "false"); }
  catch {}
}

// Record every level, including recovery. This makes a later escalation audible
// while initial/duplicate snapshots and ordinary re-renders stay silent.
export function observeCostAlertLevel(level, storage = browserStorage()) {
  const nextSeverity = COST_CONTROL_LEVELS[level];
  if (nextSeverity === undefined || !storage) return false;

  try {
    const previousLevel = storage.getItem(OBSERVED_LEVEL_KEY);
    storage.setItem(OBSERVED_LEVEL_KEY, level);
    if (previousLevel === null) return false;
    return nextSeverity > (COST_CONTROL_LEVELS[previousLevel] ?? 0);
  } catch {
    return false;
  }
}

export async function playCostAlertTone() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error("這個瀏覽器不支援提示音");

  // Reuse the context unlocked by the administrator's test click. Creating a
  // fresh context for a later automatic alert is commonly blocked as autoplay.
  const context = audioContext || new AudioContext();
  audioContext = context;
  await context.resume();
  const start = context.currentTime;

  [0, 0.22, 0.44].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = index === 2 ? 1046 : 880;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    }, { once: true });
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.17);
  });
}
