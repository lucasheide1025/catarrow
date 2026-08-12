import fs from "fs";
import path from "path";

const readSource = relativePath => fs.readFileSync(path.join(__dirname, relativePath), "utf8");

describe("世界王公開顯示資料", () => {
  test("兩個正式攻擊入口都優先寫入玩家暱稱", () => {
    const legacyGate = readSource("../../worldboss/RaidGate.jsx");
    const attack = readSource("./WorldBossAttack.jsx");

    expect(legacyGate).toContain('profile?.nickname || profile?.name || "射手"');
    expect(attack).toContain('profile?.nickname || profile?.name || "射手"');
  });

  test("大廳的排行榜、參戰者與擊倒演出共用公開名稱優先序", () => {
    const lobby = readSource("./WorldBossLobby.jsx");

    expect(lobby).toContain("participant?.nickname || participant?.displayName || participant?.name");
    expect(lobby).toContain("killer.nickname || killer.displayName || killer.memberName");
    expect(lobby.match(/publicParticipantName\(p\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  test("休眠畫面只渲染本輪有效的召喚條件", () => {
    const lobby = readSource("./WorldBossLobby.jsx");

    expect(lobby).toContain("activeSpawnTypes(spawnCycle).map(key =>");
    expect(lobby).not.toContain('["🏹 全體箭數","arrows"], ["🏰 六族地下城","dungeonClears"]');
  });

  test("世界王領獎在發放資源前先以 transaction 鎖定", () => {
    const dbSource = readSource("../../lib/worldBossDb.js");
    const reserveAt = dbSource.indexOf("const claimReserved = await runTransaction");
    const payoutAt = dbSource.indexOf("if (coinsToGive > 0)");

    expect(reserveAt).toBeGreaterThan(0);
    expect(payoutAt).toBeGreaterThan(reserveAt);
    expect(dbSource).toContain('if (!claimReserved) return { ok:false, reason:"already_claimed" }');
  });
});
