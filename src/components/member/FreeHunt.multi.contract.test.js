import fs from "fs";
import path from "path";

test("multi hunt keeps battle routing in parent apps and exposes party reservation controls", () => {
  const source = fs.readFileSync(path.join(__dirname, "FreeHunt.jsx"), "utf8");
  expect(source).not.toContain("multiMode");
  expect(source).toContain('data-multi-hunt-solo="true"');
  expect(source).toContain('data-multi-hunt-create-party="true"');
  expect(source).toContain('data-multi-hunt-join-party="true"');
  expect(source).toContain("onMultiMonster?.({ family, tierIndex })");
  expect(source).toContain('huntType:"multi"');
  expect(source).toContain("multiMonster:true");
  expect(source).toContain("multiFamily:family");
  expect(source).toContain("multiTier:tierIndex");
  expect(source).toContain("onEnterMultiPartyRoom");
  expect(source).toContain("onEnterMultiPartyRoom?.(res.roomId, true");
  expect(source).toContain("onEnterMultiPartyRoom?.(res.roomId, false");
  expect(source).not.toContain("多怪同步戰鬥尚未開放");
});

test("member and coach archer renderers both wire multi-monster routing", () => {
  const memberSource = fs.readFileSync(path.join(__dirname, "../../pages/MemberApp.jsx"), "utf8");
  const adminSource = fs.readFileSync(path.join(__dirname, "../../pages/AdminApp.jsx"), "utf8");
  for (const source of [memberSource, adminSource]) {
    expect(source).toContain('onMultiMonster={({ family, tierIndex }) =>');
    expect(source).toContain('setPage("multi-monster")');
    expect(source).toContain('page==="multi-monster" && multiMonsterContext && <MultiMonsterBattle');
  }
});

test("multi-monster battle HUD shows live HP ATK DEF from battle state", () => {
  const source = fs.readFileSync(path.join(__dirname, "../battle/MultiMonsterBattle.jsx"), "utf8");
  expect(source).toContain('data-multi-player-stats="true"');
  expect(source).toContain('label="HP"');
  expect(source).toContain('label="ATK"');
  expect(source).toContain('label="DEF"');
  expect(source).toContain("getMultiMonsterPlayerStats(visualState)");
});
