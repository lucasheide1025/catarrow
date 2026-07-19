// 2026-07-19：DLC 全面開放，預設啟用。
// 仍保留關閉手段：環境變數設 "false"、或該裝置用 ?expansion=off / localStorage 覆寫，
// 萬一上線後發現問題可以立刻關掉單一裝置或整個環境，不必回退版本。
const ENV_FLAG = process.env.REACT_APP_MONSTER_EXPANSION_V1 !== "false";

export const MONSTER_EXPANSION_FLAG_KEY = "monsterExpansionV1";

// 開關優先序：網址參數 ?expansion=on|off > localStorage > 環境變數。
// 正式部署可由 Vercel 設 REACT_APP_MONSTER_EXPANSION_V1=true 全域開啟。
//
// 為什麼要有網址參數：組隊測試得用多台手機、多個人，手機無法開 devtools 打 localStorage 指令。
// 用 ?expansion=on 開一次就寫進該裝置的 localStorage，之後正常開網址也維持開啟，
// 而且只影響有點過那條連結的裝置，其他使用者完全不受影響。
export function syncMonsterExpansionFlagFromUrl(search) {
  if (typeof window === "undefined") return null;
  try {
    const raw = search ?? window.location.search;
    const param = new URLSearchParams(raw).get("expansion");
    if (param !== "on" && param !== "off") return null;
    window.localStorage.setItem(MONSTER_EXPANSION_FLAG_KEY, param);
    return param;
  } catch {
    return null; // 無痕模式等 localStorage 不可用時，靜默忽略
  }
}

// 模組載入時同步一次（App 啟動即生效，不必等某個元件呼叫）
syncMonsterExpansionFlagFromUrl();

export function isMonsterExpansionEnabled() {
  if (typeof window !== "undefined") {
    try {
      const local = window.localStorage.getItem(MONSTER_EXPANSION_FLAG_KEY);
      if (local === "on") return true;
      if (local === "off") return false;
    } catch {
      return ENV_FLAG; // localStorage 不可用 → 退回環境變數
    }
  }
  return ENV_FLAG;
}
