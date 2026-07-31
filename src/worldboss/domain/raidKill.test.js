import {
  KILL_STYLES,
  KILL_STYLE_COIN_BONUS,
  KILL_REPLAY_FRESH_MS,
  buildKillPayload,
  detectKillStyle,
  findKillingBlow,
  isKillReplayFresh,
  shouldReplayKill,
  killAnnouncement,
  lastHitReward,
} from "./raidKill";
import { LAST_HIT_EXTRA } from "../../lib/worldBossData";
import { createRaidState, resolveRaidRound } from "./raidFlow";
import { WEAK_SPOT_MAP } from "./weakPoints";

describe("擊倒方式", () => {
  test("一定會判出一種——保底規則不能漏", () => {
    expect(detectKillStyle({}).id).toBeTruthy();
    expect(detectKillStyle().id).toBeTruthy();
  });

  test("紅點正中是最稀有的", () => {
    const s = detectKillStyle({ bySpot: "red", bullseye: true, teamSize: 4 });
    expect(s.id).toBe("red_bullseye");
    expect(s.rarity).toBe("legendary");
  });

  test("⚠️ 特別的排前面——不然「穩紮穩打」會把所有有趣的情況吃掉", () => {
    // 同時滿足多條時，取更有趣的那個
    expect(detectKillStyle({ bySpot: "green", burst: true, teamSize: 4 }).id).toBe("burst_finish");
    expect(detectKillStyle({ bySpot: "green", staggered: true, teamSize: 4 }).id).toBe("stagger_finish");
    expect(detectKillStyle({ byCat: true, teamSize: 4 }).id).toBe("cat_finish");
  });

  test("單人擊倒與滿編擊倒是不同的故事", () => {
    expect(detectKillStyle({ bySpot: "green", teamSize: 1 }).id).toBe("solo_slay");
    expect(detectKillStyle({ bySpot: "green", teamSize: 8 }).id).toBe("full_team");
  });

  test("沒中弱點也能打倒——那是另一種味道", () => {
    expect(detectKillStyle({ bySpot: null, byCat: false, teamSize: 4 }).id).toBe("lucky_finish");
  });

  test("過度殺傷：剩一點血卻打了三倍", () => {
    expect(detectKillStyle({ bySpot: "yellow", damage: 900, hpBefore: 100, teamSize: 4 }).id).toBe("overkill");
  });

  test("每一種都有完整的顯示資料", () => {
    for (const s of KILL_STYLES) {
      expect(s.icon && s.name && s.flavour && s.rarity).toBeTruthy();
      expect(typeof s.match).toBe("function");
    }
  });

  test("每一種都判得出顏色（UI 要用）", () => {
    for (const s of KILL_STYLES) expect(detectKillStyle({}).color).toBeTruthy();
  });
});

describe("尾刀獎勵", () => {
  test("沿用既有的 LAST_HIT_EXTRA，不另外發明", () => {
    const r = lastHitReward({ rarity: "rare" });
    expect(r.catBoxes).toBe(LAST_HIT_EXTRA.catBoxes);
    expect(r.cardPacks).toBe(LAST_HIT_EXTRA.cardPacks);
  });

  test("擊倒方式越稀有，金幣加碼越多", () => {
    expect(lastHitReward({ rarity: "legendary" }).coins)
      .toBeGreaterThan(lastHitReward({ rarity: "epic" }).coins);
    expect(lastHitReward({ rarity: "epic" }).coins)
      .toBeGreaterThan(lastHitReward({ rarity: "common" }).coins);
  });

  test("沒給稀有度也不會炸", () => {
    expect(lastHitReward(null).coins).toBe(KILL_STYLE_COIN_BONUS.common);
  });
});

describe("全服播報", () => {
  test("單人：說得出是誰、用什麼方式、打倒了誰", () => {
    const text = killAnnouncement({
      killerName: "小明", bossName: "主教練",
      style: detectKillStyle({ bySpot: "red", bullseye: true }), teamNames: ["小明"],
    });
    expect(text).toContain("小明");
    expect(text).toContain("主教練");
    expect(text).toContain("一箭穿心");
  });

  test("組隊：講得出還有幾位隊友", () => {
    const text = killAnnouncement({
      killerName: "小明", bossName: "寶寶",
      style: detectKillStyle({ teamSize: 4 }), teamNames: ["小明", "A", "B", "C"],
    });
    expect(text).toContain("3 位隊友");
  });
});

describe("從 log 找出補刀", () => {
  test("找得到 bossDown 前面最近的一次傷害", () => {
    const log = [
      { type: "arrow", damage: 10 },
      { type: "gauge" },
      { type: "arrow", damage: 999, hit: true },
      { type: "bossDown" },
    ];
    expect(findKillingBlow(log).damage).toBe(999);
  });

  test("沒打倒就沒有補刀", () => {
    expect(findKillingBlow([{ type: "arrow" }])).toBeNull();
  });
});

describe("實際結算會帶上補刀資訊", () => {
  const nearlyDead = () => {
    const st = createRaidState({
      boss: { key: "t", name: "測試王", hp: 500000, maxHp: 500000, atk: 100, def: 40 },
      stats: { atk: 150, def: 60, hp: 250 },
    });
    return { ...st, bossHp: 1, spots: [{ ...WEAK_SPOT_MAP.red, cx: 0, cy: 0, key: "t" }] };
  };

  test("bossDown 帶得出誰補的刀、怎麼補的", () => {
    const { log } = resolveRaidRound({
      state: nearlyDead(),
      arrows: [{ memberId: "me", nx: 0, ny: 0, score: 10 }],
    });
    const down = log.find(e => e.type === "bossDown");
    expect(down).toBeTruthy();
    expect(down.killerId).toBe("me");
    expect(down.style).toBeTruthy();
    expect(down.style.name).toBeTruthy();
    expect(down.finishingArrow).toBeTruthy();
  });

  test("貓補刀時記的是貓，不是箭", () => {
    const st = {
      ...createRaidState({
        boss: { key: "t", name: "測試王", hp: 500000, maxHp: 500000, atk: 100, def: 40 },
        members: [{ memberId: "a", name: "阿甲", stats: { atk: 100, def: 50, hp: 200 }, cats: [{ catId: "c", name: "小咪", atk: 90 }] }],
      }),
      bossHp: 1, spots: [],
    };
    const { log } = resolveRaidRound({ state: st, arrows: [] });
    const down = log.find(e => e.type === "bossDown");
    expect(down.byCat).toBe(true);
    expect(down.catName).toBe("小咪");
    expect(down.style.id).toBe("cat_finish");
  });
});

describe("全服擊倒重播（作者 2026-07-31 澄清）", () => {
  const style = detectKillStyle({ bySpot: "red", bullseye: true });
  const payload = () => buildKillPayload({
    bossKey: "cat_baobao", bossName: "寶寶", killerId: "m1", killerName: "小明",
    style, members: [{ memberId: "m1", name: "小明" }, { memberId: "m2", name: "阿華" }],
    eventId: "e1", at: 1000,
  });

  test("⚠️ 演出必須能從存下來的資料重現——別人的裝置沒有戰鬥 state", () => {
    const p = payload();
    expect(p.style.name).toBe("一箭穿心");
    expect(p.cast).toHaveLength(2);
    expect(p.killerName).toBe("小明");
    expect(p.bossName).toBe("寶寶");
  });

  test("刻意精簡：只存演出要用的，不搬整份成員資料", () => {
    const p = buildKillPayload({
      style, members: [{ memberId: "m1", name: "小明", stats: { atk: 999 }, cats: [{}] }],
    });
    expect(Object.keys(p.cast[0])).toEqual(["memberId", "name"]);
  });

  test("最多帶 5 位——8 個人全排會擠成一團", () => {
    const p = buildKillPayload({
      style, members: Array.from({ length: 8 }, (_, i) => ({ memberId: `m${i}`, name: `隊員${i}` })),
    });
    expect(p.cast).toHaveLength(5);
    expect(p.teamSize).toBe(8);      // 但人數要記真的
  });

  test("沒有 style 就沒有 payload（不會生出空演出）", () => {
    expect(buildKillPayload({ killerName: "小明" })).toBeNull();
  });

  test("太舊的重播不跳出來嚇人", () => {
    const p = payload();
    expect(isKillReplayFresh(p, 1000 + 60_000)).toBe(true);
    expect(isKillReplayFresh(p, 1000 + KILL_REPLAY_FRESH_MS + 1)).toBe(false);
  });

  test("⚠️ 看過的不重播——不然每次開 App 都播同一場", () => {
    const p = payload();
    expect(shouldReplayKill(p, 0, 1000)).toBe(true);
    expect(shouldReplayKill(p, 1000, 1000)).toBe(false);   // 已經看過這一次
    expect(shouldReplayKill(p, 999, 1000)).toBe(true);     // 上次看的是更早那場
  });
});
