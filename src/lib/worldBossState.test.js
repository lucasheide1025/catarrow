import {
  findPendingWorldBossEvents,
  normalizeWorldBossState,
  shouldShowWorldBossVictory,
} from "./worldBossState";

test("已擊倒但仍保存 6721 HP 的舊世界王一律顯示 0", () => {
  const result = normalizeWorldBossState({ status:"defeated", bossCurrentHP:6721, bossMaxHP:550000 });
  expect(result.bossCurrentHP).toBe(0);
  expect(result.needsTerminalRepair).toBe(true);
});

test("HP 已歸零的 active 王正規化為 defeated", () => {
  expect(normalizeWorldBossState({ status:"active", bossCurrentHP:0, bossMaxHP:10 }).status).toBe("defeated");
});

test("低傷害最後一名仍保有待領資格", () => {
  const events = [{
    id:"boss-1", status:"defeated", bossCurrentHP:0, bossMaxHP:100,
    participants:{ shirley:{ totalDmg:1, claimed:false }, winner:{ totalDmg:99, claimed:true } },
  }];
  expect(findPendingWorldBossEvents(events, "shirley").map(event => event.id)).toEqual(["boss-1"]);
});

test("擊倒回傳會進勝利結算", () => {
  expect(shouldShowWorldBossVictory({ ok:true, defeated:true })).toBe(true);
});
