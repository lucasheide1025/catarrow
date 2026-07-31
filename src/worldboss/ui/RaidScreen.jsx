// src/worldboss/ui/RaidScreen.jsx
// 討伐版式的外殼＋演出引擎。
//
// ⚠️ 演出鐵律：domain 產生 log，這裡**照 log 的原順序**重播（buildRaidTimeline）。
//    不按事件類型分桶——公會就是那樣才會「怪物全滅前直接跳過戰鬥動畫」。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { maxArrowsPerFace, raidFaceLabel } from "../domain/raidFaces";
import { sfxLockOn, sfxRaidEvent, sfxTap, unlockAudio, vibrate } from "../../lib/sound";
import { burstMultiplier, isBurstActive } from "../domain/breakGauge";
import { intentForRound } from "../domain/bossIntent";
import { hitSpot } from "../domain/weakPoints";
import { PHASE_TINTS, currentPhase } from "../domain/raidPhases";
import { RAID_ARROWS_PER_ROUND, RAID_TOTAL_ROUNDS, raidHpRatio, resolveRaidRound } from "../domain/raidFlow";
import { buildRaidTimeline, describeEvent } from "../domain/raidTimeline";
import { RaidBossBar, RaidGauge, RaidIntent, RaidSpotLegend } from "./RaidHud";
import RaidBoss from "./RaidBoss";
import RaidTarget from "./RaidTarget";
import { rangeLabel } from "../domain/raidRange";
import "./raidFx.css";

export default function RaidScreen({
  state,                       // createRaidState 的結果
  onState,                     // (nextState, roundLog) => void
  bossKey, bossTitle,
  participants = 0,
  bgUrl = null,
  // ⚠️ 靶面輸入是**強制**的（作者 2026-07-31）：弱點的精準判定要靠落點，
  //    按分數鍵給不出位置，整套「射在紙上的位置＝射在牠身上的位置」就不成立。
  targetFmt = "half_17",
  onFinish,
  onExit,
}) {
  const [pending, setPending] = useState([]);       // 本回合已輸入的箭
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(null);         // 演出中的即時畫面狀態
  const [banner, setBanner] = useState(null);
  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(null);
  const [bossAnim, setBossAnim] = useState(null);
  const [floats, setFloats] = useState([]);
  const [message, setMessage] = useState("");
  const timers = useRef([]);
  const floatId = useRef(0);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const phase = currentPhase(shown?.hpRatio ?? raidHpRatio(state));
  const intent = useMemo(
    () => intentForRound({ config: state.boss.skillConfig, round: state.round, phaseId: phase.id }),
    [state.boss.skillConfig, state.round, phase.id],
  );
  const displayHp = shown?.bossHp ?? state.bossHp;
  const displayGauge = shown?.gauge ?? state.gauge;
  const burstOn = isBurstActive(displayGauge, state.round);

  const spots = state.spots || [];
  // 輸入中先不透露打斷進度（要射完才知道有沒有中）；演出時才跑真實數字
  const legHits = shown?.legHits ?? 0;

  const pushFloat = useCallback((text, kind) => {
    const key = floatId.current++;
    setFloats(list => [...list.slice(-5), { key, text, kind, left: 40 + Math.random() * 20 }]);
    setTimeout(() => setFloats(list => list.filter(f => f.key !== key)), 1200);
  }, []);

  const addArrow = useCallback(arrow => {
    if (playing || state.finished || pending.length >= RAID_ARROWS_PER_ROUND) return;
    unlockAudio();
    const spot = hitSpot(spots, arrow.nx, arrow.ny);
    setPending(list => [...list, { ...arrow, spotId: spot?.id || null }]);
    setMessage("");
    if (spot) { sfxLockOn(); vibrate(12); } else { sfxTap(); }
  }, [playing, state.finished, pending.length, spots]);

  // ── 演出：照 log 順序重播 ──
  const playRound = useCallback(() => {
    if (playing || state.finished || !pending.length) return;
    setPlaying(true);
    setMessage("");
    const { state: next, log } = resolveRaidRound({ state, arrows: pending });
    const timeline = buildRaidTimeline(log);
    let liveLegs = 0;

    timeline.forEach(event => {
      const t = setTimeout(() => {
        sfxRaidEvent(event);
        setMessage(describeEvent(event) || "");

        switch (event.type) {
          case "arrow": {
            setShown(s => ({ ...(s || {}), bossHp: event.bossHp, hpRatio: event.bossHpRatio, legHits: liveLegs }));
            if (event.hit) {
              liveLegs += event.spot?.id === "red" ? 2 : 1;
              setShown(s => ({ ...(s || {}), legHits: liveLegs }));
              setBossAnim("flinch"); setShake("soft");
              pushFloat(`-${event.damage}`, "weak");
              vibrate(24);
            } else if (event.missed) {
              pushFloat("脫靶", "graze");
            } else if (event.grazed || event.blocked) {
              pushFloat(event.blocked ? "被護住" : "擦過", "graze");
              vibrate(8);
            } else {
              pushFloat(`-${event.damage}`, "normal");
            }
            setTimeout(() => { setBossAnim(null); setShake(null); }, 260);
            break;
          }
          case "gauge":
            setShown(s => ({ ...(s || {}), gauge: event.gauge }));
            break;
          case "breakthrough":
            setFlash(true); setBanner({ text: "破防", color: "#fde68a", wave: true });
            vibrate([40, 60, 90]);
            setTimeout(() => setFlash(false), 520);
            setTimeout(() => setBanner(null), 1500);
            break;
          case "interrupt":
            setBanner({ text: "破綻！", color: "#4ade80" });
            setBossAnim("stagger"); vibrate([30, 40, 30]);
            setTimeout(() => setBanner(null), 1200);
            break;
          case "phaseShift":
            setBossAnim("roar"); setShake("hard");
            setBanner({ text: event.phase?.name || "", color: "#c084fc" });
            setTimeout(() => { setBossAnim(null); setShake(null); setBanner(null); }, 1400);
            break;
          case "ult":
            setShake("hard"); vibrate([60, 40, 60]);
            setTimeout(() => setShake(null), 520);
            break;
          case "bossDown":
            setBossAnim("fall"); setBanner({ text: "討伐成功", color: "#fde68a", wave: true });
            vibrate([80, 60, 120]);
            break;
          default:
            break;
        }
      }, event.atMs);
      timers.current.push(t);
    });

    const total = timeline.length ? timeline[timeline.length - 1].atMs + timeline[timeline.length - 1].durationMs : 0;
    timers.current.push(setTimeout(() => {
      setPlaying(false);
      setPending([]);
      setShown(null);
      onState?.(next, log);
      if (next.finished) onFinish?.(next);
    }, total + 240));
  }, [playing, pending, state, onState, onFinish, pushFloat]);

  const full = pending.length >= RAID_ARROWS_PER_ROUND;

  const range = rangeLabel(state.rangeMult || 1);
  const faceCap = maxArrowsPerFace(targetFmt);

  return (
    <div className="raid-stage" style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      background: "#05040a", color: "#e2e8f0", position: "relative", overflow: "hidden",
    }}>
      {/* 景深：遠景天空 */}
      {bgUrl && <div className="raid-parallax-sky" style={{ backgroundImage: `url(${bgUrl})` }} />}
      <div className="raid-vignette" />
      <div className="raid-parallax-fg" />
      <div className="raid-tint" style={{ background: phase.tint ? PHASE_TINTS[phase.tint] : "transparent" }} />

      {/* 全場共享血條 */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <RaidBossBar
          name={state.boss.name} title={bossTitle} phase={phase}
          hp={displayHp} maxHp={state.boss.maxHp} participants={participants}
        />
      </div>

      {/* 舞台：王 ＋ 部位熱點 */}
      <div className={`${shake === "hard" ? "raid-shake-hard" : shake === "soft" ? "raid-shake-soft" : ""}`}
        style={{ position: "relative", zIndex: 2, flex: "0 0 auto", padding: "10px 0 4px" }}>
        <RaidBoss
          bossKey={bossKey} hp={displayHp} maxHp={state.boss.maxHp} size={230}
          spots={spots} charging={intent.charging} staggered={state.staggered}
          anim={bossAnim}
        />
        {/* 傷害數字 */}
        {floats.map(f => (
          <span key={f.key}
            className={`raid-dmg ${f.kind === "weak" ? "raid-dmg-weak" : f.kind === "graze" ? "raid-dmg-graze" : "raid-dmg-normal"}`}
            style={{ left: `${f.left}%`, top: "38%" }}>{f.text}</span>
        ))}
      </div>

      {/* 意圖 ＋ 破防槽 */}
      <div style={{ position: "relative", zIndex: 3 }}>
        <RaidIntent intent={intent} legHits={legHits} />
        <RaidGauge gauge={displayGauge.gauge} burstActive={burstOn} />
      </div>

      {/* 戰報 */}
      <div style={{
        position: "relative", zIndex: 3, minHeight: 22, padding: "0 12px",
        fontSize: 12, fontWeight: 700, color: "#cbd5e1", textAlign: "center",
      }}>{message}</div>

      {/* 操作區 */}
      <div style={{
        position: "relative", zIndex: 3, marginTop: "auto",
        background: "linear-gradient(180deg,rgba(2,6,23,.55),rgba(2,6,23,.96))",
        padding: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 9,
      }}>
        <RaidSpotLegend spots={spots} />

        {/* 箭數進度 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: RAID_ARROWS_PER_ROUND }).map((_, i) => {
              const a = pending[i];
              return (
                <span key={i} title={a ? `${a.label ?? a.score}${a.spotId ? `・${a.spotId}` : ""}` : ""}
                  style={{
                    width: 11, height: 11, borderRadius: "50%",
                    background: a ? "#fbbf24" : "rgba(255,255,255,.14)",
                    boxShadow: a ? "0 0 7px rgba(251,191,36,.7)" : "none",
                  }} />
              );
            })}
          </div>
          <span style={{ fontSize: 10.5, color: "#94a3b8" }}>
            {raidFaceLabel(targetFmt)}・{state.distanceM}m
            <b style={{ color: range.color }}>　×{(state.rangeMult || 1).toFixed(2)}</b>
            　第 {Math.min(state.round, RAID_TOTAL_ROUNDS)}/{RAID_TOTAL_ROUNDS} 回合
            {burstOn && <b style={{ color: "#fde68a" }}>　💥 ×{burstMultiplier(displayGauge, state.round)}</b>}
          </span>
        </div>

        {/* 計分：強制靶面 */}
        <RaidTarget
          fmtId={targetFmt}
          spots={spots}
          disabled={playing || full}
          arrows={pending}
          radius={122}
          onArrow={rec => addArrow(rec)}
          onFullFace={i => {
            setMessage(`${["左", "中", "右"][i] || ""}靶已經吃滿 ${faceCap} 箭了——換一張射。`);
            sfxTap();
          }}
        />
        {faceCap != null && (
          <div style={{ fontSize: 10.5, color: "#fbbf24", textAlign: "center", lineHeight: 1.6 }}>
            ⚠️ 三連靶：每張靶最多只吃 <b>{faceCap} 箭</b>，六箭要平均分到左／中／右
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {pending.length > 0 && !playing && (
            <button type="button" onClick={() => { setPending(list => list.slice(0, -1)); sfxTap(); }}
              style={{
                padding: "12px 14px", borderRadius: 11, border: "none",
                background: "#334155", color: "#e2e8f0", fontWeight: 900, cursor: "pointer",
              }}>↩︎ 收回</button>
          )}
          <button type="button" disabled={playing || !pending.length} onClick={playRound}
            style={{
              flex: 1, padding: "13px 0", borderRadius: 11, border: "none",
              background: playing ? "#475569"
                : pending.length ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#475569",
              color: "#fff", fontWeight: 900, fontSize: 15,
              cursor: playing || !pending.length ? "not-allowed" : "pointer",
              boxShadow: pending.length && !playing ? "0 4px 16px rgba(245,158,11,.4)" : "none",
            }}>
            {playing ? "演出中…" : full ? "🏹 送出這回合" : `🏹 送出（${pending.length}/${RAID_ARROWS_PER_ROUND}）`}
          </button>
        </div>

        {onExit && !playing && (
          <button type="button" onClick={onExit}
            style={{ padding: "7px 0", borderRadius: 9, border: "none", background: "transparent", color: "#64748b", fontSize: 11, cursor: "pointer" }}>
            離開討伐
          </button>
        )}
      </div>

      {/* 結算：討伐結束就鎖住畫面，不能再打下去（沒有這層的話回合會一直往上加）*/}
      {state.finished && !playing && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 30, display: "grid", placeItems: "center",
          background: "rgba(2,6,23,.88)", padding: 20,
        }}>
          <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: state.bossHp <= 0 ? "#fde68a" : "#e2e8f0" }}>
              {state.bossHp <= 0 ? "🏆 討伐成功" : state.playerHp <= 0 ? "💀 力竭撤退" : "⏱ 出擊結束"}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6, marginBottom: 16 }}>
              {state.bossHp <= 0 ? "牠倒下了。" : "牠還站著——但你打掉的每一分血都算數。"}
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, fontSize: 12,
              background: "rgba(15,23,42,.9)", borderRadius: 12, padding: 14, textAlign: "left",
            }}>
              <div>總傷害　<b style={{ color: "#fbbf24" }}>{state.totals.damage.toLocaleString()}</b></div>
              <div>破防貢獻　<b style={{ color: "#fbbf24" }}>{state.totals.breakPoints}</b></div>
              <div>弱點命中　<b>{state.totals.weakHits}</b></div>
              <div>擦過　<b style={{ color: "#94a3b8" }}>{state.totals.grazes}</b></div>
              <div>最高連擊　<b>{state.totals.bestCombo}</b></div>
              <div>成功打斷　<b style={{ color: "#4ade80" }}>{state.totals.interrupts}</b></div>
            </div>
            <button type="button" onClick={() => onExit?.()}
              style={{
                marginTop: 16, width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
                background: "linear-gradient(135deg,#f59e0b,#b45309)", color: "#fff",
                fontWeight: 900, fontSize: 15, cursor: "pointer",
              }}>收工</button>
          </div>
        </div>
      )}

      {/* 全螢幕演出層 */}
      {flash && <div className="raid-flash" style={{ zIndex: 20 }} />}
      {banner && (
        <>
          {banner.wave && <div className="raid-shockwave" style={{ zIndex: 21 }} />}
          <div className="raid-banner" style={{ zIndex: 22, color: banner.color, textShadow: `0 0 30px ${banner.color}` }}>
            {banner.text}
          </div>
        </>
      )}
    </div>
  );
}
