export const EQUIPMENT_RUNE_TYPES = {
  atk: { name: "攻擊符文", icon: "⚔️", stat: "atk" },
  def: { name: "防禦符文", icon: "🛡️", stat: "def" },
  hp: { name: "生命符文", icon: "❤️", stat: "hp" },
  cat: { name: "貓靈符文", icon: "🐱", stat: "all" },
};

export const EQUIPMENT_RUNE_TIERS = [
  { tier: 1, name: "初階", bonus: 0.04, fragmentCost: 10, goldCost: 300 },
  { tier: 2, name: "進階", bonus: 0.07, fragmentCost: 16, goldCost: 900 },
  { tier: 3, name: "高階", bonus: 0.11, fragmentCost: 24, goldCost: 2400 },
  { tier: 4, name: "王級", bonus: 0.16, fragmentCost: 36, goldCost: 6000 },
];

export const EQUIPMENT_RUNES = Object.fromEntries(
  Object.entries(EQUIPMENT_RUNE_TYPES).flatMap(([type, meta]) =>
    EQUIPMENT_RUNE_TIERS.map(config => {
      const id = `equipment_${type}_t${config.tier}`;
      return [id, { id, type, ...meta, ...config }];
    }),
  ),
);

export function getEquipmentRune(runeId) {
  return EQUIPMENT_RUNES[runeId] || null;
}

export function getEquipmentRuneBonus(sockets = []) {
  const bonus = { atk: 0, def: 0, hp: 0 };
  sockets.forEach(runeId => {
    const rune = getEquipmentRune(runeId);
    if (!rune) return;
    if (rune.stat === "all") {
      bonus.atk += rune.bonus;
      bonus.def += rune.bonus;
      bonus.hp += rune.bonus;
    } else {
      bonus[rune.stat] += rune.bonus;
    }
  });
  return bonus;
}

export function getAllEquipmentRuneBonus(equipment = {}) {
  return Object.values(equipment).reduce((total, item) => {
    const bonus = getEquipmentRuneBonus(item?.sockets);
    total.atk += bonus.atk;
    total.def += bonus.def;
    total.hp += bonus.hp;
    return total;
  }, { atk: 0, def: 0, hp: 0 });
}
