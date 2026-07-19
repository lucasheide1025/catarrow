// src/components/member/cards/components.smoke.test.js
// 冒煙測試：讓 jest/babel 編譯全部卡片元件與 lib,確保 import 路徑/語法/引用皆正確。
// （專案未安裝 @testing-library,不做實際 render;render 行為由 Codex 接線後在瀏覽器驗收。）

import CardMiniCell from "./CardMiniCell";
import CardFilterBar from "./CardFilterBar";
import CardGroupSection, { MAX_PER_GROUP } from "./CardGroupSection";
import CardDetailSheet from "./CardDetailSheet";
import CardCollectionPrototype from "./CardCollectionPrototype";
import CardArtImage, { CardArtSVG } from "./CardArt";
import * as catalog from "./cardCatalog";
import * as seen from "./cardSeen";

test("所有卡片元件與 lib 皆可載入", () => {
  for (const C of [CardMiniCell, CardFilterBar, CardGroupSection, CardDetailSheet, CardCollectionPrototype, CardArtImage, CardArtSVG]) {
    expect(typeof C).toBe("function");
  }
  expect(MAX_PER_GROUP).toBe(6);
  expect(catalog.CARD_CATALOG.length).toBe(252);
  expect(typeof seen.seedSeenIfFirstRun).toBe("function");
});
