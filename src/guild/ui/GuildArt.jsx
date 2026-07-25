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

// 怪物與貓「沿用主線既有立繪」，公會不另生一套（同一個世界就該長一樣）
const monsterSources = id => [`/monsters-battle/${id}.webp`, `/monsters/${id}.webp`];
const catPortrait = catId => `/cats/portraits/${catId}.webp`;

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

export function CatArt({ catId, icon, size = 38, style }) {
  return (
    <ArtOrEmoji sources={catId ? [catPortrait(catId)] : []} emoji={icon || "🐱"} size={size}
      style={{ borderRadius: "50%", ...style }} />
  );
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
