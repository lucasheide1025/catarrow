import { GUILD_BATTLE_SOUND_EVENTS, guildBattleSound } from "../ui/guildBattleSound";

describe("公會戰鬥獨立音效", () => {
  test("所有戰鬥事件都有公會專用播放器", () => {
    expect(GUILD_BATTLE_SOUND_EVENTS).toEqual([
      "tap",
      "shoot",
      "hit",
      "critical",
      "monsterDown",
      "enemyAttack",
      "catAssist",
      "hazard",
      "waveClear",
      "victory",
      "defeat",
      "error",
    ]);

    for (const event of GUILD_BATTLE_SOUND_EVENTS) {
      expect(typeof guildBattleSound[event]).toBe("function");
    }
  });
});
