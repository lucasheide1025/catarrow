import fs from "fs";
import path from "path";

test("自由狩獵組隊不再使用舊 CatRoundOverlay 重播同一貓咪回合", () => {
  const source = fs.readFileSync(path.join(__dirname, "PartyBattleRoom.jsx"), "utf8");
  expect(source).toContain('open={!isFreeHuntParty && room?.status !== "active" && !!liveEntry && isCatMini}');
});

test("自由狩獵不顯示外層 CatMsg，避免和戰鬥事件重疊", () => {
  const source = fs.readFileSync(path.join(__dirname, "PartyBattleRoom.jsx"), "utf8");
  expect(source).toContain("!isFreeHuntParty&&<CatMsg");
});
