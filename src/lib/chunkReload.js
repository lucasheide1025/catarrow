// src/lib/chunkReload.js
// 修 ChunkLoadError：CRA 程式碼分割後，每次 Vercel 重新部署，JS chunk 檔名（內容 hash）會變。
// 使用者若在部署前就開著 App（或瀏覽器快取了舊的 index.html），之後 lazy 載入某個分頁時，
// 會去要「舊的 chunk 檔名」——但檔案已被新版覆蓋 → 404 → ChunkLoadError，畫面卡住／進不去
// （例如「獎品發放 AdminGiveTool」「背包 inventory-hub」「冒險 adventure-hub」）。
//
// 解法：全域攔截 ChunkLoadError，自動重新整理一次頁面。重載後會拿到新版 index.html →
// 對應到新的 chunk 檔名 → 正常。用時間戳防止無限重載（10 秒內剛因此重載過就不再重載，
// 避免遇到「真的缺檔」時陷入重整迴圈）。

export function reloadOnceForStaleChunk() {
  try {
    const KEY = "__chunk_reload_ts__";
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 10000) return; // 剛剛才因 chunk 失敗重載過，別無限循環
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  } catch {
    window.location.reload();
  }
}

export function isChunkError(errOrMsg) {
  const name = errOrMsg?.name || "";
  const msg = errOrMsg?.message || (typeof errOrMsg === "string" ? errOrMsg : "");
  return name === "ChunkLoadError" || /Loading chunk [\w-]+ failed/i.test(msg) || /ChunkLoadError/i.test(msg);
}

export function installChunkReloadGuard() {
  // 一般同步錯誤（render 途中拋出的 ChunkLoadError）
  window.addEventListener("error", (e) => {
    if (isChunkError(e?.error) || isChunkError(e?.message)) reloadOnceForStaleChunk();
  });
  // lazy import() 失敗多半以「未處理的 Promise 拒絕」形式出現（console 顯示 Uncaught (in promise) ChunkLoadError）
  window.addEventListener("unhandledrejection", (e) => {
    if (isChunkError(e?.reason)) reloadOnceForStaleChunk();
  });
}
