// src/zombie/ZombieGame.jsx
// ═══════════════════════════════════════════════════════════════
//  🧟 殭屍生存 — 完整遊戲循環
//  地圖探索→遭遇戰→戰鬥→結算→下一回合→撤離/勝利
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from "react";
import ZombieHUD, { InfectionOverlay, DamageOverlay, ScreenShake } from "./ui/ZombieHUD";
import ZombieLobby from "./ui/ZombieLobby";
import ZombieResultScreen from "./ui/ZombieResultScreen";
import ZombieMapView from "./ui/ZombieMapView";
import ZombieBattleArena from "./ui/ZombieBattleArena";
import { COLORS } from "./ui/theme";
import { playZombieSound, initZombieAudio } from "./domain/zombieSound";
import { ZOMBIE_ANIMATIONS } from "./style/zombieAnimations";
import {
  GAME_PHASE,
  createInitialGameState,
  transitionPhase,
  getPhaseIcon,
  getPhaseLabel,
} from "./domain/gameStateMachine";
import { createParty } from "./domain/partyEngine";

const CSS_KEYFRAMES = ZOMBIE_ANIMATIONS;

export default function ZombieGame() {
  const [gameState, setGameState] = useState(() => createInitialGameState());
  const [party, setParty] = useState(null);
  const [localPlayerId] = useState(`player_${Date.now()}`);
  const [localPlayerName] = useState("倖存者");
  const [damageIntensity, setDamageIntensity] = useState(0);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [combatResult, setCombatResult] = useState(null);
  const [encounterZone, setEncounterZone] = useState(null);

  const phase = gameState.phase;

  // ── 開始遊戲 ───────────────────────────────────────────
  const handleStartGame = useCallback(({ party: inputParty, zone, difficulty, solo }) => {
    const gameParty = inputParty || createParty(localPlayerId, localPlayerName);
    setParty(gameParty);
    setCombatResult(null);
    setEncounterZone(null);
    setGameState({
      ...createInitialGameState(),
      phase: GAME_PHASE.EXPLORATION,
      zone,
      difficulty,
      round: 1,
      startedAt: Date.now(),
      resources: {
        food: difficulty === "easy" ? 50 : difficulty === "hard" ? 15 : 30,
        water: difficulty === "easy" ? 50 : difficulty === "hard" ? 15 : 30,
        arrows: difficulty === "easy" ? 35 : difficulty === "hard" ? 10 : 20,
        specialArrows: [],
      },
      events: [{ type: "mission_start", text: `任務開始！區域：${zone}，難度：${difficulty}`, time: Date.now() }],
    });
  }, [localPlayerId, localPlayerName]);

  // ── 從地圖觸發戰鬥 ────────────────────────────────────
  const handleTriggerBattle = useCallback((zoneType) => {
    const zt = zoneType || "normal";
    setEncounterZone(zt);
    setCombatResult(null);
    playZombieSound("explore:combat_trigger");
    setGameState(prev => transitionPhase(prev, GAME_PHASE.COMBAT, {
      events: [...prev.events, { type: "encounter", text: `⚔️ 遭遇！區域：${zt}`, time: Date.now() }],
    }).state);
  }, []);

  // ── 戰鬥結束回呼 ──────────────────────────────────────
  const handleCombatEnd = useCallback((result) => {
    setCombatResult(result);
    setGameState(prev => transitionPhase(prev, GAME_PHASE.RESULT, {
      resources: {
        ...prev.resources,
        arrows: Math.max(0, (prev.resources?.arrows || 0) - (result?.arrowsUsed || 0)),
      },
      events: [...prev.events, { type: "combat_end", text: `🏁 戰鬥結束！擊殺 ${result?.kills || 0} 隻`, time: Date.now() }],
    }).state);
    setDamageIntensity(0);
  }, []);

  // ── 行動處理 ───────────────────────────────────────────
  const handleAction = useCallback((actionId) => {
    switch (actionId) {
      case "fight":
        setGameState(prev => transitionPhase(prev, GAME_PHASE.COMBAT).state);
        break;
      case "continue":
        setGameState(prev => transitionPhase(prev, GAME_PHASE.EXPLORATION, {
          round: (prev.round || 0) + 1,
          events: [...prev.events, { type: "continue", text: "➡️ 繼續探索", time: Date.now() }],
        }).state);
        setEncounterZone(null);
        setCombatResult(null);
        break;
      case "extract":
      case "extract_now":
        setGameState(prev => transitionPhase(prev, GAME_PHASE.EXTRACTION).state);
        playZombieSound("system:complete");
        setTimeout(() => {
          setGameState(prev => transitionPhase(prev, GAME_PHASE.VICTORY).state);
          playZombieSound("result:victory");
        }, 2000);
        break;
      default:
        break;
    }
  }, []);

  // ── 返回大廳 ───────────────────────────────────────────
  const handleReturnToLobby = useCallback(() => {
    setGameState(createInitialGameState());
    setParty(null);
    setCombatResult(null);
    setEncounterZone(null);
    setDamageIntensity(0);
    setShakeIntensity(0);
  }, []);

  // ── 渲染內容 ───────────────────────────────────────────
  const renderContent = useMemo(() => {
    switch (phase) {
      case GAME_PHASE.LOBBY:
        return <ZombieLobby onStartGame={handleStartGame} localPlayerId={localPlayerId} localPlayerName={localPlayerName} />;

      case GAME_PHASE.VICTORY:
      case GAME_PHASE.DEFEAT:
        return <ZombieResultScreen result={{ type: phase }} gameState={gameState} party={party} onReturnToLobby={handleReturnToLobby} />;

      case GAME_PHASE.EXPLORATION:
        return (
          <div style={GAME_VIEW}>
            <ZombieMapView
              onTriggerBattle={handleTriggerBattle}
              onLogEvent={(ev) => { setGameState(prev => ({ ...prev, events: [...prev.events, ev] })); }}
            />
          </div>
        );

      case GAME_PHASE.ENCOUNTER:
        return (
          <div style={GAME_VIEW}>
            <ZombieBattleArena
              zoneType={encounterZone}
              onCombatEnd={handleCombatEnd}
            />
          </div>
        );

      case GAME_PHASE.COMBAT:
        return (
          <div style={GAME_VIEW}>
            <ZombieBattleArena
              zoneType={encounterZone}
              onCombatEnd={handleCombatEnd}
              autoStart
            />
            <div style={{
              position: "absolute", bottom: 12, right: 12,
              padding: "4px 10px", borderRadius: 8,
              background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
              fontSize: 9, fontWeight: 700, color: COLORS.accent,
              animation: "za-pulse-glow 0.8s ease infinite",
            }}>
              🎯 戰鬥模式
            </div>
          </div>
        );

      case GAME_PHASE.RESULT:
        return (
          <div style={GAME_VIEW}>
            <div style={{
              textAlign: "center", padding: 32,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", maxWidth: 400,
              animation: "za-scale-in 0.35s ease-out",
            }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📊</div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: "0 0 4px" }}>戰鬥結算</h3>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, margin: "12px 0 16px" }}>
                <div><div style={{ fontSize: 24, fontWeight: 900, color: COLORS.green }}>{combatResult?.kills || 0}</div><div style={{ fontSize: 9, color: COLORS.textDim }}>擊殺</div></div>
                <div><div style={{ fontSize: 24, fontWeight: 900, color: COLORS.blue }}>{combatResult?.rounds || 1}</div><div style={{ fontSize: 9, color: COLORS.textDim }}>回合</div></div>
                <div><div style={{ fontSize: 24, fontWeight: 900, color: COLORS.amber }}>{combatResult?.arrowsUsed || 0}</div><div style={{ fontSize: 9, color: COLORS.textDim }}>箭矢</div></div>
              </div>
              <p style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 16, lineHeight: 1.5 }}>
                回合 R{gameState.round} 完成<br/>
                {combatResult?.survivors !== false ? "✅ 全員存活" : "⚠️ 有人陣亡"}
              </p>
              <button onClick={() => handleAction("continue")}
                style={{
                  padding: "10px 28px", borderRadius: 10,
                  background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                  border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", letterSpacing: 1,
                }}>
                ➡️ 繼續探索
              </button>
            </div>
          </div>
        );

      case GAME_PHASE.EXTRACTION:
        return (
          <div style={GAME_VIEW}>
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 64, marginBottom: 16, animation: "za-float 2s ease-in-out infinite" }}>🚁</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: COLORS.green, margin: "0 0 8px", letterSpacing: 2 }}>
                撤離中⋯
              </h2>
              <p style={{ fontSize: 12, color: COLORS.textDim }}>
                直升機正在接近撤離點
              </p>
            </div>
          </div>
        );

      default:
        return <div style={GAME_VIEW}><div style={{ fontSize: 32, fontWeight: 900, color: COLORS.textMuted, textAlign: "center" }}>{getPhaseIcon(phase)} {getPhaseLabel(phase)}</div></div>;
    }
  }, [phase, gameState, party, handleStartGame, handleReturnToLobby,
      localPlayerId, localPlayerName, handleTriggerBattle, encounterZone, combatResult, handleCombatEnd]);

  const worstInfection = useMemo(() => {
    if (!party?.members) return { progress: 0, fullyInfected: false };
    return party.members.reduce((worst, m) => {
      const p = m.infectionProgress || 0;
      return p > worst.progress ? { progress: p, fullyInfected: m.isFullyInfected } : worst;
    }, { progress: 0, fullyInfected: false });
  }, [party]);

  const isFullScreen = phase === GAME_PHASE.LOBBY || phase === GAME_PHASE.VICTORY || phase === GAME_PHASE.DEFEAT;

  if (isFullScreen) {
    return <ZombieErrorBoundary><style>{CSS_KEYFRAMES}</style>{renderContent}</ZombieErrorBoundary>;
  }

  return (
    <ZombieErrorBoundary>
      <style>{CSS_KEYFRAMES}</style>
      <ZombieHUD gameState={gameState} party={party} onAction={handleAction}>
        <InfectionOverlay progress={worstInfection.progress} isFullyInfected={worstInfection.fullyInfected} />
        <DamageOverlay intensity={damageIntensity} />
        {renderContent}
      </ZombieHUD>
    </ZombieErrorBoundary>
  );
}

// ── Error Boundary ────────────────────────────────────────────
class ZombieErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[ZombieErrorBoundary]", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:40,textAlign:"center",background:"#1e1e2e",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#fff"}}>
          <div style={{fontSize:48,marginBottom:16}}>💥</div>
          <h2 style={{color:"#ef4444",fontSize:18,fontWeight:700,margin:"0 0 8px"}}>Zombie Mode Crashed</h2>
          <p style={{color:"#94a3b8",fontSize:11,maxWidth:360,marginBottom:16}}>{this.state.error?.message || "Unknown error"}</p>
          <button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload();}}
            style={{padding:"8px 20px",borderRadius:8,background:"linear-gradient(135deg,#7c3aed,#2563eb)",border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GAME_VIEW = {
  width: "100%", height: "100%",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "20px 20px", overflow: "auto",
  zIndex: 1, position: "relative",
};
