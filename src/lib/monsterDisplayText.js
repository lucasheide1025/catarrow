import { monsterTierNumber } from "./monsterData";

export const MONSTER_FAMILY_LABELS = Object.freeze({
  ghost:"幽冥系",
  mountain:"山嶺系",
  insect:"昆蟲系",
  workplace:"職場系",
  exam:"考試系",
  temple:"神廟系",
  treasure:"寶箱族",
});

export function getMonsterTaxonomyPresentation(monster={}) {
  const tier=monsterTierNumber(monster);
  return {
    familyLabel:MONSTER_FAMILY_LABELS[monster?.family]||"未知族系",
    tierLabel:tier?`第 ${tier} 階`:"未知階級",
  };
}
