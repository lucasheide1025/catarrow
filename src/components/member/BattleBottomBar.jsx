// src/components/member/BattleBottomBar.jsx
// 戰鬥底部 Tab 列：計分 / 藥水 / 隊友 三切換

import { BattleScoreButtons } from "../shared/SharedBattleComponents";
import { setBattleInputMode } from "../shared/TargetFaceOverlay";
import { CARRY_POTIONS, THROW_POTIONS } from "../../lib/itemData";

function TabButton({ active, disabled, onClick, children }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      flex: "1 1 0", padding: "5px 0", borderRadius: 6, border: "none",
      fontSize: 11, fontWeight: 900, cursor: disabled ? "default" : "pointer",
      background: active ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
      color: active ? "#a5b4fc" : disabled ? "#475569" : "rgba(255,255,255,0.55)",
      transition: "all .15s",
    }}>{children}</button>
  );
}

function SubTabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "4px 0", borderRadius: 5, border: "none",
      fontSize: 10, fontWeight: 900, cursor: "pointer",
      background: active ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.05)",
      color: active ? "#c4b5fd" : "rgba(255,255,255,0.45)",
    }}>{children}</button>
  );
}

function PotionGroupRow({ icon, label, potions, potionInv, potionUsedThisRound, onClick }) {
  if (potions.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "4px 6px", marginBottom: 3 }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#cbd5e1", minWidth: 42 }}>{label}</span>
      <div style={{ display: "flex", gap: 2, flex: 1 }}>
        {potions.map(lv => {
          const lvCount = potionInv[lv.id] || 0;
          const disabled = lvCount <= 0 || potionUsedThisRound;
          return (
            <button key={lv.id} onClick={() => disabled ? undefined : onClick(lv)}
              disabled={disabled}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 5, border: "none",
                fontSize: 10, fontWeight: 900, cursor: disabled ? "default" : "pointer",
                background: !disabled ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.04)",
                color: !disabled ? "#fbbf24" : "#475569",
                opacity: !disabled ? 1 : 0.4,
              }}>
              Lv{lv.id.slice(-1)}x{lvCount}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 根據靶面格式決定計分按鈕標籤
// full_110（全靶，預設）：X 10 9 8 7 6 5 4 3 2 1 M
// half_610（半靶）     ：X 10 9 8 7 6 M
// field_16（原野射箭） ：6 5 4 3 2 1 M
function getLabelsForFmt(targetFmt) {
  if (targetFmt === "half_610") return ["X","10","9","8","7","6","M"];
  if (targetFmt === "field_16") return ["6","5","4","3","2","1","M"];
  return ["X","10","9","8","7","6","5","4","3","2","1","M"]; // full_110 or default
}

function ScoreTabContent({
  scoringModeChosen,
  setScoringModeChosen,
  targetMode,
  setTargetMode,
  arrows,
  onArrow,
  targetFmt,
  arrowsPerRound = 6,
  showModeChooser = true,
}) {
  if (showModeChooser && !scoringModeChosen) {
    return (
      <div style={{ padding: "3px 0" }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 700, marginBottom: 5, letterSpacing: 1 }}>
          選擇計分方式
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={()=>{ setScoringModeChosen(true); setTargetMode(false); setBattleInputMode("button"); }}
            style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1.5px solid rgba(255,255,255,0.15)",
              background:"rgba(255,255,255,0.06)", color:"#e2e8f0", fontSize:12, fontWeight:700,
              cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span style={{fontSize:18}}>🎯</span><span>分數按鈕</span>
            <span style={{fontSize:9, color:"#94a3b8", fontWeight:500}}>點擊輸入 X/10/9/...</span>
          </button>
          <button onClick={()=>{ setScoringModeChosen(true); setTargetMode(true); setBattleInputMode("target"); }}
            style={{ flex:1, padding:"8px 0", borderRadius:8, border:"1.5px solid rgba(255,255,255,0.15)",
              background:"rgba(255,255,255,0.06)", color:"#e2e8f0", fontSize:12, fontWeight:700,
              cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <span style={{fontSize:18}}>🖼️</span><span>靶面點擊</span>
            <span style={{fontSize:9, color:"#94a3b8", fontWeight:500}}>直接點靶面位置</span>
          </button>
        </div>
      </div>
    );
  }
  if (!targetMode && arrows.length < arrowsPerRound) {
    return (
      <BattleScoreButtons
        labels={getLabelsForFmt(targetFmt)}
        onScore={onArrow}
        disabled={false}
        variant="image"
        btnSize="md"
      />
    );
  }
  if (!targetMode && arrows.length >= arrowsPerRound) {
    return <div style={{textAlign:"center", fontSize:11, color:"#4ade80", fontWeight:700, padding:"12px 0"}}>{arrowsPerRound} 箭已滿，按送出！</div>;
  }
  return null;
}

function PotionTabContent({ potionSubTab, setPotionSubTab, potionInv, potionUsedThisRound, arrows, onCarryPotion, onThrowPotion }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        <SubTabButton active={potionSubTab === "carry"} onClick={() => setPotionSubTab("carry")}>攜帶型</SubTabButton>
        <SubTabButton active={potionSubTab === "throw"} onClick={() => setPotionSubTab("throw")}>投擲</SubTabButton>
      </div>
      {potionSubTab === "carry" && (
        <div>
          <PotionGroupRow icon="❤️" label="HP恢復" potions={CARRY_POTIONS.filter(p=>p.id.startsWith("hp_"))} potionInv={potionInv} potionUsedThisRound={potionUsedThisRound} onClick={onCarryPotion} />
          <PotionGroupRow icon="⚔️" label="ATK提升" potions={CARRY_POTIONS.filter(p=>p.id.startsWith("atk_"))} potionInv={potionInv} potionUsedThisRound={potionUsedThisRound} onClick={onCarryPotion} />
          <PotionGroupRow icon="🛡️" label="DEF提升" potions={CARRY_POTIONS.filter(p=>p.id.startsWith("def_"))} potionInv={potionInv} potionUsedThisRound={potionUsedThisRound} onClick={onCarryPotion} />
          <div style={{fontSize:9, color:"#475569", textAlign:"center", marginTop:4}}>每回合選一種，喝了自動跳回計分</div>
        </div>
      )}
      {potionSubTab === "throw" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
          {THROW_POTIONS.map(p => {
            const count = potionInv[p.id] || 0;
            const disabled = count <= 0 || potionUsedThisRound || arrows.length >= 6;
            return (
              <button key={p.id} onClick={() => disabled ? undefined : onThrowPotion(p)} disabled={disabled}
                style={{ padding:"5px 2px", borderRadius:6, border:"none", display:"flex", flexDirection:"column", alignItems:"center", gap:1,
                  fontSize:9, fontWeight:700, cursor:disabled?"default":"pointer",
                  background: (count>0&&!potionUsedThisRound&&arrows.length<6) ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                  color: (count>0&&!potionUsedThisRound&&arrows.length<6) ? "#fca5a5" : "#475569", opacity: disabled ? 0.35 : 1 }}>
                <span style={{fontSize:16}}>{p.icon}</span>
                <span>{p.name}</span>
                <span style={{fontSize:8, color:"rgba(255,255,255,0.3)"}}>x{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BattleBottomBar({
  bottomTab, setBottomTab,
  potionSubTab, setPotionSubTab,
  potionUsedThisRound,
  scoringModeChosen, setScoringModeChosen,
  targetMode, setTargetMode,
  arrows, onArrow,
  potionInv, onCarryPotion, onThrowPotion,
  targetFmt,        // 靶面格式（"full_110"/"half_610"/"field_16"），控制計分按鈕
  arrowsPerRound,   // 每回合箭數（黨模式可能非預設 6）
  controlsLocked = false,
  onStartScoring,
  showModeChooser = true,
}) {
  if (controlsLocked) {
    return (
      <div style={{ background:"rgba(0,0,0,0.55)", borderRadius:8, padding:"8px 8px", marginBottom:4 }}>
        <button
          onClick={onStartScoring}
          style={{
            width:"100%", padding:"12px 0", borderRadius:10, border:"none",
            fontSize:14, fontWeight:900, cursor:"pointer",
            background:"linear-gradient(90deg,#f59e0b,#ef4444)",
            color:"white",
          }}>
          開始計分
        </button>
        <div style={{ marginTop:6, textAlign:"center", fontSize:10, color:"rgba(255,255,255,0.35)" }}>
          點一下後再進入「計分｜藥水｜隊友」
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:"rgba(0,0,0,0.55)", borderRadius:8, padding:"5px 5px", marginBottom:4 }}>
      <div style={{ display: "flex", gap: 2, marginBottom: 5 }}>
        <TabButton active={bottomTab === "score"} onClick={() => setBottomTab("score")}>📌 計分</TabButton>
        <TabButton active={bottomTab === "potion"} disabled={potionUsedThisRound} onClick={() => !potionUsedThisRound && setBottomTab("potion")}>🧪 藥水</TabButton>
        <TabButton active={bottomTab === "party"} onClick={() => setBottomTab("party")}>👥 隊友</TabButton>
      </div>
      {bottomTab === "score" && (
        <ScoreTabContent
          scoringModeChosen={scoringModeChosen} setScoringModeChosen={setScoringModeChosen}
          targetMode={targetMode} setTargetMode={setTargetMode}
          arrows={arrows} onArrow={onArrow}
          targetFmt={targetFmt}
          arrowsPerRound={arrowsPerRound}
          showModeChooser={showModeChooser}
        />
      )}
      {bottomTab === "potion" && (
        <PotionTabContent
          potionSubTab={potionSubTab} setPotionSubTab={setPotionSubTab}
          potionInv={potionInv} potionUsedThisRound={potionUsedThisRound}
          arrows={arrows}
          onCarryPotion={onCarryPotion}
          onThrowPotion={onThrowPotion}
        />
      )}
      {bottomTab === "party" && (
        <div style={{ padding: "10px 0", textAlign: "center", fontSize: 11, color: "#64748b" }}>
          隊友狀態（僅組隊/地城模式顯示）
        </div>
      )}
    </div>
  );
}
