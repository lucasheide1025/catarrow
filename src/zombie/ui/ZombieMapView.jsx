// src/zombie/ui/ZombieMapView.jsx
// ═══════════════════════════════════════════════════════════════
//  🗺️ 殭屍生存 — 地圖探索（平面 + 2.5D 等角雙模式）
//  保留既有平面版本為 fallback，新增等角切換開關
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from "react";
import { createMapState, moveToNode, getReachableNodes, canExtract, getNodeDisplayLabel, purchaseMap } from "../domain/mapEngine";
import { ZONE_TYPE } from "../domain/types";
import { COLORS, RADIUS } from "./theme";
import { playZombieSound, initZombieAudio } from "../domain/zombieSound";
import { ANIM_DURATION } from "../style/zombieAnimations";
import ZombieMapIsometric from "./ZombieMapIsometric";

const ZONE = {
  [ZONE_TYPE.SAFE]:       { color: COLORS.green,  icon: "🟢", bg: "rgba(34,197,94,0.08)",  label: "安全" },
  [ZONE_TYPE.NORMAL]:     { color: "#eab308",     icon: "🟡", bg: "rgba(234,179,8,0.08)",  label: "普通" },
  [ZONE_TYPE.DANGER]:     { color: COLORS.amber,  icon: "🟠", bg: "rgba(245,158,11,0.08)", label: "危險" },
  [ZONE_TYPE.HIGH_RISK]:  { color: COLORS.red,    icon: "🔴", bg: "rgba(239,68,68,0.08)",  label: "高危" },
  [ZONE_TYPE.RESTRICTED]: { color: COLORS.purple, icon: "⚫", bg: "rgba(139,92,246,0.08)", label: "禁區" },
};

const LAYERS = {
  start: 0, crossroad_1: 1, warehouse: 1,
  hospital: 2, gas_station: 2, market: 2,
  church: 3, east_district: 3, underground: 3,
  suburb: 4, sewer: 4,
  military_base: 5, bridge: 5, boss_room: 5, extraction_heli: 6,
};

export default function ZombieMapView({ onTriggerBattle, onLogEvent }) {
  const [mapState, setMapState] = useState(null);
  const [log, setLog] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [moveAnim, setMoveAnim] = useState(null);
  const [encounterFlash, setEncounterFlash] = useState(false);
  const [mapMode, setMapMode] = useState(() => {
    return localStorage.getItem("zombieMapMode") || "flat";
  });

  useEffect(() => { initZombieAudio(); }, []);

  const currentNode = mapState?.nodes?.[mapState?.currentNodeId];
  const reachable = useMemo(() => mapState ? getReachableNodes(mapState) : [], [mapState]);
  const extract = useMemo(() => mapState ? canExtract(mapState) : { canExtract: false }, [mapState]);
  const reachableIds = useMemo(() => reachable.map(r => r.id), [reachable]);

  const layers = useMemo(() => {
    if (!mapState) return [];
    const m = {};
    for (const [id, n] of Object.entries(mapState.nodes)) {
      const l = LAYERS[id] ?? 3;
      (m[l] = m[l] || []).push({ id, ...n });
    }
    return Object.entries(m).sort(([a], [b]) => +a - +b);
  }, [mapState]);

  const toggleMode = useCallback(() => {
    setMapMode(prev => {
      const next = prev === "flat" ? "isometric" : "flat";
      localStorage.setItem("zombieMapMode", next);
      return next;
    });
  }, []);

  const gen = useCallback(() => {
    const s = createMapState();
    setMapState(s); setPhase("exploring");
    playZombieSound("explore:item_found");
    const evt = { type: "system", text: "🗺️ 地圖已生成！", time: Date.now() };
    setLog([evt]);
    onLogEvent?.(evt);
  }, []);

  const move = useCallback((tid) => {
    if (!mapState) return;
    const r = moveToNode(mapState, tid);
    if (!r.valid) { playZombieSound("system:error"); return; }
    setMoveAnim(tid);
    setTimeout(() => setMoveAnim(null), 500);
    setMapState(r.mapState);
    playZombieSound("explore:node_move");
    const nl = [...log];
    r.events.forEach(evt => {
      if (evt.type === "extraction_found") { nl.push({ type: "extraction", text: `🚁 撤離點！`, time: Date.now() }); playZombieSound("explore:extract_found"); }
      else if (evt.type === "boss_sighted") { nl.push({ type: "boss", text: `👑 BOSS`, time: Date.now() }); playZombieSound("combat:zombie_roar"); }
      else if (evt.type === "encounter_trigger") { nl.push({ type: "combat", text: `⚔️!`, time: Date.now() }); playZombieSound("explore:combat_trigger"); setEncounterFlash(true); setTimeout(() => setEncounterFlash(false), 800); }
      else if (evt.type === "moved") nl.push({ type: "move", text: `👣 ${evt.payload.label}`, time: Date.now() });
      else if (evt.type === "node_visited") nl.push({ type: "visit", text: `📍 ${evt.payload.label}`, time: Date.now() });
    });
    setLog(nl);
    if (r.encounterTriggered) { setPhase("combat"); setTimeout(() => onTriggerBattle?.(mapState.nodes[tid]?.zoneType || "normal"), 300); }
  }, [mapState, log, onTriggerBattle, onLogEvent]);

  const purchase = useCallback(() => {
    if (!mapState || mapState.mapPurchased) return;
    const r = purchaseMap(mapState); setMapState(r.mapState);
    playZombieSound("lobby:zone_select");
  }, [mapState]);

  const extractFn = useCallback(() => {
    if (!extract.canExtract) return;
    setPhase("complete");
    playZombieSound("system:complete");
  }, [extract]);

  const reset = useCallback(() => { setMapState(null); setPhase("idle"); setLog([]); playZombieSound("lobby:player_leave"); }, []);

  const isIsometric = mapMode === "isometric";

  // ── 等角渲染的共同標題列 ───────────────────────────
  const renderHeader = () => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: isIsometric ? 8 : 10,
    }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{isIsometric ? "🏔️" : "🗺️"}</span>
        <span>{isIsometric ? "2.5D 地圖" : "平面地圖"}</span>
        {/* 模式切換 */}
        <button
          onClick={toggleMode}
          style={{
            padding: "2px 8px", borderRadius: RADIUS.sm,
            fontSize: 8, fontWeight: 600,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: COLORS.textDim, cursor: "pointer",
            transition: "all 0.12s",
            marginLeft: 4,
          }}
          title={isIsometric ? "切換為平面模式" : "切換為 2.5D 等角模式"}
        >
          {isIsometric ? "🗺️ 平面" : "🏔️ 2.5D"}
        </button>
      </h2>
      <div style={{ display: "flex", gap: 6 }}>
        {phase === "idle" && <Btn label="🗺️ 生成" onClick={gen} primary />}
        {phase === "exploring" && <>
          {!mapState?.mapPurchased && <Btn label="🗺️ 購買" onClick={purchase} />}
          {extract.canExtract && <Btn label="🚁 撤離" onClick={extractFn} danger />}
          <Btn label="🔄" onClick={reset} />
        </>}
      </div>
    </div>
  );

  // ── 狀態列 ──────────────────────────────────────────
  const renderStatusBar = () => {
    if (!mapState) return null;
    return (
      <div style={{ display: "flex", gap: 4, marginBottom: isIsometric ? 8 : 10, flexWrap: "wrap" }}>
        {[{ icon: "📍", v: currentNode?.label, c: COLORS.text },
          { icon: "🧠", v: `${mapState.intelAccuracy}%`, c: COLORS.blue },
          { icon: "🔗", v: `${reachable.length}`, c: COLORS.textDim },
          { icon: ZONE[currentNode?.zoneType]?.icon || "❓", v: ZONE[currentNode?.zoneType]?.label || "?", c: COLORS.textDim },
        ].map((d, i) => (
          <span key={i} style={{
            padding: "2px 8px", borderRadius: RADIUS.sm, fontSize: 9, fontWeight: 600,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: d.c,
            animation: `za-slide-in-up ${ANIM_DURATION.fast} ${i * 0.04}s both`,
          }}>{d.icon} {d.v}</span>
        ))}
        {mapState?.mapPurchased && <span style={{ padding: "2px 8px", borderRadius: RADIUS.sm, fontSize: 9, fontWeight: 600, background: `${COLORS.green}12`, border: `1px solid ${COLORS.green}33`, color: COLORS.green }}>🗺️✓</span>}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {renderHeader()}
      {renderStatusBar()}

      {/* 遭遇戰閃爍 */}
      {encounterFlash && <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", background: "radial-gradient(ellipse at center,rgba(239,68,68,0.15),transparent)", animation: "za-fade-in 0.15s, za-fade-in 0.3s 0.5s reverse" }} />}

      {/* ── 2.5D 等角地圖 ───────────────────────────── */}
      {isIsometric && (
        mapState ? (
          <div style={{
            padding: "8px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: RADIUS.lg,
            marginBottom: 10,
          }}>
            <ZombieMapIsometric
              mapState={mapState}
              currentNodeId={mapState.currentNodeId}
              reachableIds={reachableIds}
              moveAnimId={moveAnim}
              onMove={move}
              phase={phase}
              mapPurchased={mapState.mapPurchased}
              showLabels={true}
            />
          </div>
        ) : (
          /* 空狀態 */
          <div style={{ padding: "40px 20px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: RADIUS.lg }}>
            <div style={{ fontSize: 48, opacity: 0.3, animation: `za-float ${ANIM_DURATION.float} infinite` }}>🏔️</div>
            <p style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8 }}>生成地圖開始探索（2.5D 模式）</p>
          </div>
        )
      )}

      {/* ── 平面地圖（原始版本） ─────────────────────── */}
      {!isIsometric && mapState && (
        <div style={{ padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: RADIUS.lg, marginBottom: 10, animation: `za-scale-in ${ANIM_DURATION.slow}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {layers.map(([l, nodes], li) => (
              <div key={l} style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", animation: `za-slide-in-up ${ANIM_DURATION.fast} ${li * 0.04}s both` }}>
                {nodes.map(n => {
                  const cur = mapState.currentNodeId === n.id;
                  const rch = reachable.some(r => r.id === n.id);
                  const z = ZONE[n.zoneType] || { color: COLORS.textDim, icon: "❓", bg: "rgba(255,255,255,0.02)" };
                  const moving = moveAnim === n.id;
                  return (
                    <button key={n.id} onClick={() => rch && move(n.id)} disabled={!rch}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        padding: "6px 10px", borderRadius: RADIUS.lg, minWidth: 72,
                        border: `2px solid ${cur ? COLORS.green : rch ? `${z.color}55` : "rgba(255,255,255,0.03)"}`,
                        background: cur ? `${COLORS.green}15` : rch ? z.bg : "rgba(255,255,255,0.02)",
                        cursor: rch ? "pointer" : "default",
                        opacity: cur ? 1 : rch ? 0.9 : 0.35,
                        boxShadow: cur ? `0 0 10px ${COLORS.greenGlow}` : moving ? `0 0 16px ${z.color}33` : "none",
                        transform: moving ? "scale(1.08)" : "scale(1)",
                        transition: "all 0.2s",
                        position: "relative",
                      }}>
                        {n.bossGuarded && <span style={{ position: "absolute", top: -6, right: -6, fontSize: 12 }}>👑</span>}
                        {n.isExtractionPoint && <span style={{ position: "absolute", top: -6, left: -6, fontSize: 12, animation: `za-float ${ANIM_DURATION.float} infinite` }}>🚁</span>}
                        <span style={{ fontSize: 10 }}>{z.icon}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: cur ? COLORS.green : COLORS.text, textAlign: "center", lineHeight: 1.1 }}>
                          {getNodeDisplayLabel(mapState, n.id).replace(/^[🟢🟡🟠🔴⚫]\s*/, "").slice(0, 6)}
                          {cur && "📍"}
                        </span>
                        {rch && !cur && <span style={{ fontSize: 7, color: COLORS.textMuted }}>→</span>}
                      </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 平面模式空狀態 ─────────────────────────── */}
      {!isIsometric && !mapState && (
        <div style={{ padding: "40px 20px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: RADIUS.lg }}>
          <div style={{ fontSize: 48, opacity: 0.3, animation: `za-float ${ANIM_DURATION.float} infinite` }}>🗺️</div>
          <p style={{ fontSize: 12, color: COLORS.textDim, marginTop: 8 }}>生成地圖開始探索</p>
        </div>
      )}

      {/* 撤離橫幅 */}
      {extract.canExtract && (
        <div style={{
          padding: "8px 12px", borderRadius: RADIUS.md, marginBottom: 10, fontSize: 10,
          background: `${COLORS.green}10`, border: `1px solid ${COLORS.green}33`,
          display: "flex", alignItems: "center", gap: 8,
          animation: `za-slide-in-up ${ANIM_DURATION.fast}`,
        }}>
          <span style={{ fontSize: 18, animation: `za-float ${ANIM_DURATION.float} infinite` }}>🚁</span>
          <span style={{ fontWeight: 700, color: COLORS.green }}>撤離點發現</span>
        </div>
      )}

      {/* 日誌 */}
      {log.length > 0 && (
        <div style={{ padding: "6px 10px", borderRadius: RADIUS.md, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", maxHeight: 120, overflowY: "auto", fontSize: 8, lineHeight: 1.8 }}>
          {log.slice(-15).reverse().map((e, i) => (
            <div key={i} style={{ color: e.type === "combat" ? COLORS.red : e.type === "extraction" ? COLORS.green : COLORS.textDim, animation: `za-slide-in-left ${ANIM_DURATION.fast} ${i * 0.01}s both` }}>
              {e.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Btn({ label, onClick, primary, danger }) {
  const base = { padding: "5px 12px", borderRadius: RADIUS.md, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "none", transition: "all 0.12s" };
  const s = primary ? { ...base, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", boxShadow: "0 2px 8px rgba(124,58,237,0.3)" }
    : danger ? { ...base, background: "rgba(239,68,68,0.15)", color: COLORS.red, border: "1px solid rgba(239,68,68,0.3)" }
    : { ...base, background: "rgba(255,255,255,0.04)", color: COLORS.text, border: "1px solid rgba(255,255,255,0.06)" };
  return <button onClick={onClick} style={s}>{label}</button>;
}
