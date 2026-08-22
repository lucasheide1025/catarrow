// src/arcade/arcadeTeamDb.js — 組隊雲端協調層（Cloud for coordination）
// 單人遊戲完全 Local First；組隊才碰 Firestore（arcadeRooms/{roomCode}），
// 且只同步最小欄位：玩家身分＋每回合分數＋房間狀態。不搬整份 visitorProfile。
// 規格 §30：雲端只負責協調不同手機；排行榜只上傳最終結果。
// 房間碼就是鑰匙；規則與 guestSessions 相同（免登入、短生命週期）——見 firestore.rules。
import {
  collection, doc, getDoc, getDocs, runTransaction, setDoc,
  deleteDoc, onSnapshot, serverTimestamp, query, where,
  updateDoc, deleteField,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  TEAM_MIN_PLAYERS, TEAM_MAX_PLAYERS, TEAM_ROOM_TTL_MS,
  isValidRoomCode, buildTeamAdventure, resolveTeamRound, resolveTeamBossRound, accumulateTeamPlayerStats,
  teamGrade, assignPersonalGoals, routeById, rollTeamEvent, eliteVariant,
  teamModeById,
  TEAM_BOSS_TEAM_MIN, TEAM_BOSS_SPIRIT_START, TEAM_BOSS_SPIRIT_GAIN, TEAM_BOSS_SPIRIT_LOST,
  HOST_STALE_MS, PLAYER_STALE_MS, RESULT_RETENTION_MS, pruneStaleRoster, isStaleAt,
} from "./arcadeTeamLogic";
import { resolveTargetHit } from "../lib/targetFace";

const C = "arcadeRooms";

function humanError(e) {
  const msg = String(e?.message || e || "");
  if (/__ROOM_NOT_FOUND__/.test(msg)) return "找不到這個房間，檢查一下代碼？";
  if (/__ROOM_FULL__/.test(msg)) return "這個房間已經滿了（最多 8 人）";
  if (/__WRONG_ROOM_KIND__/.test(msg)) return "這個代碼是射手競技場，不是組隊冒險房";
  if (/__ALREADY_STARTED__/.test(msg)) return "冒險已經開始了，等下一場吧";
  if (/__NOT_HOST__/.test(msg)) return "只有隊長可以開始冒險";
  if (/__HOST_ALIVE__/.test(msg)) return "隊長還在線上，只有隊長能開始";
  if (/__NEED_MORE__/.test(msg)) return "至少需要 2 位玩家才能出發";
  if (/__ROUND_MISMATCH__/.test(msg)) return "回合不同步，請重新整理";
  if (/__NOT_PLAYER__/.test(msg)) return "你不在這個房間裡";
  if (/__STALE_ROUND__/.test(msg)) return "這個回合已經送出過了";
  if (/__BAD_ROUTE__/.test(msg)) return "這條路不在選項裡，重新整理看看";
  if (/insufficient permissions|permission-denied/i.test(msg)) return "資料庫權限還沒開（arcadeRooms）——請在 Firebase Console 貼上規則";
  if (/offline|unavailable|network/i.test(msg)) return "網路連不上，等一下再按一次";
  if (/deadline|timeout/i.test(msg)) return "連線太慢，再按一次送出（不會重複計分）";
  return msg || "操作失敗";
}

function playerEntry(profile) {
  const cat = profile.cat || {};
  const combat = profile.combatSnapshot || {};
  return {
    visitorId: profile.visitorId,
    nickname: profile.nickname,
    catId: cat.id || profile.catId || "haji",
    catName: cat.name || "貓貓",
    catImage: cat.image || "/cats/haji.webp",
    catRole: cat.role || "",
    joinedAt: Date.now(),
    lastAt: Date.now(),
    ready: false,
    roundScore: 0,
    roundHits: 0,
    roundShots: 0,
    roundScoreSq: 0,
    score: 0,
    shots: 0,
    hitCount: 0,
    scoreSqSum: 0,
    damage: 0,
    kills: 0,
    level: Math.max(1, Number(combat.level) || 1),
    hp: Math.max(1, Number(combat.maxHp) || 100),
    maxHp: Math.max(1, Number(combat.maxHp) || 100),
    atk: Math.max(1, Number(combat.atk) || 10),
    def: Math.max(0, Number(combat.def) || 5),
    cardEffects: Array.isArray(combat.cardEffects) ? combat.cardEffects.slice(0, 2) : [],
  };
}

/** 建立房間（隊長）。碰撞自動換一組新代碼重試。mode: forest | moon | abyss */
export async function createTeamRoom({ visitorId, nickname, cat, combatSnapshot }, mode = "forest") {
  if (!visitorId) return { ok: false, reason: "參數錯誤" };
  const safeMode = teamModeById(mode).id;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const roomCode = String(Math.floor(10000 + Math.random() * 90000));
    const ref = doc(db, C, roomCode);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error("__COLLISION__");
        const now = Date.now();
        tx.set(ref, {
          kind: "team",
          roomCode,
          sessionKey: `team-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          hostId: visitorId,
          status: "waiting",
          mode: safeMode,
          players: { [visitorId]: playerEntry({ visitorId, nickname, cat, combatSnapshot }) },
          adventure: null,
          monsterIdx: 0,
          monster: null,
          monsterHp: 0,
          monsterStatuses: [],
          round: 0,
          lastResolution: null,
          result: null,
          advanceRound: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt: now + TEAM_ROOM_TTL_MS,
        });
      });
      pruneExpiredRooms(); // 順手清掉過期房間（best-effort）
      return { ok: true, roomCode };
    } catch (e) {
      if (/__COLLISION__/.test(String(e?.message))) continue; // 換代碼重試
      return { ok: false, reason: humanError(e) };
    }
  }
  return { ok: false, reason: "房間代碼一直撞號，再試一次" };
}

/** 大廳：隊長切換冒險模式（開始前可自由換，其他隊員即時看到）。 */
export async function setTeamMode(roomCode, visitorId, mode) {
  if (!isValidRoomCode(roomCode)) return { ok: false, reason: "請輸入 5 位數房間代碼" };
  if (!teamModeById(mode)) return { ok: false, reason: "沒有這個冒險模式" };
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.status !== "waiting") throw new Error("__ALREADY_STARTED__");
      if (data.hostId !== visitorId) throw new Error("__NOT_HOST__");
      tx.update(ref, { mode: teamModeById(mode).id, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/** 加入房間（朋友掃 QR 或輸入代碼）。順手清掉離線玩家，保持名單乾淨。 */
export async function joinTeamRoom(roomCode, { visitorId, nickname, cat, combatSnapshot }) {
  if (!isValidRoomCode(roomCode)) return { ok: false, reason: "請輸入 5 位數房間代碼" };
  if (!visitorId) return { ok: false, reason: "參數錯誤" };
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      // 舊房間沒有 kind 視為 team；新 PvP 房必須拒絕，避免兩種玩法共用 5 位碼時串錯房。
      if (data.kind && data.kind !== "team") throw new Error("__WRONG_ROOM_KIND__");
      // 清離線玩家（含離線房主 → 之後由 start/takeOver 轉移）
      const now = Date.now();
      const stale = pruneStaleRoster(data.players, now, PLAYER_STALE_MS);
      if (stale.removed.length) {
        const rm = {};
        stale.removed.forEach((p) => { rm[`players.${p.visitorId}`] = deleteField(); });
        tx.update(ref, { ...rm, updatedAt: serverTimestamp() });
      }
      const existing = data.players?.[visitorId];
      if (existing) {
        // 回來（含戰鬥中重連）：用完整 playerEntry 補齊所有欄位再覆寫——
        // 心跳可能留下只有 lastAt 的幽靈欄位（見 heartbeat），重連時必須補回統計欄位，不能有 undefined
        const fresh = playerEntry({ visitorId, nickname, cat, combatSnapshot });
        tx.update(ref, {
          [`players.${visitorId}`]: {
            ...fresh,
            ...existing,
            nickname: nickname || existing.nickname || "貓客",
            catId: cat?.id || existing.catId || fresh.catId,
            catName: cat?.name || existing.catName || fresh.catName,
            catImage: cat?.image || existing.catImage || fresh.catImage,
            catRole: cat?.role || existing.catRole || fresh.catRole,
            ...(data.status === "waiting" ? {
              level: fresh.level,
              hp: fresh.maxHp,
              maxHp: fresh.maxHp,
              atk: fresh.atk,
              def: fresh.def,
              cardEffects: fresh.cardEffects,
            } : {}),
            lastAt: now,
          },
          updatedAt: serverTimestamp(),
        });
        return;
      }
      if (data.status !== "waiting") throw new Error("__ALREADY_STARTED__");
      const activeCount = stale.active.length;
      if (activeCount >= TEAM_MAX_PLAYERS) throw new Error("__ROOM_FULL__");
      tx.update(ref, {
        [`players.${visitorId}`]: playerEntry({ visitorId, nickname, cat, combatSnapshot }),
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true, roomCode };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/** 隊長開始冒險：依玩家人數縮放整趟冒險，寫入第一隻怪物。
 * 原隊長離線（超過 HOST_STALE_MS 沒心跳）時，任何玩家可以直接接管並開始。 */
export async function startTeamRoom(roomCode, hostId) {
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.status !== "waiting") throw new Error("__ALREADY_STARTED__");
      const players = data.players || {};
      const now = Date.now();
      // 先清離線玩家：幽靈不該算人數，也不該留在開場名單
      const prune = pruneStaleRoster(players, now, PLAYER_STALE_MS);
      const rm = {};
      prune.removed.forEach((p) => { rm[`players.${p.visitorId}`] = deleteField(); });
      const hostRec = players[data.hostId];
      const hostStale = !hostRec || isStaleAt(hostRec.lastAt, now, HOST_STALE_MS);
      if (!hostStale && data.hostId !== hostId) throw new Error("__NOT_HOST__");
      if (hostStale && !prune.active.some((p) => p.visitorId === hostId)) throw new Error("__NOT_PLAYER__");
      const count = prune.active.length;
      if (count < TEAM_MIN_PLAYERS) throw new Error("__NEED_MORE__");
      const adventure = buildTeamAdventure(data.mode, count);
      const first = adventure.stages[0].monster;
      const patch = {
        ...rm,
        status: "fighting",
        adventure,
        stageIdx: 0,
        routeIdx: -1,
        routeEffects: { atkBuff: 1, coinMult: 1, spirit: TEAM_BOSS_SPIRIT_START },
        monster: first,
        monsterHp: first.hp,
        monsterStatuses: [],
        round: 1,
        startedAt: Date.now(), // 最速通關統計用
        updatedAt: serverTimestamp(),
      };
      prune.active.forEach((player) => {
        const maxHp = Math.max(1, Number(player.maxHp) || 100);
        patch[`players.${player.visitorId}.hp`] = maxHp;
        patch[`players.${player.visitorId}.maxHp`] = maxHp;
        patch[`players.${player.visitorId}.alive`] = true;
      });
      if (hostStale) patch.hostId = hostId; // 離線房主 → 接管
      tx.update(ref, patch);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/**
 * 送出本回合（6 箭）。冪等：同一回合重送只回 duplicate，不會重複計分。
 * 最後一位送出的玩家在同一交易內解析整回合（全隊傷害 → 怪物 HP → 下一回合），
 * 所有人透過 onSnapshot 看到同一個結果。
 */
export async function submitTeamRound(roomCode, visitorId, { round, arrows }) {
  const ref = doc(db, C, roomCode);
  // 箭可以兩種形式：記分板數字（0~10／11=X）或靶面落點物件 { nx, ny }（BOSS 戰）。
  // 落點 → 用標準靶面換算環值（X 內十計 10 分）；統一存成 roundArrows 供解析用。
  let score = 0;
  let hits = 0;
  let xCount = 0;
  let scoreSq = 0;
  const normalized = (arrows || []).map((a) => {
    if (a && typeof a === "object" && a.nx != null && a.ny != null) {
      const hit = resolveTargetHit("full_110", a.nx, a.ny);
      if (hit.rawScore >= 5) hits += 1;
      if (hit.label === "X") xCount += 1;
      score += hit.rawScore;
      scoreSq += hit.rawScore * hit.rawScore;
      return { nx: a.nx, ny: a.ny, label: hit.label, score: hit.rawScore, ratio: hit.ratio };
    }
    const v = Math.min(10, Math.max(0, a)); // -1=未填視為 0；11=X 內十計 10
    if (v >= 5) hits += 1;
    if (a === 11) xCount += 1;
    score += v;
    scoreSq += v * v;
    return a;
  });
  try {
    let duplicate = false;
    let resolution = null;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.status !== "fighting") throw new Error("__ALREADY_STARTED__");
      if (data.round !== round) throw new Error("__ROUND_MISMATCH__");
      // 清離線玩家（超過 PLAYER_STALE_MS 沒心跳 → 移出戰局，避免卡死整房）
      const now = Date.now();
      const prune = pruneStaleRoster(data.players, now, PLAYER_STALE_MS);
      const removePatch = {};
      prune.removed.forEach((p) => { removePatch[`players.${p.visitorId}`] = deleteField(); });
      const players = { ...(data.players || {}) };
      prune.removed.forEach((p) => { delete players[p.visitorId]; });

      const me = players[visitorId];
      if (!me) throw new Error("__NOT_PLAYER__");
      if (me.ready) { duplicate = true; return; }

      players[visitorId] = { ...me, ready: true, roundScore: score, roundHits: hits, roundShots: normalized.length, roundScoreSq: scoreSq, roundX: xCount, roundArrows: normalized, lastAt: now };
      const selfPatch = {
        ...removePatch,
        [`players.${visitorId}.ready`]: true,
        [`players.${visitorId}.roundScore`]: score,
        [`players.${visitorId}.roundHits`]: hits,
        [`players.${visitorId}.roundShots`]: normalized.length,
        [`players.${visitorId}.roundScoreSq`]: scoreSq,
        [`players.${visitorId}.roundX`]: xCount,
        [`players.${visitorId}.roundArrows`]: normalized,
        [`players.${visitorId}.lastAt`]: now,
        updatedAt: serverTimestamp(),
      };

      const roster = Object.values(players);
      const activeRoster = roster.filter((p) => p.alive !== false && (p.hp === undefined || Number(p.hp) > 0));
      const allReady = activeRoster.length > 0 && activeRoster.every((p) => p.ready);
      if (!allReady) {
        tx.update(ref, selfPatch);
        return;
      }

      // ── 最後一位送出 → 解析本回合 ──
      const isBoss = (data.stageIdx || 0) >= (data.adventure?.stages?.length || 3);
      const comboInfo = isBoss ? resolveTeamBossRound(data, roster) : resolveTeamRound(data, roster);
      const monsterHp = comboInfo.monsterHp;
      const victory = comboInfo.victory;
      const defeat = !!comboInfo.defeat;
      const patch = {
        ...removePatch,
        monsterHp,
        monsterStatuses: comboInfo.monsterStatuses || [],
        round: data.round + 1,
        updatedAt: serverTimestamp(),
      };
      // 清掉所有就緒旗標、累加個人統計
      roster.forEach((p) => {
        const roundDmg = comboInfo.perPlayer?.find((x) => x.visitorId === p.visitorId)?.dmg
          ?? Math.round((Number(p.roundScore) || 0) * comboInfo.combo.totalMult);
        const totals = accumulateTeamPlayerStats(p, roundDmg);
        patch[`players.${p.visitorId}.ready`] = false;
        patch[`players.${p.visitorId}.roundScore`] = 0;
        patch[`players.${p.visitorId}.roundHits`] = 0;
        patch[`players.${p.visitorId}.roundShots`] = 0;
        patch[`players.${p.visitorId}.roundScoreSq`] = 0;
        patch[`players.${p.visitorId}.roundX`] = 0;
        patch[`players.${p.visitorId}.roundArrows`] = [];
        patch[`players.${p.visitorId}.score`] = totals.score;
        patch[`players.${p.visitorId}.shots`] = totals.shots;
        patch[`players.${p.visitorId}.hitCount`] = totals.hitCount;
        patch[`players.${p.visitorId}.scoreSqSum`] = totals.scoreSqSum;
        patch[`players.${p.visitorId}.damage`] = totals.damage;
        patch[`players.${p.visitorId}.xCount`] = totals.xCount; // X 內十累計
        // 個人最高單回合傷害（結果頁顯示）
        patch[`players.${p.visitorId}.bestRoundDamage`] = totals.bestRoundDamage;
      });
      (comboInfo.partyDamage || []).forEach((hit) => {
        patch[`players.${hit.visitorId}.hp`] = hit.hpAfter;
        patch[`players.${hit.visitorId}.maxHp`] = Math.max(1, Number(players[hit.visitorId]?.maxHp) || 100);
        patch[`players.${hit.visitorId}.alive`] = hit.alive;
      });
      // 全隊 Combo 累計（結果頁顯示）
      if (comboInfo.combo.comboMult > 1) {
        patch.combos = (data.combos || 0) + 1;
      }
      if (comboInfo.combo.comboMult >= 1.5) {
        patch.teamBreaks = (data.teamBreaks || 0) + 1;
      }
      // BOSS 戰：士氣變化
      if (isBoss && comboInfo.spirit !== undefined) {
        patch.spirit = comboInfo.spirit;
      }

      let adventureDone = false;
      if (victory) {
        // 每個人擊敗數 +1
        roster.forEach((p) => {
          patch[`players.${p.visitorId}.kills`] = (p.kills || 0) + 1;
        });
        const adventure = data.adventure;
        const stageCount = adventure?.stages?.length || 3;
        if (isBoss) {
          // BOSS 擊敗 → 冒險完成
          adventureDone = true;
          const kills = (data.monsterIdx || 0) + 1;
          const baseCoins = [...(adventure?.stages || []).map((s) => s.monster), adventure?.boss]
            .filter(Boolean)
            .reduce((s, m) => s + (m.rewardCoins || 0), 0);
          const coins = Math.round(baseCoins * (data.routeEffects?.coinMult || 1)); // 菁英/深入路獎勵加成
          patch.status = "result";
          patch.result = {
            kills, coins, grade: teamGrade(kills), finishedAt: Date.now(),
            mode: data.mode || "forest",
            dungeon: adventure?.dungeon || "🤝 組隊冒險",
            durationMs: Math.max(1, Date.now() - (data.startedAt || Date.now())),
          };
        } else {
          // 打完一關 → 叉路選擇（房主選）：路線影響下一關或 BOSS
          patch.stageIdx = (data.stageIdx || 0) + 1;
          patch.monsterIdx = (data.monsterIdx || 0) + 1;
          patch.status = "route";
          patch.routeIdx = data.stageIdx || 0; // 這一關的 routes 是選項（影響下一關/BOSS）
          patch.routeLog = [];
        }
      } else if (defeat) {
        // 團滅
        patch.status = "defeat";
        patch.result = {
          kills: data.monsterIdx || 0,
          coins: 0,
          grade: teamGrade(data.monsterIdx || 0, true),
          finishedAt: Date.now(),
          defeated: true,
        };
      }

      resolution = {
        round: data.round,
        monsterHpBefore: data.monsterHp || data.monster?.hp || 0,
        // 最後一擊同一個 snapshot 可能已把 room.monster 換成下一隻怪；
        // presentation 必須鎖住「本回合被打的那一隻」名稱/圖片/HP，避免擊破演出錯位。
        monsterSnapshot: data.monster ? {
          id: data.monster.id || "",
          name: data.monster.name || "怪物",
          image: data.monster.image || "",
          emoji: data.monster.emoji || "👹",
          hp: data.monster.hp || (data.monsterHp || 1),
          rewardCoins: data.monster.rewardCoins || 0,
          task: data.monster.task || "",
          ability: data.monster.ability || "",
          skillName: data.monster.skillName || "",
        } : null,
        totalScore: comboInfo.totalScore,
        dmg: comboInfo.dmg,
        hits: comboInfo.combo.hits,
        comboName: comboInfo.combo.comboName,
        comboMult: comboInfo.combo.comboMult,
        perfect: comboInfo.combo.perfect,
        totalMult: comboInfo.combo.totalMult,
        victory,
        defeat,
        adventureDone,
        isBoss,
        teamInterrupted: !!comboInfo.teamInterrupted,
        perPlayer: comboInfo.perPlayer || [],
        partyDamage: comboInfo.partyDamage || [],
        spirit: comboInfo.spirit ?? 100,
        monsterName: data.monster?.name,
        log: comboInfo.log,
      };
      patch.lastResolution = resolution;
      tx.update(ref, patch);
    });
    return { ok: true, duplicate, resolution };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/**
 * 房主選叉路（status === "route"）：套用路線效果 → 進下一關或 BOSS 戰。
 * 路線效果：寶箱路/貓薄荷 → atkBuff ×1.2；菁英路 → 下場怪 elite 化＋coinMult ×2；
 *           神秘事件 → 隨機；深入險境（最後一關）→ BOSS 狂暴＋coinMult ×1.5；休息 → 士氣 +20。
 */
export async function chooseTeamRoute(roomCode, visitorId, routeId) {
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.status !== "route") throw new Error("__ALREADY_STARTED__");
      if (data.hostId !== visitorId) throw new Error("__NOT_HOST__");
      const adventure = data.adventure;
      const routeIdx = data.routeIdx ?? 0;
      const stage = adventure?.stages?.[routeIdx];
      const allowed = (stage?.routes || []).map((r) => r);
      if (!allowed.includes(routeId)) throw new Error("__BAD_ROUTE__");
      const eff = { ...(data.routeEffects || { atkBuff: 1, coinMult: 1, spirit: TEAM_BOSS_SPIRIT_START }) };
      const nextStageIdx = data.stageIdx ?? routeIdx + 1;
      const isBoss = nextStageIdx >= (adventure?.stages?.length || 3);
      const routeLog = [];
      // 套用路線效果
      if (routeId === "treasure") {
        eff.atkBuff = (eff.atkBuff || 1) * 1.2;
        routeLog.push("📦 寶箱路：全隊開寶箱，接下來的攻擊變強了！");
      } else if (routeId === "elite") {
        eff.coinMult = (eff.coinMult || 1) * 2;
        routeLog.push("⚔️ 菁英路：接下來的怪物變強，但獎勵 ×2！");
      } else if (routeId === "event") {
        const ev = rollTeamEvent();
        routeLog.push(`${ev.icon} ${ev.text}`);
        if (ev.spirit) eff.spirit = Math.max(1, Math.min(TEAM_BOSS_SPIRIT_START, (eff.spirit ?? TEAM_BOSS_SPIRIT_START) + ev.spirit));
        if (ev.atkBuff) eff.atkBuff = (eff.atkBuff || 1) * ev.atkBuff;
      } else if (routeId === "deep") {
        eff.coinMult = (eff.coinMult || 1) * 1.5;
        routeLog.push("🔥 深入險境：BOSS 陷入狂暴，但獎勵 ×1.5！");
      } else if (routeId === "rest") {
        eff.spirit = Math.min(TEAM_BOSS_SPIRIT_START, (eff.spirit ?? TEAM_BOSS_SPIRIT_START) + TEAM_BOSS_SPIRIT_GAIN);
        routeLog.push("🛏️ 稍作休息：全隊恢復 20 士氣！");
      }
      const patch = {
        status: "fighting",
        routeIdx: -1,
        routeEffects: eff,
        atkBuff: eff.atkBuff || 1,
        routeLog,
        routeId,
        routeChosenAt: Date.now(), // 全隊揭曉動畫的觸發訊號（新值 → 播過場）
        updatedAt: serverTimestamp(),
      };
      if (isBoss) {
        // 最後一關 → BOSS 戰（世界王風格：團隊目標＋各自攻擊目標＋士氣）
        const roster = Object.values(data.players || {});
        let boss = adventure.boss;
        if (routeId === "deep") {
          boss = {
            ...boss,
            id: `rage_${boss.id}`,
            name: `狂暴${boss.name}`,
            hp: Math.round(boss.hp * 1.3),
            maxHp: Math.round(boss.hp * 1.3),
            atk: (boss.atk || 0) + 5,
            task: `🔥 ${boss.name} 狂暴化了！但獎勵 ×1.5`,
          };
        }
        const teamMin = Math.round(TEAM_BOSS_TEAM_MIN * (roster.length / 2));
        const personal = assignPersonalGoals(roster.length);
        roster.forEach((p, i) => {
          patch[`players.${p.visitorId}.personalGoalId`] = personal[i % personal.length].id;
        });
        patch.spirit = Math.max(1, eff.spirit ?? TEAM_BOSS_SPIRIT_START);
        patch.teamGoals = { teamMin, personal, atkBuff: eff.atkBuff || 1 };
        patch.monster = boss;
        patch.monsterHp = boss.hp;
        patch.monsterStatuses = [];
      } else {
        // 進下一關：菁英路 → 下場怪 elite 化
        let m = adventure.stages[nextStageIdx].monster;
        if (routeId === "elite") m = eliteVariant(m);
        patch.monster = m;
        patch.monsterHp = m.hp;
        patch.monsterStatuses = [];
      }
      tx.update(ref, patch);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/**
 * 隊長「繼續 →」推進訊號（BOSS 戰結算門控）：
 * 寫入 advanceRound = 目前 room.round，所有隊員監聽到該回合已推進 → 收起結算面板。
 * 防呆：隊長離線（超過 HOST_STALE_MS 沒心跳）時，任一隊員可代按（不換 host，只推進）。
 */
export async function advanceTeamRound(roomCode, visitorId) {
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.status !== "fighting") throw new Error("__ALREADY_STARTED__");
      if (!data.players?.[visitorId]) throw new Error("__NOT_PLAYER__");
      const host = data.players?.[data.hostId];
      const hostStale = !host || isStaleAt(host.lastAt, Date.now(), HOST_STALE_MS);
      if (data.hostId !== visitorId && !hostStale) throw new Error("__NOT_HOST__");
      if ((data.advanceRound || 0) >= data.round) return; // 已推進過（冪等）
      tx.update(ref, { advanceRound: data.round, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/** 離開房間。隊長離開 → 整房刪除；所有人離開 → 整房刪除。 */
export async function leaveTeamRoom(roomCode, visitorId) {
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const isHost = data.hostId === visitorId;
      const players = { ...(data.players || {}) };
      delete players[visitorId];
      if (isHost || Object.keys(players).length === 0) {
        tx.delete(ref);
        return;
      }
      tx.update(ref, {
        players,
        updatedAt: serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/** 心跳：更新我的 lastAt（元件掛載期間每 25 秒呼叫一次，讓逾時機制知道我還活著）。
 * ⚠️ 只在「玩家還在名單裡」時更新——updateDoc 對不存在的欄位路徑會自動建立，
 *    離線玩家被清理後，心跳若再寫會製造只有 lastAt 的幽靈欄位（重連時缺欄）。 */
export async function heartbeatTeamRoom(roomCode, visitorId) {
  if (!roomCode || !visitorId) return { ok: false };
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(doc(db, C, roomCode));
      if (!snap.exists()) return;
      const data = snap.data();
      if (!data.players?.[visitorId]) return; // 已被清理 → 不製造幽靈欄位
      tx.update(doc(db, C, roomCode), {
        [`players.${visitorId}.lastAt`]: Date.now(),
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/**
 * 逾時清理（交易保護、冪等）：
 *  - 過期（expiresAt）→ 刪房
 *  - 結果頁保留 RESULT_RETENTION_MS 後刪房
 *  - 戰鬥/大廳：離線玩家（PLAYER_STALE_MS）移出名單；清空 → 刪房
 *  - 大廳：房主離線（HOST_STALE_MS）→ 交給最近活躍的玩家
 */
export async function cleanupStaleRoom(roomCode) {
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const now = Date.now();
      if (data.expiresAt && data.expiresAt < now) { tx.delete(ref); return; }
      if (data.status === "result") {
        const finishedAt = data.result?.finishedAt || now;
        if (now - finishedAt > RESULT_RETENTION_MS) tx.delete(ref);
        return;
      }
      const prune = pruneStaleRoster(data.players, now, PLAYER_STALE_MS);
      if (prune.active.length === 0) { tx.delete(ref); return; }
      const patch = { updatedAt: serverTimestamp() };
      prune.removed.forEach((p) => { patch[`players.${p.visitorId}`] = deleteField(); });
      const hostAlive = prune.active.some((p) => p.visitorId === data.hostId);
      if (!hostAlive && data.status === "waiting") {
        const sorted = [...prune.active].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
        patch.hostId = sorted[0].visitorId;
      }
      if (prune.removed.length > 0 || patch.hostId) {
        tx.update(ref, patch);
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/** 接管隊長（大廳限定）：原隊長離線超過 HOST_STALE_MS 才能接管。 */
export async function takeOverHost(roomCode, visitorId) {
  const ref = doc(db, C, roomCode);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("__ROOM_NOT_FOUND__");
      const data = snap.data();
      if (data.status !== "waiting") throw new Error("__ALREADY_STARTED__");
      if (!data.players?.[visitorId]) throw new Error("__NOT_PLAYER__");
      const host = data.players?.[data.hostId];
      if (host && !isStaleAt(host.lastAt, Date.now(), HOST_STALE_MS)) {
        throw new Error("__HOST_ALIVE__");
      }
      tx.update(ref, { hostId: visitorId, updatedAt: serverTimestamp() });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

/** 訂閱房間即時狀態。回傳取消函式。 */
export function subscribeTeamRoom(roomCode, cb, onError) {
  if (!roomCode) return () => {};
  return onSnapshot(
    doc(db, C, roomCode),
    (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    (err) => {
      console.warn("[arcadeTeam] snapshot error (kept locally):", err?.message);
      if (typeof onError === "function") onError(err);
    },
  );
}

export async function getTeamRoom(roomCode) {
  if (!roomCode) return null;
  // 不吞掉 network/Firestore error：null 只能代表「確認不存在」。
  // 呼叫端才能保留 IndexedDB resume，不把暫時斷網誤判成房間已刪除。
  const s = await getDoc(doc(db, C, roomCode));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/** 建立房間時順手清掉過期房間（best-effort，失敗無所謂）。 */
async function pruneExpiredRooms() {
  try {
    const q = query(collection(db, C), where("expiresAt", "<", Date.now()));
    const snap = await getDocs(q);
    const dels = snap.docs.map((d) => deleteDoc(d.ref).catch(() => {}));
    await Promise.all(dels);
  } catch { /* ignore */ }
}

/** 隊長在結果頁「結束」時直接刪房。 */
export async function deleteTeamRoom(roomCode) {
  if (!roomCode) return { ok: false };
  try {
    await deleteDoc(doc(db, C, roomCode));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: humanError(e) };
  }
}

export const TEAM_COLLECTION = C;

// Dev-only 測試鉤子：production build 中 `process.env.NODE_ENV !== "production"` 為 false，
// 整段會被 webpack 靜態消除，不會進正式 bundle。供自動化雙人流程測試（第二位玩家代理）。
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  window.__arcadeTeamDb = {
    createTeamRoom, joinTeamRoom, startTeamRoom, submitTeamRound, chooseTeamRoute,
    leaveTeamRoom, subscribeTeamRoom, getTeamRoom, deleteTeamRoom,
    heartbeatTeamRoom, cleanupStaleRoom, takeOverHost,
    setTeamMode, advanceTeamRound,
  };
}
