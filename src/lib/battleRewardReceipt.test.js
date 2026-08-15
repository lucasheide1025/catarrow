import { createSyncingReceipt, normalizeBattleRewardReceipt } from "./battleRewardReceipt";

test("同步中收據不得提前揭示掉落",()=>{
  expect(createSyncingReceipt({claimId:"c",battleId:"b",mode:"solo"})).toMatchObject({status:"syncing",items:[]});
});

test("權威回應正規化為唯一戰利品收據",()=>{
  const receipt=normalizeBattleRewardReceipt({claimId:"c",battleId:"b",mode:"party",reward:{coins:12,materialTotals:{mat_ghost_t1_normal_a:5},chests:[{id:"x",name:"金幣寶箱",icon:"🎁"}],archerXP:8}});
  expect(receipt.status).toBe("confirmed");
  expect(receipt.items.find(item=>item.kind==="coins")?.quantity).toBe(12);
  expect(receipt.items.find(item=>item.kind==="material")?.quantity).toBe(5);
  expect(receipt.progression).toContainEqual(expect.objectContaining({kind:"archerXP",amount:8}));
});
