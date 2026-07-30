import {
  buildDungeonFirstClearKey,
  getDungeonFirstClearState,
  normalizeDungeonDifficultyTier,
  normalizeWorldFirstClearInput,
  DUNGEON_DIFFICULTY_TIERS,
} from "./dungeonFirstClear";

test("相同族系與等級使用穩定首殺鍵，不受 run id 影響", () => {
  expect(buildDungeonFirstClearKey("ghost", 3)).toBe("ghost_t3");
  expect(buildDungeonFirstClearKey("ghost", 3)).toBe("ghost_t3");
});

test("寶藏系不列入六族首次通關", () => {
  expect(buildDungeonFirstClearKey("treasure", 3)).toBeNull();
});

// 地下城地圖的難度是字串、遠征是數字，兩者共用同一組鍵。原本 Number("advanced") 得到 NaN
// 而退回 1，於是四種難度全部算成 _t1：打完普通後進階／困難／地獄都顯示「已完成」，
// 而打完進階（寫入 t3）後面板查 t1 又顯示「尚未取得」。
test("地圖難度字串對映到固定的 tier，四種難度不可互相碰撞", () => {
  expect(normalizeDungeonDifficultyTier("normal")).toBe(1);
  expect(normalizeDungeonDifficultyTier("advanced")).toBe(3);
  expect(normalizeDungeonDifficultyTier("hard")).toBe(4);
  expect(normalizeDungeonDifficultyTier("hell")).toBe(5);
  const tiers = ["normal", "advanced", "hard", "hell"].map(normalizeDungeonDifficultyTier);
  expect(new Set(tiers).size).toBe(4);
});

test("遠征的數字 tier 維持原本行為，並夾在 1～6", () => {
  expect(normalizeDungeonDifficultyTier(3)).toBe(3);
  expect(normalizeDungeonDifficultyTier("3")).toBe(3); // 純數字字串
  expect(normalizeDungeonDifficultyTier(0)).toBe(1);
  expect(normalizeDungeonDifficultyTier(99)).toBe(6);
  expect(normalizeDungeonDifficultyTier(undefined)).toBe(1);
  expect(normalizeDungeonDifficultyTier("無法辨識")).toBe(1);
});

test("地圖與面板算出同一個鍵：寫入端與讀取端不可分岔", () => {
  // DungeonBattleRoom 寫入時傳 dungeonInfo.difficulty（字串）
  // DungeonSelectionPanel 讀取時傳 dungeon.difficulty（同一個字串）
  for (const [difficulty, tier] of Object.entries(DUNGEON_DIFFICULTY_TIERS)) {
    const writeKey = buildDungeonFirstClearKey("ghost", difficulty);
    const readKey = getDungeonFirstClearState(
      { dungeonFirstClears:{} },
      { family:"ghost", difficulty },
    ).key;
    expect(writeKey).toBe(`ghost_t${tier}`);
    expect(readKey).toBe(writeKey);
  }
});

test("打完普通不會讓進階顯示成已完成", () => {
  const profile = { dungeonFirstClears:{ ghost_t1:{ runId:"r1" } } };
  expect(getDungeonFirstClearState(profile, { family:"ghost", difficulty:"normal" }).completed).toBe(true);
  expect(getDungeonFirstClearState(profile, { family:"ghost", difficulty:"advanced" }).completed).toBe(false);
  expect(getDungeonFirstClearState(profile, { family:"ghost", difficulty:"hard" }).completed).toBe(false);
  expect(getDungeonFirstClearState(profile, { family:"ghost", difficulty:"hell" }).completed).toBe(false);
});

test("打完進階後，面板查得到那筆紀錄", () => {
  const profile = { dungeonFirstClears:{ ghost_t3:{ runId:"r1" } } };
  expect(getDungeonFirstClearState(profile, { family:"ghost", difficulty:"advanced" }).completed).toBe(true);
});

test("玩家首次通關狀態區分未知、未通關與已通關", () => {
  const dungeon = { family:"exam", difficulty:2 };
  // profile 還沒載入才是未知
  expect(getDungeonFirstClearState(null, dungeon).known).toBe(false);
  expect(getDungeonFirstClearState(undefined, dungeon).known).toBe(false);
  expect(getDungeonFirstClearState({ dungeonFirstClears:{} }, dungeon).completed).toBe(false);
  expect(getDungeonFirstClearState({ dungeonFirstClears:{ exam_t2:{ runId:"r1" } } }, dungeon).completed).toBe(true);
});

// 從沒通關過的射手，members 文件裡不會有 dungeonFirstClears 欄位。原本把「欄位不存在」
// 判成資料還沒載入，畫面就永遠停在「首次通關資料讀取中」，獎勵狀態顯示不出來。
test("已載入但沒有 dungeonFirstClears 欄位＝尚未通關，不是資料未載入", () => {
  const dungeon = { family:"exam", difficulty:2 };
  const state = getDungeonFirstClearState({ id:"m1", name:"新射手" }, dungeon);
  expect(state.known).toBe(true);
  expect(state.completed).toBe(false);
  expect(state.eligible).toBe(true);
  expect(state.reason).toBe("首次通關獎勵尚未取得");
});

test("組隊全服首殺只以房主作為擁有者", () => {
  const result = normalizeWorldFirstClearInput({
    family:"temple", difficultyTier:6, hostId:"host", hostName:"房主",
    teamMemberIds:["member"], teamNames:["隊員"], runId:"run-1",
  });
  expect(result.ownerId).toBe("host");
  expect(result.key).toBe("temple_t6");
  expect(result.teamMemberIds).toEqual(["host", "member"]);
});
