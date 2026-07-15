import { useEffect, useState } from "react";
import { useCostControl } from "../../hooks/useCostControl";
import { nextRecoveryLevel } from "../../lib/costControl";
import {
  isCostAlertSoundEnabled, observeCostAlertLevel, playCostAlertTone,
  setCostAlertSoundEnabled,
} from "../../lib/costAlertAudio";

const LABELS = { warning:"提醒", protect:"防護", restricted:"限制", emergency:"緊急" };

export default function AdminCostControlBanner() {
  const { policy, recoverTo } = useCostControl();
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(isCostAlertSoundEnabled);

  useEffect(() => {
    const severityRose = observeCostAlertLevel(policy.level);
    if (severityRose && soundEnabled) playCostAlertTone().catch(() => {});
  }, [policy.level, soundEnabled]);

  if (policy.level === "normal") return null;
  const recoveryLevel = nextRecoveryLevel(policy.level);

  async function enableOrTestSound() {
    try {
      await playCostAlertTone();
      setCostAlertSoundEnabled(true);
      setSoundEnabled(true);
    } catch (error) {
      window.alert(error?.message || "瀏覽器無法播放提示音");
    }
  }

  function disableSound() {
    setCostAlertSoundEnabled(false);
    setSoundEnabled(false);
  }

  async function recover() {
    if (!window.confirm(`請先確認 Firestore 用量已穩定且爆量原因已修正。確定逐級恢復至${LABELS[recoveryLevel] || recoveryLevel}模式？`)) return;
    setBusy(true);
    try { await recoverTo(recoveryLevel); }
    catch (error) { window.alert(error?.message || "恢復失敗"); }
    finally { setBusy(false); }
  }

  return (
    <div role="alert" style={{ position:"sticky", top:0, zIndex:100, padding:"10px 14px", background:"#991b1b", color:"white", display:"flex", gap:12, alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 8px #0004" }}>
      <div>
        <strong>Firestore 成本{LABELS[policy.level] || policy.level}模式</strong>
        <span style={{ marginLeft:8, fontSize:12 }}>{policy.observedPercent || 0}% · {policy.reason || "成本門檻已觸發"}</span>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
        <button type="button" onClick={enableOrTestSound} aria-pressed={soundEnabled} style={{ border:"1px solid #fff8", borderRadius:8, padding:"6px 10px", fontWeight:800, cursor:"pointer", background:"transparent", color:"white" }}>
          {soundEnabled ? "測試提示音" : "啟用並測試提示音"}
        </button>
        {soundEnabled && <button type="button" onClick={disableSound} style={{ border:"1px solid #fff8", borderRadius:8, padding:"6px 10px", fontWeight:800, cursor:"pointer", background:"transparent", color:"white" }}>關閉提示音</button>}
        <button type="button" disabled={busy} onClick={recover} style={{ border:0, borderRadius:8, padding:"6px 10px", fontWeight:800, cursor:"pointer" }}>
          {busy ? "處理中…" : `逐級恢復至${LABELS[recoveryLevel] || recoveryLevel}`}
        </button>
      </div>
    </div>
  );
}
