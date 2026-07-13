// src/pages/MemberApp.jsx
import { useState, useEffect, useRef, lazy, Suspense, startTransition, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { subscribeResults, subscribeNotifications, subscribeAppVersion, isMemberRegistered,
  subscribeCertification, getDexConfig, subscribeDexGrants,
  subscribeMonsterDex, subscribeCraftStats, subscribeChestStats, subscribePotionDex,
  subscribeCardCollection, submitGuildQuestCompletion,
  subscribeActiveGuildQuests, subscribeTodayPracticeLogs,
  subscribeMyCheckin, submitCheckin,
  subscribeMaintenanceConfig, subscribeTierPermissions } from "../lib/db";
import { getAllowedPages, isAutoLocked } from "../lib/accessControl";
import { MaintenanceScreen, FrozenScreen, LockedFeatureCard } from "../components/member/AccessLockScreens";
import { subscribeActiveWorldBoss } from "../lib/worldBossDb";
import { subscribeLatestBroadcast } from "../lib/dungeonDb";
import { getDuelStats } from "../lib/duelDb";
import { APP_VERSION } from "../lib/version";
import { getAppTheme, APP_THEMES, saveAppTheme } from "../lib/theme";
import { OverlayModal } from "../components/shared/UI";
import { ProgressRing, CountUp } from "../components/shared/Widgets";
import { sfxSwitch } from "../lib/sound";
import { certLevelStyle } from "../lib/constants";
import { levelFromXP, rankFromLevel } from "../lib/adventurerSystem";
import { archerLevelFromXP, archerXPProgress } from "../lib/archerLevel";
import MemberHome         from "../components/member/MemberHome";
import MustReadGate       from "../components/member/MustReadGate";
import HonorCelebration   from "../components/member/HonorCelebration";
import BadgeEarnPopup     from "../components/member/BadgeEarnPopup";

const MemberComps        = lazy(() => import("../components/member/MemberComps"));
const MemberScoring      = lazy(() => import("../components/member/MemberScoring"));
const MemberLearn        = lazy(() => import("../components/member/MemberLearn"));
const MemberMessages     = lazy(() => import("../components/member/MemberMessages"));
const MemberHistory      = lazy(() => import("../components/member/MemberHistory"));
const MemberPractice     = lazy(() => import("../components/member/MemberPractice"));
const MemberLeaderboard  = lazy(() => import("../components/member/MemberLeaderboard"));
const MemberProfile      = lazy(() => import("../components/member/MemberProfile"));
const MemberExternalComp = lazy(() => import("../components/member/MemberExternalComp"));
const MemberAchievements = lazy(() => import("../components/member/MemberAchievements"));
const MemberCertExam     = lazy(() => import("../components/member/MemberCertExam"));
const MemberNotifications= lazy(() => import("../components/member/MemberNotifications"));
const MemberDex          = lazy(() => import("../components/member/MemberDex"));
const MemberMaterials    = lazy(() => import("../components/member/MemberMaterials"));
const MemberMonsterDex   = lazy(() => import("../components/member/MemberMonsterDex"));
const MemberGuide        = lazy(() => import("../components/member/MemberGuide"));
const MemberBowSettings  = lazy(() => import("../components/member/MemberBowSettings"));
const MemberAdventureHub = lazy(() => import("../components/member/MemberAdventureHub"));
const MemberTrainingHub  = lazy(() => import("../components/member/MemberTrainingHub"));
const MemberInventoryHub = lazy(() => import("../components/member/MemberInventoryHub"));
const MemberRecordsHub   = lazy(() => import("../components/member/MemberRecordsHub"));
const MonsterBattle      = lazy(() => import("../components/member/MonsterBattle"));
const CardCollection     = lazy(() => import("../components/member/CardCollection"));
const EquipmentPage      = lazy(() => import("../components/member/EquipmentPage"));
const CoinShop           = lazy(() => import("../components/member/CoinShop"));
const AdventurerGuild    = lazy(() => import("../components/member/AdventurerGuild"));
const CatVillage         = lazy(() => import("../components/member/CatVillage"));
const CatCollection      = lazy(() => import("../components/cat/CatCollection"));
const CatStoryBook       = lazy(() => import("../components/cat/CatStoryBook"));
const StoryBook          = lazy(() => import("../components/story/StoryBook"));
const PartyLobby         = lazy(() => import("../components/party/PartyLobby"));
const PartyQuestRoom     = lazy(() => import("../components/party/PartyQuestRoom"));
const PartyBattleRoom    = lazy(() => import("../components/party/PartyBattleRoom"));
const DuelLobby          = lazy(() => import("../components/duel/DuelLobby"));
const DuelRoom           = lazy(() => import("../components/duel/DuelRoom"));
const DungeonLobby       = lazy(() => import("../components/dungeon/DungeonLobby"));
const DungeonController  = lazy(() => import("../components/dungeon/DungeonController"));
const WorldBossLobby     = lazy(() => import("../components/worldboss/WorldBossLobby"));
const WorldBossIntro     = lazy(() => import("../components/worldboss/WorldBossIntro"));
const MemberBooking      = lazy(() => import("../components/member/MemberBooking"));

const CAN_SCORE = ["upcoming","open","ongoing"];
const ADVENTURE_PAGES = ["adventure-hub","monster","party","party-quest","party-battle","duel","duel-room","dungeon","dungeon-room","worldboss","guild","monsterdex"];
const TRAINING_PAGES  = ["training-hub","comps","comp-detail","practice"];
const INVENTORY_PAGES = ["inventory-hub","coinshop","materials","cats","catbook","story","equipment","cards","gacha"];
const PROFILE_PAGES   = ["profile","learn","msgs","history","external","achievements","certexam","notifications","dex","guide","records-hub","leaderboard","bowsetting"];

// hover / touch 預載：使用者碰到導覽按鈕時就開始下載對應 chunk
const NAV_PRELOADS = {
  "adventure-hub": () => {
    import("../components/member/MemberAdventureHub");
    import("../components/member/MonsterBattle");
    import("../components/dungeon/DungeonLobby");
    import("../components/dungeon/DungeonController");
  },
  "training-hub": () => {
    import("../components/member/MemberTrainingHub");
    import("../components/member/MemberPractice");
    import("../components/member/MemberComps");
  },
  "gacha": () => {
    import("../components/member/CatVillage");
    import("../components/cat/CatCollection");
  },
  "inventory-hub": () => {
    import("../components/member/MemberInventoryHub");
    import("../components/member/MemberMaterials");
    import("../components/member/CardCollection");
    import("../components/member/CoinShop");
  },
  "profile": () => {
    import("../components/member/MemberProfile");
    import("../components/member/MemberAchievements");
    import("../components/member/MemberHistory");
  },
  "booking": () => {
    import("../components/member/MemberBooking");
  },
};

export default function MemberApp() {
  const { logout, profile, role } = useAuth();
  const [page, setPageState]   = useState(()=>sessionStorage.getItem("member_page")||"home");
  const setPage = useCallback((p) => startTransition(() => setPageState(p)), []);
  // 學生分級與系統鎖定（2026-07-04）
  const [maintenanceConfig, setMaintenanceConfig] = useState({ enabled:false, message:"" });
  const [tierPermissions,   setTierPermissions]   = useState(null);
  const retiredRedirectedRef = useRef(false);
  const [gachaInitTab, setGachaInitTab] = useState("village");
  const [selComp, setSelComp] = useState(null);
  const [scoring, setScoring] = useState(false);
  useEffect(()=>{ sessionStorage.setItem("member_page",page); },[page]);
  useEffect(()=>{ if(page==="comp-detail"&&!selComp) setPage("comps"); },[]); // eslint-disable-line
  const [battleImmersive, setBattleImmersive] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  // 組隊遠征不會使用舊版 dungeon_room；重新整理後必須另外從 Firestore
  // 找回仍屬於此玩家的遠征房，否則玩家只能手動再進地下城大廳才看得到續接。
  const [teamDungeonRecovery, setTeamDungeonRecovery] = useState(null);
  // 地下城（含組隊遠征）不顯示全站導覽，避免誤觸後離開進度中的房間。
  const dungeonImmersive = page === "dungeon" || page === "dungeon-room";
  const hideGlobalChrome = battleImmersive || dungeonImmersive;
  const [partyRoomId,   setPartyRoomId]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("party_room"))?.roomId || null; } catch { return null; }
  });
  const [partyRoomType, setPartyRoomType] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("party_room"))?.type || null; } catch { return null; }
  });
  const [partyIsHost,   setPartyIsHost]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("party_room"))?.isHost || false; } catch { return false; }
  });
  const [notifications, setNotifications] = useState([]);
  const [appTheme, setAppTheme] = useState(() => getAppTheme());
  const [bossIntroEvent, setBossIntroEvent] = useState(null);
  const [wbKillAlert,    setWbKillAlert]    = useState(null);
  const [activeWorldBoss, setActiveWorldBoss] = useState(null); // 供首頁「進行中」卡顯示世界王入口

  const shownWbKillRef  = useRef(null);
  const [dungeonKillAlert, setDungeonKillAlert] = useState(null);
  const lastBroadcastIdRef = useRef(null);
  const [latestVersion, setLatestVersion] = useState(null);

  const [certification, setCertification] = useState(null);
  const [dexConfig,     setDexConfig]     = useState({ physicalMax:10, pointMax:10 });
  const [dexGrants,     setDexGrants]     = useState([]);
  const [duelStats,     setDuelStats]     = useState(null);
  const [monsterDex,    setMonsterDex]    = useState({});
  const [craftStats,    setCraftStats]    = useState({});
  const [chestStats,    setChestStats]    = useState({});
  const [potionDex,     setPotionDex]     = useState({});
  const [cardData,      setCardData]      = useState({ cards:{}, equipped:[] });
  const [questCtx,     setQuestCtx]      = useState(null); // 公會任務導航上下文
  const [fromGuild,    setFromGuild]     = useState(false); // 是否從公會進入打怪
  const [specialAlert, setSpecialAlert]  = useState(null);  // 緊急任務浮動通知
  const [badgePopup,   setBadgePopup]   = useState(null);  // 徽章獲得彈窗
  const [todayArrowsGlobal, setTodayArrowsGlobal] = useState(0); // 今日全域練箭數（含所有來源）
  const [todayCheckin, setTodayCheckin] = useState(undefined);  // 今日報到狀態
  const [showCheckinPopup, setShowCheckinPopup] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const prevAchRef = useRef(null);
  const seenQuestIds = useRef(null); // null = 尚未完成首次載入
  const checkinPopupShownRef = useRef(!!sessionStorage.getItem("member_checkin_popup_shown")); // 一天只彈一次（跨重整）

  // 地下城首殺全系統播報（防重複：lastBroadcastIdRef 過濾 onSnapshot 重複觸發）
  useEffect(() => {
    const unsub = subscribeLatestBroadcast(data => {
      if (!data) return;
      // 失敗廣播（broadcastExpeditionFailure）跟首殺廣播寫同一個 dungeonBroadcasts collection，
      // 不能把「有人失敗」誤顯示成「首殺」——只放行真正的首殺（修 #2：單人敗北跳首殺）。
      // emoji==="💀" 兜底過濾沒有 kind 欄位的舊失敗廣播。
      if (data.kind === "failure" || data.emoji === "💀") return;
      const dismissedId = localStorage.getItem("dismissedBroadcastId");
      if (dismissedId === data.id) return;
      if (lastBroadcastIdRef.current === data.id) return;
      lastBroadcastIdRef.current = data.id;
      setDungeonKillAlert(data);
    });
    return () => unsub?.();
  }, []); // eslint-disable-line

  // 今日報到訂閱（供浮動視窗判斷）— 一天只彈一次
  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMyCheckin(profile.id, c => {
      setTodayCheckin(c);
      // 未報到且今天還沒彈過 → 彈出視窗
      if (c === null && !checkinPopupShownRef.current) {
        checkinPopupShownRef.current = true;
        sessionStorage.setItem("member_checkin_popup_shown", "1");
        setShowCheckinPopup(true);
      }
    });
    return () => unsub?.();
  }, [profile?.id]); // eslint-disable-line

  async function handleCheckinSubmit() {
    if (!profile?.id) return;
    setCheckinBusy(true);
    try {
      await submitCheckin(profile.id, profile.name, profile.nickname);
    } catch (e) { console.error("checkin:", e?.message); }
    setCheckinBusy(false);
    setShowCheckinPopup(false);
  }

  // 今日練箭數全域訂閱（只讀今日，減少 Firestore 資料量）
  useEffect(() => {
    if (!profile?.id) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    return subscribeTodayPracticeLogs(profile.id, todayStr, logs => {
      const count = logs.reduce((s, l) =>
        s + (l.totalArrows ?? (Array.isArray(l.rounds) ? l.rounds.flat().length : 0)), 0);
      setTodayArrowsGlobal(count);
    });
  }, [profile?.id]); // eslint-disable-line

  // 徽章獲得偵測：profile.achievement 有增加時彈出慶祝
  useEffect(() => {
    const ach = profile?.achievement;
    if (!ach) return;
    const prev = prevAchRef.current;
    if (prev) {
      if ((ach.black || 0) > (prev.black || 0))       setBadgePopup("black");
      else if ((ach.gold || 0) > (prev.gold || 0))    setBadgePopup("gold");
      else if ((ach.silver || 0) > (prev.silver || 0)) setBadgePopup("silver");
    }
    prevAchRef.current = { silver: ach.silver||0, gold: ach.gold||0, black: ach.black||0 };
  }, [profile?.achievement?.silver, profile?.achievement?.gold, profile?.achievement?.black]); // eslint-disable-line

  // 緊急任務訂閱：只在新任務出現時彈出通知
  useEffect(() => {
    if (!profile?.id) return;
    return subscribeActiveGuildQuests(quests => {
      if (seenQuestIds.current === null) {
        // 首次載入：記住目前所有任務 ID，不彈出通知
        seenQuestIds.current = new Set(quests.map(q => q.id));
        return;
      }
      // 找出本次有新出現的緊急任務
      const newSpecial = quests.find(q => q.type === "special" && !seenQuestIds.current.has(q.id));
      quests.forEach(q => seenQuestIds.current.add(q.id));
      if (newSpecial) setSpecialAlert(newSpecial);
    });
  }, [profile?.id]); // eslint-disable-line

  // 從公會接任務後導向對應功能
  // 若是同一個任務，保留目前的擊殺進度，不重置 killsSoFar
  function handleGuildNavigate(targetPage, ctx) {
    setFromGuild(true);
    setQuestCtx(prev => ({
      ...ctx,
      killsSoFar: (prev?.questId === ctx.questId) ? (prev.killsSoFar || 0) : 0,
    }));
    setPage(targetPage);
  }

  // MonsterBattle 回報擊殺
  function handleQuestKill(monsterId) {
    if (!questCtx || questCtx.monsterId !== monsterId) return;
    const newKills = (questCtx.killsSoFar || 0) + 1;
    const justCompleted = newKills >= questCtx.killsNeeded;
    // 先更新進度（純 state update，無 side effect）
    setQuestCtx(prev => {
      if (!prev || prev.monsterId !== monsterId) return prev;
      return { ...prev, killsSoFar: newKills, ...(justCompleted && { completed: true }) };
    });
    // 任務達成後才呼叫 Firestore（移出 updater，避免 React 反模式）
    if (justCompleted) {
      const _rankMult = rankFromLevel(levelFromXP(profile?.adventurerXP || 0)).mult;
      submitGuildQuestCompletion(
        profile.id, profile.nickname || profile.name,
        { id: questCtx.questId, title: questCtx.title, reward: questCtx.reward, badgeReward: questCtx.badgeReward || null },
        "打怪任務完成", _rankMult
      ).catch(e => console.error("[guild] kill quest submit failed:", e));
    }
  }

  function handleAppThemeChange(id) {
    saveAppTheme(id);
    setAppTheme(APP_THEMES.find(t => t.id === id) || APP_THEMES[0]);
  }

  useEffect(() => {
    if (!profile?.id) return;
    return subscribeNotifications(profile.id, setNotifications, profile.createdAt);
  }, [profile?.id]); // eslint-disable-line

  useEffect(() => {
    return subscribeAppVersion(setLatestVersion);
  }, []);

  // 系統維護鎖 + 分級權限矩陣（教練後台調整後即時生效）
  useEffect(() => {
    const u1 = subscribeMaintenanceConfig(setMaintenanceConfig);
    const u2 = subscribeTierPermissions(setTierPermissions);
    return () => { u1?.(); u2?.(); };
  }, []);

  // retired 狀態：預設登入頁改導向「我的」（home 本身對 retired 是鎖住的），只在首次載入套用一次
  // 注意：page 初始值來自 sessionStorage（可能殘留上次登入的任意頁面，不只 "home"），
  // 因此只要不是 "profile" 就一律導向，而非只檢查 "home"，避免殘留頁面卡在鎖卡而非落在「我的」
  useEffect(() => {
    if (!profile || retiredRedirectedRef.current) return;
    retiredRedirectedRef.current = true;
    if (profile.studentTier === "retired" && page !== "profile") setPage("profile");
  }, [profile?.studentTier]); // eslint-disable-line

  // 瀏覽器空閒時預載最常用的頁面 chunk（手機也適用）
  useEffect(() => {
    const idle = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (cb) => setTimeout(cb, 1000);
    const cancel = typeof cancelIdleCallback !== "undefined" ? cancelIdleCallback : clearTimeout;
    const h = idle(() => {
      import("../components/member/MemberPractice");
      import("../components/member/MemberAdventureHub");
      import("../components/member/MonsterBattle");
      import("../components/member/MemberProfile");
    }, { timeout: 4000 });
    return () => cancel(h);
  }, []);

  // 世界王登場 + 擊殺公告
  useEffect(() => {
    return subscribeActiveWorldBoss(ev => {
      setActiveWorldBoss(ev && ev.status === "active" ? ev : null);
      if (!ev) return;
      // 登場動畫
      const key = `wb_intro_${ev.id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        setBossIntroEvent(ev);
      }
      // 擊殺公告（每個 eventId 只播一次）
      if (ev.status === "defeated" && ev.id !== shownWbKillRef.current) {
        shownWbKillRef.current = ev.id;
        setWbKillAlert(ev);
        const t = setTimeout(() => setWbKillAlert(null), 8000);
        return () => clearTimeout(t);
      }
    });
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    getDexConfig().then(setDexConfig).catch(() => {});
    getDuelStats(profile.id).then(setDuelStats).catch(() => {});
    const u1 = subscribeCertification(profile.id, setCertification);
    const u2 = subscribeDexGrants(profile.id, setDexGrants);
    const u3 = subscribeMonsterDex(profile.id, setMonsterDex);
    const u4 = subscribeCraftStats(profile.id, setCraftStats);
    const u5 = subscribeChestStats(profile.id, setChestStats);
    const u6 = subscribePotionDex(profile.id, setPotionDex);
    const u7 = subscribeCardCollection(profile.id, setCardData);
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); u6?.(); u7?.(); };
  }, [profile?.id]); // eslint-disable-line

  function handleEnterPartyRoom(roomId, type, host) {
    setPartyRoomId(roomId);
    setPartyRoomType(type);
    setPartyIsHost(host);
    sessionStorage.setItem("party_room", JSON.stringify({ roomId, type, isHost: host }));
    setPage(type === "quest" ? "party-quest" : "party-battle");
  }
  function handleLeaveParty() {
    sessionStorage.removeItem("party_room");
    setPartyRoomId(null); setPartyRoomType(null); setPartyIsHost(false);
    setPage("profile");
  }

  const _savedDuel = (() => { try { return JSON.parse(sessionStorage.getItem("duel_room") || "null"); } catch { return null; } })();
  const [duelRoomId,  setDuelRoomId]  = useState(_savedDuel?.roomId || null);
  const [duelIsHost,  setDuelIsHost]  = useState(_savedDuel?.isHost || false);
  const [duelMyTeam,  setDuelMyTeam]  = useState(_savedDuel?.team   || "A");
  function handleEnterDuelRoom(roomId, team, host) {
    setDuelRoomId(roomId); setDuelMyTeam(team); setDuelIsHost(host);
    sessionStorage.setItem("duel_room", JSON.stringify({ roomId, team, isHost: host }));
    setPage("duel-room");
  }
  function handleLeaveDuel() {
    sessionStorage.removeItem("duel_room");
    setDuelRoomId(null); setDuelIsHost(false);
    setPage("duel");
  }

  const _savedDungeon = (() => { try { return JSON.parse(sessionStorage.getItem("dungeon_room") || "null"); } catch { return null; } })();
  // 服務端存檔備案：若 sessionStorage 沒有但 profile.activeDungeon 有，則使用它
  const _savedDungeonFallback = (!_savedDungeon?.roomId && profile?.activeDungeon?.roomId)
    ? { roomId: profile.activeDungeon.roomId }
    : null;
  const _initialDungeonRoomId = _savedDungeon?.roomId || _savedDungeonFallback?.roomId || null;
  const [dungeonRoomId, setDungeonRoomId] = useState(_initialDungeonRoomId);
  useEffect(() => {
    if (!profile?.id) return undefined;
    let cancelled = false;
    import("../lib/expeditionTeamDb").then(({ findReconnectableTeamExpedition }) =>
      findReconnectableTeamExpedition(profile.id)
    ).then(result => {
      if (!cancelled) setTeamDungeonRecovery(result?.ok ? result.room : null);
    }).catch(() => {
      if (!cancelled) setTeamDungeonRecovery(null);
    });
    return () => { cancelled = true; };
  }, [profile?.id]);
  // 載入時驗證 sessionStorage / activeDungeon 中的地下城房間是否仍有效
  // 若房間已結束或不存在，自動清除，避免玩家卡在無限載入
  useEffect(() => {
    const checkRoomId = _savedDungeon?.roomId || _savedDungeonFallback?.roomId;
    if (!checkRoomId) return;
    let cancelled = false;
    import("../lib/dungeonDb").then(({ checkDungeonRoomExists, setActiveDungeon }) => {
      checkDungeonRoomExists(checkRoomId).then(res => {
        if (cancelled) return;
        if (!res.exists) {
          sessionStorage.removeItem("dungeon_room");
          setDungeonRoomId(null);
        } else if (_savedDungeonFallback && !_savedDungeon?.roomId) {
          // 從 activeDungeon 恢復：同步寫回 sessionStorage
          sessionStorage.setItem("dungeon_room", JSON.stringify({ roomId: checkRoomId }));
          setDungeonRoomId(checkRoomId);
        }
      });
      // 若使用 activeDungeon 備案，確保服務端記錄仍存在
      if (_savedDungeonFallback) {
        setActiveDungeon(profile?.id, checkRoomId).catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line
  function handleEnterDungeonRoom(roomId) {
    setDungeonRoomId(roomId);
    sessionStorage.setItem("dungeon_room", JSON.stringify({ roomId }));
    setPage("dungeon-room");
  }
  function handleLeaveDungeon(options = {}) {
    if (options?.preserve === false) {
      sessionStorage.removeItem("dungeon_room");
      setDungeonRoomId(null);
      import("../lib/dungeonDb").then(({ clearActiveDungeon }) =>
        clearActiveDungeon(profile?.id).catch(() => {})
      );
    }
    setPage("adventure-hub");
  }

  // 線上約課分頁：正式開放給所有已登入學生，教練/管理員在射手模式也可使用。
  const canSeeBooking = !!profile?.id || role === "admin";
  const nav = [
    { id:"home",          icon:"🏠", label:"首頁" },
    { id:"adventure-hub", icon:"🗺️", label:"冒險" },
    { id:"training-hub",  icon:"🏹", label:"練箭" },
    { id:"gacha",         icon:"🏡", label:"貓村" },
    { id:"inventory-hub", icon:"🎒", label:"背包" },
    ...(canSeeBooking ? [{ id:"booking", icon:"📅", label:"約課" }] : []),
    { id:"profile",       icon:"👤", label:"我的" },
  ];

  function handleSelectComp(comp) { setSelComp(comp); setScoring(false); setPage("comp-detail"); }

  function isNavActive(navId, curPage) {
    if (navId === curPage) return true;
    if (navId === "adventure-hub" && ADVENTURE_PAGES.includes(curPage)) return true;
    if (navId === "training-hub"  && TRAINING_PAGES.includes(curPage))  return true;
    if (navId === "inventory-hub" && INVENTORY_PAGES.includes(curPage)) return true;
    if (navId === "profile"       && PROFILE_PAGES.includes(curPage))   return true;
    return false;
  }

  const needsUpdate = latestVersion && latestVersion !== APP_VERSION;

  // ── Header 顯示資料（全部來自既有 state / profile，無新增訂閱）──
  const archerLv  = archerLevelFromXP(profile?.archerXP || 0);
  const xpProg    = archerXPProgress(profile?.archerXP || 0);
  const certLevel = certification?.level && certification.level !== "none" ? certification.level : null;
  const unreadNotifCount = notifications.filter(x =>
    !(x.readBy    || []).includes(profile?.id) &&
    !(x.deletedBy || []).includes(profile?.id)
  ).length;
  const avatarChar = (profile?.nickname || profile?.name || "🏹").trim().charAt(0) || "🏹";
  const currencyChips = [
    { icon:"🪙", value:(profile?.coins || 0),                                 color:"var(--text-gold)", page:"coinshop", label:"金幣" },
    { icon:"💧", value:(profile?.village?.resources?.arrowdew || 0),          color:"var(--info-fg)",   page:"gacha",    label:"箭露" },
    { icon:"🎫", value:Math.floor(profile?.gachaCoins ?? 0),                  color:"#f9a8d4",          page:"gacha",    label:"轉蛋幣" },
  ];

  // 學生分級與系統鎖定：維護鎖 → 帳號凍結 → 分級鎖定（優先權由高到低）
  const maintenanceActive = !!maintenanceConfig?.enabled;
  const accountFrozen     = !!profile?.accountFrozen;
  const allowedPages      = getAllowedPages(profile, role, tierPermissions);
  const pageLocked        = allowedPages !== null && !allowedPages.includes(page);
  const lockReason = profile?.studentTier === "retired"
    ? "此帳號為退休狀態，僅能查看「我的」頁面，如需恢復請洽詢教練。"
    : isAutoLocked(profile)
      ? "帳號因超過 14 天未報到已暫時鎖定部分功能，前往首頁完成報到即可立即恢復。"
      : "此功能需正式學生身份，請洽詢教練開通。";

  if (maintenanceActive) {
    return <MaintenanceScreen message={maintenanceConfig?.message} onLogout={logout} />;
  }
  if (accountFrozen) {
    return <FrozenScreen onLogout={logout} />;
  }

  return (
    <div style={{ height:"100dvh", display:"flex", flexDirection:"column", fontFamily:"sans-serif", overflow:"hidden", background:"#0f172a" }}>

      {/* 版本更新提醒 */}
      {needsUpdate && (
        <OverlayModal open={true} zIndex={99999} bg="rgba(0,0,0,0.75)">
          <div style={{ background:"white", borderRadius:"24px", padding:"36px 28px", width:"100%", textAlign:"center", boxShadow:"0 25px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize:"56px", marginBottom:"12px" }}>🔄</div>
            <div style={{ fontWeight:"900", fontSize:"20px", color:"#1e293b", marginBottom:"8px" }}>系統已更新！</div>
            <div style={{ color:"#64748b", fontSize:"13px", marginBottom:"4px" }}>目前版本：<b>{APP_VERSION}</b></div>
            <div style={{ color:"#64748b", fontSize:"13px", marginBottom:"20px" }}>最新版本：<b style={{ color:"#2563eb" }}>{latestVersion}</b></div>
            <div style={{ background:"#eff6ff", borderRadius:"12px", padding:"12px 16px", color:"#1d4ed8", fontSize:"13px", marginBottom:"24px", lineHeight:"1.6" }}>
              請重新整理頁面，<br />才能使用最新功能與修正 🐱
            </div>
            <button onClick={() => window.location.reload()}
              style={{ width:"100%", padding:"16px", background:"linear-gradient(135deg,#2563eb,#7c3aed)", color:"white", fontWeight:"900", fontSize:"16px", borderRadius:"16px", border:"none", cursor:"pointer", letterSpacing:"0.02em" }}>
              🔄 立即重整頁面
            </button>
          </div>
        </OverlayModal>
      )}

      <MustReadGate memberId={profile?.id} notifications={notifications} />
      <HonorCelebration memberId={profile?.id} notifications={notifications} onGoPage={setPage} />
      {bossIntroEvent && <WorldBossIntro event={bossIntroEvent} onClose={() => setBossIntroEvent(null)} />}

      {/* 地下城首殺全系統公告 */}
      {dungeonKillAlert && (
        <div role="button" tabIndex={0} aria-live="polite"
          style={{ position:"fixed", top:0, left:0, right:0, zIndex:999, padding:"12px 16px", background:"linear-gradient(90deg,#78350f,#92400e,#78350f)", boxShadow:"0 4px 24px rgba(0,0,0,0.5)", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
          onClick={() => { localStorage.setItem("dismissedBroadcastId", dungeonKillAlert.id); setDungeonKillAlert(null); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); localStorage.setItem("dismissedBroadcastId", dungeonKillAlert.id); setDungeonKillAlert(null); } }}>
          <div style={{ fontSize:28, flexShrink:0 }}>👑</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:13, color:"#fbbf24", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              ⚡ 地下城首殺！{dungeonKillAlert.emoji} {dungeonKillAlert.dungeonName}（{dungeonKillAlert.difficultyLabel}）
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {dungeonKillAlert.teamNames?.join("、") || dungeonKillAlert.memberName} 成為首殺英雄！
            </div>
          </div>
          <div style={{ fontSize:16, color:"rgba(255,255,255,0.4)", flexShrink:0 }}>✕</div>
        </div>
      )}
      {/* 🌍 世界王擊殺全系統公告 */}
      {wbKillAlert && (
        <div role="button" tabIndex={0} aria-live="polite"
          style={{ position:"fixed", top: dungeonKillAlert ? 52 : 0, left:0, right:0, zIndex:998, padding:"10px 16px", background:"linear-gradient(90deg,#1c0a00,#7f1d1d,#1c0a00)", boxShadow:"0 4px 24px rgba(0,0,0,0.6)", display:"flex", alignItems:"center", gap:12, cursor:"pointer", borderBottom:"2px solid #ef4444" }}
          onClick={() => setWbKillAlert(null)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setWbKillAlert(null); } }}>
          <div style={{ fontSize:28, flexShrink:0 }}>🌍</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:900, fontSize:13, color:"#fca5a5", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              ⚔️ 世界王擊殺！{wbKillAlert.bossData?.name || "Boss"} 已倒下！
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {wbKillAlert.lastHitBy?.memberName || "英雄"} 給予最後一擊！全員功勛已發放 🎁
            </div>
          </div>
          <div style={{ fontSize:16, color:"rgba(255,255,255,0.4)", flexShrink:0 }}>✕</div>
        </div>
      )}

      {badgePopup && <BadgeEarnPopup badge={badgePopup} onClose={() => setBadgePopup(null)} />}

      {/* 📋 今日報到浮動視窗 */}
      <OverlayModal open={showCheckinPopup}>
        <div style={{ background:"linear-gradient(135deg,#0f172a,#1e293b)", borderRadius:24, padding:"28px 24px", width:"100%", maxWidth:320, border:"1px solid rgba(255,255,255,0.15)", boxShadow:"0 0 40px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>📋</div>
          <div style={{ color:"#f1f5f9", fontWeight:900, fontSize:18, textAlign:"center", marginBottom:8 }}>今日報到</div>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:13, textAlign:"center", lineHeight:1.6, marginBottom:24 }}>
            點選報到後，等待教練確認<br />即可開始累積箭數與箭露！
          </div>
          <button onClick={handleCheckinSubmit} disabled={checkinBusy}
            style={{ width:"100%", padding:"13px", borderRadius:12, background:"linear-gradient(135deg,#059669,#0d9488)", color:"white", fontWeight:900, fontSize:15, border:"none", cursor:"pointer", opacity: checkinBusy ? 0.6 : 1 }}>
            {checkinBusy ? "送出中…" : "✅ 我要報到"}
          </button>
          <button onClick={() => setShowCheckinPopup(false)}
            style={{ width:"100%", padding:"10px", borderRadius:12, background:"transparent", color:"rgba(255,255,255,0.35)", fontSize:13, border:"none", cursor:"pointer", marginTop:8 }}>
            今日不報到
          </button>
        </div>
      </OverlayModal>

      {/* ⚡ 緊急任務浮動通知 */}
      <OverlayModal open={!!specialAlert} onClose={() => setSpecialAlert(null)} zIndex={99998} bg="rgba(0,0,0,0.72)">
        <div aria-live="polite" style={{ background:"linear-gradient(135deg,#7f1d1d,#1e1b4b)", borderRadius:"24px", padding:"32px 24px", width:"100%", textAlign:"center", boxShadow:"0 0 60px rgba(251,191,36,0.3)", border:"2px solid rgba(251,191,36,0.5)" }}>
          <div style={{ fontSize:"52px", marginBottom:"8px", animation:"pulse 1s infinite" }}>⚡</div>
          <div style={{ color:"#fbbf24", fontWeight:"900", fontSize:"13px", letterSpacing:"0.08em", marginBottom:"8px" }}>緊急懸賞任務登場！</div>
          <div style={{ color:"white", fontWeight:"900", fontSize:"22px", lineHeight:"1.3", marginBottom:"12px" }}>{specialAlert?.title}</div>
          {specialAlert?.desc && (
            <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"13px", lineHeight:"1.6", marginBottom:"16px" }}>{specialAlert.desc}</div>
          )}
          {specialAlert?.reward && (
            <div style={{ background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.35)", borderRadius:"12px", padding:"10px 16px", marginBottom:"20px", color:"#fbbf24", fontSize:"13px", fontWeight:"700" }}>
              🎁 獎勵：{specialAlert.reward}
            </div>
          )}
          <div style={{ display:"flex", gap:"10px" }}>
            <button onClick={() => setSpecialAlert(null)}
              style={{ flex:1, padding:"14px", background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", fontWeight:"700", fontSize:"14px", borderRadius:"14px", border:"none", cursor:"pointer" }}>
              稍後再看
            </button>
            <button onClick={() => { setSpecialAlert(null); setPage("guild"); }}
              style={{ flex:2, padding:"14px", background:"linear-gradient(135deg,#dc2626,#7c3aed)", color:"white", fontWeight:"900", fontSize:"14px", borderRadius:"14px", border:"none", cursor:"pointer" }}>
              ⚔️ 立即前往公會
            </button>
          </div>
        </div>
      </OverlayModal>

      {/* Header（戰鬥沉浸模式隱藏） */}
      <div style={{ flexShrink:0, position:"sticky", top:0, zIndex:40, display: hideGlobalChrome ? 'none' : undefined }}>
        <div style={{ background:appTheme.headerBg, borderBottom:`1px solid ${appTheme.headerBorder}`, padding:"10px 14px 8px" }}>
          {/* 第一列：頭像等級環｜暱稱＋檢定 pill｜通知鈴鐺｜登出 */}
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <button onClick={() => setPage("profile")} aria-label="我的檔案"
              style={{ border:"none", background:"transparent", padding:0, cursor:"pointer", flexShrink:0, lineHeight:0 }}>
              <ProgressRing value={xpProg.current} max={xpProg.needed} size={44} stroke={3} color="var(--accent)">
                <div style={{ width:34, height:34, borderRadius:"50%", background:"rgba(255,255,255,0.10)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:"var(--text-primary)" }}>
                  {avatarChar}
                </div>
              </ProgressRing>
            </button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <span style={{ fontWeight:"900", color:"var(--text-primary)", fontSize:"14px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {profile?.nickname || profile?.name || "射手"}
                </span>
                {certLevel && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${certLevelStyle(certLevel, "solid")}`} style={{ flexShrink:0 }}>
                    {certLevel}
                  </span>
                )}
              </div>
              <div style={{ fontSize:"11px", color:"var(--text-secondary)", marginTop:"1px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                ⚔️ Lv.{archerLv}・🏹 今日 {todayArrowsGlobal} 箭
              </div>
            </div>
            <button onClick={() => setPage("notifications")} aria-label="通知"
              style={{ position:"relative", width:"40px", height:"40px", borderRadius:"12px", border:"1px solid var(--glass-border)", background:"rgba(255,255,255,0.06)", cursor:"pointer", fontSize:"17px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              🔔
              {unreadNotifCount > 0 && (
                <span style={{ position:"absolute", top:"-4px", right:"-4px", minWidth:"16px", height:"16px", padding:"0 3px", background:"#ef4444", borderRadius:"999px", fontSize:"9px", fontWeight:900, color:"white", display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid var(--bg-deep)", boxSizing:"content-box" }}>
                  {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                </span>
              )}
            </button>
            <button onClick={logout} style={{ fontSize:"11px", borderRadius:"8px", padding:"4px 10px", cursor:"pointer", flexShrink:0, ...appTheme.logoutStyle }}>登出</button>
          </div>
          {/* 第二列：貨幣 chips（點擊跳轉對應頁）*/}
          <div style={{ display:"flex", gap:"6px", marginTop:"8px" }}>
            {currencyChips.map(c => (
              <button key={c.label} onClick={() => setPage(c.page)} aria-label={c.label}
                style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"4px", padding:"5px 8px", borderRadius:"999px", border:"1px solid var(--glass-border)", background:"rgba(255,255,255,0.06)", cursor:"pointer", minWidth:0 }}>
                <span style={{ fontSize:"12px", flexShrink:0 }}>{c.icon}</span>
                <span style={{ fontSize:"12px", fontWeight:800, color:c.color, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  <CountUp value={c.value} />
                </span>
              </button>
            ))}
          </div>
        </div>
        {partyRoomId && !["party-quest","party-battle"].includes(page) && (
          <button onClick={() => setPage(partyRoomType === "quest" ? "party-quest" : "party-battle")}
            style={{ display:"block", width:"100%", background:appTheme.partyBg, color:"white", padding:"7px 16px", fontSize:"12px", fontWeight:"900", textAlign:"center", border:"none", cursor:"pointer", letterSpacing:"0.02em" }}>
            🎮 組隊進行中 — 點此回到房間
          </button>
        )}
        {duelRoomId && page !== "duel-room" && (
          <button onClick={() => setPage("duel-room")}
            style={{ display:"block", width:"100%", background:"linear-gradient(90deg,#1d4ed8,#7c3aed)", color:"white", padding:"7px 16px", fontSize:"12px", fontWeight:"900", textAlign:"center", border:"none", cursor:"pointer", letterSpacing:"0.02em" }}>
            ⚔️ 決鬥進行中 — 點此回到戰場
          </button>
        )}
        {dungeonRoomId && page !== "dungeon-room" && (
          <button onClick={() => setPage("dungeon-room")}
            style={{ display:"block", width:"100%", background:"linear-gradient(90deg,#7c3aed,#1e1b4b)", color:"white", padding:"7px 16px", fontSize:"12px", fontWeight:"900", textAlign:"center", border:"none", cursor:"pointer", letterSpacing:"0.02em" }}>
            🏰 地下城進行中 — 點此回到地下城
          </button>
        )}
        {teamDungeonRecovery && page !== "dungeon" && (
          <button
            onClick={() => setPage("dungeon")}
            style={{ display:"block", width:"100%", background:"linear-gradient(90deg,#0f766e,#155e75)", color:"white", padding:"7px 16px", fontSize:"12px", fontWeight:"900", textAlign:"center", border:"none", cursor:"pointer", letterSpacing:"0.02em" }}
          >
            🧭 組隊地下城進行中 — 點此重新連線
          </button>
        )}
      </div>

      {/* 頁面內容（content-area 套用深藍覆寫；貓貓村跳過） */}
      <div style={{ flex:1, minHeight:0, overflowY:"auto", overflowX:"hidden" }} className="content-area">
        {pageLocked ? (
          <LockedFeatureCard reason={lockReason} onBack={() => setPage("profile")} />
        ) : (
        <Suspense fallback={<div style={{ minHeight:"60vh", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.25)", fontSize:13 }}>載入中…</div>}>
        {page==="home"        && <MemberHome onPageChange={setPage} onJoinParty={handleEnterPartyRoom} notifications={notifications}
            certification={certification} dexConfig={dexConfig} dexGrants={dexGrants}
            duelStats={duelStats} monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
            potionDex={potionDex} cardData={cardData} todayArrows={todayArrowsGlobal}
            todayCheckin={todayCheckin} worldBoss={activeWorldBoss} />}
        {page==="comps"       && <MemberComps onSelectComp={handleSelectComp} onPageChange={setPage} />}
        {page==="comp-detail" && selComp && !scoring && (
          <CompDetail comp={selComp} profile={profile}
            onBack={()=>setPage("comps")}
            onStartScoring={(myRes)=>{ setLastResult(myRes||null); setScoring(true); }} />
        )}
        {page==="comp-detail" && selComp && scoring && (
          <MemberScoring comp={selComp} lastResult={lastResult}
            onBack={()=>setScoring(false)}
            onDone={()=>{ setScoring(false); setPage("comps"); }} />
        )}
        {page==="practice"    && <MemberPractice />}
        {page==="leaderboard" && <MemberLeaderboard />}
        {page==="profile"     && <MemberProfile onPageChange={setPage} appTheme={appTheme} onAppThemeChange={handleAppThemeChange}
            certification={certification} dexConfig={dexConfig} dexGrants={dexGrants}
            duelStats={duelStats} monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
            potionDex={potionDex} cardData={cardData} />}
        {page==="learn"       && <MemberLearn />}
        {page==="msgs"        && <MemberMessages />}
        {page==="history"     && <MemberHistory />}
        {page==="external"    && <MemberExternalComp />}
        {page==="achievements" && <MemberAchievements />}
        {page==="certexam"    && <MemberCertExam onBack={()=>setPage("profile")} />}
        {page==="notifications" && <MemberNotifications notifications={notifications} />}
        {page==="dex"         && <MemberDex onBack={()=>setPage("profile")} />}
        {/* ── 冒險 Hub ── */}
        {page==="adventure-hub" && <MemberAdventureHub onPageChange={setPage} />}
        {page==="training-hub"  && <MemberTrainingHub  onPageChange={setPage} onJoinParty={handleEnterPartyRoom} />}
        {page==="inventory-hub" && <MemberInventoryHub onPageChange={setPage} />}
        {page==="records-hub"   && <MemberRecordsHub   onPageChange={setPage} />}

        {page==="monster"     && <MonsterBattle
          onBack={() => {
            if (fromGuild) { setFromGuild(false); setPage("guild"); }
            else { setQuestCtx(null); setPage("adventure-hub"); }
          }}
          onImmersiveChange={setBattleImmersive}
          questContext={questCtx} onKillForQuest={handleQuestKill}
          monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
          potionDex={potionDex} duelStats={duelStats} />}
        {page==="duel"        && <DuelLobby profile={profile} onEnterRoom={handleEnterDuelRoom} onBack={()=>setPage("adventure-hub")} />}
        {page==="duel-room"   && duelRoomId && <DuelRoom roomId={duelRoomId} myTeam={duelMyTeam} isHost={duelIsHost} onLeave={handleLeaveDuel} profile={profile} />}
        {page==="materials"   && <MemberMaterials onBack={()=>setPage("inventory-hub")} onGoVillage={()=>{ setGachaInitTab("potioncraft"); setPage("gacha"); }} />}
        {page==="guide"       && <MemberGuide      onBack={()=>setPage("profile")} />}
        {page==="bowsetting"  && <MemberBowSettings onBack={()=>setPage("profile")} />}
        {page==="equipment"   && <EquipmentPage onPageChange={setPage} />}
        {page==="coinshop"    && <CoinShop />}
        {page==="cards"       && <CardCollection />}
        {page==="gacha"       && <div className="no-override"><CatVillage
          catCards={profile?.catCards}
          gachaCoins={profile?.gachaCoins ?? 0}
          initialTab={gachaInitTab}
          key={gachaInitTab} /></div>}
        {page==="monsterdex"  && <MemberMonsterDex onBack={()=>setPage("adventure-hub")} />}
        {page==="dungeon"     && <DungeonLobby onBack={()=>setPage("adventure-hub")} autoReconnectRoomId={teamDungeonRecovery?.id || null} />}
        {page==="dungeon-room" && dungeonRoomId && (
          <div style={{ position:"fixed", inset:0, zIndex:60 }}>
            <DungeonController roomId={dungeonRoomId} onExit={handleLeaveDungeon} />
          </div>
        )}
        {page==="worldboss"   && <div style={{ position:"fixed", inset:0, zIndex:60 }}><WorldBossLobby onBack={()=>setPage("adventure-hub")}/></div>}
        {page==="cats"        && <CatCollection onBack={()=>setPage("inventory-hub")} onOpenBook={()=>setPage("catbook")} onOpenForge={()=>{ setGachaInitTab("forge"); setPage("gacha"); }}/>}
        {page==="catbook"     && <CatStoryBook  onBack={()=>setPage("cats")}/>}
        {page==="story"       && <StoryBook     onBack={()=>setPage("inventory-hub")}/>}
        {page==="guild"       && <AdventurerGuild
          onBack={()=>{ setQuestCtx(null); setPage("adventure-hub"); }}
          onNavigate={handleGuildNavigate}
          questCtx={questCtx?.completed ? null : questCtx}
          onQuestCtxClear={()=>setQuestCtx(null)}
        />}
        {page==="party"       && <PartyLobby onEnterRoom={handleEnterPartyRoom} onBack={()=>setPage("adventure-hub")} />}
        {page==="party-quest" && partyRoomId && (
          <PartyQuestRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty} />
        )}
        {page==="party-battle" && partyRoomId && (
          <PartyBattleRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty} />
        )}
        {page==="booking"     && canSeeBooking && <MemberBooking />}
        </Suspense>
        )}
      </div>

      {/* 底部導覽（戰鬥沉浸模式隱藏） */}
      <div style={{ flexShrink:0, background:"var(--bg-deep)", borderTop:"1px solid var(--border-subtle)", display: hideGlobalChrome ? 'none' : 'flex', zIndex:40, paddingBottom:"env(safe-area-inset-bottom)", viewTransitionName:"member-nav" }}>
        {nav.map(n => {
          const active = isNavActive(n.id, page);
          return (
            <button key={n.id} onClick={() => { if (!active) sfxSwitch(); setPage(n.id); }}
              onPointerEnter={() => NAV_PRELOADS[n.id]?.()}
              style={{ flex:1, minHeight:"56px", display:"flex", flexDirection:"column", alignItems:"center", paddingTop:0, paddingBottom:"6px", gap:"2px", border:"none", background:"transparent", cursor:"pointer" }}>
              {/* 頂部 active 指示條 */}
              <div style={{ height:"3px", width: active ? "24px" : "0px", background:"var(--accent)", borderRadius:"0 0 3px 3px", marginBottom:"4px", transition:"width 0.2s ease" }} />
              <div style={{ position:"relative", display:"inline-block" }}>
                {/* key 換值讓 icon 在變 active 時重掛，重播 fx-bounce 彈跳 */}
                <span key={active ? "on" : "off"} className={active ? "fx-bounce" : ""}
                  style={{ fontSize: active ? "20px" : "18px", display:"inline-block", transition:"font-size 0.15s ease", filter: active ? "none" : "grayscale(35%)", opacity: active ? 1 : 0.85 }}>{n.icon}</span>
                {n.id === "profile" && (profile?.hasUnreadReply || profile?.hasNewLearnLog) && (
                  <span style={{ position:"absolute", top:"-2px", right:"-5px", width:"8px", height:"8px", background:"#ef4444", borderRadius:"50%", border:"2px solid var(--bg-deep)", display:"block" }} />
                )}
              </div>
              <span style={{ fontSize:"10px", fontWeight: active ? "800" : "500", color: active ? "var(--accent)" : "var(--text-muted)" }}>{n.label}</span>
            </button>
          );
        })}
      </div>

      {/* 戰鬥沉浸模式：顯示導覽列按鈕 */}
      {battleImmersive && !dungeonImmersive && (
        <button onClick={() => setBattleImmersive(false)}
          style={{
            position:"fixed", top:8, left:"50%", transform:"translateX(-50%)",
            zIndex:9999, background:"rgba(15,23,42,0.85)",
            border:"1px solid rgba(255,255,255,0.2)",
            borderRadius:20, padding:"6px 16px",
            color:"rgba(255,255,255,0.8)",
            fontSize:12, fontWeight:700, cursor:"pointer",
            backdropFilter:"blur(8px)",
            display:"flex", alignItems:"center", gap:6,
          }}
        >
          <span>▴</span>
          <span>顯示導覽列</span>
        </button>
      )}
    </div>
  );
}

function CompDetail({ comp, onBack, onStartScoring, profile }) {
  const isCert = comp?.type==="年度檢定";
  const [results,    setResults]    = useState([]);
  const [loadingR,   setLoadingR]   = useState(true);
  const [regChecked, setRegChecked] = useState(false); // 已從 registrations 確認報名

  useEffect(()=>{
    if(!comp?.id){ setLoadingR(false); return; }
    let unsub = ()=>{};
    try {
      unsub = subscribeResults(comp.id,(data)=>{ setResults(Array.isArray(data)?data:[]); setLoadingR(false); });
    } catch(e){ console.warn("subscribeResults failed:",e); setLoadingR(false); }
    return ()=>{ try{ unsub(); }catch{} };
  },[comp?.id]);

  // 確認是否已在 registrations 報名（不依賴 participants 欄位）
  useEffect(()=>{
    if(!comp?.id||!profile?.id) return;
    isMemberRegistered(comp.id, profile.id).then(yes=>{ if(yes) setRegChecked(true); }).catch(()=>{});
  },[comp?.id, profile?.id]); // eslint-disable-line

  const myId = profile?.id||null;
  const safeResults = Array.isArray(results)?results:[];
  const parts = Array.isArray(comp?.participants)?comp.participants:[];
  const joined = !!(myId && (parts.includes(myId) || regChecked));
  const myResult = safeResults.find(r=>r&&r.memberId===myId)||null;
  const myCertResults = isCert?safeResults.filter(r=>r&&r.memberId===myId):[];
  const rankList = (isCert?safeResults.filter(r=>r&&r.reviewStatus==="approved"):safeResults)
    .slice().sort((a,b)=>((b&&b.total)||0)-((a&&a.total)||0));
  const myRank = rankList.findIndex(r=>r&&r.memberId===myId);
  const BOW_GROUP_LABEL = { recurve_bare:"🏹 競技反曲弓", compound:"🦅 獵弓", traditional:"🌿 傳統" };
  const certApproved = isCert?safeResults.filter(r=>r&&r.reviewStatus==="approved"):[];
  const certByBow = {};
  certApproved.forEach(r=>{ const b=(r.certBowType==="recurve_full"?"recurve_bare":r.certBowType)||"other"; if(!certByBow[b]) certByBow[b]=[]; certByBow[b].push(r); });
  Object.keys(certByBow).forEach(b=>certByBow[b].sort((a,c)=>(c.total||0)-(a.total||0)));
  const canScoreStatus = CAN_SCORE.includes(comp?.status);
  let canEnter=false, lockMsg="";
  if(!joined){ canEnter=false; lockMsg="尚未報名，請先回比賽列表報名"; }
  else if(!canScoreStatus){ canEnter=false; lockMsg="此比賽目前無法計分"; }
  else{ canEnter=true; }
  const anyPending = isCert&&myCertResults.some(r=>r.reviewStatus==="pending");

  return (
    <div className="p-4 flex flex-col gap-4">
      <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="text-gray-800 font-black text-lg mb-2">{comp?.title||"比賽"}</div>
        <div className="grid grid-cols-2 gap-2">
          {[["📅 日期",(comp?.date||"")+(comp?.endDate?` ～ ${comp.endDate}`:"")],
            ["🎯 靶紙",comp?.targetName||"—"],
            comp?.arrowCount ? ["🏹 規格",`${comp.arrowCount}箭×${comp.roundCount}回`] : null,
            ["計分","環數"+(comp?.hasMiss?" +M":"")]].filter(Boolean).map(([k,v])=>(
            <div key={k} className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-400 text-xs">{k}</div>
              <div className="text-gray-700 font-bold text-sm">{v}</div>
            </div>
          ))}
        </div>
      </div>
      {comp?.announcement && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-blue-600 text-xs font-bold mb-1">📢 比賽公告</div>
          <div className="text-blue-800 text-sm">{comp.announcement}</div>
        </div>
      )}
      {comp?.target && <img src={comp.target} alt="靶紙" className="w-full rounded-2xl max-h-48 object-contain bg-gray-100" />}
      {isCert&&myCertResults.length>0 && (
        <div className="flex flex-col gap-2">
          {myCertResults.map(mr=>(
            <div key={mr.id} className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-blue-200 text-xs">{mr.bowLabel||(BOW_GROUP_LABEL[mr.certBowType]||"我的成績")}</div>
                <div className="font-black text-3xl">{mr.total}</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {mr.reviewStatus==="pending" && <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">⏳ 審核中</span>}
                  {mr.reviewStatus==="approved"&&mr.certLevel && (
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${mr.certLevel==="未達標"?"bg-white/20 text-white":certLevelStyle(mr.certLevel,"solid")}`}>
                      {mr.certLevel==="未達標"?"未達標":`${mr.certLevel} 級`}
                    </span>
                  )}
                  {mr.reviewStatus==="rejected" && <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">已退回</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!isCert&&myResult && (
        <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-blue-200 text-xs">我的成績</div>
            <div className="font-black text-3xl">{myResult.total}</div>
          </div>
          {(myResult.rank||(myRank>=0)) && (
            <div className="text-right">
              <div className="text-blue-200 text-xs">名次</div>
              <div className="font-black text-3xl">{myResult.rank||(myRank+1)}</div>
            </div>
          )}
        </div>
      )}
      {anyPending && <div className="text-center text-amber-600 text-xs py-2 bg-amber-50 rounded-xl">部分弓種審核中，審核通過前該弓種無法刷分；可改考其他弓種</div>}
      {canEnter ? (
        <button onClick={()=>onStartScoring(isCert?null:myResult)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl">
          🏹 {isCert?(myCertResults.length>0?"再考一種弓 / 刷分":"進入檢定"):(myResult?"重新挑戰":"開始記分")}
        </button>
      ) : (
        lockMsg&&<div className="text-center text-gray-400 text-sm py-2 bg-gray-50 rounded-xl">{lockMsg}</div>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="text-gray-500 text-xs font-bold mb-3">🏅 成績排行{isCert?"（已審核）":""}</div>
        {loadingR ? <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
        : isCert ? (
          Object.keys(certByBow).length===0
            ? <div className="text-gray-400 text-sm text-center py-4">尚無已審核成績</div>
            : <div className="flex flex-col gap-4">
                {["recurve_bare","compound","traditional"].filter(b=>certByBow[b]?.length).map(b=>(
                  <div key={b}>
                    <div className="text-gray-600 text-xs font-black mb-1.5">{BOW_GROUP_LABEL[b]||b}</div>
                    {certByBow[b].map((r,i)=>{
                      const isMe=r.memberId===myId;
                      return (
                        <div key={r.id||i} className={`flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 ${isMe?"bg-blue-50 -mx-4 px-4 rounded-xl":""}`}>
                          <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i]||i+1}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold ${isMe?"text-blue-700":"text-gray-800"}`}>{r.nickname||r.name||"匿名射手"}{isMe&&"（我）"}</div>
                            {r.certLevel&&r.certLevel!=="未達標" && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${certLevelStyle(r.certLevel,"soft")}`}>{r.certLevel}</span>}
                          </div>
                          <span className={`font-black text-xl ${isMe?"text-blue-600":"text-gray-800"}`}>{r.total}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
        ) : rankList.length===0
          ? <div className="text-gray-400 text-sm text-center py-4">尚無成績</div>
          : rankList.map((r,i)=>{
              const isMe=r.memberId===myId;
              return (
                <div key={r.id||r.memberId||i} className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 ${isMe?"bg-blue-50 -mx-4 px-4 rounded-xl":""}`}>
                  <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i]||i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold ${isMe?"text-blue-700":"text-gray-800"}`}>{r.nickname||r.name||"匿名射手"}{isMe&&"（我）"}</div>
                  </div>
                  <span className={`font-black text-xl ${isMe?"text-blue-600":"text-gray-800"}`}>{r.total}</span>
                </div>
              );
            })
        }
      </div>
      <RegList compId={comp?.id} myId={myId} />
    </div>
  );
}

function RegList({ compId, myId }) {
  const [regs, setRegs]     = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    if(!compId){ setLoading(false); return; }
    import("../lib/db").then(({ getRegistrations })=>{
      getRegistrations(compId).then(d=>{ setRegs(Array.isArray(d)?d:[]); setLoading(false); }).catch(()=>setLoading(false));
    });
  },[compId]);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="text-gray-500 text-xs font-bold mb-3">📋 報名名單{regs.length?`（${regs.length}）`:""}</div>
      {loading ? <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
      : regs.length===0 ? <div className="text-gray-400 text-sm text-center py-4">尚無人報名</div>
      : <div className="flex flex-wrap gap-2">
          {regs.map(r=>{
            const isMe=r.memberId===myId;
            const label=r.nickname||r.name||r.guestInfo?.name||"射手";
            return (
              <span key={r.id||r.memberId} className={`text-xs px-3 py-1.5 rounded-full font-bold ${isMe?"bg-blue-600 text-white":"bg-gray-100 text-gray-600"}`}>
                {label}{isMe&&"（我）"}
              </span>
            );
          })}
        </div>
      }
    </div>
  );
}
