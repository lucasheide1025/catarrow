// src/worldboss/ui/RaidSandbox.jsx
// 🚧 討伐版式的試裝間（?raid）。假資料驅動，不碰 Firestore、不影響線上世界王。
//
// 為什麼要沙盒：既有慣例「先驗證再實裝」（battle-ui-redesign.md 實裝計畫第 1 條）。
// 這裡可以自由切換王、玩家強度、輸入模式，把版式與所有特效先看爽度，
// 確認 OK 才接到真正的世界王戰鬥。
import { useMemo, useState } from "react";
import { WORLD_BOSSES } from "../../lib/worldBossData";
import { WORLD_BOSS_SKILLS } from "../../lib/worldBossSkillData";
import { DEFAULT_RAID_FACE, RAID_FACES, faceMultiplier } from "../domain/raidFaces";
import { RAID_DISTANCES, RAID_DEFAULT_DISTANCE, distanceMultiplier, rangeLabel, rangeMultiplier } from "../domain/raidRange";
import { rookieMultiplier } from "../domain/raidRookie";
import { RAID_MAX_TEAM, canTeamDepart, teamBreakSpeedup, teamGaugeMax, teamInterruptRequired, teamStatBonus } from "../domain/raidTeam";
import { RAID_DAILY_ATTEMPTS, consumeAttempt, todayKey } from "../domain/raidQuota";
import { lobbyView, soloDepart } from "../domain/raidLobby";
import { clearRaidProgress, loadRaidProgress, resumeLabel } from "../domain/raidResume";
import { BOT_SKILLS } from "../domain/raidBot";
import { CATS, CAT_TYPE_MAP } from "../../lib/catData";
import { calcCatCombatStats } from "../../lib/catCombat";
import { createRaidState } from "../domain/raidFlow";
import { RAID_LOBBY_BG, raidBackground } from "../raidAssets";
import RaidScreen from "./RaidScreen";
import RaidKillCutscene from "./RaidKillCutscene";
import RaidSoloRoom from "./RaidSoloRoom";
import RaidWaitRoom from "./RaidWaitRoom";
import { KILL_RARITY_COLOR, KILL_STYLES, buildKillPayload, detectKillStyle } from "../domain/raidKill";

const PRESETS = {
  rookie:  { label: "新手白板", atk: 30,  def: 30, hp: 180 },
  mid:     { label: "中階玩家", atk: 120, def: 60, hp: 260 },
  veteran: { label: "114 級好裝", atk: 300, def: 95, hp: 380 },
};

const DEFAULT_BOSS_FOR_RESUME = null;   // 沙盒不限定王，載入時再比對

const BOSS_CHOICES = ["cat_baobao", "ghost_boss_r1", "head_coach"]
  .filter(key => WORLD_BOSSES[key])
  .concat(Object.keys(WORLD_BOSSES).slice(0, 6))
  .filter((v, i, arr) => arr.indexOf(v) === i)
  .slice(0, 8);

export default function RaidSandbox() {
  const [bossKey, setBossKey] = useState(BOSS_CHOICES[0] || Object.keys(WORLD_BOSSES)[0]);
  const [preset, setPreset] = useState("mid");
  const [targetFmt, setTargetFmt] = useState(DEFAULT_RAID_FACE);
  const [distanceM, setDistanceM] = useState(RAID_DEFAULT_DISTANCE);
  const [catId, setCatId] = useState("baobao");
  const [archerLevel, setArcherLevel] = useState(10);
  const [teamCount, setTeamCount] = useState(1);
  const [spentIdx, setSpentIdx] = useState(-1);   // 模擬「某個隊員次數用完」
  const [botSkill, setBotSkill] = useState("mid");
  const [wbCardMode, setWbCardMode] = useState("me");   // none / me / half / all
  const [hpScale, setHpScale] = useState(0.05);   // 沙盒預設把血調低，才看得到階段轉換
  const [runId, setRunId] = useState(0);
  const [state, setState] = useState(null);
  const [summary, setSummary] = useState(null);
  // 全服擊倒重播：正式版存在王文件上，全服玩家都會播一次
  const [killPayload, setKillPayload] = useState(null);
  const [replaying, setReplaying] = useState(false);
  // ⚠️ 重播要能連按——RaidKillCutscene 的分鏡是內部 state，
  //    只換 payload 不會回到第一幕，必須用 key 讓它重新掛載。
  const [replaySeq, setReplaySeq] = useState(0);
  const playReplay = payload => { setKillPayload(payload); setReplaySeq(n => n + 1); setReplaying(true); };
  // 防重整：一進來就看看有沒有沒打完的場次
  const [resume, setResume] = useState(() => loadRaidProgress({ bossKey: DEFAULT_BOSS_FOR_RESUME }));

  // 前置畫面：單人房 / 等待室。用假房間驅動，一樣不碰 Firestore。
  const [roomScreen, setRoomScreen] = useState("none");   // none | solo | wait
  const [joinCode, setJoinCode] = useState("");
  const [readyOverride, setReadyOverride] = useState({});   // memberId -> bool

  const boss = WORLD_BOSSES[bossKey];

  const start = () => {
    const maxHp = Math.max(1000, Math.round((boss?.hp || 200000) * hpScale));
    const p = PRESETS[preset];
    setSummary(null);
    setState(createRaidState({
      boss: {
        key: bossKey, name: boss?.name || bossKey,
        hp: maxHp, maxHp, atk: boss?.atk || 120, def: boss?.def || 50,
        skillConfig: WORLD_BOSS_SKILLS?.[bossKey] || null,
      },
      stats: { atk: p.atk, def: p.def, hp: p.hp },
      archerLevel,
      wbCard: wbCardMode === "me" || wbCardMode === "all" || wbCardMode === "half",
      wbCardCount: wbCardMode === "none" ? 0 : 1,
      members: teamCount < 2 ? null : Array.from({ length: teamCount }, (_, i) => ({
        memberId: `m${i}`, name: i === 0 ? "我" : `隊友${i}`,
        wbCard: wbCardMode === "all" || (wbCardMode === "me" && i === 0)
          || (wbCardMode === "half" && i % 2 === 0),
        wbCardCount: 1,
        stats: { atk: p.atk, def: p.def, hp: p.hp },
        archerLevel: i === 0 ? archerLevel : 60,
        cats: catId === "none" ? [] : [(() => {
          const st = calcCatCombatStats({ catId, catXP: 4000, bond: 20 }, catId);
          return { catId, name: CATS[catId]?.name || catId, atk: st.catATK };
        })()],
      })),
      cats: catId === "none" ? [] : [(() => {
        const st = calcCatCombatStats({ catId, catXP: 4000, bond: 20 }, catId);
        return { catId, name: CATS[catId]?.name || catId, atk: st.catATK, skillGroup: CAT_TYPE_MAP[catId] };
      })()],
      distanceM,
      targetFmt,
    }));
    setRunId(n => n + 1);
  };

  // ── 前置畫面（單人房／等待室）─────────────────────────────
  const memberIdAt = i => (i === 0 ? "me" : `bot${i}`);
  const spentParticipant = { attemptDate: todayKey(), attempts: RAID_DAILY_ATTEMPTS };
  const mockParticipants = spentIdx >= 0 ? { [memberIdAt(spentIdx)]: spentParticipant } : {};

  const mockRoom = (() => {
    const p = PRESETS[preset];
    const n = Math.max(2, teamCount);
    const members = {};
    for (let i = 0; i < n; i += 1) {
      const id = memberIdAt(i);
      // 預設「最後一位還沒準備」——才看得到房主被擋住的樣子
      const auto = i < n - 1;
      members[id] = {
        name: i === 0 ? "我" : `隊友${i}`,
        ready: readyOverride[id] ?? auto,
        atk: p.atk, def: p.def, hp: p.hp,
        archerLevel: i === 0 ? archerLevel : 30 + i,
        cats: [], joinedAt: i,
        // 靶紙與射程各自決定——假隊友刻意給不一樣的，才看得出畫面有沒有分開顯示
        targetFmt: i === 0 ? targetFmt : RAID_FACES[i % RAID_FACES.length].id,
        distanceM: i === 0 ? distanceM : 5 + ((i * 4) % 14),
      };
    }
    return {
      id: "mock", code: "CAT777", status: "waiting",
      hostId: "me", hostName: "我",
      bossKey, targetFmt, distanceM, members,
    };
  })();

  if (roomScreen === "solo") {
    return (
      <RaidSoloRoom
        bossKey={boss?.pixelKey || bossKey} bossName={boss?.name} bossDesc={boss?.desc}
        bossHp={Math.round((boss?.hp || 200000) * 0.62)} bossMaxHp={boss?.hp || 200000}
        stats={{ atk: PRESETS[preset].atk, def: PRESETS[preset].def, hp: PRESETS[preset].hp }}
        archerLevel={archerLevel}
        catName={catId === "none" ? null : CATS[catId]?.name}
        targetFmt={targetFmt} distanceM={distanceM}
        onTargetFmt={setTargetFmt} onDistance={setDistanceM}
        depart={soloDepart({ participant: spentIdx === 0 ? spentParticipant : {} })}
        resume={resume ? { label: resumeLabel(resume.record) } : null}
        onResume={() => { setState(resume.state); setRunId(n => n + 1); setResume(null); setRoomScreen("none"); }}
        onDiscardResume={() => { clearRaidProgress(); setResume(null); }}
        onDepart={() => { setRoomScreen("none"); setTeamCount(1); start(); }}
        onCreateRoom={() => setRoomScreen("wait")}
        onJoinRoom={() => setRoomScreen("wait")}
        joinCode={joinCode} onJoinCode={setJoinCode}
        onExit={() => setRoomScreen("none")}
      />
    );
  }

  if (roomScreen === "wait") {
    const view = lobbyView(mockRoom, "me", { participants: mockParticipants });
    return (
      <RaidWaitRoom
        view={view} bossName={boss?.name}
        onReady={v => setReadyOverride(o => ({ ...o, me: v }))}
        onStart={() => { setRoomScreen("none"); setTeamCount(view.size); start(); }}
        onKick={id => setReadyOverride(o => ({ ...o, [id]: true }))}
        onTargetFmt={setTargetFmt} onDistance={setDistanceM}
        onLeave={() => setRoomScreen("solo")}
        onDisband={() => setRoomScreen("none")}
      />
    );
  }

  if (state) {
    return (
      <RaidScreen
        key={runId}
        state={state}
        bossKey={boss?.pixelKey || bossKey}
        bossTitle={boss?.title}
        bossMeta={{ family: boss?.family, familyTier: boss?.familyTier }}
        participants={24}
        playerName={`${PRESETS[preset].label}`}
        botSkill={teamCount > 1 ? botSkill : null}
        appearance={catId === "none" ? "baobao" : catId}
        bgUrl={raidBackground(boss?.family)}
        targetFmt={targetFmt}
        onState={next => setState(next)}
        onFinish={next => { setSummary(next); clearRaidProgress(); }}
        onKill={p => setKillPayload(p)}
        onExit={() => setState(null)}
      />
    );
  }

  const cardStyle = { background: "rgba(15,23,42,.9)", borderRadius: 14, padding: 14, marginBottom: 12 };
  const labelStyle = { fontSize: 11, fontWeight: 900, color: "#c7d2fe", marginBottom: 7 };

  return (
    <div style={{
      minHeight: "100dvh", color: "#e2e8f0", padding: 16, maxWidth: 520, margin: "0 auto",
      backgroundImage: `linear-gradient(180deg,rgba(5,4,10,.88),rgba(15,23,42,.96)), url(${RAID_LOBBY_BG})`,
      backgroundSize: "cover", backgroundPosition: "center top", backgroundAttachment: "fixed",
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fde68a", marginBottom: 4 }}>
        🚧 世界王討伐・試裝間
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14, lineHeight: 1.7 }}>
        假資料驅動，不會碰到線上的世界王。用來確認版式與聲光效果——確認 OK 才接真的。
      </div>

      {/* 前置畫面入口。⚠️ 這兩個是玩家真正的入口，不是沙盒面板——
          沙盒面板只是調參數用的，正式版看不到。 */}
      <div style={{ ...cardStyle, border: "1px solid rgba(74,222,128,.4)" }}>
        <div style={labelStyle}>🚪 出擊前的前置畫面</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button type="button" onClick={() => setRoomScreen("solo")} style={{
            padding: "12px 0", borderRadius: 9, border: "1px solid #4ade80",
            background: "rgba(74,222,128,.14)", color: "#e2e8f0",
            fontWeight: 900, fontSize: 12.5, cursor: "pointer",
          }}>🏹 單人房</button>
          <button type="button" onClick={() => setRoomScreen("wait")} style={{
            padding: "12px 0", borderRadius: 9, border: "1px solid #4ade80",
            background: "rgba(74,222,128,.14)", color: "#e2e8f0",
            fontWeight: 900, fontSize: 12.5, cursor: "pointer",
          }}>👥 等待室（{Math.max(2, teamCount)} 人）</button>
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
          等待室用上面的「組隊人數」與「模擬隊友1 次數用完」設定生假成員，
          預設讓最後一位還沒準備——才看得到房主被擋住的樣子。
        </div>
      </div>

      {/* 🌐 全服擊倒廣播預覽——不用真的打死王也看得到長怎樣 */}
      {!state && (
        <div style={{ ...cardStyle, border: "1px solid rgba(147,197,253,.5)" }}>
          <div style={labelStyle}>🌐 全服擊倒廣播預覽</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8, lineHeight: 1.6 }}>
            王被打倒時，全服玩家都會看到這段演出重播一次（不是只有一行文字）。
            這裡可以直接預覽。
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
            {[["solo", "單人擊倒"], ["team", `${Math.max(2, teamCount)} 人擊倒`]].map(([mode, label]) => (
              <button key={mode} type="button"
                onClick={() => {
                  const n = mode === "solo" ? 1 : Math.max(2, teamCount);
                  const members = Array.from({ length: n }, (_, i) => ({
                    memberId: `p${i}`, name: i === 0 ? "我" : `隊友${i}`,
                  }));
                  playReplay(buildKillPayload({
                    bossKey, bossName: boss?.name || "世界王",
                    killerId: "p0", killerName: "我",
                    style: detectKillStyle({
                      bySpot: mode === "solo" ? "red" : "green",
                      bullseye: mode === "solo",
                      teamSize: n, burst: mode === "team",
                    }),
                    members,
                  }));
                }}
                style={{
                  padding: "10px 0", borderRadius: 9, border: "1px solid #60a5fa",
                  background: "rgba(96,165,250,.14)", color: "#e2e8f0",
                  fontWeight: 900, fontSize: 12, cursor: "pointer",
                }}>▶️ {label}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#64748b", marginBottom: 5 }}>換一種擊倒方式看看：</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {KILL_STYLES.map(st => (
              <button key={st.id} type="button"
                onClick={() => {
                  const n = Math.max(1, teamCount);
                  playReplay(buildKillPayload({
                    bossKey, bossName: boss?.name || "世界王",
                    killerId: "p0", killerName: "我",
                    style: {
                      id: st.id, icon: st.icon, name: st.name,
                      flavour: st.flavour, rarity: st.rarity,
                      color: KILL_RARITY_COLOR[st.rarity],
                    },
                    members: Array.from({ length: n }, (_, i) => ({ memberId: `p${i}`, name: i === 0 ? "我" : `隊友${i}` })),
                  }));
                }}
                style={{
                  padding: "5px 8px", borderRadius: 7, cursor: "pointer",
                  border: "1px solid rgba(255,255,255,.12)", background: "#1e293b",
                  color: "#cbd5e1", fontSize: 10, fontWeight: 800,
                }}>{st.icon} {st.name}</button>
            ))}
          </div>
        </div>
      )}

      {killPayload && !state && (
        <div style={{ ...cardStyle, border: "1px solid #93c5fd" }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: "#93c5fd", marginBottom: 4 }}>
            🌐 全服擊倒重播
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, lineHeight: 1.6 }}>
            {killPayload.style.icon} {killPayload.killerName} 以「{killPayload.style.name}」討伐了 {killPayload.bossName}。<br />
            正式版這段會存在王文件上，全服玩家都會看到這段演出重播一次（不是只有一行文字）。
          </div>
          <button type="button" onClick={() => playReplay(killPayload)}
            style={{
              width: "100%", padding: "10px 0", borderRadius: 9, border: "none",
              background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff",
              fontWeight: 900, fontSize: 13, cursor: "pointer",
            }}>▶️ 播放其他玩家看到的畫面</button>
        </div>
      )}

      {replaying && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#05040a" }}>
          <RaidKillCutscene key={replaySeq} payload={killPayload} replay onDone={() => setReplaying(false)} />
        </div>
      )}

      {resume && !state && (
        <div style={{ ...cardStyle, border: "1px solid #60a5fa" }}>
          <div style={{ fontSize: 12.5, fontWeight: 900, color: "#93c5fd", marginBottom: 4 }}>
            🔌 有一場沒打完的討伐
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
            {resumeLabel(resume.record)}　斷線或重整都接得回來。
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button type="button"
              onClick={() => { setState(resume.state); setRunId(n => n + 1); setResume(null); }}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 9, border: "none",
                background: "linear-gradient(135deg,#2563eb,#1e40af)", color: "#fff",
                fontWeight: 900, fontSize: 13, cursor: "pointer",
              }}>接續戰鬥</button>
            <button type="button"
              onClick={() => { clearRaidProgress(); setResume(null); }}
              style={{
                padding: "10px 14px", borderRadius: 9, border: "1px solid #475569",
                background: "transparent", color: "#94a3b8", fontWeight: 900, fontSize: 12, cursor: "pointer",
              }}>放棄</button>
          </div>
        </div>
      )}

      {summary && (
        <div style={{ ...cardStyle, border: "1px solid #f59e0b" }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fde68a", marginBottom: 7 }}>
            {summary.bossHp <= 0 ? "🏆 討伐成功" : "戰報"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7, fontSize: 11.5 }}>
            <div>總傷害　<b style={{ color: "#fbbf24" }}>{summary.totals.damage.toLocaleString()}</b></div>
            <div>破防貢獻　<b style={{ color: "#fbbf24" }}>{summary.totals.breakPoints}</b></div>
            <div>弱點命中　<b>{summary.totals.weakHits}</b></div>
            <div>擦過　<b style={{ color: "#94a3b8" }}>{summary.totals.grazes}</b></div>
            <div>最高連擊　<b>{summary.totals.bestCombo}</b></div>
            <div>成功打斷　<b style={{ color: "#4ade80" }}>{summary.totals.interrupts}</b></div>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={labelStyle}>王</div>
        <select value={bossKey} onChange={e => setBossKey(e.target.value)}
          style={{ width: "100%", padding: 9, borderRadius: 9, background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", fontWeight: 700 }}>
          {Object.keys(WORLD_BOSSES).map(key => (
            <option key={key} value={key}>{WORLD_BOSSES[key].name}（{(WORLD_BOSSES[key].hp / 10000).toFixed(0)} 萬血）</option>
          ))}
        </select>
        <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 6 }}>{boss?.desc}</div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>玩家強度（驗證新老玩家的差距）</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          {Object.entries(PRESETS).map(([key, p]) => (
            <button key={key} type="button" onClick={() => setPreset(key)}
              style={{
                padding: "9px 2px", borderRadius: 9, cursor: "pointer",
                border: `2px solid ${preset === key ? "#fbbf24" : "rgba(255,255,255,.1)"}`,
                background: preset === key ? "rgba(251,191,36,.16)" : "#1e293b",
                color: "#e2e8f0", fontSize: 11, fontWeight: 900,
              }}>
              {p.label}
              <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>ATK {p.atk}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>靶紙</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
          {RAID_FACES.map(f => (
            <button key={f.id} type="button" onClick={() => setTargetFmt(f.id)}
              style={{
                padding: "9px 2px", borderRadius: 9, cursor: "pointer",
                border: `2px solid ${targetFmt === f.id ? "#60a5fa" : "rgba(255,255,255,.1)"}`,
                background: targetFmt === f.id ? "rgba(96,165,250,.16)" : "#1e293b",
                color: "#e2e8f0", fontSize: 12, fontWeight: 900,
              }}>
              {f.label}
              <div style={{ fontSize: 8.5, color: "#94a3b8", fontWeight: 700 }}>{f.hint}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
          ⌨️ 點分數的模式已移除——弱點判定要靠落點位置。
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>射程（貓小隊實際是 5~18 米）</div>
        <input type="range" min={RAID_DISTANCES[0]} max={RAID_DISTANCES[RAID_DISTANCES.length - 1]}
          value={distanceM} onChange={e => setDistanceM(Number(e.target.value))} style={{ width: "100%" }} />
        {(() => {
          const dm = distanceMultiplier(distanceM);
          const fm = faceMultiplier(targetFmt);
          const mult = rangeMultiplier({ distanceM, targetFmt });
          const lab = rangeLabel(mult);
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
                <span style={{ color: "#94a3b8" }}>{distanceM} 米</span>
                <span style={{ color: lab.color, fontWeight: 900 }}>傷害 ×{mult.toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                距離 ×{dm.toFixed(2)} × 靶紙 ×{fm.toFixed(1)}
              </div>
            </>
          );
        })()}
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 6, lineHeight: 1.6 }}>
          5 米＝新手標準射程（×1.00），退越遠加成越高（18 米 ×1.90）。靶紙倍率另外相乘。
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>組隊人數（上限 {RAID_MAX_TEAM} 人＝射箭場容量．各扣各的每日次數）</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
          {Array.from({ length: RAID_MAX_TEAM }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" onClick={() => { setTeamCount(n); setSpentIdx(-1); }}
              style={{
                padding: "9px 0", borderRadius: 9, cursor: "pointer",
                border: `2px solid ${teamCount === n ? "#4ade80" : "rgba(255,255,255,.1)"}`,
                background: teamCount === n ? "rgba(74,222,128,.16)" : "#1e293b",
                color: "#e2e8f0", fontSize: 12, fontWeight: 900,
              }}>{n === 1 ? "單人" : `${n} 人`}</button>
          ))}
        </div>
        {teamCount > 1 && (() => {
          const roster = Array.from({ length: teamCount }, (_, i) => ({
            memberId: `m${i}`, name: i === 0 ? "我" : `隊友${i}`, ready: true,
            participant: i === spentIdx ? consumeAttempt({}, "2026-07-31") : {},
          }));
          const check = canTeamDepart(roster, "2026-07-31");
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 900, lineHeight: 1.7 }}>
                🤝 {teamStatBonus(teamCount).label}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.7 }}>
                破防槽 {teamGaugeMax(teamCount)}（單人 {teamGaugeMax(1)}）→ <b style={{ color: "#fbbf24" }}>破防快 {teamBreakSpeedup(teamCount)}×</b><br />
                打斷需求 {teamInterruptRequired(1, teamCount)} 次／{teamCount * 6} 箭（單人 {teamInterruptRequired(1, 1)}／6 箭）
              </div>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#c7d2fe", marginTop: 8, marginBottom: 4 }}>
                模擬隊友的準度（單機也驗得到組隊邏輯）
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
                {BOT_SKILLS.map(sk => (
                  <button key={sk.id} type="button" onClick={() => setBotSkill(sk.id)}
                    style={{
                      padding: "7px 2px", borderRadius: 8, cursor: "pointer",
                      border: `2px solid ${botSkill === sk.id ? "#60a5fa" : "rgba(255,255,255,.1)"}`,
                      background: botSkill === sk.id ? "rgba(96,165,250,.16)" : "#1e293b",
                      color: "#e2e8f0", fontSize: 11, fontWeight: 900,
                    }}>
                    {sk.label}
                    <div style={{ fontSize: 8, color: "#94a3b8", fontWeight: 700 }}>{sk.desc}</div>
                  </button>
                ))}
              </div>
              <button type="button"
                onClick={() => setSpentIdx(spentIdx === 1 ? -1 : 1)}
                style={{
                  marginTop: 6, padding: "6px 10px", borderRadius: 8, fontSize: 10.5, fontWeight: 900,
                  border: "1px solid #475569", background: "transparent",
                  color: spentIdx === 1 ? "#f87171" : "#94a3b8", cursor: "pointer",
                }}>
                {spentIdx === 1 ? "✓ 隊友1 次數已用完（點此還原）" : "模擬「隊友1 次數用完」"}
              </button>
              <div style={{
                marginTop: 6, fontSize: 10.5, fontWeight: 900,
                color: check.ok ? "#4ade80" : "#f87171", lineHeight: 1.6,
              }}>
                {check.ok
                  ? `✓ 全隊都還有次數，可以出發（每人今日上限 ${RAID_DAILY_ATTEMPTS} 次）`
                  : check.blockers.map(bl => `✕ ${bl.text}`).join("　")}
              </div>
            </div>
          );
        })()}
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>👑 世界王卡（有卡的人立繪會有金邊＋皇冠）</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
          {[["none","都沒有"],["me","只有我"],["half","一半的人"],["all","全隊都有"]].map(([id,label]) => (
            <button key={id} type="button" onClick={() => setWbCardMode(id)}
              style={{
                padding: "8px 2px", borderRadius: 8, cursor: "pointer",
                border: `2px solid ${wbCardMode === id ? "#f5b942" : "rgba(255,255,255,.1)"}`,
                background: wbCardMode === id ? "rgba(245,185,66,.16)" : "#1e293b",
                color: "#e2e8f0", fontSize: 11, fontWeight: 900,
              }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>貓貓陪練（每回合會自己咬一口）</div>
        <select value={catId} onChange={e => setCatId(e.target.value)}
          style={{ width: "100%", padding: 9, borderRadius: 9, background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", fontWeight: 700 }}>
          <option value="none">不帶貓</option>
          {Object.keys(CATS).map(id => (
            <option key={id} value={id}>{CATS[id].name}（{CAT_TYPE_MAP[id]}）</option>
          ))}
        </select>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>射手等級（50 級以下有新手扶助）</div>
        <input type="range" min="1" max="120" value={archerLevel}
          onChange={e => setArcherLevel(Number(e.target.value))} style={{ width: "100%" }} />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          Lv.{archerLevel}　{archerLevel < 50 ? `🌱 新手扶助 ×${rookieMultiplier(archerLevel).toFixed(2)}` : "無扶助"}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>王的血量（沙盒調低才看得到三個階段）</div>
        <input type="range" min="1" max="100" value={Math.round(hpScale * 100)}
          onChange={e => setHpScale(Number(e.target.value) / 100)}
          style={{ width: "100%" }} />
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          {Math.round(hpScale * 100)}%　＝ {Math.round((boss?.hp || 0) * hpScale).toLocaleString()} 血
        </div>
      </div>

      <button type="button" onClick={start}
        style={{
          width: "100%", padding: "15px 0", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg,#f59e0b,#b45309)", color: "#fff",
          fontWeight: 900, fontSize: 16, cursor: "pointer", boxShadow: "0 4px 18px rgba(245,158,11,.4)",
        }}>
        🔥 開始討伐
      </button>
    </div>
  );
}
