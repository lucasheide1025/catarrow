const ATLAS = "/ui/cat-village/nav-art.png";

const CELLS = Object.freeze({
  village: [0, 0], tasks: [1, 0], workshop: [2, 0],
  trade: [0, 1], gacha: [1, 1], albums: [2, 1],
  dex: [0, 2], forge: [1, 2], potioncraft: [2, 2],
});

export default function CatVillageNavArt({ name, size = 42, style }) {
  const [column, row] = CELLS[name] || CELLS.village;
  return <span aria-hidden style={{
    display: "inline-block", width: size, height: size, flex: `0 0 ${size}px`,
    backgroundImage: `url(${ATLAS})`, backgroundSize: "300% 300%",
    backgroundPosition: `${column * 50}% ${row * 50}%`,
    backgroundRepeat: "no-repeat",
    filter: "drop-shadow(0 3px 5px rgba(65,38,20,.35))",
    ...style,
  }} />;
}
