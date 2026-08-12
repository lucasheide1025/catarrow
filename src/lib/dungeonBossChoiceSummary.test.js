import { describeDungeonBossChoice } from "./dungeonBossChoiceSummary";

test("formats only selected safe reward summaries",()=>{
  expect(describeDungeonBossChoice({type:"coins",coins:900})).toContain("900");
  expect(describeDungeonBossChoice({type:"materialChests",family:"ghost",tierIndex:1,quantity:6})).toContain("×6");
  expect(describeDungeonBossChoice({type:"card",card:{name:"Boss"}})).toContain("Boss");
});
