// src/guild/ui/GuildArt.jsx
// 公會美術的共用元件與路徑。
// 鐵律：**每張圖都要有 emoji fallback**——圖沒生好/載入失敗時畫面照樣可玩，
// 排版才能先上線、美術後補（比照 DungeonTeamLobby 的 ImgOrEmoji 手法）。
import { useState } from "react";

export const GUILD_ART = "/assets/guild";

// 公會自己的場景圖（大廳、戰場地面、羊皮紙）
export const hallBg = () => `${GUILD_ART}/hall_bg.webp`;
export const fieldBg = family => `${GUILD_ART}/field_${family || "ghost"}.webp`;
export const paperBg = () => `${GUILD_ART}/contract_paper.webp`;
export const rankBadge = rankId => `${GUILD_ART}/rank_${rankId}.webp`;
export const junkArt = junkId => `${GUILD_ART}/junk_${junkId}.webp`;
export const masterArt = () => `${GUILD_ART}/guild_master.webp`;

// 公會自己的 2.5D 微縮模型立繪（scripts/gen-guild-chars.py 產）。
// 排在主線圖前面，**找不到才退回主線**——所以 42 隻舊怪吃公會版、210 隻擴充怪自動沿用主線圖，
// 不用在程式裡維護「哪些有新圖」的名單。
const CHIBI = `${GUILD_ART}/chibi`;
// 只有 42 隻**舊怪**有公會版立繪，而舊怪的 id 剛好都是 `<族>_<1~6>`（擴充怪是 `<族>_t<N>_<role>`）。
// 用 id 形態判斷就不必維護名單，也**不會**讓 210 隻擴充怪每次都先打一發 404 才 fallback。
const LEGACY_ID = /^[a-z]+_[1-6]$/;
const monsterSources = id => [
  ...(LEGACY_ID.test(id) ? [`${CHIBI}/mob_${id}.webp`] : []),
  `/monsters-battle/${id}.webp`, `/monsters/${id}.webp`,
];
const catPortrait = catId => [`${CHIBI}/cat_${catId}.webp`, `/cats/portraits/${catId}.webp`];
export const heroArt = drawing => `${CHIBI}/${drawing ? "hero_shoot" : "hero"}.webp`;

// 依序試多個網址，全失敗才退回 emoji
export function ArtOrEmoji({ sources = [], emoji = "❓", size = 40, style, className }) {
  const [idx, setIdx] = useState(0);
  if (idx >= sources.length) {
    return <span className={className} style={{ fontSize: size, lineHeight: 1, ...style }}>{emoji}</span>;
  }
  return (
    <img src={sources[idx]} alt="" draggable={false} className={className}
      onError={() => setIdx(i => i + 1)}
      style={{ width: size, height: size, objectFit: "contain", display: "block", ...style }} />
  );
}

export function MonsterArt({ monsterId, icon, size = 56, style }) {
  return <ArtOrEmoji sources={monsterId ? monsterSources(monsterId) : []} emoji={icon || "👹"} size={size} style={style} />;
}

// round=true 才裁圓（頭像用）。戰鬥立繪是**全身微縮模型**，裁圓會把腳切掉。
export function CatArt({ catId, icon, size = 38, round = false, style }) {
  return (
    <ArtOrEmoji sources={catId ? catPortrait(catId) : []} emoji={icon || "🐱"} size={size}
      style={{ borderRadius: round ? "50%" : 0, ...style }} />
  );
}

// 玩家本人（射手）。拉弓時換成 hero_shoot，戰鬥畫面原本就有 bowPull 狀態可以直接接。
export function HeroArt({ drawing = false, size = 64, style }) {
  return <ArtOrEmoji sources={[heroArt(drawing), heroArt(false)]} emoji="🏹" size={size} style={style} />;
}

// 背景圖層（圖沒生好時退回漸層底色，不會變白畫面）
export function bgLayer(url, { overlay = "rgba(8,6,3,.55)", fallback = "linear-gradient(180deg,#0b1220,#1a1207)", size = "cover", position = "center" } = {}) {
  return {
    backgroundColor: "#0b1220",
    backgroundImage: `linear-gradient(${overlay},${overlay}), url(${url}), ${fallback}`,
    backgroundSize: `${size}, ${size}, cover`,
    backgroundPosition: `${position}, ${position}, center`,
    backgroundRepeat: "no-repeat",
  };
}
