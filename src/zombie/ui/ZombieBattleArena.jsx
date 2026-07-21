// src/zombie/ui/ZombieBattleArena.jsx
// ═══════════════════════════════════════════════════════════════
//  ⚔️ 殭屍生存 — 沉浸式戰鬥競技場
//  暗色主題 · 回合流程 · 命中動畫 · 殭屍狀態條
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ZombieTargetSVG } from "../target";
import { createEncounterState, processRound } from "../domain/encounterResolver";
import { ZONE_TYPE } from "../domain/types";
import ZombieArrowSelector from "./ZombieArrowSelector";
import { ZombieArmorPanel, ZombieMedicalPanel, ZombieAccessoryPanel } from "./ZombieInventoryPanel";
import { COLORS, SHADOWS, RADIUS, FONT } from "./theme";

// ── Theme Tokens ─────────────────────────────────────────
const THEME = {
  glow: {
    green: `0 0 16px ${COLORS.green}44, 0 0 32px ${COLORS.green}22`,
    red: `0 0 16px rgba(239,68,68,0.3), 0 0 32px rgba(239,68,68,0.1)`,
    amber: `0 0 12px rgba(245,158,11,0.3)`,
    blue: `0 0 12px ${COLORS.blue}33`,
  },
};

// ── Archetype 資料（內含 ComfyUI 生成圖路徑） ────────────
const ARCH_DATA = {
  normal:  { icon:"🧟", img:"/assets/zombie/zombie_normal.webp",  color:"#6b7280", label:"普通殭屍" },
  fast:    { icon:"💨", img:"/assets/zombie/zombie_fast.webp",    color:"#8b5cf6", label:"疾行殭屍" },
  armored: { icon:"🛡️", img:"/assets/zombie/zombie_armored.webp", color:"#f59e0b", label:"重裝殭屍" },
  ranged:  { icon:"🎯", img:"/assets/zombie/zombie_ranged.webp",  color:"#ef4444", label:"遠程殭屍" },
};

const ZONE_LABELS = {
  [ZONE_TYPE.SAFE]:       { icon:"🟢", label:"安全區" },
  [ZONE_TYPE.NORMAL]:     { icon:"🟡", label:"普通區" },
  [ZONE_TYPE.DANGER]:     { icon:"🟠", label:"危險區" },
  [ZONE_TYPE.HIGH_RISK]:  { icon:"🔴", label:"高危區" },
  [ZONE_TYPE.RESTRICTED]: { icon:"⚫", label:"禁區" },
};

// ═════════════════════════════════════════════════════════
//  主元件
// ═════════════════════════════════════════════════════════

export default function ZombieBattleArena({ zoneType: externalZoneType, onCombatEnd, autoStart }) {
  // ── 核心狀態 ────────────────────────────────────────────
  const [encounter, setEncounter] = useState(null);
  const [round, setRound] = useState(0);
  const [focusedZombieId, setFocusedZombieId] = useState(null); // 目前放大顯示的殭屍
  const [arrowHits, setArrowHits] = useState({});
  const [phase, setPhase] = useState("idle");
  const [currentArrows, setCurrentArrows] = useState(0);
  const [totalArrowsUsed, setTotalArrowsUsed] = useState(0);
  const [log, setLog] = useState([]);
  const [roundEvents, setRoundEvents] = useState([]);
  const [zoneType, setZoneType] = useState(externalZoneType || ZONE_TYPE.NORMAL);
  const [selectedArrow, setSelectedArrow] = useState("normal");
  const [specialAmmo, setSpecialAmmo] = useState({});
  const [armor, setArmor] = useState({});
  const [accessories, setAccessories] = useState([]);
  const [accessoryUses, setAccessoryUses] = useState({});
  const [showInventory, setShowInventory] = useState(false);
  const [hitFlash, setHitFlash] = useState(null);
  const [roundTransition, setRoundTransition] = useState(false);

  const isIntegrated = !!onCombatEnd;
  const maxArrows = 3;
  const containerRef = useRef(null);

  // ── 殭屍列表 ────────────────────────────────────────────
  const zombieList = useMemo(() => {
    if (!encounter) return [];
    return Object.values(encounter.zombies).map(z => ({
      ...z,
      icon: ARCH_DATA[z.archetypeId]?.icon || "🧟",
      name: ARCH_DATA[z.archetypeId]?.label || z.archetypeId,
      color: ARCH_DATA[z.archetypeId]?.color || COLORS.zombieNormal,
      alive: z.alive !== false,
    }));
  }, [encounter]);

  const focusedZombie = zombieList.find(z => z.id === focusedZombieId);
  const survivorState = encounter?.survivors?.player_1 || null;
  const aliveZombies = zombieList.filter(z => z.alive);
  const totalZombies = Object.keys(encounter?.zombies || {}).length;
  const killedCount = totalZombies - aliveZombies.length;

  // ── 開始戰鬥 ────────────────────────────────────────────
  const handleStartEncounter = useCallback(() => {
    const state = createEncounterState(zoneType, ["player_1"], {
      startDistanceMin: 8, startDistanceMax: 15,
    });
    setEncounter(state);
    setRound(0);
    setArrowHits({});
    setFocusedZombieId(null);
    setPhase("aiming");
    setCurrentArrows(0);
    setTotalArrowsUsed(0);
    setSelectedArrow("normal");
    setRoundEvents([]);
    const ammo = {};
    ["arrow_threshold","arrow_knockback","arrow_penetration","arrow_explosive","arrow_silent"].forEach(id => { ammo[id] = 3; });
    setSpecialAmmo(ammo);
    setLog([{ type:"battle_start", text:`⚔️ 戰鬥開始！遭遇 ${state.zombies ? Object.keys(state.zombies).length : 0} 隻殭屍`, time:Date.now() }]);
  }, [zoneType]);

  // ── 點擊殭屍卡片 → 放大顯示 ────────────────────────────
  const handleFocusZombie = useCallback((zombieId) => {
    if (phase !== "aiming") return;
    setFocusedZombieId(zombieId);
  }, [phase]);

  // ── 縮回卡片列表 ───────────────────────────────────────
  const handleUnfocusZombie = useCallback(() => {
    setFocusedZombieId(null);
  }, []);

  // ── 命中 ────────────────────────────────────────────────
  const handleHit = useCallback((slot, zombieId, part) => {
    if (phase !== "aiming" || currentArrows >= maxArrows) return;

    setHitFlash({ zombieId, part, time: Date.now() });
    setTimeout(() => setHitFlash(null), 200);

    if (part === "miss") {
      setCurrentArrows(a => a + 1);
      const prefix = selectedArrow !== "normal" ? "（特殊箭浪費）" : "";
      setLog(l => [...l, { type:"miss", text:`✗ 脫靶${prefix}`, time:Date.now() }]);
      return;
    }

    setArrowHits(prev => {
      const next = { ...prev };
      if (!next[zombieId]) next[zombieId] = {};
      next[zombieId] = { ...next[zombieId], [part]: (next[zombieId][part] || 0) + 1 };
      return next;
    });

    if (selectedArrow !== "normal") {
      setSpecialAmmo(prev => ({ ...prev, [selectedArrow]: Math.max(0, (prev[selectedArrow] || 0) - 1) }));
    }

    setCurrentArrows(a => a + 1);
    const arrowName = { arrow_threshold:"貫穿", arrow_knockback:"擊退", arrow_penetration:"穿透", arrow_explosive:"爆炸", arrow_silent:"靜音" }[selectedArrow] || "";
    const prefix = selectedArrow !== "normal" ? `[${arrowName}] ` : "";
    setLog(l => [...l, { type:"hit", text:`🏹 ${prefix}${getPartLabel(part)}命中！`, time:Date.now() }]);
  }, [phase, currentArrows, selectedArrow]);

  // ── 結算回合 ────────────────────────────────────────────
  const handleResolveRound = useCallback(() => {
    if (!encounter) return;

    setPhase("resolving");

    // 構建 submissions（從 arrowHits 收集，不再需要 selectedSlot）
    const allHits = [];
    for (const [zId, parts] of Object.entries(arrowHits)) {
      for (const [part, count] of Object.entries(parts)) {
        for (let j = 0; j < count; j++) {
          const zombie = Object.values(encounter.zombies).find(z => z.id === zId);
          allHits.push({ targetSlot: zombie?.targetSlot || "A" });
        }
      }
    }
    const missCount = Math.max(0, currentArrows - allHits.length);
    const submissions = { player_1: [] };
    for (let i = 0; i < allHits.length; i++) {
      submissions.player_1.push({ targetSlot: allHits[i].targetSlot, isMiss: false, arrowType: selectedArrow });
    }
    for (let i = 0; i < missCount; i++) {
      // 使用第一隻 alive 殭屍的 slot 作為 miss slot
      const firstAlive = Object.values(encounter.zombies).find(z => z.alive);
      submissions.player_1.push({ targetSlot: firstAlive?.targetSlot || "A", isMiss: true, arrowType: selectedArrow });
    }

    setTotalArrowsUsed(prev => prev + currentArrows);

    // 執行結算
    const result = processRound(encounter, submissions, { randomize: true });
    setEncounter(result.nextState);
    setRound(result.nextState.round);

    // 收集本回合事件
    const newEvents = result.events.map(e => ({ type: e.type, text: formatEventText(e), time: Date.now() }));
    setRoundEvents(newEvents);
    setLog(l => [...l, ...newEvents]);

    // 命中動畫延遲後進入 round_result
    setTimeout(() => {
      setPhase("round_result");
      setRoundTransition(true);
      setFocusedZombieId(null);
      setArrowHits({});
      setCurrentArrows(0);
    }, 400);
  }, [encounter, arrowHits, currentArrows, selectedArrow]);

  // ── 下一回合 ────────────────────────────────────────────
  const handleNextRound = useCallback(() => {
    if (encounter) {
      const allDead = Object.values(encounter.zombies).every(z => !z.alive);
      if (allDead) {
        setPhase("complete");
        return;
      }
    }
    setRoundTransition(false);
    setRoundEvents([]);
    setFocusedZombieId(null);
    setPhase("aiming");
    setSelectedArrow("normal");
  }, [encounter]);

  // ── 撤離（從戰鬥中直接撤離） ────────────────────────────
  const handleRetreat = useCallback(() => {
    setPhase("complete");
    setLog(l => [...l, { type:"system", text:"🏃 撤離戰鬥區域…", time:Date.now() }]);
  }, []);

  // ── 外部 zoneType 同步 ───────────────────────────────────
  useEffect(() => {
    if (externalZoneType) setZoneType(externalZoneType);
  }, [externalZoneType]);

  // ── 自動開始 ────────────────────────────────────────────
  useEffect(() => {
    if (autoStart && phase === "idle" && !encounter) {
      handleStartEncounter();
    }
  }, [autoStart, phase, encounter, handleStartEncounter]);

  // ── 戰鬥結束回呼 ────────────────────────────────────────
  const prevCompleteRef = useRef(false);
  useEffect(() => {
    if (phase === "complete" && !prevCompleteRef.current && onCombatEnd && encounter) {
      prevCompleteRef.current = true;
      onCombatEnd({
        kills: killedCount,
        totalZombies,
        arrowsUsed: totalArrowsUsed,
        rounds: round,
        victory: killedCount === totalZombies,
        survivors: Object.values(encounter.survivors || {}).filter(s => s.alive).length > 0,
      });
    }
    if (phase !== "complete") prevCompleteRef.current = false;
  }, [phase, onCombatEnd, encounter, killedCount, totalZombies, totalArrowsUsed, round]);

  const handleReset = useCallback(() => {
    setEncounter(null); setPhase("idle"); setArrowHits({}); setFocusedZombieId(null);
    setCurrentArrows(0); setTotalArrowsUsed(0); setRound(0); setLog([]);
    setRoundEvents([]); setSelectedArrow("normal"); setRoundTransition(false);
  }, []);

  const handleEquipArmor = useCallback((slot, armorId) => {
    setArmor(prev => {
      const next = { ...prev };
      const tier = parseInt(armorId.match(/t(\d)$/)?.[1] || "1", 10);
      next[slot] = { itemId: armorId, durability: 3 + (tier - 1) * 2 };
      return next;
    });
  }, []);

  const handleUnequipArmor = useCallback((slot) => {
    setArmor(prev => { const next = { ...prev }; delete next[slot]; return next; });
  }, []);

  const handleUseAccessory = useCallback((accId) => {
    setAccessoryUses(prev => ({ ...prev, [accId]: Math.max(0, (prev[accId] ?? 3) - 1) }));
    setLog(l => [...l, { type:"system", text:`⚙️ 使用配件 ${accId}`, time:Date.now() }]);
  }, []);

  const handleArrowSelect = useCallback((arrowId) => {
    if (arrowId !== "normal" && (specialAmmo[arrowId] || 0) <= 0) return;
    setSelectedArrow(arrowId);
  }, [specialAmmo]);

  // ── 感染狀態 ────────────────────────────────────────────
  const infectionState = survivorState?.lifeState || "healthy";
  const infectionDisplay = {
    healthy:        { label:"健康",     color:COLORS.green, icon:"💚" },
    infected:       { label:"感染⚠️",   color:COLORS.amber, icon:"🦠" },
    suppressed:     { label:"抑制中",   color:COLORS.blue,  icon:"💊" },
    fully_infected: { label:"完全感染",  color:COLORS.red,   icon:"☠️" },
  }[infectionState] || { label: infectionState, color: COLORS.textDim, icon:"❓" };

  // ── Zone 主題色 ──────────────────────────────────────────
  const zt = ZONE_LABELS[zoneType] || ZONE_LABELS[ZONE_TYPE.NORMAL];

  // ═════════════════════════════════════════════════════════
  //  Render
  // ═════════════════════════════════════════════════════════

  return (
    <div ref={containerRef} style={CONTAINER}>
      {/* ── 頂部戰場橫幅 ──────────────────────────────── */}
      <div style={BANNER}>
        <div style={BANNER_LEFT}>
          <div style={BANNER_ICON}>⚔️</div>
          <div>
            <div style={BANNER_TITLE}>戰鬥區域</div>
            <div style={BANNER_SUBTITLE}>
              <span style={{ color: zt.icon ? "inherit" : COLORS.textDim }}>{zt.icon}</span> {zt.label}
            </div>
          </div>
        </div>
        <div style={BANNER_CENTER}>
          {phase !== "idle" && (
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <PhaseBadge phase={phase} />
              <RoundCounter round={round} />
            </div>
          )}
        </div>
        <div style={BANNER_RIGHT}>
          {phase === "idle" && !isIntegrated && (
            <>
              <select value={zoneType} onChange={e => setZoneType(e.target.value)}
                style={ZONE_SELECT}>
                {Object.entries(ZONE_LABELS).map(([val, z]) => (
                  <option key={val} value={val}>{z.icon} {z.label}</option>
                ))}
              </select>
              <BattleBtn onClick={handleStartEncounter} variant="primary" icon="⚔️" label="開始戰鬥" />
            </>
          )}
        </div>
      </div>

      {/* ── 戰鬥中狀態列 ────────────────────────────────── */}
      {encounter && (
        <div style={STATUS_BAR}>
          <StatusChip icon={ARCH_DATA[zombieList[0]?.archetypeId]?.icon || "🧟"}
            label={`${aliveZombies.length}/${totalZombies}`}
            color={aliveZombies.length > 0 ? COLORS.red : COLORS.green}
            glow={aliveZombies.length > 0} />
          <StatusChip icon={infectionDisplay.icon}
            label={infectionDisplay.label}
            color={infectionDisplay.color} />
          {Object.keys(armor).length > 0 && (
            <StatusChip icon="🛡️" label={`${Object.keys(armor).length}件`} color={COLORS.blue} />
          )}
          {phase === "aiming" && (
            <div style={ARROW_METER}>
              <span style={{ fontSize:10, color:COLORS.textMuted, marginRight:4 }}>🏹</span>
              {Array.from({length: maxArrows}).map((_, i) => (
                <div key={i} style={{
                  width: 18, height: 6,
                  borderRadius: 3,
                  background: i < currentArrows ? COLORS.amber : "rgba(255,255,255,0.08)",
                  border: `1px solid ${i < currentArrows ? `${COLORS.amber}66` : "rgba(255,255,255,0.06)"}`,
                  transition: "all 0.2s",
                  boxShadow: i < currentArrows ? THEME.glow.amber : "none",
                }} />
              ))}
              <span style={{ fontSize:9, fontWeight:700, color:COLORS.textDim, marginLeft:4, fontFamily:FONT.mono }}>
                {currentArrows}/{maxArrows}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── 殭屍距離指示條 ──────────────────────────────── */}
      {encounter && (
        <div style={DISTANCE_BAR_WRAP}>
          <div style={DISTANCE_BAR}>
            <div style={DISTANCE_BAR_INNER}>
              <div style={{ position:"absolute", left:0, top:0, bottom:0, width:"12%",
                background:"linear-gradient(90deg, rgba(239,68,68,0.2), transparent)",
                borderRadius:4 }} />
              {[0, 5, 10, 15, 20].map(d => (
                <div key={d} style={{
                  position:"absolute", left:`${(d/20)*100}%`, top:0, bottom:0,
                  borderLeft:"1px solid rgba(255,255,255,0.04)",
                  display:"flex", alignItems:"flex-end", justifyContent:"center",
                  fontSize:7, color:"rgba(255,255,255,0.15)", paddingBottom:1,
                }}>
                  <span>{d}m</span>
                </div>
              ))}
              {zombieList.filter(z => z.alive).map(z => (
                <div key={z.id} style={{
                  position:"absolute",
                  left:`${(z.distanceM / 20) * 100}%`,
                  top: 2, bottom: 2, width: 14,
                  marginLeft: -7,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}>
                  <span style={{
                    fontSize: z.distanceM <= 3 ? 14 : 10,
                    filter: z.distanceM <= 3 ? "drop-shadow(0 0 4px rgba(239,68,68,0.6))" : "none",
                    transition:"all 0.3s",
                  }}>
                    {z.icon}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:7, color:"rgba(255,255,255,0.12)", marginTop:2, padding:"0 4px" }}>
            <span>⚠️ 危險</span>
            <span>🟢 安全</span>
          </div>
        </div>
      )}

      {/* ── 裝備面板 ───────────────────────────────────── */}
      {showInventory && phase === "aiming" && (
        <div style={{ marginBottom:12, display:"flex", flexDirection:"column", gap:8 }}>
          <ZombieArmorPanel armor={armor} onEquipArmor={handleEquipArmor} onUnequipArmor={handleUnequipArmor} minTier={1} />
          <ZombieMedicalPanel supplies={{}} />
          <ZombieAccessoryPanel accessories={accessories} accessoryUses={accessoryUses} onUseAccessory={handleUseAccessory} />
        </div>
      )}

      {/* ── 戰鬥主區 ────────────────────────────────────── */}
      {encounter ? (
        <div style={BATTLE_ARENA}>
          {/* ── 殭屍卡片列表（橫向滾動） ──────────────────── */}
          {(!focusedZombieId || phase !== "aiming") && (
            <div style={{
              display:"flex", gap:4, marginBottom: focusedZombieId ? 0 : 6,
              overflowX:"auto", paddingBottom:2,
            }}>
              {zombieList.map(z => (
                <ZombieCard
                  key={z.id} zombie={z}
                  isFlashing={hitFlash?.zombieId === z.id}
                  isFocused={focusedZombieId === z.id}
                  onClick={handleFocusZombie}
                  compact={!focusedZombieId}
                />
              ))}
            </div>
          )}

          {/* ── 箭矢選擇器（緊湊版） ─────────────────────── */}
          {phase === "aiming" && !focusedZombieId && (
            <div style={{ marginBottom:6 }}>
              <ZombieArrowSelector selected={selectedArrow} onSelect={handleArrowSelect} ammo={specialAmmo} disabled={false} />
            </div>
          )}

          {/* ── 當前聚焦殭屍的大靶面 ──────────────────────── */}
          {phase === "aiming" && focusedZombie && focusedZombie.alive && (
            <div style={ZOOM_TARGET}>
              {/* 頂部操作列（緊湊） */}
              <div style={ZOOM_HEADER}>
                <button onClick={handleUnfocusZombie} style={ZOOM_BACK_BTN}>
                  ← 返回
                </button>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:12 }}>{focusedZombie.icon}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:COLORS.text }}>
                    {focusedZombie.name}
                  </span>
                  <span style={{
                    fontSize:9, fontWeight:900, fontFamily:FONT.mono,
                    color: focusedZombie.distanceM <= 3 ? COLORS.red : COLORS.green,
                  }}>
                    {focusedZombie.distanceM}m
                  </span>
                </div>
                <span style={{ fontSize:8, color:COLORS.amber }}>
                  🏹 {maxArrows - currentArrows}
                </span>
              </div>

              {/* 響應式大靶面 SVG */}
              <div style={ZOOM_SVG_WRAP}>
                <ZombieTargetSVG
                  zombie={focusedZombie} active={true}
                  hits={arrowHits[focusedZombie.id] || {}}
                  onHit={(part) => handleHit(focusedZombie.targetSlot, focusedZombie.id, part)}
                  width={ZOOM_SVG_SIZE} height={Math.round(ZOOM_SVG_SIZE * 1.3)}
                />
              </div>
            </div>
          )}

          {/* ── 行動按鈕列 ──────────────────────────────── */}
          <div style={ACTION_ROW}>
            {phase === "aiming" && !focusedZombieId && aliveZombies.length > 0 && (
              <>
                <BattleBtn onClick={() => setShowInventory(!showInventory)}
                  variant="secondary" active={showInventory} icon="🎒" label="裝備" />
                <div style={{
                  flex:1, textAlign:"center", fontSize:9,
                  color:COLORS.textMuted,
                }}>
                  👆 點擊殭屍進入射擊
                </div>
                <BattleBtn onClick={handleResolveRound} disabled={currentArrows === 0}
                  variant="primary" icon="⚙️" label={`結算 (${currentArrows}/${maxArrows})`} />
              </>
            )}

            {phase === "aiming" && focusedZombieId && (
              <div style={{ display:"flex", gap:6, width:"100%", justifyContent:"space-between" }}>
                <BattleBtn onClick={handleUnfocusZombie}
                  variant="secondary" icon="◀" label="目標列表" />
                <BattleBtn onClick={handleResolveRound} disabled={currentArrows === 0}
                  variant="primary" icon="⚙️" label={`結算 (${currentArrows}/${maxArrows})`} />
              </div>
            )}

            {phase === "round_result" && (
              <>
                <BattleBtn onClick={handleRetreat}
                  variant="danger" icon="🏃" label="撤離" />
                <div style={{ flex:1 }} />
                <BattleBtn onClick={handleNextRound}
                  variant="primary" icon="➡️" label="下一回合 →" />
              </>
            )}

            {phase === "complete" && !isIntegrated && (
              <>
                <div style={{ flex:1 }} />
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:11, color:COLORS.textDim, marginBottom:6 }}>
                    {victoryLabel(killedCount, totalZombies)}
                  </div>
                  <BattleBtn onClick={handleReset} variant="secondary" icon="🔄" label="重新開始" />
                </div>
                <div style={{ flex:1 }} />
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={EMPTY_STATE}>
          <div style={{ fontSize:48, marginBottom:12, opacity:0.4 }}>⚔️</div>
          <div style={{ fontSize:15, fontWeight:700, color:COLORS.textDim, marginBottom:6 }}>
            選擇區域開始戰鬥
          </div>
          <div style={{ fontSize:10, color:COLORS.textMuted }}>
            不同區域遭遇不同類型的殭屍組合
          </div>
        </div>
      )}

      {/* ── 回合結果過場 ────────────────────────────────── */}
      {phase === "round_result" && roundTransition && roundEvents.length > 0 && (
        <div style={ROUND_RESULT_OVERLAY}>
          <div style={ROUND_RESULT_CARD}>
            <div style={{ fontSize:11, fontWeight:700, color:COLORS.text, marginBottom:8, letterSpacing:1 }}>
              ⏹️ 第 {round} 回合結果
            </div>
            <div style={{ display:"flex", gap:16, marginBottom:10 }}>
              <StatBox icon="💀" value={countByType(roundEvents, "zombie_killed")} label="擊殺" color={COLORS.green} />
              <StatBox icon="🏹" value={currentArrows} label="箭矢" color={COLORS.amber} />
              <StatBox icon="💥" value={countByType(roundEvents, "knockback") + countByType(roundEvents, "special_knockback")} label="擊退" color={COLORS.blue} />
              <StatBox icon="🦠" value={countByType(roundEvents, "infection")} label="感染" color={COLORS.red} />
            </div>
            <div style={ROUND_EVENT_LOG}>
              {roundEvents.slice(-8).map((e, i) => (
                <div key={i} style={{
                  fontSize:8, lineHeight:1.8,
                  color: e.type === "zombie_killed" ? COLORS.green
                    : e.type === "infection" ? COLORS.red
                    : e.type === "knockback" ? COLORS.blue
                    : e.type === "armor_block" ? COLORS.blue
                    : e.type === "charge_attack" ? COLORS.purple
                    : COLORS.textDim,
                }}>
                  {e.text}
                </div>
              ))}
            </div>
            <BattleBtn onClick={handleNextRound} variant="primary" icon="➡️" label="下一回合" fullWidth />
          </div>
        </div>
      )}

      {/* ── 事件日誌 ────────────────────────────────────── */}
      {log.length > 0 && phase !== "round_result" && (
        <div style={LOG_PANEL}>
          <div style={LOG_HEADER}>
            <span>📜 戰鬥日誌</span>
            <span style={{ fontSize:8, color:COLORS.textMuted }}>{log.length} 條</span>
          </div>
          <div style={LOG_BODY}>
            {log.slice(-20).reverse().map((entry, i) => (
              <div key={i} style={logEntryStyle(entry.type)}>
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
//  子元件
// ═════════════════════════════════════════════════════════

function ZombieCard({ zombie, isFlashing, isFocused, onClick, compact }) {
  const alive = zombie.alive !== false;
  const distColor = zombie.distanceM <= 0 ? COLORS.red
    : zombie.distanceM <= 3 ? COLORS.amber
    : zombie.distanceM <= 6 ? "#eab308"
    : COLORS.green;

  // 取得 ComfyUI 生成圖路徑
  const archData = ARCH_DATA[zombie.archetypeId] || ARCH_DATA.normal;
  const zombieImg = archData.img;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div onClick={() => alive && onClick?.(zombie.id)}
      style={{
        display:"flex", flexDirection: compact ? "row" : "column",
        alignItems:"center", gap: compact ? 5 : 3,
        padding: compact ? "4px 10px" : "6px 8px",
        borderRadius:RADIUS.md,
        background: isFocused ? `${COLORS.green}14` : alive ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)",
        border: isFlashing
          ? `1px solid ${COLORS.amber}`
          : isFocused
            ? `1px solid ${COLORS.green}44`
            : `1px solid ${alive ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"}`,
        opacity: alive ? 1 : 0.3,
        cursor: alive && !isFocused ? "pointer" : "default",
        transition: "all 0.15s",
        boxShadow: isFlashing ? THEME.glow.amber : isFocused ? THEME.glow.green : "none",
        whiteSpace:"nowrap",
        flexShrink:0,
      }}>
      {/* ComfyUI 生成圖頭像（取代 Emoji） */}
      {alive && imgLoaded ? (
        <img src={zombieImg} alt={archData.label}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(false)}
          style={{
            width: compact ? 22 : 30,
            height: compact ? 28 : 40,
            objectFit:"cover",
            borderRadius: 4,
            filter: isFlashing ? "brightness(1.5)" : "none",
            transition:"filter 0.1s",
            imageRendering:"auto",
          }}
        />
      ) : (
        <span style={{ fontSize: compact ? 12 : 14, filter: isFlashing ? "brightness(1.5)" : "none", transition:"filter 0.1s" }}>
          {alive ? zombie.icon : "💀"}
        </span>
      )}
      {!compact && (
        <span style={{ fontSize:9, fontWeight:600, color: alive ? COLORS.text : COLORS.textMuted }}>
          {alive ? zombie.name : "已擊殺"}
        </span>
      )}
      {compact && alive && (
        <div style={{
          width:30, height:3, borderRadius:2,
          background:"rgba(255,255,255,0.06)",
          overflow:"hidden",
        }}>
          <div style={{
            height:"100%",
            width:`${Math.min(100, (zombie.distanceM / 20) * 100)}%`,
            borderRadius:2,
            background:`linear-gradient(90deg, ${distColor}, ${distColor}88)`,
            transition:"width 0.3s",
          }} />
        </div>
      )}
      <span style={{
        fontSize: compact ? 9 : 9, fontWeight:900, fontFamily:FONT.mono,
        color: distColor,
      }}>
        {alive ? `${zombie.distanceM}m` : "—"}
      </span>
    </div>
  );
}

function PhaseBadge({ phase }) {
  const config = {
    aiming:       { color:COLORS.green, label:"🎯 射擊中",    glow:THEME.glow.green },
    resolving:    { color:COLORS.blue,  label:"⚙️ 結算中",   glow:THEME.glow.blue },
    round_result: { color:COLORS.amber, label:"📊 回合結果",  glow:THEME.glow.amber },
    complete:     { color:COLORS.red,   label:"🏁 戰鬥結束",  glow:THEME.glow.red },
  }[phase] || { color:COLORS.textDim, label:phase, glow:"none" };

  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 10px", borderRadius:RADIUS.sm,
      fontSize:10, fontWeight:700,
      background:`${config.color}14`,
      color: config.color,
      border:`1px solid ${config.color}33`,
      boxShadow: config.glow,
      animation: phase === "resolving" ? "za-pulse-glow 0.6s ease infinite" : "none",
    }}>
      {config.label}
    </span>
  );
}

function RoundCounter({ round }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding:"3px 8px", borderRadius:RADIUS.sm,
      fontSize:10, fontWeight:700, fontFamily:FONT.mono,
      background:"rgba(255,255,255,0.04)",
      border:"1px solid rgba(255,255,255,0.06)",
      color: COLORS.text,
    }}>
      R{round}
    </span>
  );
}

function StatusChip({ icon, label, color, glow }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:4,
      padding:"3px 8px", borderRadius:RADIUS.sm,
      background:`${color}0c`,
      border:`1px solid ${color}22`,
      fontSize:9, fontWeight:600, color,
      boxShadow: glow ? `0 0 8px ${color}22` : "none",
    }}>
      <span style={{ fontSize:10 }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatBox({ icon, value, label, color }) {
  return (
    <div style={{ textAlign:"center" }}>
      <div style={{ fontSize:18, fontWeight:900, color, fontFamily:FONT.mono }}>
        {value}
      </div>
      <div style={{ fontSize:8, color:COLORS.textMuted }}>
        {icon} {label}
      </div>
    </div>
  );
}

function BattleBtn({ onClick, disabled, variant, active, icon, label, fullWidth }) {
  const base = {
    display:"flex", alignItems:"center", gap:5,
    padding:"8px 18px", borderRadius:RADIUS.md,
    fontSize:11, fontWeight:700, cursor:"pointer",
    border:"none", transition:"all 0.15s",
    whiteSpace:"nowrap",
    width: fullWidth ? "100%" : "auto",
    justifyContent:"center",
  };

  const styles = {
    primary: {
      ...base,
      background: COLORS.gradientPrimary,
      color:"#fff",
      boxShadow: SHADOWS.glow(),
    },
    secondary: {
      ...base,
      background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)"}`,
      color: active ? COLORS.blue : COLORS.text,
    },
    danger: {
      ...base,
      background: "rgba(239,68,68,0.1)",
      border: "1px solid rgba(239,68,68,0.25)",
      color: COLORS.red,
    },
  };

  const s = styles[variant] || styles.secondary;
  if (disabled) s.opacity = 0.35; s.cursor = "not-allowed";

  return <button onClick={onClick} disabled={disabled} style={s}>{icon} {label}</button>;
}

// ═════════════════════════════════════════════════════════
//  樣式
// ═════════════════════════════════════════════════════════

const CONTAINER = {
  maxWidth: 920,
  margin: "0 auto",
  fontFamily: FONT.family,
};

const BANNER = {
  display:"flex", alignItems:"center", justifyContent:"space-between",
  padding:"8px 14px", marginBottom:10, gap:8,
  background:"rgba(10,8,20,0.6)",
  border:"1px solid rgba(255,255,255,0.06)",
  borderRadius: RADIUS.lg,
  backdropFilter:"blur(8px)",
};

const BANNER_LEFT = {
  display:"flex", alignItems:"center", gap:8,
};

const BANNER_ICON = {
  width:32, height:32, borderRadius:RADIUS.md,
  display:"flex", alignItems:"center", justifyContent:"center",
  background:"linear-gradient(135deg, #dc2626, #991b1b)",
  fontSize:16, boxShadow:"0 0 12px rgba(239,68,68,0.3)",
};

const BANNER_TITLE = {
  fontSize:12, fontWeight:700, color:COLORS.text, letterSpacing:0.5,
};

const BANNER_SUBTITLE = {
  fontSize:9, color:COLORS.textDim, marginTop:1,
};

const BANNER_CENTER = {
  display:"flex", alignItems:"center", gap:6,
};

const BANNER_RIGHT = {
  display:"flex", alignItems:"center", gap:6,
};

const ZONE_SELECT = {
  padding:"5px 10px", borderRadius:RADIUS.sm,
  fontSize:10, fontWeight:600,
  background:"rgba(0,0,0,0.3)",
  border:"1px solid rgba(255,255,255,0.08)",
  color: COLORS.text, cursor:"pointer",
};

const STATUS_BAR = {
  display:"flex", gap:6, marginBottom:10, flexWrap:"wrap", alignItems:"center",
};

const ARROW_METER = {
  display:"flex", alignItems:"center",
  padding:"4px 8px", borderRadius:RADIUS.sm,
  background:"rgba(0,0,0,0.2)",
  border:"1px solid rgba(255,255,255,0.04)",
  marginLeft:"auto",
};

const DISTANCE_BAR_WRAP = {
  marginBottom:8,
  padding:"6px 10px",
  background:"rgba(0,0,0,0.2)",
  borderRadius: RADIUS.md,
  border:"1px solid rgba(255,255,255,0.03)",
};

const DISTANCE_BAR = {
  height:24, position:"relative",
};

const DISTANCE_BAR_INNER = {
  position:"absolute", inset:0,
  background:"linear-gradient(90deg, rgba(239,68,68,0.08), rgba(34,197,94,0.05))",
  borderRadius:4,
  border:"1px solid rgba(255,255,255,0.03)",
};

const BATTLE_ARENA = {
  padding:"10px", marginBottom:8,
  background:"rgba(10,8,20,0.5)",
  border:"1px solid rgba(255,255,255,0.04)",
  borderRadius: RADIUS.lg,
};

const ZOOM_SVG_SIZE = 240; // 手機友善尺寸（viewBox 200×260 等比例縮放）

const ZOOM_TARGET = {
  background:"rgba(0,0,0,0.35)",
  borderRadius: RADIUS.md,
  border:"1px solid rgba(255,255,255,0.05)",
  padding:"6px 8px",
  animation:"za-fade-in 0.2s ease-out",
};

const ZOOM_HEADER = {
  display:"flex", alignItems:"center", justifyContent:"space-between",
  marginBottom:4, gap:4,
};

const ZOOM_BACK_BTN = {
  display:"flex", alignItems:"center",
  padding:"3px 8px",
  borderRadius:RADIUS.sm,
  background:"rgba(255,255,255,0.04)",
  border:"1px solid rgba(255,255,255,0.06)",
  color:COLORS.text,
  fontSize:9, fontWeight:600,
  cursor:"pointer",
};

const ZOOM_SVG_WRAP = {
  display:"flex", justifyContent:"center",
  width:"100%",
  maxWidth: ZOOM_SVG_SIZE,
  margin:"0 auto",
};

const ACTION_ROW = {
  display:"flex", alignItems:"center", gap:6,
  marginTop:12, paddingTop:10,
  borderTop:"1px solid rgba(255,255,255,0.04)",
};

const EMPTY_STATE = {
  padding:"60px 20px", textAlign:"center",
  background:"rgba(10,8,20,0.4)",
  border:"1px dashed rgba(255,255,255,0.06)",
  borderRadius: RADIUS.lg,
};

const ROUND_RESULT_OVERLAY = {
  position:"fixed", inset:0, zIndex:300,
  display:"flex", alignItems:"center", justifyContent:"center",
  background:"rgba(0,0,0,0.6)",
  backdropFilter:"blur(4px)",
  animation:"za-fade-in 0.2s ease-out",
};

const ROUND_RESULT_CARD = {
  padding:"18px 22px", maxWidth:360, width:"90%",
  background:"rgba(10,8,20,0.95)",
  border:"1px solid rgba(255,255,255,0.08)",
  borderRadius: RADIUS.lg,
  textAlign:"center",
  boxShadow:"0 16px 48px rgba(0,0,0,0.5)",
};

const ROUND_EVENT_LOG = {
  textAlign:"left", maxHeight:120, overflowY:"auto",
  marginBottom:12, padding:"6px 8px",
  background:"rgba(0,0,0,0.2)",
  borderRadius: RADIUS.sm,
  fontSize:8,
};

const LOG_PANEL = {
  borderRadius:RADIUS.md, maxHeight:160, overflowY:"auto",
  padding:"8px 12px", fontSize:10, lineHeight:1.8,
  background:"rgba(10,8,20,0.4)",
  border:"1px solid rgba(255,255,255,0.04)",
};

const LOG_HEADER = {
  display:"flex", justifyContent:"space-between",
  fontSize:9, fontWeight:700, color:COLORS.textMuted,
  marginBottom:4, letterSpacing:0.5, paddingBottom:4,
  borderBottom:"1px solid rgba(255,255,255,0.04)",
};

const LOG_BODY = {
  maxHeight:120, overflowY:"auto",
};

// ═════════════════════════════════════════════════════════
//  輔助函數
// ═════════════════════════════════════════════════════════

function getPartLabel(partId) {
  const labels = { head:"頭部", neck:"頸部", chest:"胸腔", belly:"腹部",
    arm_left:"左臂", arm_right:"右臂", groin:"鼠蹊", heart:"心臟", lung:"肺葉", kidney:"腎臟", balls:"要害" };
  return labels[partId] || partId;
}

function formatEventText(event) {
  const p = event.payload || {};
  switch (event.type) {
    case "arrow_hit": return `🏹 ${p.partName || "?"}命中${p.killed ? " 💀" : ""}`;
    case "arrow_miss": return `✗ 脫靶${p.reason === "no_target" ? "（無目標）" : ""}`;
    case "zombie_killed": return `💀 擊殺！${p.reason ? `（${p.reason}）` : ""}`;
    case "knockback": return `💨 擊退 ${p.distance}m（→${p.newDistance}m）`;
    case "special_knockback": return `💥 特殊箭額外 +${p.bonus}m`;
    case "slowed": return `🐢 減速`;
    case "arm_disabled": return `🦾 手臂${p.level === "full" ? "完全失效" : "減半"}`;
    case "zombie_move": return `👣 ${p.from}m→${p.to}m`;
    case "zombie_arrive": return `⚠️ 抵達 0m！`;
    case "charge_attack": return `💢 破甲衝撞${p.penetrated ? " 🔴 穿透！" : " 🟢 格擋成功"}`;
    case "auto_interfere": return `📡 遠程殭屍干擾`;
    case "interfere_lose_arrow": return `✂️ 受干擾 箭數減少`;
    case "penetration_hit": return `⚡ 穿透箭命中第二目標`;
    case "explosion": return `💥 爆炸波及 ${p.part}`;
    case "armor_block": return `🛡️ 防具格擋！${p.durabilityLeft > 0 ? `剩餘 ${p.durabilityLeft}` : "⚠️ 耐久歸零"}`;
    case "infection": return `🦠 感染！來源: ${p.source || "殭屍"}`;
    case "encounter_win": return `🏆 戰鬥勝利！共 ${p.round} 回合`;
    case "encounter_lose": return `💀 全員陣亡…`;
    case "round_end": return `⏹️ 第 ${p.round} 回合結束`;
    case "rescue_window": return `🆘 救援窗口開啟！${p.seconds}秒`;
    default: return event.type;
  }
}

function countByType(events, type) {
  return events.filter(e => e.type === type).length;
}

function victoryLabel(killed, total) {
  if (killed === total) return "🏆 全數殲滅！";
  if (killed > 0) return `💪 擊殺 ${killed}/${total}`;
  return "💀 全滅…";
}

function logEntryStyle(type) {
  const colors = {
    hit: COLORS.green,
    miss: COLORS.red,
    zombie_killed: COLORS.green,
    knockback: COLORS.blue,
    special_knockback: COLORS.blue,
    infection: COLORS.red,
    armor_block: COLORS.blue,
    charge_attack: COLORS.purple,
    auto_interfere: COLORS.red,
    penetration_hit: COLORS.purple,
    explosion: COLORS.amber,
    rescue_window: COLORS.green,
    encounter_win: COLORS.green,
    encounter_lose: COLORS.red,
    round_end: COLORS.textMuted,
  };
  return {
    color: colors[type] || COLORS.textDim,
    fontSize: type === "round_end" || type === "encounter_win" || type === "encounter_lose" ? 9 : 10,
    fontWeight: type === "zombie_killed" || type === "encounter_win" || type === "encounter_lose" ? 700 : 500,
    lineHeight: 1.8,
  };
}
