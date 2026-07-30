import {
  COLLECTIBLE_MAP,
  getExpeditionFirstClearTrophy,
  rollFamilyDrop,
  rollBossDrops,
  rollTreasureRoomDrop,
} from "./dungeonCollectibles";

describe("dungeon collectible drop contracts", () => {
  test.each([
    ["monster", 0.149, true],
    ["monster", 0.15, false],
    ["elite", 0.449, true],
    ["elite", 0.45, false],
    ["chest", 0.549, true],
    ["chest", 0.55, false],
  ])("%s threshold uses the approved rate", (roomType, roll, shouldDrop) => {
    const drop = rollFamilyDrop("ghost", roomType, 1, () => roll);
    expect(Boolean(drop)).toBe(shouldDrop);
  });

  test("boss uses 65% base chance", () => {
    expect(rollBossDrops("ghost", "normal", 1, sequence(0.649, 0.99))).toHaveLength(1);
    expect(rollBossDrops("ghost", "normal", 1, sequence(0.65, 0.99))).toHaveLength(0);
  });

  test("treasure room always returns a registered family collectible", () => {
    const drop = rollTreasureRoomDrop("temple", 4, () => 0.7);
    expect(drop).toBeTruthy();
    expect(COLLECTIBLE_MAP[drop.itemId]).toMatchObject({ family: "temple" });
  });

  test("every generated id belongs to the dungeon dex", () => {
    const drops = [
      rollFamilyDrop("mountain", "monster", 1, () => 0),
      rollFamilyDrop("insect", "elite", 1, () => 0.3),
      rollFamilyDrop("exam", "chest", 1, () => 0.5),
      ...rollBossDrops("workplace", "hell", 1, sequence(0, 0)),
      rollTreasureRoomDrop("ghost", 6, () => 0.9),
    ].filter(Boolean);
    expect(drops.every(drop => COLLECTIBLE_MAP[drop.itemId])).toBe(true);
  });
});

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

// getExpeditionFirstClearTrophy 原本只做 Number(difficultyTier)，地下城地圖傳進來的是字串
// （normal／advanced／hard／hell），NaN 後退回 1，四種難度全部拿到 T1 紀念章與 T1 那張圖。
test("紀念章依難度取到對應的 tier，字串與數字都正確", () => {
  expect(getExpeditionFirstClearTrophy("ghost", "normal").itemId).toBe("ghost_t1_trophy");
  expect(getExpeditionFirstClearTrophy("ghost", "advanced").itemId).toBe("ghost_t3_trophy");
  expect(getExpeditionFirstClearTrophy("ghost", "hard").itemId).toBe("ghost_t4_trophy");
  expect(getExpeditionFirstClearTrophy("ghost", "hell").itemId).toBe("ghost_t5_trophy");
  // 遠征傳數字
  expect(getExpeditionFirstClearTrophy("exam", 6).itemId).toBe("exam_t6_trophy");
});

test("每個紀念章都有對應的圖片路徑，且與 tier 一致", () => {
  for (const family of ["ghost", "mountain", "insect", "workplace", "exam", "temple"]) {
    for (let tier = 1; tier <= 6; tier += 1) {
      const item = COLLECTIBLE_MAP[`${family}_t${tier}_trophy`];
      expect(item).toBeTruthy();
      expect(item.image).toBe(`/ui/dungeon/first-clear/${family}-t${tier}.webp`);
    }
  }
});

test("寶藏族沒有首次通關紀念章", () => {
  expect(getExpeditionFirstClearTrophy("treasure", "normal")).toBeNull();
});

// 舊制首殺徽章（{family}_{normal|advanced|hard|hell}_trophy，24 件、只有 emoji）已依需求移除，
// 一律以新制 36 件為主。這條測試防止舊制被重新加回來造成兩套並存、圖鑑又只列到其中一套。
test("首次通關紀念章只有新制 36 件，沒有舊制難度字串版", () => {
  const trophies = Object.keys(COLLECTIBLE_MAP).filter(id => id.endsWith("_trophy"));
  const tierStyle = trophies.filter(id => /_t[1-6]_trophy$/.test(id));
  expect(tierStyle).toHaveLength(36);
  for (const legacy of ["ghost_normal_trophy", "exam_hell_trophy", "workplace_hard_trophy", "temple_advanced_trophy"]) {
    expect(COLLECTIBLE_MAP[legacy]).toBeUndefined();
  }
  // 除了 36 件 tier 紀念章，不該再有其他以 _trophy 結尾的地下城收藏品
  expect(trophies.sort()).toEqual(tierStyle.sort());
});
