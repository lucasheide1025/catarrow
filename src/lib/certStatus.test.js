import {
  CERT_COMP_TYPE,
  activeCertComp,
  certCompTitle,
  certPeriodKey,
  certProgress,
  certYearOptions,
  halfShortLabel,
  myCertState,
} from "./certStatus";
import { CERT_DEFAULT_SCORES } from "./constants";

const cert = (over = {}) => ({ type: CERT_COMP_TYPE, year: 2026, half: "first", status: "open", ...over });

// ── 標題 ───────────────────────────────────────────────────────────────────
test("標題含年份、期別與距離——改距離要能重組出正確標題", () => {
  expect(certCompTitle({ year: 2026, half: "second", distance: 18 }))
    .toBe("2026年下半年（7月～12月） 年度檢定（18米）");
  expect(certCompTitle({ year: 2026, half: "second", distance: 30 }))
    .toContain("30米");
});

test("期別短標籤：不是 second 一律當上半年，不會回 undefined", () => {
  expect(halfShortLabel("second")).toBe("下半年");
  expect(halfShortLabel("first")).toBe("上半年");
  expect(halfShortLabel(undefined)).toBe("上半年");
});

// ── 進行中的檢定 ───────────────────────────────────────────────────────────
test("沒有進行中的年度檢定時回 null（首頁卡片才不會變成空卡）", () => {
  expect(activeCertComp([])).toBe(null);
  expect(activeCertComp(null)).toBe(null);
  expect(activeCertComp([cert({ status: "closed" })])).toBe(null);
  // 其他類型的比賽不算
  expect(activeCertComp([{ type: "積分賽", status: "open", year: 2026, half: "first" }])).toBe(null);
});

test("同時開了上下半年時取最新期別", () => {
  const picked = activeCertComp([cert({ half: "first" }), cert({ half: "second" })]);
  expect(picked.half).toBe("second");
});

test("跨年時 2026 上半年比 2025 下半年新", () => {
  const picked = activeCertComp([
    cert({ year: 2025, half: "second" }),
    cert({ year: 2026, half: "first" }),
  ]);
  expect(picked.year).toBe(2026);
  expect(picked.half).toBe("first");
});

test("upcoming 也算可以考（報名要提早開）", () => {
  expect(activeCertComp([cert({ status: "upcoming" })])).not.toBe(null);
});

test("期別 key 的格式固定，缺 half 時退回 first", () => {
  expect(certPeriodKey(cert({ half: "second" }))).toBe("2026_second");
  expect(certPeriodKey({ year: 2026 })).toBe("2026_first");
  expect(certPeriodKey(null)).toBe(null);
});

// ── 差幾分升級 ─────────────────────────────────────────────────────────────
test("0 分時下一級是最低的「入門」，不會回 NaN", () => {
  const p = certProgress({ certScores: null, bowType: "recurve_full", score: 0 });
  expect(p.level).toBe(null);
  expect(p.nextLevel).toBe("入門");
  expect(p.gap).toBe(CERT_DEFAULT_SCORES.recurve_full["入門"]);
});

test("108 分（中級）距離「進階」還差 18 分", () => {
  const p = certProgress({ certScores: null, bowType: "recurve_full", score: 108 });
  expect(p.level).toBe("中級");
  expect(p.nextLevel).toBe("進階");
  expect(p.gap).toBe(126 - 108);
});

test("已達最高級時 nextLevel 為 null、gap 為 0（不能顯示「差 -12 分」）", () => {
  const p = certProgress({ certScores: null, bowType: "recurve_full", score: 200 });
  expect(p.level).toBe("精英");
  expect(p.nextLevel).toBe(null);
  expect(p.gap).toBe(0);
});

test("傳統弓最高級是「菁英」，不可被寫成其他弓種的「精英」", () => {
  const p = certProgress({ certScores: null, bowType: "traditional", score: 102 });
  expect(p.level).toBe("進階");
  expect(p.nextLevel).toBe("菁英");
  expect(p.gap).toBe(114 - 102);
});

test("用該場檢定賽的門檻，不是寫死的預設值", () => {
  const certScores = { recurve_full: { 入門: 30, 初級: 60, 中級: 90, 進階: 120, 精英: 150 } };
  const p = certProgress({ certScores, bowType: "recurve_full", score: 100 });
  expect(p.level).toBe("中級");
  expect(p.nextLevel).toBe("進階");
  expect(p.gap).toBe(20); // 用預設門檻會算成 26
});

test("未知弓種或缺分數不會炸，也不會回 NaN", () => {
  const p = certProgress({ certScores: null, bowType: "不存在的弓", score: undefined });
  expect(p.nextLevel).toBe(null);
  expect(p.gap).toBe(0);
  expect(Number.isNaN(p.gap)).toBe(false);
});

// ── 我這期考到哪 ───────────────────────────────────────────────────────────
test("四種狀態分得出來——已送出待審不可被當成沒考", () => {
  expect(myCertState({})).toBe("none");
  expect(myCertState({ registered: true })).toBe("registered");
  expect(myCertState({ registered: true, result: { reviewStatus: "pending" } })).toBe("submitted");
  expect(myCertState({ registered: true, result: { reviewStatus: "approved" } })).toBe("approved");
});

test("沒報名卻已有成績（教練代登）仍算已送出", () => {
  expect(myCertState({ registered: false, result: { reviewStatus: "pending" } })).toBe("submitted");
});

// ── 歷年期別選單 ───────────────────────────────────────────────────────────
test("歷年期別由新到舊排序", () => {
  const groups = {
    "2025_first":  { year: 2025, half: "first",  scores: {} },
    "2026_second": { year: 2026, half: "second", scores: {} },
    "2025_second": { year: 2025, half: "second", scores: {} },
    "2026_first":  { year: 2026, half: "first",  scores: {} },
  };
  expect(certYearOptions(groups).map(o => o.key)).toEqual([
    "2026_second", "2026_first", "2025_second", "2025_first",
  ]);
  expect(certYearOptions(groups)[0].label).toBe("2026 下半年");
});

test("沒有任何紀錄時回空陣列，不是 undefined", () => {
  expect(certYearOptions({})).toEqual([]);
  expect(certYearOptions(null)).toEqual([]);
});
