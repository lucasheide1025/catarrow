// src/components/member/CouncilHall.jsx — 議會廳入口
import { useState } from "react";
import { COUNCIL_BUILDINGS, GATHER_TIER, TIER_ORDER, COUNCIL_MONSTERS } from "../../lib/councilMonsters";
import GatheringBattle from "./GatheringBattle";
import { completeGatheringSession } from "../../lib/db";

export default function CouncilHall({ profile, village, onBack }) {
  const [activeBld, setActiveBld] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [doneMsg, setDoneMsg]     = useState("");

  async function handleFinish(result) {
    if (!result || (!result.raceMaterials?.length && !result.isFullClear)) {
      setActiveBld(null);
      return;
    }
    setSaving(true);
    try {
      await completeGatheringSession(profile.id, result);
      const mats = result.raceMaterials?.length || 0;
      let msg = `✓ 獲得 ${mats} 個種族素材`;
      if (result.isFullClear) msg += "　🏡 村莊材料 ×3　🪙 扭蛋幣 ×5";
      setDoneMsg(msg);
      setTimeout(() => setDoneMsg(""), 4000);
    } catch(e) {
      console.warn("completeGatheringSession:", e.message);
    }
    setSaving(false);
    setActiveBld(null);
  }

  if (activeBld) {
    return (
      <GatheringBattle
        building={activeBld}
        village={village}
        onFinish={handleFinish}
      />
    );
  }

  return (
    <div style={{
      minHeight: "100%",
      background: "linear-gradient(160deg,#fdf6ec 0%,#fef9f0 100%)",
      padding: "12px 12px 80px",
    }}>
      {/* 標頭 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>
          ←
        </button>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>🏛️ 議會廳</div>
          <div style={{ fontSize: 11, color: "#78716c" }}>採集副本．獲得種族素材</div>
        </div>
      </div>

      {/* 結算提示 */}
      {doneMsg && (
        <div style={{
          background: "#dcfce7", color: "#16a34a", fontWeight: 800,
          borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13,
        }}>
          {doneMsg}
        </div>
      )}

      {/* 說明 */}
      <div style={{
        background: "rgba(255,255,255,0.7)", borderRadius: 12, padding: "10px 14px",
        marginBottom: 16, fontSize: 12, color: "#57534e", lineHeight: 1.8,
      }}>
        <b>怎麼玩？</b><br/>
        每棟建築對應一種種族，各有 6 隻障礙。<br/>
        點「採集」按鈕排除干擾，消耗體力換取素材。<br/>
        全部通關額外獲得村莊材料 × 3 + 扭蛋幣 × 5。
      </div>

      {/* 建築卡 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {COUNCIL_BUILDINGS.map(bld => {
          const monsters = COUNCIL_MONSTERS[bld.id];
          return (
            <button key={bld.id}
              onClick={() => !saving && setActiveBld(bld)}
              disabled={saving}
              style={{
                background: "white", borderRadius: 14, padding: "14px 16px",
                border: "1px solid #e7e5e4", cursor: saving ? "default" : "pointer",
                textAlign: "left", display: "flex", alignItems: "center", gap: 14,
                boxShadow: "0 1px 4px #0000000a",
                opacity: saving ? 0.6 : 1,
              }}>
              {/* emoji */}
              <span style={{ fontSize: 36, lineHeight: 1 }}>{bld.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 2 }}>{bld.name}</div>
                <div style={{ fontSize: 11, color: "#78716c", marginBottom: 6 }}>{bld.raceLabel}素材</div>
                {/* tier dots */}
                <div style={{ display: "flex", gap: 4 }}>
                  {TIER_ORDER.map(t => (
                    <div key={t} style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: GATHER_TIER[t].color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10,
                    }}>
                      {monsters[t].emoji}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 22, color: "#d1d5db" }}>›</div>
            </button>
          );
        })}
      </div>

      {/* 底部提示 */}
      <div style={{ marginTop: 20, fontSize: 11, color: "#a8a29e", textAlign: "center" }}>
        體力 {TIER_ORDER.map(t => `${GATHER_TIER[t].label}-${GATHER_TIER[t].staminaCost}`).join("  ")} 共 {TIER_ORDER.reduce((s,t)=>s+GATHER_TIER[t].staminaCost,0)} 點
      </div>
    </div>
  );
}
