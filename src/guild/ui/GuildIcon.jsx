const ATLASES = Object.freeze({
  resource: "/guild/generated/resources.png",
  equipment: "/guild/generated/equipment.png",
  menu: "/guild/generated/menus.png",
});

const ICONS = Object.freeze({
  catCoin: ["resource", 0, 0],
  coin: ["resource", 1, 0],
  shard: ["resource", 2, 0],
  food: ["resource", 0, 1],
  water: ["resource", 1, 1],
  reputation: ["resource", 2, 1],
  bow: ["equipment", 0, 0],
  arrow: ["equipment", 1, 0],
  armor: ["equipment", 2, 0],
  quiver: ["equipment", 0, 1],
  potionPouch: ["equipment", 1, 1],
  item: ["equipment", 2, 1],
  contracts: ["menu", 0, 0],
  stash: ["menu", 1, 0],
  shop: ["menu", 2, 0],
  territory: ["menu", 0, 1],
  vault: ["menu", 1, 1],
  license: ["menu", 2, 1],
});

export const GUILD_SLOT_ICON = Object.freeze({
  bow: "bow",
  arrow: "arrow",
  armor: "armor",
  quiver: "quiver",
  potionPouch: "potionPouch",
});

export default function GuildIcon({ name, size = 32, label, style }) {
  const icon = ICONS[name] || ICONS.item;
  const [atlas, column, row] = icon;
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{
      display: "inline-block",
      width: size,
      height: size,
      flex: `0 0 ${size}px`,
      backgroundImage: `url(${ATLASES[atlas]})`,
      backgroundSize: "300% 200%",
      backgroundPosition: `${column * 50}% ${row * 100}%`,
      backgroundRepeat: "no-repeat",
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,.45))",
      verticalAlign: "middle",
      ...style,
    }} />
  );
}
