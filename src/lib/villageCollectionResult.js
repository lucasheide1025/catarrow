const RESOURCE_META = Object.freeze({
  ore:{ name:"礦石", icon:"⛏️" },
  melon:{ name:"貓草", icon:"🌿" },
  fish:{ name:"鮮魚", icon:"🐟" },
  meat:{ name:"獸肉", icon:"🥩" },
  driedfish:{ name:"魚乾", icon:"🐠" },
  can:{ name:"罐罐", icon:"🥫" },
  potion:{ name:"貓薄荷藥水", icon:"🍵" },
  fur:{ name:"貓毛", icon:"🐾" },
  archer:{ name:"箭術素材", icon:"🏹" },
  arrowdew:{ name:"神聖箭露", icon:"💧" },
  gachaCoins:{ name:"扭蛋幣", icon:"🎰" },
  gachaToken:{ name:"扭蛋幣", icon:"🎰" },
});

const SECTION_META = Object.freeze({
  raw:{ id:"raw", label:"村莊採集資源", icon:"🧺" },
  special:{ id:"special", label:"特殊獎勵", icon:"✨" },
});

function toItem(key, rawAmount) {
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const match = key.match(/^(.+)_t([1-5])$/);
  const resource = match?.[1] || key;
  const tier = match ? Number(match[2]) : null;
  const meta = RESOURCE_META[resource] || { name:resource, icon:"📦" };
  const section = tier ? "raw" : "special";
  return {
    key,
    resource,
    tier,
    amount,
    name:meta.name,
    icon:meta.icon,
    section,
    groupLabel:SECTION_META[section].label,
    art:tier
      ? `/ui/village/resource-${resource}${tier}.webp`
      : resource === "arrowdew"
        ? "/ui/village/resource-arrowdew.webp"
        : "/ui/village/gacha-machine.webp",
  };
}

export function buildVillageCollectionResult(collected = {}) {
  const items = Object.entries(collected)
    .map(([key, amount]) => toItem(key, amount))
    .filter(Boolean)
    .sort((a, b) => (a.section === b.section ? a.key.localeCompare(b.key) : a.section === "raw" ? -1 : 1));
  const sections = ["raw", "special"].map(id => ({
    ...SECTION_META[id],
    items:items.filter(item => item.section === id),
  })).filter(section => section.items.length);
  return {
    totalKinds:items.length,
    totalAmount:items.reduce((sum, item) => sum + item.amount, 0),
    sections,
  };
}
