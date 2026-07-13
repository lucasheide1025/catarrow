export const PLAYER_AVATAR_OPTIONS = Array.from({ length:12 }, (_, index) => ({
  id:`ranger_${index + 1}`,
  col:index % 4,
  row:Math.floor(index / 4),
}));

export function PlayerAvatar({ avatarId, size = 44, className = "" }) {
  const index = Math.max(0, PLAYER_AVATAR_OPTIONS.findIndex(option => option.id === avatarId));
  const option = PLAYER_AVATAR_OPTIONS[index];
  return <span aria-hidden="true" className={className} style={{
    display:"block", width:size, height:size, borderRadius:"50%", flexShrink:0,
    backgroundImage:"url(/art/avatars/dungeon-ranger-portraits-v1.png)",
    backgroundRepeat:"no-repeat", backgroundSize:"400% 300%",
    backgroundPosition:`${option.col * (100 / 3)}% ${option.row * 50}%`,
    backgroundColor:"#101b29",
  }} />;
}
