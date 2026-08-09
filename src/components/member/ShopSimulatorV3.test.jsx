import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";

jest.mock("../../lib/villageShopDb", () => ({
  initVillageShopIfNeeded:jest.fn(() => Promise.resolve()),
  settleVillageShopAutoSales:jest.fn(() => Promise.resolve({ ok:true, result:{ result:{ totalItems:0, totalTickets:0 } } })),
}));

const ShopSimulatorV3 = require("./ShopSimulatorV3").default;

test("loads the Cat Village shop UI module", () => {
  expect(ShopSimulatorV3).toBeDefined();
});


test("the public shop entry is a single cross-section scene with an operations dock", () => {
  const html = renderToStaticMarkup(
    <ShopSimulatorV3
      memberId="member-1"
      resources={{}}
      coins={0}
      village={{ shop: {} }}
    />,
  );

  expect(html).toContain("/assets/shop/interior-stock-low.webp");
  expect(html).toContain('aria-label="貓貓村商店場景"');
  expect(html).toContain("/assets/shop/managers/manager-meimei.webp");
  expect(html).not.toContain("入口");
  expect(html).not.toContain("走道");
  expect(html).toContain('aria-label="商店營運操作"');
  expect(html).toContain("補貨");
  expect(html).toContain("陳列");
  expect(html).toContain("兌換");
  expect(html).toContain("裝修");
  expect(html).toContain("顧客");
  expect(html).toContain("離店自動經營 5%");
  expect(html).toContain("請先陳列商品並補足庫存");
  expect(html).not.toContain('aria-label="商店功能"');
});

test("live play is fullscreen, keeps readable controls, and exits only from the end-shop action", () => {
  const source = fs.readFileSync(require.resolve("./ShopSimulatorV3"), "utf8");
  expect(source).toContain('className="s3-livefullscreen"');
  expect(source).toContain("製造商品");
  expect(source).toContain("補充貨架");
  expect(source).toContain("結束營業");
  expect(source).toContain('setLiveStage("settling")');
  expect(source).not.toContain('liveElapsed >= totalDuration) setLiveStage("settling")');
  expect(source).toContain('className="s3-hudevent"');
  expect(source).not.toContain("寶寶・補貨");
  expect(source).not.toContain("悠悠・迎賓");
  expect(source).toContain(".shop3 .s3-livecounter{bottom:18%}");
  expect(source).toContain("font-size:14px");
  expect(source).toContain("選擇這次的營業節奏");
  expect(source).toContain("一般時間");
  expect(source).toContain("旺季時間");
  expect(source).toContain('flex-direction:column!important');
  expect(source).toContain('manualMode:liveMode');
  expect(source).toContain('回到商店・離線販售收益');
  expect(source).toContain('離店期間以 5% 速度自動販售');
  expect(source).toContain('sale.items.slice(0,3)');
  expect(source).toContain('SHOP_PRELOAD_URLS');
  expect(source).toContain('Promise.allSettled');
  expect(source).toContain('結束營業後入帳');
  expect(source).toContain('結算離線收益…');
  expect(source).toContain('offlineElapsedMs >= 60000');
  expect(source).toContain('離開商店後會自動販售已陳列且有庫存的商品');
});
