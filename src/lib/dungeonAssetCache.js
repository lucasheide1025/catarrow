export const DUNGEON_UI_ASSETS = Object.freeze([
  "/ui/dungeon/rest-options-sheet.webp",
  "/ui/dungeon/merchant-types-sheet.webp",
]);

let preloadPromise = null;

// 同一個 App 執行期間只解碼一次；HTTP Cache 則負責跨重開 App 保留素材。
export function preloadDungeonUiAssets() {
  if (preloadPromise || typeof Image === "undefined") return preloadPromise || Promise.resolve();
  preloadPromise = Promise.all(DUNGEON_UI_ASSETS.map(src => new Promise(resolve => {
    const image = new Image();
    image.onload = image.onerror = resolve;
    image.src = src;
    if (image.complete) resolve();
  })));
  return preloadPromise;
}
