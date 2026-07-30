const ATLAS = "/ui/member-nav/feature-art.png";

const CELLS = Object.freeze({
  home: [0, 0], adventure: [1, 0], training: [2, 0], village: [3, 0],
  inventory: [0, 1], booking: [1, 1], profile: [2, 1], learn: [3, 1],
  history: [0, 2], notifications: [1, 2], certexam: [2, 2], external: [3, 2],
  msgs: [0, 3], bowsetting: [1, 3], guide: [2, 3], collection: [3, 3],
});

export default function MemberFeatureArt({ name, size = 44, style, className }) {
  const [column, row] = CELLS[name] || CELLS.home;
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        backgroundImage: `url(${ATLAS})`,
        backgroundSize: "400% 400%",
        backgroundPosition: `${column * (100 / 3)}% ${row * (100 / 3)}%`,
        backgroundRepeat: "no-repeat",
        filter: "drop-shadow(0 3px 5px rgba(0,0,0,.34))",
        ...style,
      }}
    />
  );
}
