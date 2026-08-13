import { useState, useEffect, useRef, useMemo, lazy, Suspense, startTransition, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { useCostControl } from "../hooks/useCostControl";
import { subscribeResults, getRegistrations, subscribePendingCertResults, subscribeAllMessages, subscribePendingCertTasks, subscribePendingCheckins, subscribeNotifications, subscribePendingMonthlyRequests, subscribeCertification, subscribeDexGrants, getDexConfig, subscribeMonsterDex, subscribeCraftStats, subscribeChestStats, subscribePotionDex, subscribeCardCollection, submitGuildQuestCompletion, subscribeActiveGuildQuests, subscribeGuildSubmissions, subscribeMyCheckin, submitCheckin, approveCheckin, submitClassEnd, addArrowdew, checkAndGrantArrowMilestones, subscribeAppVersion, isMemberRegistered, flushPendingShootingSessions, flushPendingArrowProgress, subscribeLocalTodayArrows, initializeTodayArrows } from "../lib/db";
import { getDuelStats } from "../lib/duelDb";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { sfxNotify, sfxCheckinAlert, sfxLevelUp } from "../lib/sound";
import { markDailyPromptShown, wasDailyPromptShown } from "../lib/dailyPrompt";
import { CatBuddyProvider } from "../components/cat/CatBuddyContext";
import { db } from "../lib/firebase";
import { certLevelStyle } from "../lib/constants";
import { getAppTheme, saveAppTheme, APP_THEMES } from "../lib/theme";
import { levelFromXP, rankFromLevel } from "../lib/adventurerSystem";
import { archerLevelFromXP } from "../lib/archerLevel";
import { readHuntBattleResume, clearHuntBattleResume } from "../lib/huntBattleResume";
import { getFreeHuntMonsterById } from "../lib/freeHuntCatalog";
import { APP_VERSION } from "../lib/version";
import { subscribeWorldBossStatus } from "../lib/worldBossDb";
import { initGoalTracker } from "../lib/villageGoalDb";
import { subscribeLatestBroadcast } from "../lib/dungeonDb";
import { OverlayModal } from "../components/shared/UI";
import MemberHome         from "../components/member/MemberHome";
import MustReadGate       from "../components/member/MustReadGate";
import HonorCelebration   from "../components/member/HonorCelebration";
import BadgeEarnPopup     from "../components/member/BadgeEarnPopup";
import AdminBookingAlert  from "../components/admin/AdminBookingAlert";

const AdminMembers       = lazy(() => import("../components/admin/AdminMembers"));
const AdminCompetitions  = lazy(() => import("../components/admin/AdminCompetitions"));
const AdminLearn         = lazy(() => import("../components/admin/AdminLearn"));
const AdminGiveTool      = lazy(() => import("../components/admin/AdminGiveTool"));
const AdminBattleEvent   = lazy(() => import("../components/admin/AdminBattleEvent"));
const AdminEquipItems    = lazy(() => import("../components/admin/AdminEquipItems"));
const AdminFinance       = lazy(() => import("../components/admin/AdminFinance"));
const AdminReviewCenter  = lazy(() => import("../components/admin/AdminReviewCenter"));
const AdminMessages      = lazy(() => import("../components/admin/AdminMessages"));
const AdminResetCenter   = lazy(() => import("../components/admin/AdminResetCenter"));
const AdminWorldBoss     = lazy(() => import("../components/admin/AdminWorldBoss"));
const AdminGuildQuests   = lazy(() => import("../components/admin/AdminGuildQuests"));
const AdminStoryManager  = lazy(() => import("../components/admin/AdminStoryManager"));
const AdminArchery       = lazy(() => import("../components/admin/AdminArchery"));
const AdminVillageManager= lazy(() => import("../components/admin/AdminVillageManager"));
const AdminVillageGoals  = lazy(() => import("../components/admin/AdminVillageGoals"));
const AdminDungeon       = lazy(() => import("../components/admin/AdminDungeon"));
const AdminBattleTest   = lazy(() => import("../components/admin/AdminBattleTest"));
const AdminKidMode       = lazy(() => import("../components/admin/AdminKidMode"));
const AdminGuestAccounts = lazy(() => import("../components/admin/AdminGuestAccounts"));
const AdminGuestReviews = lazy(() => import("../components/admin/AdminGuestReviews"));
const AdminMarketingEmail = lazy(() => import("../components/admin/AdminMarketingEmail"));
const AdminTierPermissions = lazy(() => import("../components/admin/AdminTierPermissions"));
const AdminWebsiteCms    = lazy(() => import("../components/admin/AdminWebsiteCms"));
const EquipmentPage      = lazy(() => import("../components/member/EquipmentPage"));
const EquipmentProgressionPage = lazy(() => import("../components/member/EquipmentProgressionPage"));
const CoinShop           = lazy(() => import("../components/member/CoinShop"));
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
const FreeHunt           = lazy(() => import("../components/member/FreeHunt"));
const MemberTrainingHub  = lazy(() => import("../components/member/MemberTrainingHub"));
const MemberInventoryHub = lazy(() => import("../components/member/MemberInventoryHub"));
const MemberRecordsHub   = lazy(() => import("../components/member/MemberRecordsHub"));
const MemberPerformance  = lazy(() => import("../components/member/MemberPerformance"));
const MonsterBattle      = lazy(() => import("../components/member/MonsterBattle"));
const MonsterHandbook    = lazy(() => import("../components/member/MonsterHandbook"));
const CardCollection     = lazy(() => import("../components/member/CardCollectionModern"));
const GuildExpedition    = lazy(() => import("../guild/GuildTestApp"));
const CatVillage         = lazy(() => import("../components/member/CatVillage"));
const CatCollection      = lazy(() => import("../components/cat/CatCollection"));
const CatStoryBook       = lazy(() => import("../components/cat/CatStoryBook"));
const StoryBook          = lazy(() => import("../components/story/StoryBook"));
const PartyQuestRoom     = lazy(() => import("../components/party/PartyQuestRoom"));
const PartyBattleRoom    = lazy(() => import("../components/party/PartyBattleRoom"));
const DuelLobby          = lazy(() => import("../components/duel/DuelLobby"));
const DuelRoom           = lazy(() => import("../components/duel/DuelRoom"));
const DungeonLobby       = lazy(() => import("../components/dungeon/DungeonLobby"));
const WorldBossLobby     = lazy(() => import("../components/worldboss/WorldBossLobby"));
const WorldBossIntro     = lazy(() => import("../components/worldboss/WorldBossIntro"));
const MemberBooking      = lazy(() => import("../components/member/MemberBooking"));
const AdminBooking       = lazy(() => import("../components/admin/AdminBooking"));

const CAN_SCORE = ["upcoming", "open", "ongoing"];

// 教練後台 nav 預載
const ADMIN_NAV_PRELOADS = {
  "daily": () => {
    import("../components/admin/AdminBooking");
    import("../components/admin/AdminFinance");
  },
  "members-finance": () => {
    import("../components/admin/AdminMembers");
    import("../components/admin/AdminGuestAccounts");
    import("../components/admin/AdminKidMode");
    import("../components/admin/AdminLearn");
    import("../components/admin/AdminMessages");
    import("../components/admin/AdminMarketingEmail");
  },
  "game-events": () => {
    import("../components/admin/AdminCompetitions");
    import("../components/admin/AdminGuildQuests");
    import("../components/admin/AdminWorldBoss");
    import("../components/admin/AdminBattleEvent");
    import("../components/admin/AdminEquipItems");
  },
  "system-tools": () => {
    import("../components/admin/AdminGiveTool");
    import("../components/admin/AdminTierPermissions");
    import("../components/admin/AdminArchery");
    import("../components/admin/AdminResetCenter");
    import("../components/admin/AdminWebsiteCms");
  },
};

// 射手模式（教練切換後）nav 預載
const ARCHER_NAV_PRELOADS = {
  "adventure-hub": () => {
    import("../components/member/MemberAdventureHub");
    import("../components/member/FreeHunt");
    import("../components/member/MonsterBattle");
    import("../components/dungeon/DungeonLobby");
  },
  "training-hub": () => {
    import("../components/member/MemberTrainingHub");
    import("../components/member/MemberPractice");
  },
  "gacha": () => {
    import("../components/member/CatVillage");
  },
  "inventory-hub": () => {
    import("../components/member/MemberInventoryHub");
    import("../components/member/MemberMaterials");
  },
  "profile": () => {
    import("../components/member/MemberProfile");
    import("../components/member/MemberHistory");
  },
  "booking": () => {
    import("../components/member/MemberBooking");
  },
};

export default function AdminApp() {
  const { logout, profile } = useAuth();
  const { policy: costPolicy } = useCostControl();
  useEffect(() => {
    const unsub = initGoalTracker();
    return () => unsub?.();
  }, []);
  const VALID_PAGES = new Set(["daily", "members-finance", "game-events", "system-tools"]);
  const [page, setPageState]        = useState(() => {
    const isArcher = sessionStorage.getItem("admin_archerMode") === "1";
    const s = sessionStorage.getItem("admin_page");
    if (isArcher && readHuntBattleResume()) return "hunt";
    if (isArcher) return (s && !VALID_PAGES.has(s)) ? s : "home";
    return (s && VALID_PAGES.has(s)) ? s : "daily";
  });
  const setPage = useCallback((p) => startTransition(() => setPageState(p)), []);
  const dungeonImmersive = page === "dungeon";
  const [guildImmersive, setGuildImmersive] = useState(false);
  const hideGlobalChrome = dungeonImmersive || guildImmersive;

  // 選單次級分頁狀態 (Option A)
  const [dailySub,  setDailySub]  = useState("booking"); // "booking" | "review" | "monthlycard"
  const [guestReviewPendingN, setGuestReviewPendingN] = useState(0);

  useEffect(() => {
    const counts={reviews:0,invites:0}, update=()=>setGuestReviewPendingN(counts.reviews+counts.invites);
    const unsubReviews=onSnapshot(query(collection(db,"guestReviews"),where("state","in",["pending","private_unread","complaint_open","complaint_send_failed"]),limit(100)),snap=>{counts.reviews=snap.size;update();},()=>{});
    const unsubInvites=onSnapshot(query(collection(db,"guestReviewSubjects"),where("state","in",["scheduled","invite_failed"]),limit(100)),snap=>{counts.invites=snap.size;update();},()=>{});
    return()=>{unsubReviews();unsubInvites();};
  }, []);
  const [mfSub,     setMfSub]     = useState("members"); // "members" | "guests" | "kidmode" | "learn" | "messages"
  const [eventsSub, setEventsSub] = useState("villagegoal"); // "villagegoal" | "comps" | "worldboss" | "items" | "village" | "story"
  const [sysSub,    setSysSub]    = useState("givetool");// "givetool" | "tierperms" | "archery" | "reset" | "website" | "testing"

  const [archerMode, setArcherMode] = useState(() => sessionStorage.getItem("admin_archerMode") === "1");
  const [questCtx, setQuestCtx]     = useState(null);
  const [fromGuild, setFromGuild]   = useState(false);
  const [huntContext, setHuntContext] = useState(null);
  const [huntResume, setHuntResume] = useState(() => readHuntBattleResume());
  const [autoResumeHuntBattle, setAutoResumeHuntBattle] = useState(false);
  useEffect(() => { if (page === "hunt") setHuntResume(readHuntBattleResume()); }, [page]);
  const [specialAlert, setSpecialAlert] = useState(null);
  const seenQuestIds = useRef(null);
  const [badgePopup, setBadgePopup] = useState(null);
  const prevAchRef   = useRef(null);
  const [appTheme, setAppTheme]     = useState(() => getAppTheme());
  function handleAppThemeChange(id) {
    saveAppTheme(id);
    setAppTheme(APP_THEMES.find(t => t.id === id) || APP_THEMES[0]);
  }
  const [gachaInitTab, setGachaInitTab] = useState("village");
  const [selComp, setSelComp]       = useState(null);
  const [scoring, setScoring]       = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [pendingCertList, setPendingCertList] = useState([]);
  const [allMessages,     setAllMessages]     = useState([]);
  const [pendingExtList,  setPendingExtList]  = useState([]);
  const [certTasksList,   setCertTasksList]   = useState([]);
  const [pendingCheckinList, setPendingCheckinList] = useState([]);
  const [pendingMonthlyList, setPendingMonthlyList] = useState([]);
  const pendingMonthlyRef = useRef(null); // null = 尚未收到首次快照（首次不播提醒音）
  const [pendingGuildList, setPendingGuildList] = useState([]);
  const [bossIntroEvent,   setBossIntroEvent]   = useState(null);
  const [activeWorldBoss,  setActiveWorldBoss]  = useState(null); // 供首頁「進行中」卡顯示世界王入口
  const [worldBossStatus,  setWorldBossStatus]  = useState(null); // 與射手模式大廳共用
  const [dungeonKillAlert, setDungeonKillAlert] = useState(null);
  const lastBroadcastIdRef = useRef(null);
  const [latestVersion, setLatestVersion] = useState(null);
  const [partyRoomId,   setPartyRoomId]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("admin_party_room"))?.roomId || null; } catch { return null; }
  });
  const [partyRoomType, setPartyRoomType] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("admin_party_room"))?.type || null; } catch { return null; }
  });
  const [partyIsHost,   setPartyIsHost]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("admin_party_room"))?.isHost || false; } catch { return false; }
  });
  const [notifications, setNotifications] = useState([]);
  const [todayArrowsGlobal, setTodayArrowsGlobal] = useState(0);
  const [todayCheckin, setTodayCheckin] = useState(undefined);
  const [showCheckinPopup, setShowCheckinPopup] = useState(false);
  const [checkinBusy, setCheckinBusy] = useState(false);
  const checkinPopupShownRef = useRef(false);
  const [coachLevelUp, setCoachLevelUp] = useState(null);
  const lastCoachLevelRef = useRef(null);
  const coachArcherLevel = archerLevelFromXP(profile?.archerXP || 0);

  useEffect(() => {
    if (profile?.archerXP === undefined) return;
    if (lastCoachLevelRef.current === null) { lastCoachLevelRef.current = coachArcherLevel; return; }
    if (coachArcherLevel > lastCoachLevelRef.current) {
      setCoachLevelUp({ oldLevel:lastCoachLevelRef.current, newLevel:coachArcherLevel });
      lastCoachLevelRef.current = coachArcherLevel;
      sfxLevelUp();
    } else if (coachArcherLevel < lastCoachLevelRef.current) lastCoachLevelRef.current = coachArcherLevel;
  }, [coachArcherLevel, profile?.archerXP]);

  // 射手模式共用狀態（與 MemberApp 一致）
  const [certification, setCertification] = useState(null);
  const [dexConfig,     setDexConfig]     = useState({ physicalMax:10, pointMax:10 });
  const [dexGrants,     setDexGrants]     = useState([]);
  const [duelStats,     setDuelStats]     = useState(null);
  const [monsterDex,    setMonsterDex]    = useState({});
  const [craftStats,    setCraftStats]    = useState({});
  const [chestStats,    setChestStats]    = useState({});
  const [potionDex,     setPotionDex]     = useState({});
  const [cardData,      setCardData]      = useState({ cards:{}, equipped:[] });
  const [cardDataReady, setCardDataReady] = useState(false);
  const sharedPlayerData = useMemo(() => ({
    certification, dexConfig, dexGrants, duelStats,
    monsterDex, craftStats, chestStats, potionDex,
    cardData:cardDataReady ? cardData : undefined,
    todayArrows: todayArrowsGlobal,
  }), [certification, dexConfig, dexGrants, duelStats, monsterDex, craftStats, chestStats, potionDex, cardData, cardDataReady, todayArrowsGlobal]);

  useEffect(() => {
    if (!profile?.id) return;
    checkinPopupShownRef.current = wasDailyPromptShown(localStorage, "coach-checkin", profile.id);
    return subscribeNotifications(profile.id, setNotifications, profile.createdAt);
  }, [profile?.id]); // eslint-disable-line

  // 今日報到訂閱（供浮動視窗判斷）— 一天只彈一次
  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeMyCheckin(profile.id, c => {
      setTodayCheckin(c);
      if (c === null && !checkinPopupShownRef.current) {
        checkinPopupShownRef.current = true;
        markDailyPromptShown(localStorage, "coach-checkin", profile.id);
        setShowCheckinPopup(true);
      }
    });
    return () => unsub?.();
  }, [profile?.id]); // eslint-disable-line

  async function handleCheckinSubmit() {
    if (!profile?.id) return;
    setCheckinBusy(true);
    try {
      const { id } = await submitCheckin(profile.id, profile.name, profile.nickname);
      // 教練在射手模式自主報到 → 自動審核通過（不需等另一位教練）
      await approveCheckin(id, profile.id).catch(() => {});
    } catch (e) { console.error("checkin:", e?.message); }
    setCheckinBusy(false);
    setShowCheckinPopup(false);
  }

  const [classEndBusy, setClassEndBusy] = useState(false);
  async function handleHomeClassEnd() {
    if (!profile?.id || !todayCheckin?.id || classEndBusy) return;
    if (!window.confirm("確定要下課嗎？下課後會結算今天的箭數與獎勵。")) return;
    setClassEndBusy(true);
    try {
      await submitClassEnd(profile.id, todayCheckin.id);
      if (todayArrowsGlobal > 0) {
        await Promise.allSettled([
          addArrowdew(profile.id, todayArrowsGlobal),
          checkAndGrantArrowMilestones(profile.id, todayArrowsGlobal),
        ]);
      }
    } catch (e) {
      console.error("class end:", e?.message);
      window.alert("下課結算失敗，請稍後再試。");
    } finally {
      setClassEndBusy(false);
    }
  }

  // 今日箭數以 localStorage 即時累加；載入時只做一次有上限的 Firestore 補值，不開 listener
  useEffect(() => {
    if (!profile?.id) { setTodayArrowsGlobal(0); return; }
    initializeTodayArrows(profile.id).catch(() => {});
    const unsubscribe = subscribeLocalTodayArrows(profile.id, setTodayArrowsGlobal);
    // 跨分頁監聽：同一瀏覽器開多個分頁時保持同步
    return unsubscribe;
  }, [profile?.id]);

  // 載入時 flush 累積在 localStorage 的射手表現資料（下課失敗或忘記按時補傳）
  useEffect(() => {
    if (!profile?.id) return;
    flushPendingShootingSessions(profile.id).catch(() => {});
    flushPendingArrowProgress(profile.id).catch(() => {});
  }, [profile?.id, costPolicy.level]);

  useEffect(() => {
    if (!profile?.id || !archerMode) {
      seenQuestIds.current = null;
      return;
    }
    return subscribeActiveGuildQuests(quests => {
      if (seenQuestIds.current === null) {
        seenQuestIds.current = new Set(quests.map(q => q.id));
        return;
      }
      const newSpecial = quests.find(q => q.type === "special" && !seenQuestIds.current.has(q.id));
      quests.forEach(q => seenQuestIds.current.add(q.id));
      if (newSpecial) setSpecialAlert(newSpecial);
    });
  }, [profile?.id, archerMode]); // eslint-disable-line

  useEffect(() => {
    if (!archerMode) return;
    const ach = profile?.achievement;
    if (!ach) return;
    const prev = prevAchRef.current;
    if (prev) {
      if ((ach.black  || 0) > (prev.black  || 0))        setBadgePopup("black");
      else if ((ach.gold   || 0) > (prev.gold   || 0))   setBadgePopup("gold");
      else if ((ach.silver || 0) > (prev.silver || 0))   setBadgePopup("silver");
    }
    prevAchRef.current = { silver: ach.silver||0, gold: ach.gold||0, black: ach.black||0 };
  }, [profile?.achievement?.silver, profile?.achievement?.gold, profile?.achievement?.black, archerMode]); // eslint-disable-line

  useEffect(() => {
    if (!profile?.id || !archerMode) return;
    setCardDataReady(false);
    getDexConfig().then(setDexConfig).catch(() => {});
    getDuelStats(profile.id).then(setDuelStats).catch(() => {});
    const u1 = subscribeCertification(profile.id, setCertification);
    const u2 = subscribeDexGrants(profile.id, setDexGrants);
    const u3 = subscribeMonsterDex(profile.id, setMonsterDex);
    const u4 = subscribeCraftStats(profile.id, setCraftStats);
    const u5 = subscribeChestStats(profile.id, setChestStats);
    const u6 = subscribePotionDex(profile.id, setPotionDex);
    const u7 = subscribeCardCollection(profile.id, data => {
      setCardData(data);
      setCardDataReady(true);
    });
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); u6?.(); u7?.(); };
  }, [profile?.id, archerMode]); // eslint-disable-line

  const pendingCertN = pendingCertList.length;
  const pendingMsgN  = allMessages.filter(m => !m.reply).length;
  const pendingExtN  = pendingExtList.length;
  const pendingExamN = certTasksList.length;
  const pendingMonthlyN = pendingMonthlyList.length;
  const pendingCheckinN = pendingCheckinList.length;
  const pendingCheckinAwaitN = pendingCheckinList.filter(c => c.status === "pending").length;
  const pendingGuildN = pendingGuildList.length;

  // eslint-disable-next-line no-unused-vars -- 舊公會下架後暫時沒有呼叫者，保留以備懸賞玩法回歸
  function handleGuildNavigate(targetPage, ctx) {
    setFromGuild(true);
    setQuestCtx(prev => ({
      ...ctx,
      killsSoFar: (prev?.questId === ctx.questId) ? (prev.killsSoFar || 0) : 0,
    }));
    setPage(targetPage);
  }
  function handleQuestKill(monsterId) {
    if (!questCtx || questCtx.monsterId !== monsterId) return;
    const newKills = (questCtx.killsSoFar || 0) + 1;
    const justCompleted = newKills >= questCtx.killsNeeded;
    setQuestCtx(prev => {
      if (!prev || prev.monsterId !== monsterId) return prev;
      return { ...prev, killsSoFar: newKills, ...(justCompleted && { completed: true }) };
    });
    if (justCompleted) {
      const _rankMult = rankFromLevel(levelFromXP(profile?.adventurerXP || 0)).mult;
      submitGuildQuestCompletion(
        profile.id, profile.nickname || profile.name,
        { id: questCtx.questId, title: questCtx.title, reward: questCtx.reward, badgeReward: questCtx.badgeReward || null },
        "打怪任務完成", _rankMult
      ).catch(e => console.error("[guild] kill quest submit failed:", e));
    }
  }

  function handleEnterPartyRoom(roomId, type, host) {
    setPartyRoomId(roomId); setPartyRoomType(type); setPartyIsHost(host);
    sessionStorage.setItem("admin_party_room", JSON.stringify({ roomId, type, isHost: host }));
    setPage(type === "quest" ? "party-quest" : "party-battle");
  }
  function handleLeaveParty() {
    sessionStorage.removeItem("admin_party_room");
    setPartyRoomId(null); setPartyRoomType(null); setPartyIsHost(false);
    setPage(huntContext ? "hunt" : "profile");
  }
  function openHuntMonster(monster, intent) {
    setAutoResumeHuntBattle(false);
    setQuestCtx(null);
    setFromGuild(false);
    setHuntContext({ monster, intent });
    setPage("monster");
  }

  function enterFreeHuntParty(roomId, type, host, monster = null) {
    setQuestCtx(null);
    setFromGuild(false);
    setHuntContext({ monster, intent: host ? "create" : "join" });
    handleEnterPartyRoom(roomId, type, host);
  }

  const _savedDuel = (() => { try { return JSON.parse(sessionStorage.getItem("admin_duel_room") || "null"); } catch { return null; } })();
  const [duelRoomId,  setDuelRoomId]  = useState(_savedDuel?.roomId || null);
  const [duelIsHost,  setDuelIsHost]  = useState(_savedDuel?.isHost || false);
  const [duelMyTeam,  setDuelMyTeam]  = useState(_savedDuel?.team   || "A");
  function handleEnterDuelRoom(roomId, team, host) {
    setDuelRoomId(roomId); setDuelMyTeam(team); setDuelIsHost(host);
    sessionStorage.setItem("admin_duel_room", JSON.stringify({ roomId, team, isHost: host }));
    setPage("duel-room");
  }
  function handleLeaveDuel() {
    sessionStorage.removeItem("admin_duel_room");
    setDuelRoomId(null); setDuelIsHost(false);
    setPage("duel");
  }


  // 記住當前頁面 + 射手模式（重整後留在原地）
  useEffect(() => { sessionStorage.setItem("admin_page", page); }, [page]);
  useEffect(() => { sessionStorage.setItem("admin_archerMode", archerMode ? "1" : "0"); }, [archerMode]);

  // 重整後若停在比賽詳情但沒有選中的比賽，退回比賽列表（避免空白）
  useEffect(() => {
    if ((page === "comp-detail") && !selComp) setPage("comps");
  }, []);

  useEffect(() => {
    const u1 = subscribePendingCertResults(list => setPendingCertList(Array.isArray(list) ? list : []));
    const u2 = subscribeAllMessages(msgs => setAllMessages(Array.isArray(msgs) ? msgs : []));
    const qExt = query(collection(db, "externalComps"), where("status", "==", "pending_review"));
    const u3 = onSnapshot(qExt, snap => setPendingExtList(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => setPendingExtList([]));
    const u4 = subscribePendingCertTasks(list => setCertTasksList(Array.isArray(list) ? list : []));
    const u5 = subscribePendingCheckins(list => {
      const arr = Array.isArray(list) ? list : [];
      setPendingCheckinList(arr);
    });
    const u6 = subscribePendingMonthlyRequests(list => {
      const normalized = Array.isArray(list) ? list : [];
      const n = normalized.length;
      // 首次快照（ref 為 null）只記錄不播音，避免開頁面就「亂播音效」
      if (pendingMonthlyRef.current !== null && n > pendingMonthlyRef.current) sfxNotify();
      pendingMonthlyRef.current = n;
      setPendingMonthlyList(normalized);
    });
    const u7 = subscribeGuildSubmissions(list => setPendingGuildList(Array.isArray(list) ? list : []));
    return () => { u1 && u1(); u2 && u2(); u3 && u3(); u4 && u4(); u5 && u5(); u6 && u6(); u7 && u7(); };
  }, []);

  // 待審核報到時，每 12 秒播音效提醒（工作電腦保持開啟用）——改用加大音量的專用提示音
  useEffect(() => {
    if (pendingCheckinAwaitN <= 0) return;
    sfxCheckinAlert();
    const t = setInterval(() => sfxCheckinAlert(), 12000);
    return () => clearInterval(t);
  }, [pendingCheckinAwaitN]);

  // 版本更新偵測
  useEffect(() => {
    return subscribeAppVersion(setLatestVersion);
  }, []);

  // 地下城首殺全系統播報（防重複：lastBroadcastIdRef 過濾 onSnapshot 重複觸發）
  useEffect(() => {
    const unsub = subscribeLatestBroadcast(data => {
      if (!data) return;
      // 失敗廣播跟首殺廣播共用 dungeonBroadcasts，過濾掉失敗，別把失敗誤顯示成首殺（修 #2）
      if (data.kind === "failure" || data.emoji === "💀") return;
      const dismissedId = localStorage.getItem("dismissedBroadcastId");
      if (dismissedId === data.id) return;
      if (lastBroadcastIdRef.current === data.id) return;
      lastBroadcastIdRef.current = data.id;
      setDungeonKillAlert(data);
    });
    return () => unsub?.();
  }, []); // eslint-disable-line

  // 世界王登場：教練也要看到
  useEffect(() => {
    return subscribeWorldBossStatus(ev => {   // 小狀態文件：不再因為別人打王而被推 HP 更新
      setWorldBossStatus(ev || null);
      setActiveWorldBoss(ev && ev.status === "active" ? ev : null);
      if (!ev) return;
      const key = `wb_intro_${ev.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      setBossIntroEvent(ev);
    });
  }, []);

const adminNav = [
  { id: "daily",           icon: "📅", label: "今日營運" },
  { id: "members-finance", icon: "👥", label: "學員財務" },
  { id: "game-events",     icon: "🎮", label: "遊戲活動" },
  { id: "system-tools",    icon: "⚙️", label: "系統設定" },
];

  const memberNav = [
    { id:"home",          icon:"🏠", label:"首頁"  },
    { id:"adventure-hub", icon:"🗺️", label:"冒險"  },
    { id:"training-hub",  icon:"🏹", label:"練箭"  },
    { id:"gacha",         icon:"🏡", label:"貓村"  },
    { id:"inventory-hub", icon:"🎒", label:"背包"  },
    // 線上約課（07-10-booking-system-student-pilot）：教練切射手模式時永遠看得到，方便測試（design.md §4.1）
    { id:"booking",       icon:"📅", label:"約課"  },
    { id:"profile",       icon:"👤", label:"我的"  },
  ];
  const ADMIN_ADVENTURE = ["adventure-hub","monster","party-quest","party-battle","duel","duel-room","dungeon","worldboss","guild","monsterdex"];
  const ADMIN_TRAINING  = ["training-hub","comps","comp-detail","practice","performance"];
  const ADMIN_INVENTORY = ["inventory-hub","coinshop","materials","cats","catbook","story","equipment","specialization-runes","cards","gacha"];
  const ADMIN_PROFILE   = ["profile","learn","msgs","history","external","achievements","certexam","notifications","dex","guide","leaderboard","bowsetting"];

  // ── 射手模式 ──────────────────────────────────────────────
  if (archerMode) {
    return (
      <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:"#0f172a",fontFamily:"sans-serif",overflow:"hidden"}}>
        <CatBuddyProvider>
        {/* 版本更新提醒 */}
        {latestVersion && latestVersion !== APP_VERSION && (
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
        {badgePopup && <BadgeEarnPopup badge={badgePopup} onClose={() => setBadgePopup(null)} />}

        {/* 教練帳號也會累積射手等級；使用獨立卡面，避免被誤認成學生通知。 */}
        <OverlayModal open={!!coachLevelUp} onClose={() => setCoachLevelUp(null)} zIndex={99998} bg="rgba(2,6,23,0.82)">
          <div style={{ background:"linear-gradient(145deg,#082f49,#0f172a 62%,#312e81)", borderRadius:24, padding:"30px 24px", width:"100%", maxWidth:330, textAlign:"center", border:"2px solid rgba(34,211,238,.55)", boxShadow:"0 0 60px rgba(34,211,238,.24)" }}>
            <div style={{ fontSize:52, marginBottom:8 }}>🏹</div>
            <div style={{ color:"#67e8f9", fontWeight:900, fontSize:13, letterSpacing:".12em", marginBottom:8 }}>教練射手模式</div>
            <div style={{ color:"white", fontWeight:900, fontSize:23, marginBottom:10 }}>射手等級提升！</div>
            <div style={{ color:"rgba(255,255,255,.7)", fontSize:14, marginBottom:20 }}>
              Lv.{coachLevelUp?.oldLevel} <span style={{ color:"#67e8f9", padding:"0 8px" }}>→</span> <b style={{ color:"#fef08a", fontSize:20 }}>Lv.{coachLevelUp?.newLevel}</b>
            </div>
            <div style={{ background:"rgba(255,255,255,.08)", borderRadius:12, padding:"11px 14px", color:"#cbd5e1", fontSize:13, lineHeight:1.6, marginBottom:20 }}>
              教練帳號的射手戰鬥能力已更新。
            </div>
            <button onClick={() => setCoachLevelUp(null)} style={{ width:"100%", padding:14, border:0, borderRadius:14, background:"linear-gradient(135deg,#06b6d4,#4f46e5)", color:"white", fontWeight:900, fontSize:15, cursor:"pointer" }}>確認</button>
          </div>
        </OverlayModal>

        {/* 📋 今日報到浮動視窗（教練射手模式） */}
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

        {/* ⚡ 緊急任務浮動通知（教練射手模式） */}
        <OverlayModal open={!!specialAlert} onClose={() => setSpecialAlert(null)} zIndex={99998} bg="rgba(0,0,0,0.72)">
          <div style={{ background:"linear-gradient(135deg,#7f1d1d,#1e1b4b)", borderRadius:"24px", padding:"32px 24px", width:"100%", textAlign:"center", boxShadow:"0 0 60px rgba(251,191,36,0.3)", border:"2px solid rgba(251,191,36,0.5)" }}>
            <div style={{ fontSize:"52px", marginBottom:"8px" }}>⚡</div>
            <div style={{ color:"#fbbf24", fontWeight:"900", fontSize:"13px", letterSpacing:"0.08em", marginBottom:"8px" }}>緊急懸賞任務登場！</div>
            <div style={{ color:"white", fontWeight:"900", fontSize:"22px", lineHeight:"1.3", marginBottom:"12px" }}>{specialAlert?.title}</div>
            {specialAlert?.desc && <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"13px", lineHeight:"1.6", marginBottom:"16px" }}>{specialAlert.desc}</div>}
            {specialAlert?.reward && <div style={{ background:"rgba(251,191,36,0.12)", border:"1px solid rgba(251,191,36,0.35)", borderRadius:"12px", padding:"10px 16px", marginBottom:"20px", color:"#fbbf24", fontSize:"13px", fontWeight:"700" }}>🎁 獎勵：{specialAlert.reward}</div>}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setSpecialAlert(null)} style={{ flex:1, padding:"14px", background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.6)", fontWeight:"700", fontSize:"14px", borderRadius:"14px", border:"none", cursor:"pointer" }}>稍後再看</button>
              <button onClick={() => { setSpecialAlert(null); setPage("guild"); }} style={{ flex:2, padding:"14px", background:"linear-gradient(135deg,#dc2626,#7c3aed)", color:"white", fontWeight:"900", fontSize:"14px", borderRadius:"14px", border:"none", cursor:"pointer" }}>⚔️ 立即前往公會</button>
            </div>
          </div>
        </OverlayModal>

        <div style={{ flexShrink:0, position:"sticky", top:0, zIndex:40, display: hideGlobalChrome ? "none" : undefined }}>
          <div style={{ background:appTheme.headerBg, borderBottom:`1px solid ${appTheme.headerBorder}`, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontWeight:"900", color:appTheme.titleColor, fontSize:"14px", letterSpacing:"0.02em" }}>🏹 射手模式</div>
              <div style={{ fontSize:"11px", color:appTheme.subtitleColor, marginTop:"1px" }}>貓小隊射箭場</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap", justifyContent:"flex-end" }}>
              <span style={{ fontSize:"11px", color:"#fbbf24" }}>🪙{(profile?.coins||0).toLocaleString()}</span>
              <span style={{ fontSize:"11px", color:"#60a5fa" }}>💧{(profile?.village?.resources?.arrowdew||0).toLocaleString()}</span>
              <span style={{ fontSize:"11px", color:"#86efac" }}>🏹{todayArrowsGlobal}</span>
              <span style={{ fontSize:"11px", color:"#f472b6" }}>⚔️Lv.{archerLevelFromXP(profile?.archerXP||0)}</span>
              <span style={{ fontSize:"12px", color:appTheme.usernameColor }}>👤 {profile?.nickname||profile?.name}</span>
              <button onClick={()=>{setArcherMode(false);setPage("daily");setDailySub("booking");}}
                style={{ fontSize:"11px", borderRadius:"8px", padding:"4px 10px", cursor:"pointer", background:"rgba(255,255,255,0.2)", color:"white", border:"none", fontWeight:"bold" }}>
                ⚙️ 返回後台
              </button>
            </div>
          </div>
        </div>
        {partyRoomId && !["party-quest","party-battle"].includes(page) && (
          <button onClick={() => setPage(partyRoomType === "quest" ? "party-quest" : "party-battle")}
            style={{display:"block",width:"100%",background:appTheme.partyBg,color:"white",padding:"7px 16px",fontSize:"12px",fontWeight:"900",textAlign:"center",border:"none",cursor:"pointer",letterSpacing:"0.02em"}}>
            🎮 組隊進行中 — 點此回到房間
          </button>
        )}
        {duelRoomId && page !== "duel-room" && (
          <button onClick={() => setPage("duel-room")}
            style={{ display:"block", width:"100%", background:"linear-gradient(90deg,#1d4ed8,#7c3aed)", color:"white", padding:"7px 16px", fontSize:"12px", fontWeight:"900", textAlign:"center", border:"none", cursor:"pointer", letterSpacing:"0.02em" }}>
            ⚔️ 決鬥進行中 — 點此回到戰場
          </button>
        )}
        {/* 頁面內容（深藍覆寫） */}
      <div style={{ flex:1, minHeight:0, overflowY:"auto", overflowX:"hidden" }} className="content-area">
        <Suspense fallback={<div style={{ minHeight:"60vh", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.25)", fontSize:13 }}>載入中…</div>}>
          {page==="home"          && <MemberHome onPageChange={setPage} onJoinParty={handleEnterPartyRoom} notifications={notifications}
              certification={certification} dexConfig={dexConfig} dexGrants={dexGrants}
              duelStats={duelStats} monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
              potionDex={potionDex} cardData={cardData} todayArrows={todayArrowsGlobal}
              todayCheckin={todayCheckin} worldBoss={activeWorldBoss} accountView="coach"
              onCheckin={handleCheckinSubmit} checkinBusy={checkinBusy}
              onClassEnd={handleHomeClassEnd} classEndBusy={classEndBusy}
              onReturnAdmin={() => { setArcherMode(false); setPage("daily"); setDailySub("booking"); }} />}
          {page==="adventure-hub" && <MemberAdventureHub onPageChange={(nextPage) => {
            if (nextPage !== "hunt") setHuntContext(null);
            setPage(nextPage);
          }} />}
          {page==="hunt" && <FreeHunt
            onBack={() => { setHuntContext(null); setPage("adventure-hub"); }}
            onSolo={(monster) => openHuntMonster(monster, "solo")}
            resumableBattle={huntResume}
            onResumeBattle={() => { const monster=getFreeHuntMonsterById(huntResume?.monsterId); if(monster){ setAutoResumeHuntBattle(true); setHuntContext({monster,intent:"solo"}); setPage("monster"); } }}
            onAbandonBattle={() => { if(window.confirm("確定放棄這場狩獵戰鬥？進度將無法復原。")){ clearHuntBattleResume(sessionStorage,{clearBattle:true}); setHuntResume(null); } }}
            onEnterPartyRoom={enterFreeHuntParty} />}
          {page==="training-hub"  && <MemberTrainingHub  onPageChange={setPage} onJoinParty={handleEnterPartyRoom} showPerformance={archerMode} />}
          {archerMode && page==="performance" && <MemberPerformance />}
          {page==="inventory-hub" && <MemberInventoryHub onPageChange={setPage} />}
          {page==="records-hub"   && <MemberRecordsHub   onPageChange={setPage} />}
          {page==="comps"         && <MemberComps onPageChange={setPage} onSelectComp={c=>{setSelComp(c);setScoring(false);setPage("comp-detail");}}/>}
          {page==="comp-detail" && selComp && !scoring && (
            <CompDetail comp={selComp} profile={profile}
              onBack={()=>setPage("comps")}
              onStartScoring={(myRes)=>{ setLastResult(myRes||null); setScoring(true); }}/>
          )}
          {page==="comp-detail" && selComp && scoring && (
            <MemberScoring comp={selComp} lastResult={lastResult}
              onBack={()=>setScoring(false)}
              onDone={()=>{setScoring(false);setPage("comps");}}/>
          )}
          {page==="practice"    && <MemberPractice/>}
          {page==="leaderboard" && <MemberLeaderboard/>}
          {page==="profile"     && <MemberProfile onPageChange={setPage} appTheme={appTheme} onAppThemeChange={handleAppThemeChange}
              certification={certification} dexConfig={dexConfig} dexGrants={dexGrants}
              duelStats={duelStats} monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
              potionDex={potionDex} cardData={cardData} />}
          {page==="learn"       && <MemberLearn/>}
          {page==="msgs"        && <MemberMessages/>}
          {page==="history"     && <MemberHistory/>}
          {page==="external"    && <MemberExternalComp/>}
          {page==="achievements"&& <MemberAchievements/>}
          {page==="certexam"    && <MemberCertExam onBack={()=>setPage("profile")} certification={certification}/>}
          {page==="notifications" && <MemberNotifications notifications={notifications}/>}
          {page==="dex"         && <MemberDex onBack={()=>setPage("profile")}
            sharedData={sharedPlayerData} />}
          {page==="materials"   && <MemberMaterials onBack={()=>setPage("inventory-hub")} onGoVillage={()=>{ setGachaInitTab("potioncraft"); setPage("gacha"); }}/>}
          {page==="guide"       && <MemberGuide      onBack={()=>setPage("profile")}/>}
          {page==="bowsetting"  && <MemberBowSettings onBack={()=>setPage("profile")}/>}
          {page==="monsterdex"  && <MemberMonsterDex onBack={()=>setPage("adventure-hub")} monsterDex={monsterDex}/>}
          {page==="cards"       && <CardCollection cardCollection={sharedPlayerData.cardData} />}
          {page==="handbook"    && <MonsterHandbook onBack={() => setPage("adventure-hub")} />}
          {page==="monster"     && <MonsterBattle
            onBack={() => {
              setAutoResumeHuntBattle(false);
              if (fromGuild) { setFromGuild(false); setPage("guild"); }
              else if (huntContext?.intent === "solo") { setQuestCtx(null); setPage("hunt"); }
              else { setQuestCtx(null); setHuntContext(null); setPage("adventure-hub"); }
            }}
            questContext={questCtx} onKillForQuest={handleQuestKill}
            huntMonsterId={huntContext?.intent === "solo" ? huntContext.monster?.id : null}
            autoResumeBattle={autoResumeHuntBattle}
            monsterDex={monsterDex} craftStats={craftStats} chestStats={chestStats}
            potionDex={potionDex} duelStats={duelStats} sharedData={sharedPlayerData} />}
          {page==="party-quest" && partyRoomId && (
            <PartyQuestRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty}/>
          )}
          {page==="party-battle" && partyRoomId && (
            <PartyBattleRoom roomId={partyRoomId} isHost={partyIsHost} onLeave={handleLeaveParty}/>
          )}
          {page==="duel"        && <DuelLobby profile={profile} onEnterRoom={handleEnterDuelRoom} onBack={()=>setPage("adventure-hub")}/>}
          {page==="duel-room"   && duelRoomId && <DuelRoom roomId={duelRoomId} myTeam={duelMyTeam} isHost={duelIsHost} onLeave={handleLeaveDuel} profile={profile}/>}
          {page==="dungeon"     && <DungeonLobby onBack={()=>setPage("adventure-hub")} sharedData={sharedPlayerData} />}
          {page==="equipment"   && <EquipmentPage onPageChange={setPage}/>}
          {page==="specialization-runes" && <EquipmentProgressionPage onBack={()=>setPage("inventory-hub")}/>}
          {page==="coinshop"    && <CoinShop/>}
          {page==="gacha"       && <CatVillage catCards={profile?.catCards} gachaCoins={profile?.gachaCoins ?? 0} initialTab={gachaInitTab} />}
          {page==="worldboss"   && <div style={{ position:"fixed", inset:0, zIndex:60 }}><WorldBossLobby onBack={()=>setPage("adventure-hub")} sharedData={sharedPlayerData} worldBossStatus={worldBossStatus}/></div>}
          {page==="cats"        && <CatCollection onBack={()=>setPage("inventory-hub")} onOpenBook={()=>setPage("catbook")} onOpenForge={()=>{ setGachaInitTab("forge"); setPage("gacha"); }}/>}
          {page==="catbook"     && <CatStoryBook  onBack={()=>setPage("cats")}/>}
          {page==="story"       && <StoryBook     onBack={()=>setPage("inventory-hub")}/>}
          {/* 冒險者公會：2026-07-25 起全面換成新的公會遠征介面（射手模式與教練端一致）。
              舊 AdventurerGuild（懸賞任務清單）已下架；擊殺自動提交仍靠下方 handleQuestKill。*/}
          {page==="guild"       && <GuildExpedition onBack={()=>setPage("adventure-hub")} onImmersiveChange={setGuildImmersive} />}
          {page==="booking"     && <MemberBooking />}
        </Suspense>
        </div>
        {/* 底部導覽（深藍主題） */}
      <div style={{ flexShrink:0, background:"#0f172a", borderTop:"1px solid rgba(255,255,255,0.08)", display:hideGlobalChrome ? "none" : "flex", zIndex:40, paddingBottom:"env(safe-area-inset-bottom)", viewTransitionName:"admin-nav" }}>
        {memberNav.map(n => {
          const active = (page===n.id||ADMIN_ADVENTURE.includes(page)&&n.id==="adventure-hub"||ADMIN_TRAINING.includes(page)&&n.id==="training-hub"||ADMIN_INVENTORY.includes(page)&&n.id==="inventory-hub"||ADMIN_PROFILE.includes(page)&&n.id==="profile");
          return (
            <button key={n.id} onClick={() => setPage(n.id)}
              onPointerEnter={() => ARCHER_NAV_PRELOADS[n.id]?.()}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", paddingTop:"6px", paddingBottom:"8px", gap:"2px", border:"none", background:"transparent", cursor:"pointer", color: active ? "#60a5fa" : "#64748b" }}>
              <div style={{ height:"2px", width: active ? "20px" : "0px", background:"#f59e0b", borderRadius:"0 0 2px 2px", marginBottom:"3px", transition:"width 0.2s ease" }} />
              <div style={{ position:"relative", display:"inline-block" }}>
                <span style={{ fontSize:"18px" }}>{n.icon}</span>
                {n.id==="profile" && (profile?.hasUnreadReply || profile?.hasNewLearnLog) && (
                  <span style={{ position:"absolute", top:"-2px", right:"-5px", width:"8px", height:"8px", background:"#ef4444", borderRadius:"50%", border:"2px solid #0f172a", display:"block" }} />
                )}
              </div>
              <span style={{ fontSize:"10px", fontWeight: active ? "700" : "500", color: active ? "#60a5fa" : "#64748b" }}>{n.label}</span>
            </button>
          );
        })}
      </div>
      {/* 🐱 全局貓貓伴侶（教練限定）— 教練模式暫時關閉，日後復原把下一行取消註解即可 */}
      {/* <CatBuddy /> */}
      </CatBuddyProvider>
      </div>
    );
  }

  // ── 後台模式（深藍主題）──────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:"#0f172a",fontFamily:"sans-serif"}} className="flex flex-col text-slate-100">
      <CatBuddyProvider>
      {bossIntroEvent && <WorldBossIntro event={bossIntroEvent} onClose={() => setBossIntroEvent(null)} />}

      {/* 👑 全系統橫幅公告：地下城首殺 / 村目標達成（依 kind 切樣式） */}
      {dungeonKillAlert && (
        <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:999, padding:"12px 16px", background: dungeonKillAlert.kind === "villageGoal" ? "linear-gradient(90deg,#14532d,#166534,#14532d)" : "linear-gradient(90deg,#78350f,#92400e,#78350f)", boxShadow:"0 4px 24px rgba(0,0,0,0.5)", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
          onClick={() => { localStorage.setItem("dismissedBroadcastId", dungeonKillAlert.id); setDungeonKillAlert(null); }}>
          <div style={{ fontSize:28, flexShrink:0 }}>{dungeonKillAlert.kind === "villageGoal" ? (dungeonKillAlert.emoji || "🏡") : "👑"}</div>
          <div style={{ flex:1, minWidth:0 }}>
            {dungeonKillAlert.kind === "villageGoal" ? (
              <>
                <div style={{ fontWeight:900, fontSize:13, color:"#86efac", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  🎉 村目標達成！{dungeonKillAlert.goalName}
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  全村合作完成任務，快去領取獎勵 🎁
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight:900, fontSize:13, color:"#fbbf24", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  ⚡ 地下城首殺！{dungeonKillAlert.emoji} {dungeonKillAlert.dungeonName}（{dungeonKillAlert.difficultyLabel}）
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {dungeonKillAlert.teamNames?.join("、") || dungeonKillAlert.memberName} 成為首殺英雄！
                </div>
              </>
            )}
          </div>
          <div style={{ fontSize:16, color:"rgba(255,255,255,0.4)", flexShrink:0 }}>✕</div>
        </div>
      )}

      {/* 🎯 頂部教練管理列 */}
      <div style={{background:"linear-gradient(135deg,#0f172a 0%,#0c4a6e 100%)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:40}}>
        <div>
          <div style={{fontWeight:"900",color:"#f1f5f9",fontSize:"15px",letterSpacing:"0.02em"}}>🎯 教練營運後台</div>
          <div style={{fontSize:"11px",color:"#7dd3fc",marginTop:"1px"}}>貓小隊射箭場 · 系統</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <button onClick={()=>{setArcherMode(true);setPage("home");}}
            style={{fontSize:"12px",background:"rgba(255,255,255,0.1)",color:"#cbd5e1",border:"1px solid rgba(255,255,255,0.18)",borderRadius:"8px",padding:"5px 12px",cursor:"pointer",fontWeight:"bold"}}>
            🏹 切換射手模式
          </button>
          <button onClick={logout}
            style={{fontSize:"12px",color:"#94a3b8",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"5px 10px",background:"rgba(255,255,255,0.05)",cursor:"pointer"}}>
            登出
          </button>
        </div>
      </div>

      {/* 🔔 待審核條列橫幅 */}
      {(pendingCertN + pendingMsgN + pendingExtN + pendingExamN + pendingCheckinN + pendingGuildN) > 0 && (
        <button onClick={() => { setPage("daily"); setDailySub("review"); }}
          style={{width:"100%",background:"rgba(251,191,36,0.08)",borderBottom:"1px solid rgba(251,191,36,0.2)",padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",border:"none",textAlign:"left"}}>
          <span style={{fontSize:"15px"}}>🔔</span>
          <span style={{fontSize:"12px",color:"#fbbf24",fontWeight:"bold"}}>
            {[
              pendingCertN > 0 ? `${pendingCertN} 筆檢定待審核` : null,
              pendingExamN > 0 ? `${pendingExamN} 筆畢業考待審` : null,
              pendingCheckinN > 0 ? `${pendingCheckinN} 筆每日任務待處理` : null,
              pendingExtN > 0 ? `${pendingExtN} 筆外賽待審` : null,
              pendingMsgN > 0 ? `${pendingMsgN} 則新留言` : null,
              pendingGuildN > 0 ? `${pendingGuildN} 筆公會任務` : null,
            ].filter(Boolean).join(" · ")}
          </span>
          <span style={{marginLeft:"auto",fontSize:"11px",color:"#f59e0b",fontWeight:"bold"}}>前往審核 →</span>
        </button>
      )}
      {pendingMonthlyN > 0 && (
        <button onClick={() => { setPage("daily"); setDailySub("monthlycard"); }}
          style={{width:"100%",background:"rgba(96,165,250,0.08)",borderBottom:"1px solid rgba(96,165,250,0.2)",padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",border:"none",textAlign:"left"}}>
          <span style={{fontSize:"15px"}}>🎫</span>
          <span style={{fontSize:"12px",color:"#60a5fa",fontWeight:"bold"}}>
            {pendingMonthlyN} 筆月卡使用待審核
          </span>
          <span style={{marginLeft:"auto",fontSize:"11px",color:"#60a5fa",fontWeight:"bold"}}>前往審核 →</span>
        </button>
      )}

      <AdminBookingAlert onGoBooking={() => { setPage("daily"); setDailySub("booking"); }} />

      {/* 📌 次級分頁快捷 Tab 列 (一鍵直達功能，不需層層進入與點返回) */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 p-2 flex gap-1.5 overflow-x-auto sticky top-[45px] z-30 shadow-md">
        {page === "daily" && (
          <>
            <button onClick={() => setDailySub("booking")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${dailySub === "booking" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              📅 線上約課
            </button>
            <button onClick={() => setDailySub("review")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${dailySub === "review" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🔔 審核中心
              {(pendingCertN + pendingMsgN + pendingExtN + pendingExamN + pendingCheckinN + pendingGuildN) > 0 && (
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] rounded-full px-1.5 py-0.2">
                  {pendingCertN + pendingMsgN + pendingExtN + pendingExamN + pendingCheckinN + pendingGuildN}
                </span>
              )}
            </button>
            <button onClick={() => setDailySub("monthlycard")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${dailySub === "monthlycard" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🎫 財務與記帳
              {pendingMonthlyN > 0 && (
                <span className="bg-blue-400 text-slate-950 font-black text-[10px] rounded-full px-1.5 py-0.2">{pendingMonthlyN}</span>
              )}
            </button>
            <button onClick={() => setDailySub("guestreviews")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${dailySub === "guestreviews" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950" : "bg-slate-800/80 text-slate-400 border border-slate-700/50"}`}>
              ⭐ 訪客評價 {guestReviewPendingN > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-white">{guestReviewPendingN}</span>}
            </button>
          </>
        )}

        {page === "members-finance" && (
          <>
            <button onClick={() => setMfSub("members")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${mfSub === "members" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              👥 會員管理
            </button>
            <button onClick={() => setMfSub("guests")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${mfSub === "guests" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🎫 訪客帳號
            </button>
            <button onClick={() => setMfSub("kidmode")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${mfSub === "kidmode" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🎈 兒童模式
            </button>
            <button onClick={() => setMfSub("learn")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${mfSub === "learn" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              📓 學習紀錄
            </button>
            <button onClick={() => setMfSub("messages")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${mfSub === "messages" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              💬 學生留言
              {pendingMsgN > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5">{pendingMsgN}</span>}
            </button>
            <button onClick={() => setMfSub("marketing-email")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${mfSub === "marketing-email" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              📧 Email 通知
            </button>
          </>
        )}

        {page === "game-events" && (
          <>
            <button onClick={() => setEventsSub("villagegoal")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${eventsSub === "villagegoal" ? "bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🎯 村目標
            </button>
            <button onClick={() => setEventsSub("comps")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${eventsSub === "comps" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🏆 賽事管理
            </button>
            <button onClick={() => setEventsSub("worldboss")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${eventsSub === "worldboss" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              👑 世界王
            </button>
            <button onClick={() => setEventsSub("items")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${eventsSub === "items" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🗡️ 裝備庫
            </button>
            <button onClick={() => setEventsSub("village")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${eventsSub === "village" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🏡 貓村管理
            </button>
            <button onClick={() => setEventsSub("story")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${eventsSub === "story" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              📖 故事章節
            </button>
          </>
        )}

        {page === "system-tools" && (
          <>
            <button onClick={() => setSysSub("givetool")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${sysSub === "givetool" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🎁 獎品發放
            </button>
            <button onClick={() => setSysSub("tierperms")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${sysSub === "tierperms" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🎓 權限矩陣
            </button>
            <button onClick={() => setSysSub("archery")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${sysSub === "archery" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              📷 射箭辨識
            </button>
            <button onClick={() => setSysSub("reset")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${sysSub === "reset" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🔄 重置中心
            </button>
            <button onClick={() => setSysSub("website")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${sysSub === "website" ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🌐 官網內容
            </button>
            <button onClick={() => setSysSub("testing")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${sysSub === "testing" ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md" : "bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50"}`}>
              🧪 測試工具
            </button>
          </>
        )}
      </div>

      {/* 📄 頁面內容區域 */}
      <div style={{paddingBottom:"80px"}} className="content-area">
        <Suspense fallback={<div style={{ minHeight:"60vh", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.25)", fontSize:13 }}>載入中…</div>}>

        {/* 1. 今日營運 */}
        {page === "daily" && dailySub === "booking"     && <AdminBooking />}
        {page === "daily" && dailySub === "review"      && <AdminUnifiedReview pendingCert={pendingCertList} messages={allMessages} pendingExtItems={pendingExtList} certTasks={certTasksList} pendingCheckins={pendingCheckinList} guildSubmissions={pendingGuildList} />}
        {page === "daily" && dailySub === "monthlycard" && <AdminFinance adminProfile={profile} pendingRequests={pendingMonthlyList} />}
        {page === "daily" && dailySub === "guestreviews" && <AdminGuestReviews />}

        {/* 2. 學員與財務 */}
        {page === "members-finance" && mfSub === "members"   && <AdminMembers />}
        {page === "members-finance" && mfSub === "guests"    && <AdminGuestAccounts />}
        {page === "members-finance" && mfSub === "kidmode"   && <AdminKidMode />}
        {page === "members-finance" && mfSub === "learn"     && <AdminLearn />}
        {page === "members-finance" && mfSub === "messages"  && <AdminMessages messages={allMessages} />}
        {page === "members-finance" && mfSub === "marketing-email" && <AdminMarketingEmail />}

        {/* 3. 遊戲與活動 */}
        {page === "game-events" && eventsSub === "villagegoal"   && <AdminVillageGoals />}
        {page === "game-events" && eventsSub === "comps"         && <AdminCompetitions />}
        {page === "game-events" && eventsSub === "worldboss"     && <AdminWorldBoss />}
        {page === "game-events" && eventsSub === "items"         && <AdminEquipItems />}
        {page === "game-events" && eventsSub === "village"       && <AdminVillageManager />}
        {page === "game-events" && eventsSub === "story"         && <AdminStoryManager />}

        {/* 4. 系統與設定 */}
        {page === "system-tools" && sysSub === "givetool"   && <AdminGiveTool />}
        {page === "system-tools" && sysSub === "tierperms"  && <AdminTierPermissions />}
        {page === "system-tools" && sysSub === "archery"    && <AdminArchery />}
        {page === "system-tools" && sysSub === "reset"      && <AdminResetCenter />}
        {page === "system-tools" && sysSub === "website"    && <AdminWebsiteCms />}
        {page === "system-tools" && sysSub === "testing"    && (
          <div className="p-4 flex flex-col gap-4">
            <div className="text-white font-bold text-base">🧪 系統測試工具</div>
            <AdminDungeon />
            <div className="border-t border-slate-800 pt-4">
              <AdminBattleTest />
            </div>
          </div>
        )}
        </Suspense>
      </div>

      {/* 📱 底部主選單 (4 大分頁，固定於最下方) */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0f172a",borderTop:"1px solid rgba(255,255,255,0.08)",zIndex:40,viewTransitionName:"admin-nav"}}>
        <div style={{display:"flex"}}>
          {adminNav.map(n=>{
            const active = page===n.id;
            const badge = n.id === "daily"
              ? (pendingCertN + pendingMsgN + pendingCheckinN + pendingExtN + pendingExamN + pendingGuildN + pendingMonthlyN)
              : n.id === "members-finance"
                ? pendingMsgN
                : 0;
            return (
              <button key={n.id}
                onClick={() => { setPage(n.id); }}
                onPointerEnter={() => ADMIN_NAV_PRELOADS[n.id]?.()}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 4px",gap:"2px",border:"none",background:"transparent",cursor:"pointer",color:active?"#60a5fa":"#64748b",position:"relative"}}>
                <div style={{ height:"2px", width: active ? "24px" : "0px", background:"#3b82f6", borderRadius:"0 0 2px 2px", marginBottom:"2px", transition:"width 0.2s ease" }} />
                <span style={{fontSize:"19px"}}>{n.icon}</span>
                {badge > 0 && <span style={{position:"absolute",top:"4px",right:"calc(50% - 14px)",background:"#ef4444",color:"white",fontSize:"9px",fontWeight:"900",borderRadius:"99px",padding:"1px 4px",minWidth:"14px",textAlign:"center"}}>{badge}</span>}
                <span style={{fontSize:"11px",fontWeight:active?"700":"500",whiteSpace:"nowrap",color:active?"#60a5fa":"#64748b"}}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      </CatBuddyProvider>
    </div>
  );
}


// ── 統一審核中心 ──────────────────────────────────────────
function AdminUnifiedReview({ pendingCert, messages, pendingExtItems, certTasks, pendingCheckins, guildSubmissions }) {
  const [tab, setTab] = useState("general");
  const TABS = [
    { id: "general", label: "🔔 一般審核" },
    { id: "guild",   label: "🏅 公會任務" },
  ];
  return (
    <div>
      <div style={{display:"flex",gap:"8px",padding:"12px 16px 0",background:"#1e293b",borderBottom:"1px solid rgba(255,255,255,0.08)",position:"sticky",top:"41px",zIndex:20}}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{flex:1,padding:"8px",borderRadius:"10px",border:`1px solid ${tab===t.id?"#3b82f6":"rgba(255,255,255,0.12)"}`,background:tab===t.id?"#1d4ed8":"rgba(255,255,255,0.06)",color:tab===t.id?"white":"#94a3b8",fontWeight:"900",fontSize:"13px",cursor:"pointer",marginBottom:"8px"}}>
            {t.label}
          </button>
        ))}
      </div>
      {tab==="general" && (
        <AdminReviewCenter
          pendingCert={pendingCert} messages={messages}
          pendingExtItems={pendingExtItems} certTasks={certTasks}
          pendingCheckins={pendingCheckins}
        />
      )}
      {tab==="guild" && <AdminGuildQuests defaultTab="review" submissions={guildSubmissions}/>}
    </div>
  );
}


// ── 射手模式比賽詳情（與 MemberApp 同步的新版：排行 + 報名名單 + 防彈）──
function CompDetail({ comp, onBack, onStartScoring, profile }) {
  const isCert = comp?.type === "年度檢定";
  const [results, setResults] = useState([]);
  const [loadingR, setLoadingR] = useState(true);

  useEffect(() => {
    if (!comp?.id) { setLoadingR(false); return; }
    let unsub = () => {};
    try {
      unsub = subscribeResults(comp.id, (data) => {
        setResults(Array.isArray(data) ? data : []);
        setLoadingR(false);
      });
    } catch (e) {
      console.warn("subscribeResults failed:", e);
      setLoadingR(false);
    }
    return () => { try { unsub(); } catch {} };
  }, [comp?.id]);

  const [regChecked, setRegChecked] = useState(false);

  useEffect(() => {
    if (!comp?.id || !profile?.id) return;
    isMemberRegistered(comp.id, profile.id).then(yes => { if (yes) setRegChecked(true); }).catch(() => {});
  }, [comp?.id, profile?.id]); // eslint-disable-line

  const myId = profile?.id || null;
  const safeResults = Array.isArray(results) ? results : [];
  const parts = Array.isArray(comp?.participants) ? comp.participants : [];
  const joined = !!(myId && (parts.includes(myId) || regChecked));
  const myResult = safeResults.find(r => r && r.memberId === myId) || null;
  // 檢定：我在這場的所有弓種成績
  const myCertResults = isCert ? safeResults.filter(r => r && r.memberId === myId) : [];

  const rankList = (isCert
    ? safeResults.filter(r => r && r.reviewStatus === "approved")
    : safeResults
  ).slice().sort((a, b) => ((b && b.total) || 0) - ((a && a.total) || 0));
  const myRank = rankList.findIndex(r => r && r.memberId === myId);

  // 檢定排行：按弓種分組（只列已審核通過）
  const BOW_GROUP_LABEL = { recurve_bare: "🏹 競技反曲弓", compound: "🦅 獵弓", traditional: "🌿 傳統" };
  const certApproved = isCert ? safeResults.filter(r => r && r.reviewStatus === "approved") : [];
  const certByBow = {};
  certApproved.forEach(r => {
    const b = (r.certBowType === "recurve_full" ? "recurve_bare" : r.certBowType) || "other";
    if (!certByBow[b]) certByBow[b] = [];
    certByBow[b].push(r);
  });
  Object.keys(certByBow).forEach(b => certByBow[b].sort((a, c) => (c.total || 0) - (a.total || 0)));

  const canScoreStatus = CAN_SCORE.includes(comp?.status);
  let canEnter = false, lockMsg = "";
  if (!joined) { canEnter = false; lockMsg = "尚未報名，請先回比賽列表報名"; }
  else if (!canScoreStatus) { canEnter = false; lockMsg = "此比賽目前無法計分"; }
  else { canEnter = true; }
  const anyPending = isCert && myCertResults.some(r => r.reviewStatus === "pending");

  return (
    <div className="p-4 flex flex-col gap-4">
      <button onClick={onBack} className="text-gray-500 text-sm">← 返回</button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="text-gray-800 font-black text-lg mb-2">{comp?.title || "比賽"}</div>
        <div className="grid grid-cols-2 gap-2">
          {[["📅 日期", (comp?.date || "") + (comp?.endDate ? ` ～ ${comp.endDate}` : "")],
            ["🎯 靶紙", comp?.targetName || "—"],
            ["🏹 規格", comp?.arrowCount ? `${comp.arrowCount}箭×${comp.roundCount}回` : "—"],
            ["計分", "環數" + (comp?.hasMiss ? " +M" : "")]].map(([k, v]) => (
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

      {/* 檢定：列出所有弓種 */}
      {isCert && myCertResults.length > 0 && (
        <div className="flex flex-col gap-2">
          {myCertResults.map(mr => (
            <div key={mr.id} className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-blue-200 text-xs">{mr.bowLabel || (BOW_GROUP_LABEL[mr.certBowType] || "我的成績")}</div>
                <div className="font-black text-3xl">{mr.total}</div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {mr.reviewStatus === "pending" && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">⏳ 審核中</span>
                  )}
                  {mr.reviewStatus === "approved" && mr.certLevel && (
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${mr.certLevel === "未達標" ? "bg-white/20 text-white" : certLevelStyle(mr.certLevel, "solid")}`}>
                      {mr.certLevel === "未達標" ? "未達標" : `${mr.certLevel} 級`}
                    </span>
                  )}
                  {mr.reviewStatus === "rejected" && (
                    <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">已退回</span>
                  )}
                  {mr.isRental && <span className="text-blue-200 text-xs">租借器材</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!isCert && myResult && (
        <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-blue-200 text-xs">我的成績</div>
            <div className="font-black text-3xl">{myResult.total}</div>
          </div>
          {(myResult.rank || myRank >= 0) && (
            <div className="text-right">
              <div className="text-blue-200 text-xs">名次</div>
              <div className="font-black text-3xl">{myResult.rank || (myRank + 1)}</div>
            </div>
          )}
        </div>
      )}

      {anyPending && (
        <div className="text-center text-amber-600 text-xs py-2 bg-amber-50 rounded-xl">部分弓種審核中，審核通過前該弓種無法刷分；可改考其他弓種</div>
      )}
      {canEnter ? (
        <button onClick={() => onStartScoring(isCert ? null : myResult)}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg rounded-xl">
          🏹 {isCert ? (myCertResults.length > 0 ? "再考一種弓 / 刷分" : "進入檢定") : (myResult ? "重新挑戰" : "開始記分")}
        </button>
      ) : (
        lockMsg && <div className="text-center text-gray-400 text-sm py-2 bg-gray-50 rounded-xl">{lockMsg}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="text-gray-500 text-xs font-bold mb-3">🏅 成績排行{isCert ? "（已審核）" : ""}</div>
        {loadingR ? (
          <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
        ) : isCert ? (
          Object.keys(certByBow).length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">尚無已審核成績</div>
          ) : (
            <div className="flex flex-col gap-4">
              {["recurve_bare","compound","traditional"]
                .filter(b => certByBow[b]?.length)
                .map(b => (
                <div key={b}>
                  <div className="text-gray-600 text-xs font-black mb-1.5">{BOW_GROUP_LABEL[b] || b}</div>
                  {certByBow[b].map((r, i) => {
                    const isMe = r.memberId === myId;
                    return (
                      <div key={r.id || i}
                        className={`flex items-center gap-3 py-2 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                        <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i] || i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                            {r.nickname || r.name || "匿名射手"}{isMe && "（我）"}
                          </div>
                          {r.certLevel && r.certLevel !== "未達標" && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${certLevelStyle(r.certLevel, "softLight")}`}>{r.certLevel}</span>
                          )}
                          {r.isRental && <span className="text-orange-500 text-xs ml-1">· 租借</span>}
                        </div>
                        <span className={`font-black text-xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{r.total}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )
        ) : rankList.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-4">尚無成績</div>
        ) : (
          rankList.map((r, i) => {
            const isMe = r.memberId === myId;
            return (
              <div key={r.id || r.memberId || i}
                className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 ${isMe ? "bg-blue-50 -mx-4 px-4 rounded-xl" : ""}`}>
                <span className="w-7 text-center text-sm">{["🥇","🥈","🥉"][i] || i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${isMe ? "text-blue-700" : "text-gray-800"}`}>
                    {r.nickname || r.name || "匿名射手"}{isMe && "（我）"}
                  </div>
                </div>
                <span className={`font-black text-xl ${isMe ? "text-blue-600" : "text-gray-800"}`}>{r.total}</span>
              </div>
            );
          })
        )}
      </div>

      <RegList compId={comp?.id} myId={myId} />
    </div>
  );
}

function RegList({ compId, myId }) {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!compId) { setLoading(false); return; }
    getRegistrations(compId).then(d => { setRegs(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [compId]);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="text-gray-500 text-xs font-bold mb-3">📋 報名名單{regs.length ? `（${regs.length}）` : ""}</div>
      {loading ? (
        <div className="text-gray-400 text-sm text-center py-4">載入中…</div>
      ) : regs.length === 0 ? (
        <div className="text-gray-400 text-sm text-center py-4">尚無人報名</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {regs.map(r => {
            const isMe = r.memberId === myId;
            const label = r.nickname || r.name || r.guestInfo?.name || "射手";
            return (
              <span key={r.id || r.memberId}
                className={`text-xs px-3 py-1.5 rounded-full font-bold ${isMe ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                {label}{isMe && "（我）"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
