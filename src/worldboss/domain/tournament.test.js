import {
  TOURNAMENT_TYPES,
  applySuggestedRanks,
  entriesFromMatchBoard,
  memberRecord,
  normalizeDate,
  normalizeEntry,
  sortForDisplay,
  sortTournaments,
  suggestRanks,
  tournamentSummary,
  validateTournament,
} from "./tournament";

const e = (name, score, over = {}) => ({ name, score, xCount: 0, tens: 0, ...over });

describe("日期", () => {
  test("教練打 2026/8/1 也要收（現場不會有人乖乖打補零）", () => {
    expect(normalizeDate("2026/8/1")).toBe("2026-08-01");
    expect(normalizeDate("2026.8.1")).toBe("2026-08-01");
    expect(normalizeDate("2026-08-01")).toBe("2026-08-01");
  });

  test("看不懂的就回空字串，交給驗證擋", () => {
    expect(normalizeDate("八月一日")).toBe("");
    expect(normalizeDate(null)).toBe("");
  });
});

describe("成績列", () => {
  test("壞資料一律歸零，不會存進 NaN", () => {
    const r = normalizeEntry({ name: " 小明 ", score: "abc", rank: -5 });
    expect(r.name).toBe("小明");
    expect(r.score).toBe(0);
    expect(r.rank).toBe(0);
  });

  test("⚠️ rank 0 代表還沒填，不是第 0 名", () => {
    expect(normalizeEntry({ name: "甲" }).rank).toBe(0);
  });
});

describe("建議名次", () => {
  const rows = [e("甲", 90, { xCount: 2 }), e("乙", 90, { xCount: 5 }), e("丙", 120)];

  test("照總分 → X 數 → 10 數，跟比賽當下同一套規則", () => {
    const s = suggestRanks(rows);
    expect(s.find(r => r.name === "丙").suggestedRank).toBe(1);
    expect(s.find(r => r.name === "乙").suggestedRank).toBe(2);
    expect(s.find(r => r.name === "甲").suggestedRank).toBe(3);
  });

  test("⚠️ 只是建議——不會蓋掉教練已經填的名次", () => {
    const withRank = [{ ...e("甲", 10), rank: 1 }, { ...e("乙", 999), rank: 2 }];
    const s = suggestRanks(withRank);
    expect(s.find(r => r.name === "甲").rank).toBe(1);        // 教練填的留著
    expect(s.find(r => r.name === "甲").suggestedRank).toBe(2); // 建議是第 2
  });

  test("按「照分數排」才會真的寫進去", () => {
    const applied = applySuggestedRanks(rows);
    expect(applied.find(r => r.name === "丙").rank).toBe(1);
  });
});

describe("顯示排序", () => {
  test("⚠️ 沒填名次的排後面，不能當成第 0 名排到最前面", () => {
    const rows = [e("沒填", 999), { ...e("冠軍", 10), rank: 1 }, { ...e("亞軍", 5), rank: 2 }];
    expect(sortForDisplay(rows).map(r => r.name)).toEqual(["冠軍", "亞軍", "沒填"]);
  });

  test("都沒填名次就照分數", () => {
    expect(sortForDisplay([e("低", 10), e("高", 90)]).map(r => r.name)).toEqual(["高", "低"]);
  });
});

describe("存檔驗證", () => {
  test("名稱與日期是必填，理由要具體", () => {
    const v = validateTournament({ entries: [e("甲", 10)] });
    expect(v.ok).toBe(false);
    expect(v.errors.join()).toContain("名稱");
    expect(v.errors.join()).toContain("日期");
  });

  test("至少要有一位選手", () => {
    const v = validateTournament({ name: "資格賽", date: "2026-08-01", entries: [] });
    expect(v.ok).toBe(false);
    expect(v.errors.join()).toContain("選手");
  });

  test("⚠️ 並列只提醒不擋——對外賽事本來就會並列", () => {
    const v = validateTournament({
      name: "對抗賽", date: "2026-08-01",
      entries: [{ ...e("甲", 90), rank: 1 }, { ...e("乙", 90), rank: 1 }],
    });
    expect(v.ok).toBe(true);
    expect(v.warnings[0]).toContain("並列");
  });

  test("填齊就過", () => {
    expect(validateTournament({
      name: "館內賽", date: "2026/8/1", entries: [e("甲", 90)],
    }).ok).toBe(true);
  });
});

describe("從比賽模式匯入", () => {
  test("帶得走分數、箭數、X／10，並用即時名次當預設", () => {
    const rows = entriesFromMatchBoard([
      { memberId: "m1", name: "甲", score: 200, arrows: 24, xCount: 3, tens: 5, rank: 1 },
    ]);
    expect(rows[0]).toMatchObject({ memberId: "m1", name: "甲", score: 200, arrows: 24, rank: 1 });
  });

  test("空榜不會炸", () => {
    expect(entriesFromMatchBoard()).toEqual([]);
  });
});

describe("賽事列表", () => {
  const list = [
    { id: "a", name: "資格賽", date: "2026-07-01", type: "qualifier", entries: [{ name: "甲", score: 90, rank: 1 }] },
    { id: "b", name: "對抗賽", date: "2026-08-01", type: "match", entries: [{ name: "乙", score: 80, rank: 1 }] },
  ];

  test("日期新的排前面", () => {
    expect(sortTournaments(list).map(t => t.id)).toEqual(["b", "a"]);
  });

  test("摘要抓得出冠軍", () => {
    const s = tournamentSummary(list[0]);
    expect(s.champion).toBe("甲");
    expect(s.players).toBe(1);
    expect(s.typeInfo.label).toBe("資格賽");
  });

  test("沒人填名次時用分數最高的當冠軍", () => {
    const s = tournamentSummary({ name: "x", date: "2026-01-01", entries: [{ name: "低", score: 1 }, { name: "高", score: 99 }] });
    expect(s.champion).toBe("高");
  });

  test("每種賽別都有完整顯示資料", () => {
    for (const t of TOURNAMENT_TYPES) expect(t.label && t.icon && t.color).toBeTruthy();
  });
});

describe("個人對外戰績", () => {
  const list = [
    { name: "資格賽", date: "2026-07-01", entries: [{ memberId: "m1", name: "甲", score: 90, rank: 2 }] },
    { name: "對抗賽", date: "2026-08-01", entries: [{ memberId: "m1", name: "甲", score: 120, rank: 1 }] },
    { name: "他人賽", date: "2026-08-01", entries: [{ memberId: "m2", name: "乙", score: 50, rank: 1 }] },
  ];

  test("算得出參賽次數、最佳名次、前三名次數", () => {
    const r = memberRecord(list, "m1");
    expect(r.events).toBe(2);
    expect(r.best).toBe(1);
    expect(r.podiums).toBe(2);
  });

  test("⚠️ 手動補登的沒有 memberId——用名字也要找得到", () => {
    const manual = [{ name: "對抗賽", date: "2026-08-01", entries: [{ name: "小明", score: 70, rank: 3 }] }];
    expect(memberRecord(manual, null, "小明").events).toBe(1);
  });

  test("查無此人回空的，不會炸", () => {
    expect(memberRecord(list, "nobody").events).toBe(0);
    expect(memberRecord(list, null, null).events).toBe(0);
  });
});
