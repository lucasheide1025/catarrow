// 2026-07-19：DLC 正式全面安裝，開關已移除 —— 永遠啟用。
//
// 為什麼拿掉開關：flag 存在期間，測試裝置的 localStorage 或環境變數只要殘留
// 一個 "off"，整條擴充路徑（王房抽王、擴充怪池、材料/裝備面板）就會靜默
// 退回舊行為，而畫面上看不出任何差別 —— 實際踩過這個坑：王房一直抽到舊表
// 的雜怪（ghost_3 林投姐、temple_2 骷髏劍士），追了很久才發現不是抽王壞掉，
// 是 flag 沒開。功能既然要全面上線，就不該再留這個會沉默失效的開關。
//
// 兩個 export 刻意保留（呼叫端有 12 處），避免一次性大改；
// isMonsterExpansionEnabled() 恆為 true，各呼叫端的 else 分支已成 dead code，
// 後續可逐步清理。
export const MONSTER_EXPANSION_FLAG_KEY = "monsterExpansionV1";

// 舊版會依 ?expansion=on|off 寫入 localStorage；現已無作用，保留空實作供舊呼叫端。
export function syncMonsterExpansionFlagFromUrl() {
  return null;
}

export function isMonsterExpansionEnabled() {
  return true;
}
