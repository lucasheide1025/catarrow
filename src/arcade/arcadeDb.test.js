// src/arcade/arcadeDb.test.js — 本機 profile revision / migration 契約
import { prepareProfileWrite } from "./arcadeDb";

describe("Arcade 本機 profile 寫入", () => {
  test("每次寫入 revision +1，並保留舊檔遷移後的玩家等級", () => {
    const current = {
      visitorId: "abc", nickname: "小勇者", selectedCat: "haji",
      catLevel: 3, xp: 40, revision: 7, lastPlayedAt: 100,
    };
    const next = prepareProfileWrite(current, { ...current, coins: 200 }, 999);
    expect(next.revision).toBe(8);
    expect(next.updatedAt).toBe(999);
    expect(next.playerLevel).toBe(3);
    expect(next.playerXp).toBe(40);
    expect(next.coins).toBe(200);
  });

  test("候選資料不能自行把 revision 倒退或跳號", () => {
    const current = {
      visitorId: "abc", nickname: "小勇者", selectedCat: "haji",
      playerLevel: 2, playerXp: 10, revision: 12,
    };
    const next = prepareProfileWrite(current, { ...current, revision: 1 }, 1234);
    expect(next.revision).toBe(13);
  });
});
