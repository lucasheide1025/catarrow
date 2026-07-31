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
import { buildRaidTimeline, describeEvent, groupRaidVolleys } from "../domain/raidTimeline";
import { RaidBossBar, RaidGauge, RaidIntent, RaidSpotLegend, RaidTeamBar } from "./RaidHud";
import { teamGaugeMax, teamSizeOf } from "../domain/raidTeam";
import { botRoundArrows } from "../domain/raidBot";
import { allSubmitted, pendingMembers } from "../domain/raidTeam";
import { RAID_MEDALS } from "../raidAssets";
import RaidBoss from "./RaidBoss";
import RaidTarget from "./RaidTarget";
import RaidPlayerCard from "./RaidPlayerCard";
import { rangeLabel } from "../domain/raidRange";
import "./raidFx.css";

export default function RaidScreen({
  state,                       // createRaidState 的結果
  onState,                     // (nextState, roundLog) => void
  bossKey, bossTitle,
  participants = 0,
  bgUrl = null,
  playerName = "射手",
  appearance = "baobao",
  // 沙盒用：自動幫隊友出手，單機也驗得到組隊邏輯。正式組隊時是 null（箭來自真人）
  botSkill = null,
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
  const [hurt, setHurt] = useState(false);
  const [skillBanner, setSkillBanner] = useState(null);
  const [pierceMark, setPierceMark] = useState(null);
  // 輪到誰誰上前——8 個人站一排，不標的話不知道現在誰在射
  const [activeShooter, setActiveShooter] = useState(null);
  // 組隊：全員送出才推進。存每個人交上來的箭，收齊了才結算。
  const [submissions, setSubmissions] = useState({});
  // ⚠️ 短螢幕（iPhone SE 可用高度只有 ~553px）本來會把按鈕擠到摺線下方。
  //    王的尺寸跟著畫面高度縮，整頁才不用捲動。
  const [bossSize, setBossSize] = useState(() =>
    Math.round(Math.max(140, Math.min(230, (typeof window !== "undefined" ? window.innerHeight : 700) * 0.30))));
  useEffect(() => {
    const fit = () => setBossSize(Math.round(Math.max(140, Math.min(230, window.innerHeight * 0.30))));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const [floats, setFloats] = useState([]);
  const [message, setMessage] = useState("");
  // 手機畫面塞不下「靶面＋狀態列」，所以靶面收進覆蓋層，按「開始射擊」才打開
  const [scoring, setScoring] = useState(false);
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

  // ── 演出：照 log 順序重播。collected = 已經收齊的全隊箭矢（單人時省略）──
  const playRound = useCallback(collected => {
    if (playing || state.finished) return;
    const meId = state.members?.[0]?.memberId;
    const arrows = Array.isArray(collected) && collected.length
      ? collected
      : pending.map(a => ({ ...a, memberId: meId }));
    if (!arrows.length) return;
    setPlaying(true);
    setMessage("");
    const { state: next, log } = resolveRaidRound({ state, arrows });
    // 三箭一組再播：8 人局逐箭要 25 秒，分組後砍到一半以內
    const timeline = buildRaidTimeline(groupRaidVolleys(log));
    let liveLegs = 0;

    timeline.forEach(event => {
      const t = setTimeout(() => {
        sfxRaidEvent(event);
        setMessage(describeEvent(event) || "");

        switch (event.type) {
          case "arrow": {
            setActiveShooter(event.memberId || null);
            setShown(s => ({ ...(s || {}), bossHp: event.bossHp, hpRatio: event.bossHpRatio, legHits: liveLegs }));
            if (event.hit) {
              liveLegs += event.spot?.id === "red" ? 2 : 1;
              setShown(s => ({ ...(s || {}), legHits: liveLegs }));
              setBossAnim("flinch"); setShake("soft");
              pushFloat(`-${event.damage}`, "weak");
              vibrate(24);
            } else if (event.missed) {
              pushFloat("脫靶", "graze");          // 脫靶＝真的沒傷害
            } else if (event.overCap) {
              pushFloat("無效", "graze");          // 這張靶已經吃滿了
            } else {
              // ⚠️ 上靶但沒中弱點：**照樣要顯示扣了多少血**（作者 2026-07-31）。
              //    原本這裡只印「擦過」兩個字，把傷害數字吃掉了——玩家會以為這箭沒用。
              //    但特效要明顯小一號：只有數字＋輕微震動，不撲擊、不噴粒子、不震畫面。
              pushFloat(`-${event.damage}`, "normal");
              vibrate(6);
            }
            setTimeout(() => { setBossAnim(null); setShake(null); }, 260);
            break;
          }
          case "catAssist":
            setShown(s2 => ({ ...(s2 || {}), bossHp: event.bossHp, hpRatio: event.bossHpRatio }));
            setBossAnim("flinch"); setShake("soft");
            pushFloat(`-${event.damage}`, event.skill ? "weak" : "normal");
            setTimeout(() => { setBossAnim(null); setShake(null); }, 240);
            break;
          case "volley": {
            setActiveShooter(event.memberId || null);
            setShown(s2 => ({ ...(s2 || {}), bossHp: event.bossHp, hpRatio: event.bossHpRatio, legHits: liveLegs }));
            liveLegs += event.arrows.reduce((a, x) => a + (x.hit ? (x.spot?.id === "red" ? 2 : 1) : 0), 0);
            setShown(s2 => ({ ...(s2 || {}), legHits: liveLegs }));
            // 每支箭的數字都要看得到——只是錯開一點，不然疊在一起
            event.arrows.forEach((a, i) => {
              setTimeout(() => {
                if (a.missed) pushFloat("脫靶", "graze");
                else if (a.overCap) pushFloat("無效", "graze");
                else pushFloat(`-${a.damage}`, a.hit ? "weak" : "normal");
              }, i * 130);
            });
            if (event.hits) { setBossAnim("flinch"); setShake("soft"); vibrate(24); }
            else vibrate(6);
            setTimeout(() => { setBossAnim(null); setShake(null); }, 420);
            break;
          }
          case "catVolley":
            setActiveShooter(null);          // 貓上場，射手退回站位
            setShown(s2 => ({ ...(s2 || {}), bossHp: event.bossHp, hpRatio: event.bossHpRatio }));
            event.cats.forEach((c, i) => {
              setTimeout(() => pushFloat(`-${c.damage}`, c.skill ? "weak" : "normal"), i * 120);
            });
            setBossAnim("flinch"); setShake("soft");
            setTimeout(() => { setBossAnim(null); setShake(null); }, 380);
            break;
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
          case "ultCast": {
            // 技能名血字掃過＋王的前搖。名字與顏色都來自既有的 24 王技能資料。
            setSkillBanner({
              name: event.intent?.name || "強攻",
              color: event.intent?.color || "#f43f5e",
              sub: event.hits > 1 ? `${event.hits} 連擊` : (event.weakened ? "已被削弱" : ""),
            });
            setBossAnim("windup");
            vibrate(30);
            setTimeout(() => setSkillBanner(null), 1100);
            setTimeout(() => setBossAnim(null), 900);
            // 穿甲／破盾這種副效果也要看得到，不然玩家不知道自己的防具被無視了
            if (event.pierce) setPierceMark({ text: `🗡️ 穿甲 ${event.pierce}%`, color: "#fca5a5" });
            else if (event.shieldPierce) setPierceMark({ text: `🛡️💥 破盾 ${event.shieldPierce}%`, color: "#93c5fd" });
            if (event.pierce || event.shieldPierce) setTimeout(() => setPierceMark(null), 900);
            break;
          }
          case "ultHit":
            if (event.members) {
              setShown(s2 => ({
                ...(s2 || {}),
                members: (state.members || []).map(mm => {
                  const hit = event.members.find(x => x.memberId === mm.memberId);
                  return hit ? { ...mm, hp: hit.hp } : mm;
                }),
              }));
            }
            setBossAnim("lunge");
            setShake(event.last ? "hard" : "soft");
            setHurt(true);
            vibrate(event.last ? [60, 40, 60] : 35);
            setTimeout(() => { setBossAnim(null); setShake(null); setHurt(false); }, event.last ? 460 : 300);
            break;
          case "statusApply":
            setPierceMark({ text: `☠️ ${event.status?.name || "異常"}`, color: "#c084fc" });
            setTimeout(() => setPierceMark(null), 800);
            break;
          case "ultEnd":
            break;
          case "counterSwing":
            setBossAnim("windup");
            setTimeout(() => setBossAnim(null), 320);
            break;
          case "counter":
            if (event.members) {
              setShown(s2 => ({
                ...(s2 || {}),
                members: (state.members || []).map(mm => {
                  const hit = event.members.find(x => x.memberId === mm.memberId);
                  return hit ? { ...mm, hp: hit.hp } : mm;
                }),
              }));
            }
            setBossAnim("lunge"); setShake("soft"); setHurt(true);
            vibrate(25);
            setTimeout(() => { setBossAnim(null); setShake(null); setHurt(false); }, 320);
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
      setActiveShooter(null);
      setScoring(false);
      setPending([]);
      setSubmissions({});
      setShown(null);
      onState?.(next, log);
      if (next.finished) onFinish?.(next);
    }, total + 240));
  }, [playing, pending, state, onState, onFinish, pushFloat]);

  /**
   * 我送出這回合。
   * ⚠️ **組隊時不會馬上結算**——要等全隊都送出（作者 2026-07-31 指定）。
   *    正式版每個人各自 submitRaidArrows 寫自己那格，房主收齊才推進；
   *    沙盒裡隊友由 bot 陸續交上來，才看得到這個閘門真的在擋。
   */
  const submitRound = useCallback(() => {
    if (playing || state.finished || !pending.length) return;
    const roster = state.members || [];
    const meId = roster[0]?.memberId;
    const mine = pending.map(a => ({ ...a, memberId: meId }));

    if (roster.length < 2) { setScoring(false); playRound(mine); return; }

    const first = { [meId]: mine };
    setSubmissions(first);
    setScoring(false);
    setMessage(`✅ 已送出——等 ${pendingMembers(roster, first).join("、")}`);

    if (!botSkill) return;                    // 正式版：等真人交箭
    roster.filter(m => m.memberId !== meId).forEach((m, i) => {
      timers.current.push(setTimeout(() => {
        setSubmissions(prev => {
          const next = {
            ...prev,
            [m.memberId]: botRoundArrows({
              memberId: m.memberId, spots, skill: botSkill,
              arrows: RAID_ARROWS_PER_ROUND, targetFmt,
            }),
          };
          if (allSubmitted(roster, next)) {
            setMessage("全隊送出，開始結算…");
            timers.current.push(setTimeout(
              () => playRound(roster.flatMap(x => next[x.memberId] || [])), 260));
          } else {
            setMessage(`⏳ 等 ${pendingMembers(roster, next).join("、")}`);
          }
          return next;
        });
      }, 650 * (i + 1)));
    });
  }, [playing, state, pending, spots, botSkill, targetFmt, playRound]);

  const full = pending.length >= RAID_ARROWS_PER_ROUND;

  const range = rangeLabel(state.rangeMult || 1);
  const faceCap = maxArrowsPerFace(targetFmt);
  const teamSize = teamSizeOf(state);
  // 送出之後（等隊友／演出中）才顯示小隊立繪
  const teamRevealed = playing || Object.keys(submissions).length > 0;
  const gaugeMax = teamGaugeMax(teamSize);

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
        style={{ position: "relative", zIndex: 2, flex: "0 1 auto", padding: "10px 0 0" }}>
        <RaidBoss
          bossKey={bossKey} hp={displayHp} maxHp={state.boss.maxHp} size={bossSize}
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

      {/* 小隊站位＋意圖＋破防槽＋戰報：整團用 marginTop:auto 壓到底，
          只跟下面的操作區留一點空。⚠️ auto 要放在這裡，放在操作區上會把它們留在上面。 */}
      <div style={{ position: "relative", zIndex: 4, marginTop: "auto", marginBottom: 4 }}>
        {/* ⚠️ 小隊站位不能用絕對定位——8 個人會壓在王身上。
            ⚠️ **非戰鬥中先隱藏，送出分數後才亮出來**（作者 2026-07-31）：
               短螢幕（iPhone SE 可用高度 ~553px）上這一列會把按鈕擠到摺線下方。 */}
        {teamSize > 1 && teamRevealed && (
          <RaidTeamBar members={shown?.members || state.members}
            meId={state.members?.[0]?.memberId} activeId={activeShooter} submitted={submissions} />
        )}

        <RaidIntent intent={intent} legHits={legHits} />
        <RaidGauge gauge={displayGauge.gauge} max={gaugeMax} burstActive={burstOn} />

        <div style={{
          minHeight: 20, padding: "0 12px",
          fontSize: 12, fontWeight: 700, color: "#cbd5e1", textAlign: "center",
        }}>{message}</div>
      </div>

      {/* 操作區：計分中就收起來，把畫面讓給靶面。
          版式＝**左邊一塊玩家資訊、右邊小按鈕**（作者 2026-07-31）——
          原本按鈕各佔一整行，把畫面高度吃掉，王都快看不到了。 */}
      {!scoring && (
        <div style={{
          // ⚠️ 黏在畫面底部：萬一內容還是超過視窗高度（超短螢幕、系統字放大、
          //    瀏覽器工具列彈出），按鈕也一定點得到。這是最後一道保險。
          position: "sticky", bottom: 0, zIndex: 6,
          background: "linear-gradient(180deg,rgba(2,6,23,.72),rgba(2,6,23,.98))",
          backdropFilter: "blur(3px)",
          padding: "8px 10px 12px", display: "flex", flexDirection: "column", gap: 7,
        }}>
          <RaidSpotLegend spots={spots} />

          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            {/* 左：玩家資訊一塊。
                ⚠️ **開始戰鬥後整塊隱藏**（作者 2026-07-31）：小隊站位已經有「我」的立繪
                   與王卡皇冠，這裡再放一次就是同一個人出現兩次。
                   演出期間改成一行精簡狀態，資訊不掉但不佔高度也不重複。 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {teamRevealed ? (
                <div style={{
                  display: "flex", flexDirection: "column", justifyContent: "center",
                  height: "100%", gap: 4, paddingLeft: 2,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#cbd5e1" }}>
                    {playing ? "⚔️ 戰鬥進行中" : "⏳ 等隊友送出"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,.1)", overflow: "hidden", maxWidth: 120 }}>
                      <div style={{
                        height: "100%", transition: "width .3s",
                        width: `${Math.max(0, Math.min(100, (state.playerHp / (state.playerMaxHp || 1)) * 100))}%`,
                        background: state.playerHp / (state.playerMaxHp || 1) > 0.3 ? "#22c55e" : "#ef4444",
                      }} />
                    </div>
                    <span style={{ fontSize: 9.5, color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {Math.max(0, Math.round(state.playerHp))}/{Math.round(state.playerMaxHp)}
                      　{Math.min(state.round, RAID_TOTAL_ROUNDS)}/{RAID_TOTAL_ROUNDS} 回合
                      {burstOn && <b style={{ color: "#fde68a" }}>　💥×{burstMultiplier(displayGauge, state.round)}</b>}
                    </span>
                  </div>
                </div>
              ) : (
              <>
              <RaidPlayerCard
                name={playerName} hp={state.playerHp} maxHp={state.playerMaxHp}
                atk={state.stats.atk} def={state.stats.def}
                archerLevel={state.archerLevel} cats={state.cats}
                wbCard={state.members?.[0]?.wbCard}
                wbCardCount={state.members?.[0]?.wbCardCount}
                baseStats={state.members?.[0]?.baseStats}
                teamLabel={teamSize > 1 ? (state.teamBuff?.label || "") : ""}
                compact
              />
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, paddingLeft: 2 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: RAID_ARROWS_PER_ROUND }).map((_, i) => (
                    <span key={i} style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: pending[i] ? "#fbbf24" : "rgba(255,255,255,.14)",
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 9.5, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {raidFaceLabel(targetFmt)}・{state.distanceM}m
                  <b style={{ color: range.color }}> ×{(state.rangeMult || 1).toFixed(2)}</b>
                  　{Math.min(state.round, RAID_TOTAL_ROUNDS)}/{RAID_TOTAL_ROUNDS} 回合
                  {burstOn && <b style={{ color: "#fde68a" }}>　💥×{burstMultiplier(displayGauge, state.round)}</b>}
                </span>
              </div>
              </>
              )}
            </div>

            {/* 右：小按鈕 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 96, flex: "0 0 auto" }}>
              <button type="button" disabled={playing || state.finished}
                onClick={() => { unlockAudio(); setScoring(true); setMessage(""); sfxTap(); }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                  background: playing ? "#475569" : "linear-gradient(135deg,#f59e0b,#b45309)",
                  color: "#fff", fontWeight: 900, fontSize: 12, lineHeight: 1.3,
                  cursor: playing || state.finished ? "not-allowed" : "pointer",
                }}>
                {playing ? "演出中" : pending.length ? `繼續射擊\n${pending.length}/${RAID_ARROWS_PER_ROUND}` : "🏹 開始射擊"}
              </button>

              {pending.length > 0 && !playing && (
                <button type="button" onClick={submitRound}
                  style={{
                    padding: "8px 0", borderRadius: 10, border: "1px solid #f59e0b",
                    background: "transparent", color: "#fbbf24", fontWeight: 900, fontSize: 11, cursor: "pointer",
                  }}>✅ 送出</button>
              )}

              {onExit && !playing && (
                <button type="button" onClick={onExit}
                  style={{
                    padding: "6px 0", borderRadius: 9, border: "1px solid rgba(255,255,255,.12)",
                    background: "transparent", color: "#64748b", fontSize: 10, cursor: "pointer",
                  }}>離開</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 計分覆蓋層：靶面只在這裡出現，狀態列同時收起來 */}
      {scoring && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 25,
          background: "rgba(2,6,23,.94)", display: "flex", flexDirection: "column",
          padding: "10px 12px 14px", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#c7d2fe" }}>
              {raidFaceLabel(targetFmt)}・{state.distanceM}m　×{(state.rangeMult || 1).toFixed(2)}
            </span>
            <div style={{ display: "flex", gap: 5 }}>
              {Array.from({ length: RAID_ARROWS_PER_ROUND }).map((_, i) => (
                <span key={i} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: pending[i] ? "#fbbf24" : "rgba(255,255,255,.16)",
                }} />
              ))}
            </div>
          </div>

          <RaidSpotLegend spots={spots} />

          <div style={{ flex: 1, display: "grid", placeItems: "center", minHeight: 0 }}>
            <RaidTarget
              fmtId={targetFmt}
              spots={spots}
              disabled={playing || full}
              arrows={pending}
              radius={150}
              onArrow={rec => addArrow(rec)}
            />
          </div>

          {faceCap != null && (
            <div style={{ fontSize: 10.5, color: "#fbbf24", textAlign: "center", lineHeight: 1.6 }}>
              ⚠️ 三連靶：每張靶只吃 <b>{faceCap} 箭</b>的傷害，多射的照樣記錄但不算傷害
            </div>
          )}
          <div style={{ minHeight: 18, fontSize: 11.5, color: "#cbd5e1", textAlign: "center" }}>{message}</div>

          <div style={{ display: "flex", gap: 8 }}>
            {pending.length > 0 && (
              <button type="button" onClick={() => { setPending(list => list.slice(0, -1)); sfxTap(); }}
                style={{
                  padding: "12px 14px", borderRadius: 11, border: "none",
                  background: "#334155", color: "#e2e8f0", fontWeight: 900, cursor: "pointer",
                }}>↩︎ 收回</button>
            )}
            <button type="button" onClick={() => { setScoring(false); sfxTap(); }}
              style={{
                padding: "12px 14px", borderRadius: 11, border: "1px solid #475569",
                background: "transparent", color: "#94a3b8", fontWeight: 900, cursor: "pointer",
              }}>收起</button>
            <button type="button" disabled={!pending.length}
              onClick={submitRound}
              style={{
                flex: 1, padding: "13px 0", borderRadius: 11, border: "none",
                background: pending.length ? "linear-gradient(135deg,#f59e0b,#b45309)" : "#475569",
                color: "#fff", fontWeight: 900, fontSize: 15,
                cursor: pending.length ? "pointer" : "not-allowed",
              }}>
              {full ? "🏹 送出這回合" : `🏹 送出（${pending.length}/${RAID_ARROWS_PER_ROUND}）`}
            </button>
          </div>
        </div>
      )}

      {/* 結算：討伐結束就鎖住畫面，不能再打下去（沒有這層的話回合會一直往上加）*/}
      {state.finished && !playing && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 30, display: "grid", placeItems: "center",
          background: "rgba(2,6,23,.88)", padding: 20,
        }}>
          <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
            <img
              src={state.bossHp <= 0 ? RAID_MEDALS.victory
                : state.totals.breakPoints >= 20 ? RAID_MEDALS.breaker : RAID_MEDALS.lasthit}
              alt=""
              onError={e => { e.currentTarget.style.display = "none"; }}
              style={{ width: 116, height: 116, objectFit: "contain", margin: "0 auto 6px", display: "block",
                filter: state.bossHp <= 0 ? "drop-shadow(0 0 22px rgba(253,230,138,.65))" : "saturate(.6)" }}
            />
            <div style={{ fontSize: 28, fontWeight: 900, color: state.bossHp <= 0 ? "#fde68a" : "#e2e8f0" }}>
              {state.bossHp <= 0 ? "討伐成功" : state.members.every(m => m.hp <= 0) ? "力竭撤退" : "出擊結束"}
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
      {hurt && <div className="raid-hurt" />}
      {skillBanner && (
        <div className="raid-skill-banner"
          style={{ color: skillBanner.color, textShadow: `0 0 26px ${skillBanner.color}, 0 3px 10px rgba(0,0,0,.9)` }}>
          {skillBanner.name}
          {skillBanner.sub && <span className="raid-skill-sub" style={{ color: "#e2e8f0" }}>{skillBanner.sub}</span>}
        </div>
      )}
      {pierceMark && (
        <div className="raid-pierce-mark" style={{ color: pierceMark.color, textShadow: "0 2px 8px rgba(0,0,0,.9)" }}>
          {pierceMark.text}
        </div>
      )}
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
