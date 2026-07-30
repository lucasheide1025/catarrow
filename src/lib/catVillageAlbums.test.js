import {
  ALBUM_CARD_IDS, CAT_CARD_ALBUM, VILLAGE_ALBUM_IDS, albumXpFromCards,
  albumXpGains, villageAlbumBonusPct, villageAlbumLevel, villageAlbumThreshold,
} from "./catVillageAlbums";

describe("貓村九冊", () => {
  test("200 張卡唯一分入 23、23、22×7", () => {
    expect(Object.keys(CAT_CARD_ALBUM)).toHaveLength(200);
    expect(Object.values(CAT_CARD_ALBUM).every(id => VILLAGE_ALBUM_IDS.includes(id))).toBe(true);
    expect(VILLAGE_ALBUM_IDS.map(id => ALBUM_CARD_IDS[id].length).sort((a, b) => b - a))
      .toEqual([23, 23, 22, 22, 22, 22, 22, 22, 22]);
  });

  test("曲線前快後慢且 Lv20=1110 EXP / 5%", () => {
    expect(villageAlbumThreshold(20)).toBe(1110);
    expect(villageAlbumLevel(1109)).toBe(19);
    expect(villageAlbumLevel(1110)).toBe(20);
    expect(villageAlbumBonusPct(1110)).toBe(5);
  });

  test("普通卡 +1，特殊卡 +3，補算使用持有量", () => {
    const gains = albumXpGains(["001", "100", "200"]);
    expect(Object.values(gains).reduce((a, b) => a + b, 0)).toBe(7);
    const xp = albumXpFromCards({ "001": 2, "100": 3 });
    expect(Object.values(xp).reduce((a, b) => a + b, 0)).toBe(11);
  });
});
