"use strict";

const catalog = require("./data/monsterExpansionCatalog.json");
const collectibleIds = require("./data/dungeonCollectibleIds.json");
const { seededRoll } = require("./monsterReward");

const MONSTERS = new Map(catalog.monsters.map(monster => [monster.id, monster]));
const TIER_BASE = [0,1,1,2,2,3,3];
const BOSS_MARKS = [0,1,1,2,3,5,8];
const BOSS_COINS = [0,300,600,1200,2400,4800,8000];
const RUNES = ["atk", "def", "hp", "cat"];

function rewardKey({ battleId, memberId }) {
  if (!battleId || !memberId || String(battleId).includes("/") || String(memberId).includes("/")) throw new Error("invalid_dungeon_reward_identity");
  return `${battleId}:${memberId}:dungeonBoss`;
}

function normalPool(monster) {
  return catalog.monsters.filter(item => item.family === monster.family && item.tierIndex === monster.tierIndex && item.encounter === "normal").map(item => item.material);
}

function split(materials, total, key) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const offset = (hash >>> 0) % 3;
  const quantities = [Math.floor(total * .4), Math.floor(total * .35), Math.floor(total * .25)];
  for (let remaining=total-quantities.reduce((a,b)=>a+b,0), index=0; remaining>0; index++,remaining--) quantities[index % 3]++;
  return quantities.map((quantity,index) => ({ materialId:materials[(index+offset)%3].id, quantity })).filter(item => item.quantity > 0);
}

function cardResult(monster, firstDefeat, misses, roll) {
  if (firstDefeat) return { dropped:true, nextMisses:0, guaranteed:true, reason:"firstDefeat" };
  const threshold = monster.encounter === "miniBoss" ? 5 : 8;
  if (misses >= threshold-1) return { dropped:true, nextMisses:0, guaranteed:true, reason:"pity" };
  const dropped = roll < (monster.encounter === "miniBoss" ? .2 : .1);
  return { dropped, nextMisses:dropped?0:misses+1, guaranteed:false, reason:dropped?"roll":"miss" };
}

function buildDungeonBossEnvelope({ battleId, memberId, monsterId, firstDefeat=false, cardMisses=0 }) {
  const monster = MONSTERS.get(monsterId);
  if (!monster || !["miniBoss", "boss"].includes(monster.encounter)) throw new Error("boss_monster_required");
  const key = rewardKey({ battleId, memberId });
  const isBoss = monster.encounter === "boss";
  const pool = normalPool(monster);
  if (pool.length !== 3) throw new Error("normal_material_pool_invalid");
  const fixedReward = {
    bossMaterial:{ materialId:monster.material.id, quantity:1 },
    generalMaterials:split(pool, TIER_BASE[monster.tierIndex] * (isBoss?8:5), monster.id),
    bossMarks:BOSS_MARKS[monster.tierIndex] * (isBoss?2:1),
    runeFragments:(monster.tierIndex+2) * (isBoss?2:1),
    coins:BOSS_COINS[monster.tierIndex] * (isBoss?2:1),
    choiceCount:isBoss?2:1,
  };
  fixedReward.runeFragment = { type:RUNES[Math.floor(seededRoll(`${key}:${monsterId}:rune`)*RUNES.length)], count:fixedReward.runeFragments };
  const card = cardResult(monster, firstDefeat, cardMisses, seededRoll(`${key}:${monsterId}:card`));
  const choiceOptions = ["material", "coins", "exploration"].map(type => {
    let reward;
    if (type === "material") reward = { type, materials:split(pool, TIER_BASE[monster.tierIndex]*5, `${monster.id}:choice`) };
    else if (type === "coins") reward = { type, coins:Math.floor(fixedReward.coins*1.5) };
    else {
      const roll=seededRoll(`${key}:${monsterId}:choice:exploration`);
      const rarity=roll<.6?"common":roll<.95?"rare":"boss";
      // ⚠️ 寶箱族（treasure）沒有專屬收藏品池，資料檔只有六個一般族系。
      // 寶箱王房因此 throw missing_collectible_pool、玩家完全領不到獎勵（使用者實測）。
      // 缺池時退到「所有族的同稀有度合併池」——寶箱族本來就是什麼都有。
      const poolFor=r=>{
        const own=collectibleIds[monster.family]?.[r] || [];
        return own.length ? own : Object.values(collectibleIds).flatMap(entry => entry?.[r] || []);
      };
      let ids=poolFor(rarity);
      // 再往下退一層稀有度，避免某個稀有度整體無內容時仍然 throw
      if (!ids.length) for (const fb of ["boss","rare","common"]) { ids=poolFor(fb); if (ids.length) break; }
      if (!ids.length) throw new Error("missing_collectible_pool");
      reward={ type, rarity, quantity:rarity==="common"?3:rarity==="rare"?2:1, itemId:ids[Math.floor(seededRoll(`${key}:${monsterId}:collectible`)*ids.length)] };
    }
    return { type, reward };
  });
  // 三個箱子必須「長得一樣、位置隨機」讓玩家用猜的（2026-07-19 使用者指示）：
  // ①用 seeded Fisher-Yates 打亂順序（同一場結果穩定,重連不會變）；
  // ②id 改為位置索引，不再是 `choice:material` 這種會洩漏內容的字串。
  for (let i = choiceOptions.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededRoll(`${key}:${monsterId}:shuffle:${i}`) * (i + 1));
    [choiceOptions[i], choiceOptions[j]] = [choiceOptions[j], choiceOptions[i]];
  }
  choiceOptions.forEach((option, index) => { option.id = `${key}:choice:${index}`; });
  return { version:1, catalogVersion:catalog.version, rewardKey:key, battleId, memberId, monsterId, encounter:monster.encounter,
    fixedReward, cardResult:card, card:card.dropped?{ monsterId:monster.card.id, name:monster.name, family:monster.family, tier:monster.tier, encounter:monster.encounter, artKey:monster.artKey }:null,
    choiceCount:fixedReward.choiceCount, choiceOptions };
}

function validateChoices(envelope, selectedOptionIds) {
  return Array.isArray(selectedOptionIds) && selectedOptionIds.length === envelope.choiceCount
    && new Set(selectedOptionIds).size === selectedOptionIds.length
    && selectedOptionIds.every(id => envelope.choiceOptions.some(option => option.id === id));
}

module.exports = { buildDungeonBossEnvelope, validateChoices };
