import { MATERIAL_BY_ID as EXPANSION_MATERIAL_BY_ID } from "./monsterEconomyCatalog";
import { CHEST_TYPES } from "./itemData";

export function createSyncingReceipt({ claimId, battleId, mode }) {
  return { claimId, battleId, mode, status:"syncing", items:[], progression:[] };
}

export function normalizeBattleRewardReceipt({ claimId, battleId, mode, reward = {} }) {
  const items=[];
  if ((Number(reward.coins)||0)>0) items.push({id:"coins",kind:"coins",name:"金幣",icon:"🪙",quantity:Number(reward.coins),source:"狩獵獎勵"});
  for (const [id, quantity] of Object.entries(reward.materialTotals || {})) {
    const material=EXPANSION_MATERIAL_BY_ID[id] || {};
    if ((Number(quantity)||0)>0) items.push({id,kind:"material",name:material.name || "未知素材",icon:material.icon || "🪨",quantity:Number(quantity),source:"怪物素材"});
  }
  for (const [index,chest] of (reward.chests || []).entries()) {
    const info=CHEST_TYPES[chest?.type] || {};
    items.push({id:chest?.id || `chest-${index}`,kind:"chest",name:chest?.name || info.name || "寶箱",icon:chest?.icon || info.icon || "📦",quantity:1,tier:chest?.tier || null,source:chest?.source || "狩獵掉落"});
  }
  if (reward.card) items.push({id:reward.card.monsterId || reward.card.id,kind:"card",name:reward.card.name || "怪物卡片",icon:reward.card.icon || "🃏",quantity:1,tier:reward.card.tier || null,source:"怪物卡片"});
  const progression=[
    ["arrowDew","箭露","💧"],["archerXP","射手經驗","🏹"],["catXP","貓咪經驗","🐱"],
  ].flatMap(([kind,name,icon])=>(Number(reward[kind])||0)>0?[{kind,name,icon,amount:Number(reward[kind])}]:[]);
  return {claimId,battleId,mode,status:"confirmed",items,progression};
}
