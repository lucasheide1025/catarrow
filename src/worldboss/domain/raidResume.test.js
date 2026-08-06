import {
  RESUME_EXPIRE_MS,
  buildResumeRecord,
  clearRaidProgress,
  isResumeUsable,
  loadRaidProgress,
  resumeLabel,
  saveRaidProgress,
} from "./raidResume";
import { createRaidState, resolveRaidRound } from "./raidFlow";
import { WEAK_SPOT_MAP } from "./weakPoints";

const NOW = 1_800_000_000_000;
const mkState = (over = {}) => ({
  ...createRaidState({
    boss: { key: "cat_baobao", name: "寶寶", hp: 5000, maxHp: 5000, atk: 100, def: 40 },
    stats: { atk: 120, def: 60, hp: 250 },
  }),
  ...over,
});

describe("續戰存檔的三個必擋情況", () => {
  test("⚠️ 已結算的完場不能復活——不然重整就能再結算一次", () => {
    expect(buildResumeRecord(mkState({ finished: true }), { bossKey: "cat_baobao", settled: true })).toBeNull();
    expect(isResumeUsable({ v: 1, finished: true, settled: true, state: {}, savedAt: NOW }, { now: NOW })).toBe(false);
  });

  test("⚠️ 打完但**還沒送出獎勵**的場次要留著——重整才能補送（2026-08-06 修 bug）", () => {
    const rec = buildResumeRecord(mkState({ finished: true }), {
      bossKey: "cat_baobao", settled: false, now: NOW,
      settlement: { reward: { coins: 100 }, killInfo: null, killPayload: null },
    });
    expect(rec).toBeTruthy();
    expect(rec.finished).toBe(true);
    expect(rec.settled).toBe(false);
    expect(rec.settlement.reward.coins).toBe(100);
    expect(isResumeUsable(rec, { bossKey: "cat_baobao", now: NOW })).toBe(true);
  });

  test("⚠️ 換了王不能沿用", () => {
    const rec = buildResumeRecord(mkState(), { bossKey: "cat_baobao", now: NOW });
    expect(isResumeUsable(rec, { bossKey: "cat_baobao", now: NOW })).toBe(true);
    expect(isResumeUsable(rec, { bossKey: "head_coach", now: NOW })).toBe(false);
  });

  test("⚠️ 換了場次（eventId）也不能沿用", () => {
    const rec = buildResumeRecord(mkState(), { bossKey: "cat_baobao", eventId: "e1", now: NOW });
    expect(isResumeUsable(rec, { bossKey: "cat_baobao", eventId: "e1", now: NOW })).toBe(true);
    expect(isResumeUsable(rec, { bossKey: "cat_baobao", eventId: "e2", now: NOW })).toBe(false);
  });

  test("⚠️ 太舊的不接——隔天回來不該接上昨天那場", () => {
    const rec = buildResumeRecord(mkState(), { bossKey: "cat_baobao", now: NOW });
    expect(isResumeUsable(rec, { bossKey: "cat_baobao", now: NOW + RESUME_EXPIRE_MS - 1000 })).toBe(true);
    expect(isResumeUsable(rec, { bossKey: "cat_baobao", now: NOW + RESUME_EXPIRE_MS + 1000 })).toBe(false);
  });

  test("壞資料一律不接", () => {
    expect(isResumeUsable(null, {})).toBe(false);
    expect(isResumeUsable({ v: 99, state: {} }, {})).toBe(false);
    expect(isResumeUsable({ v: 1 }, {})).toBe(false);
  });
});

describe("存檔內容", () => {
  test("存得下戰鬥狀態，讀回來能繼續打", () => {
    const state = mkState();
    saveRaidProgress(state, { bossKey: "cat_baobao" });
    const loaded = loadRaidProgress({ bossKey: "cat_baobao" });
    expect(loaded).toBeTruthy();
    expect(loaded.state.bossHp).toBe(state.bossHp);
    expect(loaded.state.boss.skillConfig).toBeTruthy();      // 讀回來要重新掛上技能表
    const { state: next } = resolveRaidRound({
      state: loaded.state,
      arrows: [{ memberId: loaded.state.members[0].memberId, nx: 0, ny: 0, score: 10 }],
    });
    expect(next.round).toBe(2);
    clearRaidProgress();
  });

  test("打到一半的進度真的存下來（不是每次都從第一回合）", () => {
    let state = mkState();
    state = { ...state, spots: [{ ...WEAK_SPOT_MAP.green, cx: 0, cy: 0, key: "t" }] };
    state = resolveRaidRound({
      state, arrows: [{ memberId: "me", nx: 0, ny: 0, score: 10 }],
    }).state;
    saveRaidProgress(state, { bossKey: "cat_baobao" });
    const loaded = loadRaidProgress({ bossKey: "cat_baobao" });
    expect(loaded.record.round).toBe(2);
    expect(loaded.state.bossHp).toBeLessThan(5000);
    clearRaidProgress();
  });

  test("已結算的完場寫進去會被當成不存在", () => {
    saveRaidProgress(mkState(), { bossKey: "cat_baobao" });
    expect(loadRaidProgress({ bossKey: "cat_baobao" })).toBeTruthy();
    saveRaidProgress(mkState({ finished: true }), { bossKey: "cat_baobao", settled: true });
    expect(loadRaidProgress({ bossKey: "cat_baobao" })).toBeNull();
  });

  test("讀到壞掉的 JSON 不會炸，而且會自己清掉", () => {
    window.localStorage.setItem("wb_raid_resume_v1", "{壞掉的");
    expect(loadRaidProgress({ bossKey: "cat_baobao" })).toBeNull();
    expect(window.localStorage.getItem("wb_raid_resume_v1")).toBeNull();
  });

  test("UI 文案講得出是多久以前的第幾回合", () => {
    expect(resumeLabel({ savedAt: Date.now(), round: 3 })).toContain("第 3 回合");
    expect(resumeLabel(null)).toBe("");
  });
});
