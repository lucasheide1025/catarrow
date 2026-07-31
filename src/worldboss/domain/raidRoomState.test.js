import { BOT_SKILLS, botRoundArrows, botTeamArrows } from "./raidBot";
import { createRaidState, resolveRaidRound } from "./raidFlow";
import {
  collectRoomArrows, hydrateRaidState, roomPhase, rosterFromRoom, serializeRaidState,
} from "./raidRoomState";
import { WEAK_SPOT_MAP } from "./weakPoints";

const seeded = seed => {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

const room = (over = {}) => ({
  status: "active", round: 2,
  members: { a: { name: "阿甲", atk: 100, def: 50, hp: 200 }, b: { name: "阿乙", atk: 120, def: 60, hp: 220 } },
  submissions: {},
  ...over,
});

describe("房間狀態序列化", () => {
  const state = createRaidState({
    boss: { key: "cat_baobao", name: "寶寶", hp: 5000, maxHp: 5000, atk: 100, def: 40, skillConfig: { r2Strike: { skillId: "x" } } },
    members: [{ memberId: "a", name: "阿甲", stats: { atk: 100, def: 50, hp: 200 } }],
    targetFmt: "triple", distanceM: 12,
  });

  test("⚠️ skillConfig 不進 Firestore（那是 24 王的完整技能表，每回合搬一次太貴）", () => {
    const stored = serializeRaidState(state);
    expect(stored.boss.skillConfig).toBeUndefined();
    expect(stored.boss.key).toBe("cat_baobao");
  });

  test("讀回來時用 bossKey 重新掛上 skillConfig", () => {
    const back = hydrateRaidState(serializeRaidState(state));
    expect(back.boss.skillConfig).toBeTruthy();
    expect(back.boss.skillConfig.r2Strike).toBeTruthy();
  });

  test("⚠️ 不能有 undefined——Firestore 會拒絕整筆寫入", () => {
    const stored = serializeRaidState({ ...state, weirdField: undefined, spots: [{ id: "x", cx: 0, cy: undefined }] });
    const walk = v => {
      if (Array.isArray(v)) return v.every(walk);
      if (v && typeof v === "object") return Object.values(v).every(walk);
      return v !== undefined;
    };
    expect(walk(stored)).toBe(true);
  });

  test("戰鬥該有的東西都留著，存回去能繼續打", () => {
    const back = hydrateRaidState(serializeRaidState(state));
    expect(back.bossHp).toBe(state.bossHp);
    expect(back.members).toHaveLength(1);
    expect(back.spots.length).toBeGreaterThan(0);
    expect(back.targetFmt).toBe("triple");
    expect(back.rangeMult).toBe(state.rangeMult);
    const { state: next } = resolveRaidRound({ state: back, arrows: [{ memberId: "a", nx: 0, ny: 0, score: 10 }] });
    expect(next.round).toBe(2);
  });

  test("白名單制：state 之後長出新欄位也不會被順手同步上去", () => {
    const stored = serializeRaidState({ ...state, 某個暫存欄位: { 很大: "的東西" } });
    expect(stored["某個暫存欄位"]).toBeUndefined();
  });
});

describe("房間推進閘門", () => {
  test("有人還沒送出就不能結算，而且說得出是誰", () => {
    const r = roomPhase(room({ submissions: { a: { round: 2, arrows: [{}] } } }));
    expect(r.canResolve).toBe(false);
    expect(r.waitingNames).toEqual(["阿乙"]);
  });

  test("全員送出才能結算", () => {
    const r = roomPhase(room({ submissions: { a: { round: 2, arrows: [{}] }, b: { round: 2, arrows: [{}] } } }));
    expect(r.canResolve).toBe(true);
    expect(r.phase).toBe("ready");
  });

  test("⚠️ 上一回合的送出不算數（不然會用舊資料推進）", () => {
    const r = roomPhase(room({ submissions: { a: { round: 1, arrows: [{}] }, b: { round: 2, arrows: [{}] } } }));
    expect(r.canResolve).toBe(false);
    expect(r.waitingNames).toEqual(["阿甲"]);
  });

  test("空陣列不算送出（不然可以按空白過關）", () => {
    const r = roomPhase(room({ submissions: { a: { round: 2, arrows: [] }, b: { round: 2, arrows: [{}] } } }));
    expect(r.canResolve).toBe(false);
  });

  test("已結束的房間不再推進", () => {
    expect(roomPhase(room({ status: "done" })).phase).toBe("done");
    expect(roomPhase({ ...room(), state: { finished: true } }).phase).toBe("done");
  });

  test("離開的人（members 被刪成 null）不會卡住全隊", () => {
    const r = roomPhase(room({
      members: { a: { name: "阿甲" }, b: null },
      submissions: { a: { round: 2, arrows: [{}] } },
    }));
    expect(r.canResolve).toBe(true);
  });
});

describe("房間 → 結算的資料轉換", () => {
  test("把每個人的箭攤平並標上射手", () => {
    const arrows = collectRoomArrows(room({
      submissions: {
        a: { round: 2, arrows: [{ nx: 0, ny: 0 }, { nx: .1, ny: 0 }] },
        b: { round: 2, arrows: [{ nx: .2, ny: 0 }] },
      },
    }));
    expect(arrows).toHaveLength(3);
    expect(arrows.filter(x => x.memberId === "a")).toHaveLength(2);
    expect(arrows.every(x => x.memberId)).toBe(true);
  });

  test("回合對不上的送出直接忽略", () => {
    const arrows = collectRoomArrows(room({
      submissions: { a: { round: 1, arrows: [{}] }, b: { round: 2, arrows: [{}] } },
    }));
    expect(arrows).toHaveLength(1);
  });

  test("房間成員轉成 createRaidState 要的形狀", () => {
    const roster = rosterFromRoom(room());
    expect(roster).toHaveLength(2);
    expect(roster[0]).toMatchObject({ memberId: "a", name: "阿甲" });
    expect(roster[1].stats.atk).toBe(120);
  });
});

describe("模擬隊友出手（沙盒驗組隊邏輯用）", () => {
  const spots = [
    { ...WEAK_SPOT_MAP.green, cx: 0.2, cy: 0, faceIndex: 0, key: "g" },
    { ...WEAK_SPOT_MAP.red, cx: -0.3, cy: 0.2, faceIndex: 0, key: "r" },
  ];

  test("每位隊友產生指定數量的箭，並標好自己的 id", () => {
    const arrows = botRoundArrows({ memberId: "bot1", spots, rand: seeded(3) });
    expect(arrows).toHaveLength(6);
    expect(arrows.every(a => a.memberId === "bot1" && a.bot)).toBe(true);
  });

  test("會把箭分散到場上的圈（好玩家的打法）", () => {
    const arrows = botRoundArrows({ memberId: "b", spots, skill: "veteran", rand: seeded(11) });
    const nearGreen = arrows.filter(a => Math.hypot(a.nx - 0.2, a.ny) < 0.4).length;
    const nearRed = arrows.filter(a => Math.hypot(a.nx + 0.3, a.ny - 0.2) < 0.4).length;
    expect(nearGreen).toBeGreaterThan(0);
    expect(nearRed).toBeGreaterThan(0);
  });

  test("準度檔次真的有差——老手的箭群比新手密", () => {
    const spread = skill => {
      const arrows = botRoundArrows({ memberId: "b", spots: [], skill, arrows: 40, rand: seeded(7) });
      return arrows.reduce((sum, a) => sum + Math.hypot(a.nx, a.ny), 0) / arrows.length;
    };
    expect(spread("veteran")).toBeLessThan(spread("mid"));
    expect(spread("mid")).toBeLessThan(spread("rookie"));
  });

  test("脫靶的箭標成 M、分數 0", () => {
    const arrows = botRoundArrows({ memberId: "b", spots: [], skill: "rookie", arrows: 60, rand: seeded(5) });
    const miss = arrows.filter(a => a.score === 0);
    expect(miss.length).toBeGreaterThan(0);
    expect(miss.every(a => a.label === "M")).toBe(true);
  });

  test("三連靶時會分到不同張靶", () => {
    const arrows = botRoundArrows({ memberId: "b", spots: [], targetFmt: "triple", arrows: 6, rand: seeded(9) });
    expect(new Set(arrows.map(a => a.faceIndex)).size).toBeGreaterThan(1);
  });

  test("只幫隊友出手，不會幫「我」多射", () => {
    const members = [{ memberId: "me" }, { memberId: "b1" }, { memberId: "b2" }];
    const arrows = botTeamArrows({ members, meId: "me", spots, rand: seeded(2) });
    expect(arrows).toHaveLength(12);
    expect(arrows.some(a => a.memberId === "me")).toBe(false);
  });

  test("餵進結算能跑，而且傷害記到各自名下", () => {
    const state = {
      ...createRaidState({
        boss: { key: "t", hp: 500000, maxHp: 500000, atk: 100, def: 40 },
        members: [
          { memberId: "me", name: "我", stats: { atk: 120, def: 60, hp: 250 } },
          { memberId: "b1", name: "隊友1", stats: { atk: 120, def: 60, hp: 250 } },
        ],
      }),
      spots,
    };
    const bots = botTeamArrows({ members: state.members, meId: "me", spots, skill: "veteran", rand: seeded(4) });
    const mine = Array.from({ length: 6 }, () => ({ memberId: "me", nx: 0.2, ny: 0, score: 9 }));
    const { state: next } = resolveRaidRound({ state, arrows: [...mine, ...bots] });
    expect(next.members[0].damage).toBeGreaterThan(0);
    expect(next.members[1].damage).toBeGreaterThan(0);
  });

  test("每個準度檔次都有顯示資料", () => {
    for (const sk of BOT_SKILLS) expect(sk.label && sk.desc && sk.sigma).toBeTruthy();
  });
});
