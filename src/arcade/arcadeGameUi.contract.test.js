import fs from "fs";
import path from "path";

function source(name) {
  return fs.readFileSync(path.join(__dirname, name), "utf8");
}

describe("Visitor Arcade game UI contracts", () => {
  test("onboarding and hub expose one primary journey with semantic game surfaces", () => {
    const app = source("ArcadeApp.jsx");
    const ui = source("ArcadeGameUi.jsx");
    expect(app).toContain("ArcadeShell");
    expect(app).toContain("ArcadePlayerBar");
    expect(app).toContain("DungeonCarousel");
    expect(app).toContain("ArcadeActionDock");
    expect(app).toContain('<ArcadeShell screen="onboarding">');
    expect(app).toContain('<ArcadeShell screen="hub">');
    expect(ui).toContain("data-arcade-screen={screen}");
    expect(app).toContain("選好貓咪，開始射箭");
    expect(app).toContain("繼續冒險");
    expect(app).toContain("arcade-visual-root phase-${phase}");
  });

  test("all legacy hub destinations remain reachable after visual prioritization", () => {
    const app = source("ArcadeApp.jsx");
    expect(app).toContain("輸入 5 位數房號");
    expect(app).toContain("和朋友組隊");
    expect(app).toContain("射手競技場");
    expect(app).toContain("金幣商店");
    expect(app).toContain("冒險紀錄");
    expect(app).toContain("訪客進度保存在本裝置");
  });

  test("game stylesheet owns responsive, safe-area, focus, carousel and reduced-motion rules", () => {
    const css = source("arcadeGame.css");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("env(safe-area-inset-top");
    expect(css).toContain("env(safe-area-inset-left");
    expect(css).toContain("env(safe-area-inset-right");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("scroll-snap-type");
    expect(css).toContain("@media (max-width:390px)");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
    expect(css).toMatch(/min-height:\s*48px/);
    expect(css).toContain(".arcade-visual-root.phase-adventure .arcade-stage");
    expect(css).not.toMatch(/transition:\s*all/);
  });

  test("forms, images and async feedback keep their accessibility contracts", () => {
    const app = source("ArcadeApp.jsx");
    const ui = source("ArcadeGameUi.jsx");
    expect(app).toContain('name="arcade-nickname"');
    expect(app).toContain('autoComplete="off"');
    expect(app).toContain("spellCheck={false}");
    expect(app).not.toContain("autoFocus");
    expect(app).toContain('role="status" aria-live="polite"');
    expect(app).toMatch(/<img[^>]+width="\d+"[^>]+height="\d+"/);
    expect(ui).toContain('width="42" height="42"');
    expect(app).toContain("lazy(() => import(");
  });
});
