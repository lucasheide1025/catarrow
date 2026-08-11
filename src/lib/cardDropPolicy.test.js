import { resolveCardDropChance } from "./cardDropPolicy";

describe("card drop policy",()=>{
  test("solo and guild share base odds while party gains 1.5x capped at 50%",()=>{
    expect(resolveCardDropChance({mode:"solo",baseChance:.2})).toBe(.2);
    expect(resolveCardDropChance({mode:"guild",baseChance:.2})).toBe(.2);
    expect(resolveCardDropChance({mode:"party",baseChance:.2})).toBeCloseTo(.3);
    expect(resolveCardDropChance({mode:"party",baseChance:.8})).toBe(.5);
  });
  test("dungeon normal cards cap at 10% and bosses use 40%",()=>{
    expect(resolveCardDropChance({mode:"dungeon",encounter:"normal",baseChance:.3})).toBe(.1);
    expect(resolveCardDropChance({mode:"dungeon",encounter:"miniBoss"})).toBe(.4);
    expect(resolveCardDropChance({mode:"dungeon",encounter:"boss"})).toBe(.4);
  });
});
