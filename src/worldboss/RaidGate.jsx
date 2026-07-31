// src/worldboss/RaidGate.jsx
// ─────────────────────────────────────────────────────────────
// 正式版的世界王討伐入口。把 `src/worldboss/` 那一整套（單人房／等待室／
// 討伐畫面）接到真的世界王活動文件上。
//
// ⚠️ 這裡是**唯一**碰 Firestore 的地方。domain/ 與 ui/ 都保持純粹——
//    沙盒（?raid）用同一批元件跑假資料，正式版換成這個容器餵真資料。
//    兩邊共用元件，才不會出現「沙盒好好的、上線壞掉」。
//
// ⚠️ 玩家強度的算法**必須跟 WorldBossAttack.jsx 一致**（archerBase + 卡片 + 等級加成），
//    不然同一個人在新舊介面會有兩種數值。
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { attackWorldBoss, distributeWorldBossRewards } from "../lib/worldBossDb";
import { WORLD_BOSSES } from "../lib/worldBossData";
import { WORLD_BOSS_SKILLS } from "../lib/worldBossSkillData";
import { calcArcherStats } from "../lib/monsterData";
import { calcEquippedBonus, resolveEquippedCards } from "../lib/monsterCards";
import { archerLevelBonus, archerLevelFromXP } from "../lib/archerLevel";
import { calcCatCombatStats } from "../lib/catCombat";
import { CATS, CAT_TYPE_MAP } from "../lib/catData";

import { createRaidState } from "./domain/raidFlow";
import { roundResultFromLog, raidRoundResults } from "./domain/raidReport";
import { soloDepart } from "./domain/raidLobby";
import { DEFAULT_RAID_FACE } from "./domain/raidFaces";
import { RAID_DEFAULT_DISTANCE } from "./domain/raidRange";
import { clearRaidProgress, loadRaidProgress, resumeLabel } from "./domain/raidResume";
import { raidBackground } from "./raidAssets";
import RaidScreen from "./ui/RaidScreen";
import RaidSoloRoom from "./ui/RaidSoloRoom";

const LOADOUT_KEY = "wb_raid_loadout_v1";

/** 記住上次用的靶紙與射程——每次進來重選一次很煩，而且大部分人的場地是固定的 */
function loadLoadout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOADOUT_KEY) || "null");
    if (raw?.targetFmt) return { targetFmt: raw.targetFmt, distanceM: Number(raw.distanceM) || RAID_DEFAULT_DISTANCE };
  } catch { /* 壞掉就用預設 */ }
  return { targetFmt: DEFAULT_RAID_FACE, distanceM: RAID_DEFAULT_DISTANCE };
}
function saveLoadout(targetFmt, distanceM) {
  try { localStorage.setItem(LOADOUT_KEY, JSON.stringify({ targetFmt, distanceM })); } catch { /* 無所謂 */ }
}

export default function RaidGate({ event, onBack, sharedData, onComplete }) {
  const { profile } = useAuth();
  const myId = profile?.id;
  const myName = profile?.name || "射手";

  const [screen, setScreen] = useState("solo");     // solo | battle
  const [state, setState] = useState(null);
  const [runId, setRunId] = useState(0);
  const [resume, setResume] = useState(() => loadRaidProgress({ bossKey: event?.bossKey || null }));
  const [{ targetFmt, distanceM }, setLoadout] = useState(loadLoadout);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // ⚠️ 送出結果只**顯示**，不自動離開（作者 2026-07-31：來不及看結算畫面）。
  //    送完就 onComplete → 大廳 setInBattle(false) → 整個戰鬥畫面連同結算被卸載。
  //    要等玩家自己點掉。
  const [submitResult, setSubmitResult] = useState(null);

  // 每回合的傷害累積起來，結束時一次送出（逐箭寫入是那個 4000 次讀取的坑）
  const roundsRef = useRef([]);
  const submittedRef = useRef(false);
  // ⚠️ 擊倒 payload 要用 ref：state 每回合被整個換掉，掛在 state 上會被蓋掉
  const killPayloadRef = useRef(null);

  useEffect(() => { saveLoadout(targetFmt, distanceM); }, [targetFmt, distanceM]);

  // ── 玩家強度：跟 WorldBossAttack 同一套公式 ──────────────
  const cardColl = sharedData?.cardData ?? null;
  const stats = useMemo(() => {
    const base = calcArcherStats({
      member: profile,
      certification: sharedData?.certification,
      certRecords: sharedData?.certRecords,
      dexStats: null,
    });
    const card = calcEquippedBonus(resolveEquippedCards(cardColl));
    const lv = archerLevelBonus(archerLevelFromXP(profile?.archerXP || 0));
    return {
      atk: (base.atk || 0) + (card.atk || 0) + (lv.atk || 0),
      def: (base.def || 0) + (card.def || 0) + (lv.def || 0),
      hp: (base.hp || 0) + (card.hp || 0) + (lv.hp || 0),
    };
  }, [profile, sharedData?.certification, sharedData?.certRecords, cardColl]);

  const archerLevel = archerLevelFromXP(profile?.archerXP || 0);

  const cats = useMemo(() => {
    const catId = profile?.equippedCat?.catId;
    if (!catId) return [];
    const st = calcCatCombatStats(
      { catId, catXP: profile?.equippedCat?.catXP || 0, bond: profile?.equippedCat?.bond || 0 },
      catId,
    );
    return [{ catId, name: CATS[catId]?.name || catId, atk: st.catATK, skillGroup: CAT_TYPE_MAP[catId] }];
  }, [profile?.equippedCat]);

  // ── 出擊資格 ──────────────────────────────────────────────
  const depart = useMemo(() => soloDepart({
    participant: event?.participants?.[myId] || {},
    bossAlive: event?.status === "active" && (Number(event?.bossCurrentHP) || 0) > 0,
  }), [event?.participants, event?.bossCurrentHP, event?.status, myId]);

  const bossDef = WORLD_BOSSES[event?.bossKey] || {};

  const startSolo = useCallback(() => {
    roundsRef.current = [];
    submittedRef.current = false;
    killPayloadRef.current = null;
    setError("");
    setSubmitResult(null);
    setState(createRaidState({
      boss: {
        key: event.bossKey,
        name: event.bossData?.name || bossDef.name || "世界王",
        // ⚠️ 血是**全伺服器共享**的：帶當下剩餘血，不是滿血
        hp: Number(event.bossCurrentHP) || 1,
        maxHp: Number(event.bossMaxHP) || Number(event.bossData?.hp) || 1,
        atk: Number(event.bossData?.atk) || bossDef.atk || 120,
        def: Number(event.bossData?.def) || bossDef.def || 50,
        skillConfig: WORLD_BOSS_SKILLS[event.bossKey] || null,
      },
      // ⚠️ equipped 要掛在**成員身上**（createRaidState 用 m.equipped 判世界王卡），
      //    放在最外層不會被讀到。
      members: [{
        memberId: myId, name: myName, stats, archerLevel, cats,
        targetFmt, distanceM, equipped: resolveEquippedCards(cardColl),
      }],
      stats, archerLevel, cats, targetFmt, distanceM,
    }));
    setRunId(n => n + 1);
    setScreen("battle");
  }, [event, bossDef, myId, myName, stats, archerLevel, cats, targetFmt, distanceM, cardColl]);

  // ── 每回合：只累積在本機，不寫 Firestore ─────────────────
  const handleState = useCallback((next, log) => {
    setState(next);
    roundsRef.current.push(roundResultFromLog(log, myId));
  }, [myId]);

  // ── 結束：一次送出 ────────────────────────────────────────
  const handleFinish = useCallback(async (final) => {
    if (submittedRef.current) return;      // 防重複：重整回來也不會再送一次
    submittedRef.current = true;
    clearRaidProgress();
    setSubmitting(true);

    const rounds = raidRoundResults(roundsRef.current, final, myId);
    const killed = (final?.bossHp ?? 1) <= 0;

    let res;
    try {
      res = await attackWorldBoss({
        eventId: event.id,
        memberId: myId,
        memberName: myName,
        weapon: profile?.bowType || "反曲弓",
        roundResults: rounds,
        accountType: profile?.accountType || "official",
        memberAtk: stats.atk, memberDef: stats.def, memberHP: stats.hp,
        killerStyle: profile?.equippedCat?.catId || "baobao",
        finishingArrow: final?.killPayload?.style?.name || null,
        // 擊倒才有：全服重播用的一包資料（寫進狀態小文件，零額外讀取）
        killPayload: killed ? final?.killPayload || null : null,
      });
    } catch (e) {
      res = { ok: false, reason: e?.message || "網路錯誤" };
    }

    setSubmitting(false);
    setSubmitResult(res);
    if (!res?.ok) { setError(res?.reason || "傷害沒有送出，請截圖回報"); return; }
    if (res.defeated) distributeWorldBossRewards(event.id).catch(() => {});
    // ⚠️ 這裡**不呼叫 onComplete**——那會讓大廳把戰鬥畫面收掉，玩家看不到結算。
  }, [event, myId, myName, profile, stats]);

  /** 玩家自己點掉結算畫面才離開 */
  const leaveBattle = useCallback(() => {
    setScreen("solo");
    setState(null);
    if (submitResult?.ok) onComplete?.(submitResult);
    else onBack?.();
  }, [submitResult, onComplete, onBack]);

  if (!event) return null;

  if (screen === "battle" && state) {
    return (
      <>
        <RaidScreen
          key={runId}
          state={state}
          bossKey={event.bossData?.pixelKey || event.bossKey}
          bossTitle={event.bossData?.title || bossDef.title}
          bossMeta={{ family: event.bossData?.family, familyTier: bossDef.familyTier }}
          eventId={event.id}
          participants={event.totalParticipants || 0}
          playerName={myName}
          appearance={profile?.equippedCat?.catId || "baobao"}
          bgUrl={raidBackground(event.bossData?.family)}
          targetFmt={targetFmt}
          onState={handleState}
          onKill={payload => { killPayloadRef.current = payload; }}
          onFinish={final => handleFinish({ ...final, killPayload: killPayloadRef.current })}
          onExit={leaveBattle}
        />
        {submitting && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 300, display: "grid", placeItems: "center",
            background: "rgba(2,6,23,.8)", color: "#e2e8f0", fontWeight: 900, fontSize: 14,
          }}>戰果送出中…</div>
        )}
        {/* 玩家最在意的一件事：傷害到底有沒有記到排行榜上 */}
        {submitResult && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 260,
            padding: "9px 14px", textAlign: "center",
            background: submitResult.ok ? "rgba(21,128,61,.95)" : "rgba(127,29,29,.95)",
            color: "#fff", fontSize: 12, fontWeight: 900,
          }}>
            {submitResult.ok
              ? `✅ 傷害已記錄${submitResult.dmg ? `：${Math.round(submitResult.dmg).toLocaleString()}` : ""}${submitResult.defeated ? "　🏆 你給了最後一擊！" : ""}`
              : `⚠️ ${submitResult.reason || "傷害沒有送出"}`}
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, overflowY: "auto", background: "#05040a" }}>
      {error && (
        <div style={{
          position: "sticky", top: 0, zIndex: 5, padding: "10px 14px",
          background: "rgba(69,10,10,.95)", color: "#fecaca", fontSize: 12, fontWeight: 800,
        }}>⚠️ {error}</div>
      )}
      <RaidSoloRoom
        bossKey={event.bossData?.pixelKey || event.bossKey}
        bossName={event.bossData?.name}
        bossDesc={event.bossData?.desc}
        bossHp={Number(event.bossCurrentHP) || 0}
        bossMaxHp={Number(event.bossMaxHP) || 1}
        stats={stats}
        archerLevel={archerLevel}
        catName={cats[0]?.name || null}
        targetFmt={targetFmt} distanceM={distanceM}
        onTargetFmt={fmt => setLoadout(l => ({ ...l, targetFmt: fmt }))}
        onDistance={d => setLoadout(l => ({ ...l, distanceM: d }))}
        depart={depart}
        resume={resume ? { label: resumeLabel(resume.record) } : null}
        onResume={() => { setState(resume.state); setRunId(n => n + 1); setResume(null); setScreen("battle"); }}
        onDiscardResume={() => { clearRaidProgress(); setResume(null); }}
        onDepart={startSolo}
        onExit={onBack}
      />
    </div>
  );
}
