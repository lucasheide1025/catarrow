// src/arcade/arcadeShare.test.js — 冒險戰績分享圖單元測試
import { gradeColors, drawArcadeShareCard, buildResultText, getArcadeUrl, getShareBlob, normalizeDossierMetrics, prepareShareBlob } from "./arcadeShare";

describe("normalizeDossierMetrics", () => {
  it("normalizes five radar axes and composite to 0..100 with safe fallback", () => {
    expect(normalizeDossierMetrics({ composite: 123, metrics: { accuracy: -4, stability: 72.4, average: 88, power: 105 } })).toEqual({
      composite: 100,
      radar: { accuracy: 0, stability: 72, average: 88, power: 100, exploration: 0 },
    });
    expect(normalizeDossierMetrics({})).toEqual({ composite: 0, radar: { accuracy: 0, stability: 0, average: 0, power: 0, exploration: 0 } });
  });
});

describe("gradeColors", () => {
  it("回傳 S/A/B/C 的徽章配色與標語", () => {
    const s = gradeColors("S");
    expect(s.bg).toBe("#f59e0b");
    expect(s.label).toBe("無傷大冒險！");
    expect(gradeColors("A").bg).toBe("#58a05f");
    expect(gradeColors("B").bg).toBe("#4f6bd6");
    expect(gradeColors("C").bg).toBe("#a8865a");
  });

  it("未知評價回傳 C 的預設配色", () => {
    expect(gradeColors("Z").bg).toBe("#a8865a");
  });
});

describe("buildResultText", () => {
  it("組出含評價、戰績與 QR 網址的分享文字", () => {
    const text = buildResultText({
      nickname: "胖胖",
      cat: { name: "哈吉" },
      dungeonName: "🌲 貓森遺跡",
      grade: "S",
      statsRows: [
        { icon: "👹", label: "擊敗怪物", value: 4 },
        { icon: "🎯", label: "X 內十", value: 48 },
      ],
    });
    expect(text).toContain("胖胖");
    expect(text).toContain("評價 S");
    expect(text).toContain("👹 擊敗怪物：4");
    expect(text).toContain("🎯 X 內十：48");
    expect(text).toContain(getArcadeUrl());
  });
});

describe("drawArcadeShareCard", () => {
  it("draws dossier title, composite, radar labels and three summaries", async () => {
    const texts = [];
    const gradient = { addColorStop: jest.fn() };
    const ctx = new Proxy({
      createLinearGradient: jest.fn(() => gradient),
      fillText: jest.fn((text) => texts.push(String(text))),
    }, { get(target, key) { return key in target ? target[key] : jest.fn(); }, set(target, key, value) { target[key] = value; return true; } });
    const canvas = { getContext: () => ctx, width: 0, height: 0 };
    await drawArcadeShareCard(canvas, {
      nickname: "胖胖", cat: { name: "哈吉" }, dungeonName: "貓森遺跡", grade: "S", composite: 91,
      metrics: { accuracy: 90, stability: 80, average: 70, power: 60, exploration: 50 },
      statsRows: [{ icon: "👹", label: "擊敗", value: 4 }, { icon: "💥", label: "火力", value: 88 }, { icon: "🎯", label: "X", value: 9 }],
    });
    expect(canvas).toMatchObject({ width: 1080, height: 1620 });
    expect(texts).toEqual(expect.arrayContaining(["CAT ARCHERY DOSSIER", "91", "命中 90", "穩定 80", "👹 擊敗"]));
  });

  it("canvas 環境不支援 2D context 時安全返回（不拋錯）", async () => {
    const canvas = document.createElement("canvas");
    canvas.getContext = () => null; // jsdom 沒有 canvas 2D
    await expect(
      drawArcadeShareCard(canvas, {
        nickname: "胖胖",
        cat: { name: "哈吉", image: "/cats/haji.webp" },
        dungeonName: "🌲 貓森遺跡",
        grade: "S",
        statsRows: [{ icon: "👹", label: "擊敗怪物", value: 12 }],
      })
    ).resolves.toBeUndefined();
  });
});

describe("share blob cache", () => {
  it("scopes prepared PNG blobs to their source canvas", async () => {
    const firstBlob = new Blob(["first"], { type: "image/png" });
    const secondBlob = new Blob(["second"], { type: "image/png" });
    const first = { toBlob: (cb) => cb(firstBlob) };
    const second = { toBlob: (cb) => cb(secondBlob) };
    await prepareShareBlob(first);
    await prepareShareBlob(second);
    await expect(getShareBlob(first)).resolves.toBe(firstBlob);
    await expect(getShareBlob(second)).resolves.toBe(secondBlob);
  });
});
