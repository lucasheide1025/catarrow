const ENV_FLAG = process.env.REACT_APP_MONSTER_EXPANSION_V1 === "true";

export const MONSTER_EXPANSION_FLAG_KEY = "monsterExpansionV1";

// 開關優先序：localStorage "on"（本機測試強制開）> "off"（強制關）> 環境變數。
// 正式部署由 Vercel 設 REACT_APP_MONSTER_EXPANSION_V1=true 全域開啟。
export function isMonsterExpansionEnabled() {
  if (typeof window !== "undefined") {
    const local = window.localStorage.getItem(MONSTER_EXPANSION_FLAG_KEY);
    if (local === "on") return true;
    if (local === "off") return false;
  }
  return ENV_FLAG;
}
