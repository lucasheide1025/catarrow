// src/arcade/ArcadeTeam.jsx — 組隊模式（M3，規格 §14-16）
// 隊長一鍵建立房間 → 產生 5 位數代碼＋QR；朋友掃 QR／輸入代碼直接加入（免設定）。
// 第一版只做 Team Attack：每個人射 6 箭送出分數 → 全員到齊 → 合體攻擊 + Combo 倍率。
// 雲端只協調（最小同步）：玩家身分、每回合分數、房間狀態；不搬整份 visitorProfile。
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { arcadeCatById } from "./arcadeData";
import { ARROWS_PER_ROUND, clampArrow } from "./arcadeBattle";
import { saveCurrentTeamRoom, clearCurrentTeamRoom } from "./arcadeDb";
import ArcadeArrowInput from "./ArcadeArrowInput";
import {
  createTeamRoom, joinTeamRoom, startTeamRoom, submitTeamRound, chooseTeamRoute,
  leaveTeamRoom, subscribeTeamRoom, deleteTeamRoom,
  heartbeatTeamRoom, cleanupStaleRoom, takeOverHost,
  setTeamMode, advanceTeamRound, getTeamRoom,
} from "./arcadeTeamDb";
import {
  TEAM_MAX_PLAYERS, isValidRoomCode, normalizeRoomCode, decideTeamRoomEntry, resumeArrowsForRoom, teamGrade,
  HOST_HEARTBEAT_MS, CLEANUP_INTERVAL_MS, HOST_STALE_MS, PLAYER_STALE_MS,
  isStaleAt, comboLabel, routeById, checkPersonalGoal,
  TEAM_MODES, teamModeById, updateTeamStats, formatTeamDuration, emptyTeamStats,
} from "./arcadeTeamLogic";
import BossTarget from "./ArcadeTarget";
import BattleResultSheet from "./ArcadeResultSheet";
import { playBattleSound } from "../lib/battleSound";
import {
  sfxPathSelect, sfxOpenChest, sfxEpic, sfxGachaReveal,
  sfxWorldBossAppear, sfxBuff, sfxBossUlt, sfxSuccess, sfxTap,
} from "../lib/sound";
import { ResultShareCard, BossEntrance, ShootingPerformance } from "./ArcadeAdventure";
import { performanceFromAggregates } from "./arcadePerformance";
import { applyArcadeSettlement, buildArcadeCombatSnapshot } from "./arcadeProgression";
import { calcBattleXP } from "./arcadeShop";

function joinUrl(code) {
  const host = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? window.location.origin
    : "https://student.catgroup.com.tw";
  return `${host}/?arcade&team=${code}`;
}

function teamEntryMessage(reason) {
  if (reason === "not-found") return "找不到這個房間，請確認房號是否正確";
  if (reason === "wrong-kind") return "這個代碼不是組隊冒險房";
  if (reason === "expired") return "這個房間已過期，請重新建立房間";
  if (reason === "finished") return "這場冒險已經結束，請重新建立房間";
  if (reason === "started") return "這場已經開戰；只有原本就在房內的隊員可以返回戰鬥";
  return "無法進入這個房間";
}

export default function ArcadeTeam({ profile, initialCode = null, initialRound = 0, initialArrows = null, onExit, onSave, onMutate, onToast }) {
  const cat = arcadeCatById(profile.selectedCat) || arcadeCatById("haji");
  const combatSnapshot = buildArcadeCombatSnapshot(profile);
  const [roomCode, setRoomCode] = useState("");
  // joinCode 只是待確認的房號；roomCode 才代表已完成權威驗證、可掛 snapshot 的房間。
  const [joinCode, setJoinCode] = useState(() => normalizeRoomCode(initialCode || ""));
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [arrows, setArrows] = useState(Array(ARROWS_PER_ROUND).fill(-1)); // -1=未填
  const [fx, setFx] = useState(null); // null | attack | impact | settle
  const [resolution, setResolution] = useState(null);
  const [bestComboMult, setBestComboMult] = useState(1); // 追蹤最高倍率（顯示用 comboLabel）
  const [clock, setClock] = useState(Date.now()); // 大廳內每 5 秒 tick，讓「接管」按鈕準時出現
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [routeReveal, setRouteReveal] = useState(null); // { route, log } 全隊路線揭曉動畫
  const [bossEntrance, setBossEntrance] = useState(null); // 王房過場：{ boss, rage }
  const revealAtRef = useRef(0); // 已播過的路線時間戳（避免重複播放）
  const revealTimer = useRef(null);
  const revealSfxTimer = useRef(null);
  const [floats, setFloats] = useState([]); // 世界王風漂浮傷害數字
  const [raidBanner, setRaidBanner] = useState(null); // 打斷大招／大招橫幅
  const [bossAnim, setBossAnim] = useState(null); // idle | flinch | roar | fall
  const [partyHitIds, setPartyHitIds] = useState([]);
  const [activeAttacker, setActiveAttacker] = useState(null); // A → B → C 當前演出者
  const [presentationMonsterHp, setPresentationMonsterHp] = useState(null);
  const [killBurst, setKillBurst] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const floatId = useRef(0);
  const roomRef = useRef(null);
  const restoredRef = useRef(false); // 斷線重連：箭數只恢復一次
  const resRoundRef = useRef(0);
  const fxTimer = useRef(null);

  const myStats = room?.players?.[profile.visitorId] || null;
  const isHost = room?.hostId === profile.visitorId;
  const players = room?.players ? Object.values(room.players) : [];
  const waiting = room?.status === "waiting";
  // 從房間推導「我已送出」：重連/回鍋後狀態正確（不用本機 state 猜）
  const submitted = !!myStats?.ready;
  const hostPlayer = room?.players?.[room?.hostId];
  const hostStale = waiting && !!hostPlayer && (clock - (hostPlayer.lastAt || 0)) > HOST_STALE_MS;
  const activeCount = players.filter((p) => !isStaleAt(p.lastAt, clock, PLAYER_STALE_MS)).length;
  const shootingPerf = performanceFromAggregates({
    shots: myStats?.shots || 0,
    hitCount: myStats?.hitCount || 0,
    score: myStats?.score || 0,
    scoreSqSum: myStats?.scoreSqSum || 0,
  }, profile.visitorId || profile.nickname);
  // Firestore 可以在最後一擊同一 snapshot 寫 lastResolution + route/result/defeat。
  // 最新解析還沒播或正在播時，畫面必須留在戰鬥 presentation，禁止先跳下一頁。
  const hasUnreadResolution = !!room?.lastResolution?.round && room.lastResolution.round > resRoundRef.current;
  const presentationPending = hasUnreadResolution || !!resolution;

  async function enterExistingRoom(code, info) {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) return { ok: false, reason: "請輸入 5 位數房間代碼" };
    try {
      // 只做一次權威 read：QR、手動房號、IndexedDB resume 都走同一條驗證。
      const fresh = await getTeamRoom(normalized);
      const decision = decideTeamRoomEntry(fresh, profile.visitorId);
      if (decision.action === "reject") {
        if (decision.clearResume) await clearCurrentTeamRoom();
        return { ok: false, reason: teamEntryMessage(decision.reason), terminal: true };
      }
      // waiting outsider = 正常加入；原隊員 = refresh lastAt / 外觀後重連。
      const joined = await joinTeamRoom(normalized, info);
      if (!joined.ok) return joined;
      return { ok: true, roomCode: normalized, action: decision.action };
    } catch (e) {
      // getDoc 的網路錯誤不能當成「房間不存在」；resume 必須留下來。
      return {
        ok: false,
        temporary: true,
        reason: "📡 目前無法確認房間狀態。斷線恢復資料仍保留，網路恢復後可用原房號再試一次。",
      };
    }
  }

  // 大廳內每 5 秒 tick 一次（刷新「房主離線」狀態）；
  // BOSS 結算等待「繼續 →」時也 tick，讓隊員偵測到隊長離線可代按。
  const bossSettle = fx === "settle" && !!resolution?.isBoss && !resolution?.victory && !resolution?.defeat;
  useEffect(() => {
    if (!waiting && !bossSettle) return undefined;
    const t = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(t);
  }, [waiting, bossSettle]);

  // ── 進入：建立或加入房間 ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = { visitorId: profile.visitorId, nickname: profile.nickname, cat, combatSnapshot };
      if (initialCode && isValidRoomCode(initialCode)) {
        const normalized = normalizeRoomCode(initialCode);
        setJoinCode(normalized);
        setBusy(true);
        const r = await enterExistingRoom(normalized, info);
        if (cancelled) return;
        setBusy(false);
        if (r.ok) setRoomCode(normalized);
        else setError(r.reason || "加入失敗");
      } else {
        setBusy(true);
        const r = await createTeamRoom(info);
        if (cancelled) return;
        setBusy(false);
        if (r.ok) { setRoomCode(r.roomCode); setJoinCode(r.roomCode); }
        else setError(r.reason || "建立失敗");
      }
    })();
    return () => { cancelled = true; clearTimeout(fxTimer.current); };
    // 只掛載一次；deps 故意留空（profile/cat 由 props 帶入）
  }, []);

  // 離線偵測：顯示重連橫幅＋離線時不能送出
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // 防斷線：目前房間＋輸入中的箭數存在本機（reload/回鍋自動恢復）
  useEffect(() => {
    // 權威 room 尚未載入時不可用 round=0 覆寫舊 resume。
    if (!roomCode || !room) return undefined;
    const t = setTimeout(() => {
      saveCurrentTeamRoom({ roomCode, round: room.round || 0, arrows, savedAt: Date.now() });
    }, 800);
    return () => clearTimeout(t);
  }, [roomCode, room?.round, arrows]);

  // ── 訂閱房間 ─────────────────────────────────────────
  useEffect(() => {
    if (!roomCode) return undefined;
    const unsub = subscribeTeamRoom(
      roomCode,
      (r) => {
        if (!r) {
          if (roomRef.current?.status === "result") return; // 結果頁保留快取
          clearCurrentTeamRoom(); // snapshot 明確 exists=false 才清 resume
          setRoom(null);
          setError("房間已結束或不存在");
          return;
        }
        roomRef.current = r;
        setRoom(r);
        setSyncMessage((prev) => prev.startsWith("⚠️ 房間即時同步") ? "" : prev);
      },
      () => {
        // snapshot error 不等於房間消失；留在原戰鬥並保留本機箭數。
        setSyncMessage("⚠️ 房間即時同步暫時中斷，你仍留在原戰鬥。網路恢復後按「重新同步」。");
      },
    );
    return unsub;
  }, [roomCode]);

  // ── 路線揭曉動畫（全隊同步）：房主選完路 → routeChosenAt 變新 → 播過場 ──
  useEffect(() => {
    if (!room || room.status !== "fighting") return undefined;
    const chosenAt = room.routeChosenAt || 0;
    if (chosenAt <= revealAtRef.current) return undefined;
    revealAtRef.current = chosenAt;
    const route = routeById(room.routeId);
    if (!route) return undefined;
    // 最後一關的叉路（深入險境／稍作休息）→ 進入王房：播全螢幕過場，不播一般路線揭曉
    const stageCount = room.adventure?.stages?.length || 3;
    const bossNext = (room.stageIdx || 0) >= stageCount;
    if (bossNext) {
      sfxWorldBossAppear();
      setBossEntrance({ boss: room.monster, rage: room.routeId === "deep" });
      clearTimeout(revealTimer.current);
      clearTimeout(revealSfxTimer.current);
      revealSfxTimer.current = setTimeout(() => sfxBossUlt(), 750);
      revealTimer.current = setTimeout(() => setBossEntrance(null), 3600); // 3.6 秒過場
      return () => {
        clearTimeout(revealTimer.current);
        clearTimeout(revealSfxTimer.current);
      };
    }
    // 一般叉路：依路線類型播放不同音效
    if (room.routeId === "treasure") sfxOpenChest();
    else if (room.routeId === "elite") sfxEpic();
    else if (room.routeId === "event") sfxGachaReveal();
    else if (room.routeId === "deep") sfxWorldBossAppear();
    else if (room.routeId === "rest") sfxBuff();
    else sfxPathSelect();
    setRouteReveal({ route, log: room.routeLog || [] });
    clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setRouteReveal(null), 2600); // 2.6 秒揭曉
    return () => clearTimeout(revealTimer.current);
  }, [room?.routeChosenAt, room?.status, room?.routeId]);

  // ── 心跳＋逾時清理（M3.1）：每 25 秒報活、每 45 秒清離線玩家 ──
  useEffect(() => {
    if (!roomCode) return undefined;
    const hb = setInterval(() => {
      heartbeatTeamRoom(roomCode, profile.visitorId);
    }, HOST_HEARTBEAT_MS);
    const cl = setInterval(() => {
      cleanupStaleRoom(roomCode);
    }, CLEANUP_INTERVAL_MS);
    return () => { clearInterval(hb); clearInterval(cl); };
  }, [roomCode, profile.visitorId]);

  // ── 回合推進：重設箭數（BOSS 戰＝靶面落點用 null，普通關＝記分板用 -1） ──
  useEffect(() => {
    const bossMode = (room?.stageIdx || 0) >= (room?.adventure?.stages?.length || 3);
    setArrows(Array(ARROWS_PER_ROUND).fill(bossMode ? null : -1));
    setFx(null);
  }, [room?.round]);

  // 斷線重連：房間回合與存檔一致 → 恢復輸入中的箭數（只恢復一次）
  useEffect(() => {
    if (!room || restoredRef.current) return;
    restoredRef.current = true;
    const savedArrows = resumeArrowsForRoom({ round: initialRound, arrows: initialArrows }, room.round);
    if (!savedArrows) return; // 遠端 round 已前進，保留上方新回合的空白箭。
    const bossMode = (room?.stageIdx || 0) >= (room?.adventure?.stages?.length || 3);
    setArrows(savedArrows.map((v) => {
      if (v && typeof v === "object") return v; // 靶面落點（BOSS 戰）
      if (bossMode) return null;                // BOSS 戰：數字（-1 等）視為未填
      return v === 11 ? 11 : v > 0 ? clampArrow(v) : -1; // 保留 X 內十
    }));
  }, [room, initialRound, initialArrows]);

  // ── 新解析（有人送出最後一箭）→ 演出 ─────────────────────
  useEffect(() => {
    const res = room?.lastResolution;
    if (!res || !res.round || res.round <= resRoundRef.current) return;
    resRoundRef.current = res.round;
    setResolution(res);
    setBestComboMult((prev) => Math.max(prev, res.comboMult || 1));
    clearTimeout(fxTimer.current);
    setFloats([]);
    setRaidBanner(null);
    setKillBurst(false);
    setActiveAttacker(null);
    setPartyHitIds([]);
    setPresentationMonsterHp(Number.isFinite(res.monsterHpBefore) ? res.monsterHpBefore : (room?.monster?.hp || 0));

    const attackers = Array.isArray(res.perPlayer) && res.perPlayer.length
      ? res.perPlayer
      : [{ visitorId: "team", nickname: "全隊", catName: "貓小隊", dmg: res.dmg || 0, score: res.totalScore || 0, met: true }];
    const steps = [];
    attackers.forEach((pp, index) => {
      // A 攻擊 → 命中 → B 攻擊 → 命中…；就算前面已把視覺 HP 打到 0，也不 break。
      steps.push([index === 0 ? 0 : 140, () => {
        setActiveAttacker(pp);
        setFx("attack");
        if (res.isBoss) setBossAnim("idle");
        playBattleSound("arrow_flight", { monsterName: res.monsterName });
      }]);
      steps.push([280, () => {
        setFx("impact");
        if (res.isBoss) setBossAnim("flinch");
        playBattleSound("arrow_hit", { score: pp.score || 0, dmg: pp.dmg || 0, isCrit: !!pp.met });
        setPresentationMonsterHp((prev) => Math.max(0, (prev ?? res.monsterHpBefore ?? 0) - (pp.dmg || 0)));
        setFloats((list) => [...list.slice(-6), {
          key: floatId.current++, text: `-${pp.dmg || 0}`, kind: pp.met ? "weak" : "normal", left: 50,
        }]);
      }]);
      steps.push([300, () => {
        setFx(null);
        if (res.isBoss) setBossAnim("idle");
      }]);
    });
    steps.push([250, () => {
      setActiveAttacker(null);
      if (res.victory) {
        setKillBurst(true);
        setFx("kill");
        if (res.isBoss) setBossAnim("fall");
        playBattleSound("monster_death", { monsterName: res.monsterName, boss: res.isBoss });
      } else if (res.isBoss && !res.defeat) {
        if (res.teamInterrupted) {
          setRaidBanner({ text: "破綻！", color: "#4ade80" });
          setBossAnim("flinch");
        } else {
          setRaidBanner({ text: "大招", color: "#f43f5e" });
          setBossAnim("roar");
        }
      }
      if (!res.victory && Array.isArray(res.partyDamage) && res.partyDamage.length) {
        setPartyHitIds(res.partyDamage.map((hit) => hit.visitorId));
        playBattleSound("player_hurt", { damage: res.partyDamage[0]?.amount || 0 });
      }
    }]);
    steps.push([900, () => {
      setKillBurst(false);
      setRaidBanner(null);
      setPartyHitIds([]);
      if (!res.victory) setBossAnim("idle");
      setFx("settle");
      if (res.victory) {
        playBattleSound("victory_fanfare", { monsterName: res.monsterName, roundDmg: res.dmg });
      } else if (res.defeat) {
        playBattleSound("defeat_sigh", { monsterName: res.monsterName });
      }
    }]);
    // 結算至少完整停留；BOSS 未分勝負仍由隊長按「繼續 →」。
    steps.push([1600, () => {
      const gate = res.isBoss && !res.victory && !res.defeat;
      if (gate) return;
      setFx(null);
      setResolution(null);
      setActiveAttacker(null);
      setPresentationMonsterHp(null);
      setBossAnim("idle");
    }]);
    let i = 0;
    const next = () => {
      if (i >= steps.length) return;
      const [delay, fn] = steps[i++];
      fxTimer.current = setTimeout(() => { fn(); next(); }, delay);
    };
    next();
  }, [room?.lastResolution]);

  // 隊長「繼續 →」推進訊號：收到 advanceRound ≥ 目前回合 → 收起結算面板（全隊同步）
  useEffect(() => {
    if (!room || room.status !== "fighting") return;
    if ((room.advanceRound || 0) < (room.round || 0)) return;
    if (fx !== "settle") return;
    setFx(null); setResolution(null); setBossAnim("idle");
  }, [room?.advanceRound, room?.round, fx]);

  useEffect(() => () => {
    clearTimeout(fxTimer.current);
    clearTimeout(revealTimer.current);
    clearTimeout(revealSfxTimer.current);
  }, []);

  async function handleJoin() {
    const normalized = normalizeRoomCode(joinCode);
    if (busy || !isValidRoomCode(normalized)) { setError("請輸入 5 位數房間代碼"); return; }
    setJoinCode(normalized);
    setBusy(true);
    setError("");
    const r = await enterExistingRoom(normalized, { visitorId: profile.visitorId, nickname: profile.nickname, cat, combatSnapshot });
    setBusy(false);
    if (r.ok) setRoomCode(normalized);
    else setError(r.reason || "加入失敗");
  }

  async function handleStart() {
    if (busy || !roomCode) return;
    setBusy(true);
    setError("");
    const r = await startTeamRoom(roomCode, profile.visitorId);
    setBusy(false);
    if (!r.ok) setError(r.reason || "無法開始");
  }

  async function handleChooseRoute(routeId) {
    if (busy || !roomCode) return;
    setBusy(true);
    setError("");
    const r = await chooseTeamRoute(roomCode, profile.visitorId, routeId);
    setBusy(false);
    if (!r.ok) setError(r.reason || "無法前進");
  }

  async function handleTakeOver() {
    if (busy || !roomCode) return;
    setBusy(true);
    setError("");
    const r = await takeOverHost(roomCode, profile.visitorId);
    setBusy(false);
    if (!r.ok) setError(r.reason || "接管失敗");
  }

  async function handleSetMode(mode) {
    if (busy || !roomCode || !isHost) return;
    setBusy(true);
    setError("");
    const r = await setTeamMode(roomCode, profile.visitorId, mode);
    setBusy(false);
    if (!r.ok) setError(r.reason || "切換失敗");
  }

  async function handleAdvance() {
    if (busy || !roomCode) return;
    setBusy(true);
    setError("");
    const r = await advanceTeamRound(roomCode, profile.visitorId);
    setBusy(false);
    if (!r.ok) setError(r.reason || "推進失敗");
  }

  async function handleResync() {
    if (!roomCode || syncing) return;
    setSyncing(true);
    setSyncMessage("🔄 正在重新同步…");
    setError("");
    try {
      // 人工救援才執行：既有 heartbeat + 單次 getDoc read，不新增 polling。
      await heartbeatTeamRoom(roomCode, profile.visitorId).catch(() => {});
      const fresh = await getTeamRoom(roomCode);
      if (!fresh) {
        await clearCurrentTeamRoom();
        throw new Error("找不到這個房間，可能已結束或過期");
      }
      const decision = decideTeamRoomEntry(fresh, profile.visitorId);
      if (decision.action === "reject") {
        if (decision.clearResume) await clearCurrentTeamRoom();
        throw new Error(teamEntryMessage(decision.reason));
      }
      if (decision.action === "join") {
        const rejoin = await joinTeamRoom(roomCode, { visitorId: profile.visitorId, nickname: profile.nickname, cat, combatSnapshot });
        if (!rejoin.ok) throw new Error(rejoin.reason || "重新加入失敗");
      }

      clearTimeout(fxTimer.current);
      clearTimeout(revealTimer.current);
      setFx(null);
      setResolution(null);
      setActiveAttacker(null);
      setPresentationMonsterHp(null);
      setFloats([]);
      setRaidBanner(null);
      setKillBurst(false);
      setRouteReveal(null);
      setBossEntrance(null);

      // 若權威房間已有最新結算，人工同步後允許完整重播該回合。
      if (fresh.lastResolution?.round) {
        resRoundRef.current = Math.max(0, fresh.lastResolution.round - 1);
      }
      roomRef.current = fresh;
      setRoom(fresh);
      setError("");
      setSyncMessage("✅ 已重新同步最新房間狀態");
    } catch (e) {
      setSyncMessage(`❌ 重新同步失敗：${e?.message || "請再試一次"}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit() {
    if (!room || submitted || busy) return;
    if (!online) { setError("📡 離線中，連上網路後再送出（你的箭數已保存在本機）"); return; }
    setBusy(true);
    setError("");
    const r = await submitTeamRound(roomCode, profile.visitorId, { round: room.round, arrows });
    setBusy(false);
    if (r.ok) {
      sfxSuccess();
    } else {
      const reason = r.reason || "送出失敗";
      setError(reason);
      if (/網路|連線|同步|timeout|離線|太慢/i.test(reason)) {
        setSyncMessage("⚠️ 本回合尚未確認送出；箭數仍保存在本機。連線恢復後可按「重新同步」。");
      }
    }
  }

  async function handleLeave() {
    if (roomCode) await leaveTeamRoom(roomCode, profile.visitorId);
    await clearCurrentTeamRoom();
    onExit();
  }

  async function handleFinish() {
    const grade = room?.result?.grade || teamGrade(0);
    const coins = Math.round((room?.result?.coins || 0) * grade.bonusMult);
    const mode = room?.result?.mode || room?.mode || "forest";
    const won = room?.status === "result";
    const xp = calcBattleXP({ mode, grade: grade.grade || "C", isTeam: true, bossKills: won ? 1 : 0 });
    const settlementId = `team:${room?.sessionKey || roomCode}:${profile.visitorId}`;
    const mutate = (current) => {
      const settled = applyArcadeSettlement(current, {
        id: settlementId,
        coins: won ? coins : 0,
        xp,
        stats: {
          battles: 1,
          kills: myStats?.kills || 0,
          bestDamage: myStats?.damage || 0,
          xCount: myStats?.xCount || 0,
        },
      });
      if (settled.alreadySettled) return settled.updated;
      const teamStats = won
        ? updateTeamStats(settled.updated.teamStats, mode, {
            bestCombo: bestComboMult,
            timeMs: room?.result?.durationMs || 0,
          })
        : settled.updated.teamStats;
      return {
        ...settled.updated,
        teamStats,
        statistics: {
          ...(settled.updated.statistics || {}),
          bestCombo: Math.max(settled.updated.statistics?.bestCombo || 1, bestComboMult),
        },
      };
    };
    if (onMutate) await onMutate(mutate);
    else if (onSave) await onSave(mutate(profile));
    onToast?.(`獲得 ${xp} EXP${won ? `・${coins} 金幣` : ""}`);
    await handleLeave();
  }

  const fillAll = (v) => {
    setArrows(Array(ARROWS_PER_ROUND).fill(v <= 0 ? -1 : clampArrow(v)));
    sfxTap();
  }; // 清空 → -1（未填）

  // ── 畫面：無房間（關閉/找不到）───────────────────────────
  if (!room) {
    return (
      <TeamStage>
        {!online && <OfflineBanner />}
        <div className="arcade-card" style={{ textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 50 }}>{error ? "🤔" : "🏹"}</div>
          <div className="arcade-title" style={{ fontSize: 24, maxWidth: "none", marginTop: 8 }}>
            {error ? "無法進入房間" : "建立中…"}
          </div>
          <p className="arcade-copy" style={{ maxWidth: "none" }}>{error || "正在連線到冒險夥伴…"}</p>
          {roomCode && <SyncButton syncing={syncing} message={syncMessage} onClick={handleResync} />}
          {error && (
            <div className="arcade-field" style={{ marginTop: 16 }}>
              <input
                name="arcade-team-room-code"
                aria-label="組隊房間代碼"
                className="arcade-input"
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
                placeholder="例如：58270…"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                maxLength={5}
              />
              <button type="button" className="arcade-primary green" style={{ marginTop: 10 }} onClick={handleJoin} disabled={busy || !isValidRoomCode(joinCode)}>
                {busy ? "加入中…" : "🚪 加入／返回戰鬥"}
              </button>
            </div>
          )}
          <button type="button" className="arcade-primary blue" style={{ marginTop: 12 }} onClick={onExit}>
            回大廳
          </button>
        </div>
      </TeamStage>
    );
  }

  // ── 結果頁 ───────────────────────────────────────────
  if (room.status === "result" && room.result && !presentationPending) {
    const grade = room.result.grade || teamGrade(room.result.kills);
    const finalCoins = Math.round(room.result.coins * grade.bonusMult);
    const mode = room.result.mode || room.mode || "forest";
    const modeMeta = teamModeById(mode);
    // 本機成就統計（該模式的累計：通關次數／最佳 Combo／最速通關）
    const myStats2 = { ...emptyTeamStats(), ...(profile.teamStats?.[mode] || {}) };
    const thisTime = room.result.durationMs || 0;
    const shareData = {
      nickname: profile.nickname,
      cat,
      dungeonName: room.result.dungeon || `${modeMeta.icon} ${modeMeta.name}`,
      grade: grade.grade,
      label: grade.label,
      composite: shootingPerf.composite,
      metrics: { accuracy: shootingPerf.hitRate, stability: shootingPerf.stability, average: shootingPerf.avgScore * 10, power: myStats?.bestRoundDamage || 0, exploration: (myStats?.kills || 0) * 25 },
      statsRows: [
        { icon: "👹", label: "擊敗怪物", value: myStats?.kills || 0 },
        { icon: "🔥", label: "全隊 Combo", value: room.combos || 0 },
        { icon: "💥", label: "單回最高傷害", value: myStats?.bestRoundDamage || 0 },
        { icon: "🎯", label: "X 內十", value: myStats?.xCount || 0 },
        { icon: "🪙", label: "獲得金幣", value: finalCoins },
        { icon: "🏅", label: "最佳 Combo", value: comboLabel(bestComboMult) },
        { icon: "🤝", label: "團隊評價", value: grade.grade },
        { icon: "🏹", label: "命中率", value: `${shootingPerf.hitRate}%` },
        { icon: "〰️", label: "穩定性", value: `${shootingPerf.stability}%` },
        { icon: "⭐", label: "射擊評價", value: shootingPerf.grade },
      ],
    };
    return (
      <TeamStage>
        {!online && <OfflineBanner />}
        <RoomCodeBadge code={room.roomCode || roomCode} />
        <Confetti />
        <div className="arcade-card" style={{ textAlign: "center", padding: 26 }}>
          <div style={{ fontSize: 54 }}>🏆</div>
          <div className="arcade-kicker" style={{ marginTop: 8 }}>TEAM ADVENTURE COMPLETE</div>
          <div className="arcade-title" style={{ fontSize: 27, maxWidth: "none", marginTop: 4 }}>
            {modeMeta.icon} {modeMeta.name} 完成！
          </div>
          <div className={`arcade-grade grade-${grade.grade}`}>
            <span>評價 {grade.grade}</span>
            <span className="arcade-grade-label">{grade.label}</span>
          </div>
          <div className="arcade-stats">
            <div className="arcade-stat"><div className="arcade-stat-v">👹 {room.result.kills}</div><div className="arcade-stat-l">全隊擊敗</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🔥 ×{room.combos || 0}</div><div className="arcade-stat-l">全隊 Combo</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">💥 {myStats?.bestRoundDamage || 0}</div><div className="arcade-stat-l">單回最高傷害</div></div>
          </div>
          <div className="arcade-stats" style={{ marginTop: 10 }}>
            <div className="arcade-stat"><div className="arcade-stat-v">🎯 {myStats?.xCount || 0}</div><div className="arcade-stat-l">X 內十</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🏅 {comboLabel(bestComboMult)}</div><div className="arcade-stat-l">最佳 Combo</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🤝 {players.length}</div><div className="arcade-stat-l">隊友</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🪙 {finalCoins}</div><div className="arcade-stat-l">獲得金幣</div></div>
          </div>
          <ShootingPerformance performance={shootingPerf} />

          {/* 本模式成就統計（累計） */}
          <div className="arcade-team-ach">
            <div className="arcade-team-ach-title">🏆 {modeMeta.icon} {modeMeta.name} 成就</div>
            <div className="arcade-stats">
              <div className="arcade-stat"><div className="arcade-stat-v">🏆 {myStats2.wins}</div><div className="arcade-stat-l">通關次數</div></div>
              <div className="arcade-stat"><div className="arcade-stat-v">🏅 {comboLabel(myStats2.bestCombo)}</div><div className="arcade-stat-l">最佳 Combo</div></div>
              <div className="arcade-stat"><div className="arcade-stat-v">⚡ {formatTeamDuration(myStats2.bestTimeMs)}</div><div className="arcade-stat-l">最速通關</div></div>
            </div>
            {thisTime > 0 && (
              <div className="arcade-copy" style={{ fontSize: 11, marginTop: 6 }}>本次耗時 {formatTeamDuration(thisTime)}</div>
            )}
          </div>

          <div className="arcade-note" style={{ marginTop: 14, textAlign: "left" }}>
            🤝 隊友：{players.map((p) => `${p.nickname} 🐱${p.catName}（${p.kills} 殺）`).join(" · ")}
          </div>
          <div className="arcade-row" style={{ marginTop: 20 }}>
            <button type="button" className="arcade-primary green" style={{ flex: 1 }} onClick={handleFinish}>
              結束並回大廳
            </button>
          </div>
          <ResultShareCard data={shareData} />
        </div>
      </TeamStage>
    );
  }

  // ── 叉路選擇（房主選，規格：組隊討論、房主決定）───────────────
  if (room.status === "route" && !presentationPending) {
    const routeIdx = room.routeIdx ?? 0;
    const stage = room.adventure?.stages?.[routeIdx];
    const routeIds = stage?.routes || [];
    const routes = routeIds.map((id) => routeById(id)).filter(Boolean);
    return (
      <TeamStage>
        {!online && <OfflineBanner />}
        <RoomCodeBadge code={room.roomCode || roomCode} />
        <div className="arcade-card" style={{ padding: 20 }}>
          <div className="arcade-kicker">{isHost ? "ROUTE CHOICE" : "WAITING FOR HOST…"}</div>
          <div className="arcade-title" style={{ fontSize: 24, maxWidth: "none", marginTop: 6 }}>
            {stage ? `${stage.label} 通關了！` : "選擇路線"}
          </div>
          <p className="arcade-copy" style={{ maxWidth: "none" }}>
            {isHost
              ? "你是隊長——選一條路繼續冒險！其他隊友會看到你的選擇。"
              : "等隊長選擇路線…（其他隊友都在看）"}
          </p>
          <div className="arcade-routes">
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                className="arcade-route-card"
                style={{ borderColor: r.tone }}
                onClick={() => isHost && handleChooseRoute(r.id)}
                disabled={!isHost || busy}
              >
                <div className="arcade-route-icon" style={{ background: `${r.tone}1a`, color: r.tone }}>{r.icon}</div>
                <div className="arcade-route-label">{r.label}</div>
                <div className="arcade-route-desc">{r.desc}</div>
                {isHost && <div className="arcade-route-pick">{busy ? "前進中…" : "選這條 ➜"}</div>}
              </button>
            ))}
          </div>
          {error && <div className="arcade-note" style={{ color: "#b23b2e", borderColor: "#efc0b4", background: "#fbe9e5" }}>{error}</div>}
          <SyncButton syncing={syncing} message={syncMessage} onClick={handleResync} />
        </div>
      </TeamStage>
    );
  }

  // ── 團滅（BOSS 士氣歸零）──────────────────────────────
  if (room.status === "defeat" && room.result && !presentationPending) {
    const grade = room.result.grade || teamGrade(room.result.kills, true);
    return (
      <TeamStage>
        {!online && <OfflineBanner />}
        <RoomCodeBadge code={room.roomCode || roomCode} />
        <div className="arcade-card" style={{ textAlign: "center", padding: 26 }}>
          <div style={{ fontSize: 54 }}>💀</div>
          <div className="arcade-kicker" style={{ marginTop: 8 }}>TEAM WIPED OUT</div>
          <div className="arcade-title" style={{ fontSize: 27, maxWidth: "none", marginTop: 4 }}>團隊潰散了…</div>
          <div className={`arcade-grade grade-${grade.grade}`}>
            <span>評價 {grade.grade}</span>
            <span className="arcade-grade-label">{grade.label}</span>
          </div>
          <div className="arcade-stats">
            <div className="arcade-stat"><div className="arcade-stat-v">👹 {room.result.kills}</div><div className="arcade-stat-l">擊敗怪物</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🔥 ×{room.combos || 0}</div><div className="arcade-stat-l">全隊 Combo</div></div>
            <div className="arcade-stat"><div className="arcade-stat-v">🎯 {myStats?.xCount || 0}</div><div className="arcade-stat-l">X 內十</div></div>
          </div>
          <div className="arcade-note" style={{ marginTop: 14 }}>
            BOSS 的大招太猛了…士氣歸零，這次冒險到此為止。
          </div>
          <ShootingPerformance performance={shootingPerf} />
          <button type="button" className="arcade-primary green" style={{ marginTop: 18, width: "100%" }} onClick={handleFinish}>
            結束並回大廳
          </button>
        </div>
      </TeamStage>
    );
  }

  // ── 大廳（等待）───────────────────────────────────────
  if (waiting) {
    return (
      <TeamStage>
        {!online && <OfflineBanner />}
        <div className="arcade-card" style={{ textAlign: "center", padding: 26 }}>
          <div className="arcade-kicker">{isHost ? "YOU ARE THE HOST" : "WAITING FOR HOST"}</div>
          <div className="arcade-title" style={{ fontSize: 26, maxWidth: "none", marginTop: 6 }}>
            {isHost ? "🤝 組隊大廳" : "已加入隊伍！"}
          </div>
          <p className="arcade-copy" style={{ maxWidth: "none" }}>
            {isHost ? "把 QR 或房間代碼給朋友，等人到齊就出發！" : "等隊長開始冒險…"}
          </p>

          <div className="arcade-team-code" style={{ fontSize: 46, fontWeight: 1000, letterSpacing: 10, color: "#2c4533", margin: "10px 0 4px" }}>
            {room.roomCode}
          </div>
          <div className="arcade-copy" style={{ maxWidth: "none", fontSize: 12, marginTop: 2 }}>房間代碼</div>
          <div className="arcade-copy" style={{ maxWidth: "none", fontSize: 11, marginTop: 4 }}>斷線／重新整理後可輸入這組房號返回</div>

          <div style={{ display: "grid", placeItems: "center", marginTop: 14 }}>
            <div style={{ background: "#fffaf0", borderRadius: 20, padding: 14, border: "2px solid #d8bd8a" }}>
              <QRCodeSVG value={joinUrl(room.roomCode)} size={170} level="M" fgColor="#1f2b4d" />
            </div>
          </div>

          {/* 冒險模式選擇（隊長選，隊員即時看到） */}
          <div className="arcade-section-title" style={{ marginTop: 16 }}>
            {isHost ? "🎲 選擇冒險模式" : "🎲 隊長的冒險選擇"}
          </div>
          <div className="arcade-dungeon-grid">
            {TEAM_MODES.map((m) => {
              const active = (room.mode || "forest") === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`arcade-dungeon-card${active ? " arcade-dungeon-card-active" : ""}${isHost ? "" : " arcade-dungeon-card-locked"}`}
                  onClick={() => isHost && handleSetMode(m.id)}
                  disabled={!isHost || busy}
                >
                  <span className="arcade-dungeon-icon">{m.icon}</span>
                  <span className="arcade-dungeon-name">{m.name}</span>
                  <span className="arcade-dungeon-diff">{m.difficulty}</span>
                  <span className="arcade-dungeon-desc">{m.desc}</span>
                  {active && <span className="arcade-dungeon-check">✓ 已選</span>}
                </button>
              );
            })}
          </div>

          <div className="arcade-section-title" style={{ marginTop: 16 }}>隊友（{activeCount}/{TEAM_MAX_PLAYERS}）</div>
          <div className={`arcade-team-players ${players.length >= 6 ? "crowd" : ""}`}>
            {players.map((p) => {
              const offline = isStaleAt(p.lastAt, clock, PLAYER_STALE_MS);
              return (
                <div key={p.visitorId} className={`arcade-team-player ${offline ? "offline" : ""}`}>
                  <img src={p.catImage} alt={p.catName} width="48" height="48" />
                  <div>
                    <div className="arcade-team-player-name">{p.nickname}{p.visitorId === room.hostId ? " 👑" : ""}</div>
                    <div className="arcade-team-player-sub">{offline ? "📴 離線" : `🐱 ${p.catName}`}</div>
                  </div>
                </div>
              );
            })}
            {activeCount < TEAM_MAX_PLAYERS && (
              <div className="arcade-team-player empty">+ 等待加入</div>
            )}
          </div>

          {error && <div className="arcade-note" style={{ color: "#b23b2e", borderColor: "#efc0b4", background: "#fbe9e5" }}>{error}</div>}
          <SyncButton syncing={syncing} message={syncMessage} onClick={handleResync} />

          {!isHost && hostStale && (
            <>
              <div className="arcade-note" style={{ marginTop: 12, textAlign: "left" }}>
                👑 隊長好像離線了！你可以接管隊長，等人到齊就能出發。
              </div>
              <button
                type="button"
                className="arcade-primary green"
                style={{ marginTop: 10, width: "100%" }}
                onClick={handleTakeOver}
                disabled={busy}
              >
                {busy ? "接管中…" : "👑 接管隊長"}
              </button>
            </>
          )}

          <div className="arcade-row" style={{ marginTop: 18 }}>
            <button type="button" className="arcade-primary blue" style={{ flex: 1 }} onClick={handleLeave}>
              離開
            </button>
            {isHost ? (
              <button
                type="button"
                className="arcade-primary green"
                style={{ flex: 1 }}
                onClick={handleStart}
                disabled={busy || activeCount < 2}
              >
                {activeCount < 2 ? `等朋友加入（${activeCount}/2）…` : busy ? "準備中…" : "🚀 開始冒險！"}
              </button>
            ) : (
              <button type="button" className="arcade-primary" style={{ flex: 1 }} disabled>
                等待隊長開始…
              </button>
            )}
          </div>
        </div>
      </TeamStage>
    );
  }

  // ── 戰鬥 ─────────────────────────────────────────────
  const presentationMonster = resolution?.monsterSnapshot || room.lastResolution?.monsterSnapshot;
  const monster = presentationPending && presentationMonster ? presentationMonster : room.monster;
  const stages = room.adventure?.stages || [];
  const stageCount = stages.length || 3;
  const isBossFight = presentationPending
    ? !!(resolution?.isBoss ?? room.lastResolution?.isBoss)
    : (room.stageIdx || 0) >= stageCount;
  const displayMonsterHp = presentationMonsterHp == null ? room.monsterHp : presentationMonsterHp;
  const monsterPct = monster ? Math.max(0, Math.min(100, (displayMonsterHp / monster.hp) * 100)) : 0;
  // 箭可以是數字（記分板）或靶面落點物件 { nx, ny, score }（BOSS 戰）
  const scoreOf = (b) => (typeof b === "number" ? Math.min(10, Math.max(0, b)) : b && typeof b.score === "number" ? b.score : 0);
  const total = arrows.reduce((a, b) => a + scoreOf(b), 0);
  const showFx = fx && fx !== "settle";
  const bossBadge = isBossFight ? " 👑" : "";
  const spirit = room.spirit != null ? room.spirit : 100;
  const spiritPct = Math.max(0, Math.min(100, (spirit / 100) * 100));
  const teamMin = room.teamGoals?.teamMin;
  const teamTotal = players.reduce((s, p) => s + (p.roundScore || 0), 0);
  const myGoal = room.teamGoals?.personal?.find((g) => g.id === myStats?.personalGoalId);
  const myGoalMet = myGoal ? checkPersonalGoal(myGoal.id, arrows, myGoal.pos) : null;
  const playerAlive = myStats?.alive !== false && (myStats?.hp === undefined || Number(myStats.hp) > 0);
  return (
    <TeamStage>
      {!online && <OfflineBanner />}
      <RoomCodeBadge code={room.roomCode || roomCode} />
      {activeAttacker && (
        <div className="arcade-team-attacker-banner" aria-live="polite">
          🏹 {activeAttacker.nickname} 攻擊！ <small>🐱 {activeAttacker.catName}</small>
        </div>
      )}
      {killBurst && (
        <div className="arcade-kill-burst" aria-live="polite">
          <span>💥 擊破！</span><small>{monster.name} 被全隊擊敗</small>
        </div>
      )}
      {/* 王房前全螢幕過場（進入 raid 舞台前）：王現身＋招式名＋音效 */}
      {bossEntrance && (
        <BossEntrance
          boss={bossEntrance.boss}
          rage={bossEntrance.rage}
          tagline="全隊合力討伐！"
        />
      )}
      {/* 全隊路線揭曉動畫：覆蓋在戰鬥畫面上方 */}
      {routeReveal && (
        <RouteReveal
          route={routeReveal.route}
          log={routeReveal.log}
          isBoss={false}
        />
      )}
      <div className={isBossFight ? `arcade-raid-stage${!(resolution && fx === "settle") ? " input-mode" : ""}` : "arcade-card"}>
        {/* 四段進度：三關 + BOSS */}
        {isBossFight && <div className="arcade-raid-glow" />}
        <div className="arcade-team-track">
          {stages.map((s, i) => {
            const done = (room.stageIdx || 0) > i;
            const cur = (room.stageIdx || 0) === i && !isBossFight;
            return (
              <div key={s.stage} className={`arcade-team-track-item ${done ? "done" : cur ? "cur" : ""}`}>
                <span>{done ? "✅" : s.label.split(" ")[1]?.replace("關", "") || "關"}</span>
              </div>
            );
          })}
          <div className={`arcade-team-track-item ${isBossFight ? "cur boss" : ""}`}>
            <span>{isBossFight ? "👑" : "BOSS"}</span>
          </div>
        </div>

        {/* BOSS 戰：世界王風深色舞台（頂部血條＋大立繪＋士氣格狀槽） */}
        {isBossFight ? (
          <>
            {/* 頂部血條：名字＋HP＋進度（RaidBossBar 語意） */}
            <div className="arcade-raid-bossbar">
              <div className="arcade-raid-bossbar-row">
                <span className="arcade-raid-bossname">👹 {monster.name}</span>
                <span className="arcade-raid-bossbar-hp">{displayMonsterHp} / {monster.hp}</span>
              </div>
              <div className="arcade-raid-bossbar-track">
                <div
                  className="arcade-raid-bossbar-fill"
                  style={{
                    width: `${monsterPct}%`,
                    background: monsterPct > 66
                      ? "linear-gradient(90deg,#dc2626,#f87171)"
                      : monsterPct > 33
                        ? "linear-gradient(90deg,#c026d3,#e879f9)"
                        : "linear-gradient(90deg,#991b1b,#ef4444)",
                  }}
                />
              </div>
            </div>

            {/* 王的大立繪置中＋漂浮傷害＋大招橫幅（弱點圈移到下方的靶面上，玩家瞄準自己的圈射） */}
            <div className="arcade-raid-bossbox">
              <div className={`arcade-raid-boss-wrap arcade-raid-boss-${bossAnim || "idle"}`}>
                <img key={monster.id + room.monsterIdx} src={monster.image} alt={monster.name} width="320" height="320" className="arcade-monster-img" />
              </div>
              {/* 每人漂浮傷害 */}
              {floats.map((f) => (
                <span key={f.key} className={`arcade-raid-float ${f.kind}`} style={{ left: `${f.left}%` }}>
                  {f.text}
                </span>
              ))}
              {/* 大招／打斷橫幅 */}
              {raidBanner && (
                <div className="arcade-raid-banner" style={{ color: raidBanner.color, textShadow: `0 0 30px ${raidBanner.color}` }}>
                  {raidBanner.text}
                </div>
              )}
            </div>

            {/* 團隊目標＋我的目標 */}
            <div className="arcade-boss-goals">
              <div className="arcade-boss-goal team">
                <div className="arcade-boss-goal-label">🎯 團隊目標</div>
                <div className="arcade-boss-goal-text">全隊總分 ≥ {teamMin} → 打斷大招！</div>
                <div className="arcade-boss-goal-progress">
                  目前 <b>{teamTotal}</b> / {teamMin}
                </div>
              </div>
              <div className="arcade-boss-goal personal">
                <div className="arcade-boss-goal-label">🎯 我的目標</div>
                <div className="arcade-boss-goal-text">
                  {myGoal
                    ? (<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className="arcade-goal-dot" style={{ background: myGoal.color, boxShadow: `0 0 8px ${myGoal.color}` }} />
                        射進你的圈！
                      </span>)
                    : "射準就對了！"}
                </div>
                <div className="arcade-boss-goal-progress">{myGoalMet === null ? "未填箭" : myGoalMet ? "✅ 已達成" : "⏳ 尚未達成"}</div>
              </div>
            </div>

            {/* 士氣＝格狀槽（世界王破防槽語意） */}
            <div className="arcade-raid-spirit">
              <div className="arcade-raid-spirit-row">
                <span>💪 團隊士氣</span>
                <span>{spirit} / 100</span>
              </div>
              <div className="arcade-raid-cells">
                {Array.from({ length: 20 }).map((_, i) => {
                  const filled = spirit >= Math.round((i + 1) * 5);
                  const low = spirit <= 30;
                  return <span key={i} className={`arcade-raid-cell ${filled ? "on" : ""} ${filled && low ? "low" : ""}`} />;
                })}
              </div>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", marginTop: 4 }}>
                {room.teamGoals?.atkBuff > 1 ? `✨ 攻擊加成 ×${room.teamGoals.atkBuff}　` : ""}
                沒打斷大招 → 士氣下降並對全體存活隊員造成傷害
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 叉路效果提示 */}
            {Array.isArray(room.routeLog) && room.routeLog.length > 0 && (
              <div className="arcade-route-log">
                {room.routeLog.map((t, i) => <div key={i}>{t}</div>)}
              </div>
            )}

            <div className="arcade-battle-head">
              <div className={`arcade-battle-side monster ${fx === "impact" ? "fx-shake" : ""} ${fx === "kill" ? "fx-dead" : ""}`}>
                <div className="arcade-fighter">
                  <div className="arcade-boss-weakspots">
                    <img key={monster.id + room.monsterIdx} src={monster.image} alt={monster.name} width="320" height="320" className="arcade-monster-img" />
                  </div>
                  <div>
                    <div className="arcade-fighter-name">{monster.emoji} {monster.name}{bossBadge}</div>
                    <div className="arcade-fighter-sub">🤝 全隊合力 · 戰利品 🪙{monster.rewardCoins}</div>
                  </div>
                </div>
                <div className="arcade-hpbar"><div className="arcade-hpbar-fill hp-monster" style={{ width: `${monsterPct}%` }} /></div>
                <div className="arcade-hp-text">❤️ {displayMonsterHp} / {monster.hp}</div>
                <div className="arcade-hitflash" />
                {fx === "attack" && <div className="arcade-arrow-fly">🏹</div>}
                {fx === "impact" && activeAttacker && <div className="arcade-float-dmg dmg">💥 {activeAttacker.dmg || 0}</div>}
              </div>
            </div>

            <div className="arcade-task">{monster.task}</div>
          </>
        )}

        {resolution && fx === "settle" ? (
          /* 結算訊息：底部彈出面板覆蓋顯示，不推擠版面、手機不用捲動。
             一般關卡自動推進；BOSS 戰未分勝負 → 隊長按「繼續 →」門控，隊員等待（隊長離線可代按）。 */
          <BattleResultSheet
            result={resolution}
            roundKey={resolution.round}
            monsterName={monster.name}
            notes={[
              ...(resolution.isBoss && !resolution.victory && !resolution.defeat
                ? [{ text: `💪 士氣 ${resolution.spirit}${resolution.teamInterrupted ? "（打斷大招！）" : "（大招命中…）"}`, style: { color: "#b23b2e", borderColor: "#efc0b4", background: "#fbe9e5" } }]
                : []),
              { text: resolution.isBoss && !resolution.victory && !resolution.defeat ? "BOSS 戰繼續！" : "下一回合準備中…" },
            ]}
            advance={resolution.isBoss && !resolution.victory && !resolution.defeat ? {
              isHost,
              hostStale: !!hostPlayer && (clock - (hostPlayer.lastAt || 0)) > HOST_STALE_MS,
              onAdvance: handleAdvance,
              busy,
            } : null}
          />
        ) : (
          <>
            <div className="arcade-section-title" style={{ marginTop: 14 }}>隊友（{players.filter((p) => p.ready).length}/{players.length} 已送出）</div>
            <div className={`arcade-team-players ${players.length >= 6 ? "crowd" : ""}`}>
              {players.map((p) => {
                const hp = Math.max(0, Number.isFinite(Number(p.hp)) ? Number(p.hp) : 100);
                const maxHp = Number(p.maxHp) || 100;
                const hit = partyHitIds.includes(p.visitorId);
                return (
                <div key={p.visitorId} className={`arcade-team-player ${p.ready ? "ready" : ""} ${p.alive === false ? "down" : ""} ${hit ? "party-hit" : ""}`}>
                  <img src={p.catImage} alt={p.catName} width="48" height="48" />
                  <div>
                    <div className="arcade-team-player-name">{p.nickname}{p.visitorId === room.hostId ? " 👑" : ""}</div>
                    <div className="arcade-team-player-sub">{p.ready ? "✅ 已送出" : "⏳ 射箭中…"}</div>
                    <div className="arcade-team-player-hp"><span style={{ width: `${Math.max(0, Math.min(100, hp / maxHp * 100))}%` }} /></div>
                    <div className="arcade-team-player-hptext">HP {hp}/{maxHp}{hit ? `　-${room.lastResolution?.partyDamage?.find((x) => x.visitorId === p.visitorId)?.amount || 0}` : ""}</div>
                  </div>
                </div>
              );})}
            </div>

            {!playerAlive ? (
              <div className="arcade-acting" style={{ marginTop: 16 }}>💫 你已倒下，觀戰直到隊友結束這場戰鬥…</div>
            ) : !submitted ? (
              <>
                {isBossFight ? (
                  <>
                    {/* BOSS 戰：靶面點擊輸入（瞄準自己的弱點圈射，命中才有弱點攻擊） */}
                    <div className="arcade-section-title" style={{ marginTop: 14 }}>🎯 靶面瞄準（{arrows.filter((x) => x && typeof x === "object").length}/{ARROWS_PER_ROUND} 箭）</div>
                    <BossTarget
                      ring={myGoal?.pos}
                      ringColor={myGoal?.color}
                      arrows={arrows}
                      disabled={busy || showFx || !online}
                      onArrow={(shot) => setArrows((a) => {
                        const idx = a.findIndex((x) => !x || typeof x !== "object");
                        if (idx < 0) return a;
                        const next = a.slice();
                        next[idx] = shot;
                        return next;
                      })}
                    />
                    <div className="arcade-quick">
                      <button type="button" className="arcade-quick-btn" onClick={() => setArrows((a) => { const idx = [...a].reverse().findIndex((x) => x && typeof x === "object"); if (idx < 0) return a; const i = a.length - 1 - idx; const next = a.slice(); next[i] = null; sfxTap(); return next; })} disabled={!arrows.some((x) => x && typeof x === "object")}>↩️ 撤回上一箭</button>
                      <button type="button" className="arcade-quick-btn" onClick={() => { setArrows(Array(ARROWS_PER_ROUND).fill(null)); sfxTap(); }} disabled={!arrows.some((x) => x && typeof x === "object")}>🗑️ 清空</button>
                    </div>
                  </>
                ) : (
                  <>
                    <ArcadeArrowInput count={ARROWS_PER_ROUND} values={arrows} onChange={(i, v) => setArrows((a) => a.map((x, idx) => (idx === i ? v : x)))} />
                    <div className="arcade-quick">
                      <button type="button" className="arcade-quick-btn" onClick={() => fillAll(10)}>全 10</button>
                      <button type="button" className="arcade-quick-btn" onClick={() => fillAll(8)}>全 8</button>
                      <button type="button" className="arcade-quick-btn" onClick={() => fillAll(5)}>全 5</button>
                      <button type="button" className="arcade-quick-btn" onClick={() => fillAll(0)}>清空</button>
                    </div>
                  </>
                )}
                <button type="button" className="arcade-primary" style={{ marginTop: 14 }} onClick={handleSubmit} disabled={busy || showFx || !online}>
                  {online ? `🏹 送出本回合！（${total} 分）` : "📡 離線中…"}
                </button>
              </>
            ) : (
              <div className="arcade-acting" style={{ marginTop: 16 }}>
                <span className="arcade-acting-dots"><i /><i /><i /></span>
                已送出 {total} 分，等隊友一起攻擊…
              </div>
            )}
          </>
        )}

        {error && <div className="arcade-note" style={{ color: "#b23b2e", borderColor: "#efc0b4", background: "#fbe9e5" }}>{error}</div>}
        <SyncButton syncing={syncing} message={syncMessage} onClick={handleResync} />

        <button type="button" className="arcade-danger" style={{ marginTop: 14, width: "100%" }} onClick={handleLeave}>
          離開隊伍
        </button>
      </div>
    </TeamStage>
  );
}

function TeamStage({ children }) {
  return (
    <div className="arcade-stage">
      <div className="arcade-wrap">{children}</div>
    </div>
  );
}

function SyncButton({ syncing, message, onClick }) {
  return (
    <div className="arcade-sync-box">
      <button type="button" className="arcade-primary blue" onClick={onClick} disabled={syncing}>
        {syncing ? "同步中…" : "🔄 重新同步"}
      </button>
      {message && <div className="arcade-sync-message">{message}</div>}
    </div>
  );
}

function RoomCodeBadge({ code }) {
  if (!code) return null;
  return (
    <div className="arcade-note blue" style={{ margin: "0 0 10px", textAlign: "center", padding: "8px 12px" }}>
      🔢 房間 <strong style={{ letterSpacing: 3 }}>{code}</strong> · 斷線可用此房號返回
    </div>
  );
}

/** 全隊路線揭曉過場（覆蓋層）：大 icon 彈入 → 路線名＋效果 → 自動淡出 */
function RouteReveal({ route, log, isBoss }) {
  return (
    <div className="arcade-route-reveal" aria-hidden="true">
      <div className="arcade-route-reveal-bg" />
      <div className="arcade-route-reveal-inner">
        <div className="arcade-route-reveal-kicker">
          {isBoss ? "BOSS 戰即將開始…" : "🤝 全隊出發！"}
        </div>
        <div className="arcade-route-reveal-icon" style={{ color: route.tone }}>{route.icon}</div>
        <div className="arcade-route-reveal-title">{route.label}</div>
        <div className="arcade-route-reveal-desc">{route.desc}</div>
        {log.length > 0 && (
          <div className="arcade-route-reveal-log">
            {log.map((t, i) => <div key={i}>{t}</div>)}
          </div>
        )}
        {isBoss && <div className="arcade-route-reveal-boss">👑 世界王級 BOSS 現身！</div>}
      </div>
    </div>
  );
}

function OfflineBanner() {
  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 99,
        background: "#2b3a67", color: "#eef2fc", textAlign: "center",
        padding: "8px 12px", fontSize: 13, fontWeight: 900,
        boxShadow: "0 10px 26px rgba(0,0,0,.25)",
      }}
    >
      📡 網路不穩，正在重連…（輸入中的箭數已保存在本機）
    </div>
  );
}

function Confetti() {
  const pieces = [
    { left: "8%", delay: "0s", dur: "2.6s", emoji: "🎉" },
    { left: "22%", delay: ".3s", dur: "2.9s", emoji: "⭐" },
    { left: "38%", delay: ".1s", dur: "2.4s", emoji: "🎊" },
    { left: "55%", delay: ".5s", dur: "2.8s", emoji: "✨" },
    { left: "70%", delay: ".2s", dur: "2.5s", emoji: "🎉" },
    { left: "86%", delay: ".4s", dur: "2.7s", emoji: "⭐" },
  ];
  return (
    <div className="arcade-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur }}>{p.emoji}</span>
      ))}
    </div>
  );
}
