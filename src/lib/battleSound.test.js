// src/lib/battleSound.test.js
// 單元測試：統一音效管理器的核心邏輯
//
// 覆蓋範圍：
//   - 模式切換（debug / live / toggle / 無效模式）
//   - localStorage 持久化（寫入、init 恢復）
//   - debug 模式輸出 console.log
//   - live 模式不拋錯
//   - SOUND_DEFS 完整性（所有 ID 可播放不拋錯）
//   - createBattleSoundInstance 實例隔離
//   - 無效 soundId 不拋錯

import {
  playBattleSound,
  setBattleSoundMode,
  getBattleSoundMode,
  toggleBattleSoundMode,
  initBattleSound,
  createBattleSoundInstance,
  SOUND_IDS,
} from "./battleSound";

const LS_KEY = "buff_battle_sound_mode";

// ── 模式切換 ──

describe("mode switching", () => {
  beforeEach(() => { localStorage.clear(); setBattleSoundMode("debug"); });

  test("default mode is debug", () => {
    expect(getBattleSoundMode()).toBe("debug");
  });

  test("setBattleSoundMode('live') switches to live", () => {
    setBattleSoundMode("live");
    expect(getBattleSoundMode()).toBe("live");
  });

  test("setting invalid mode is ignored", () => {
    setBattleSoundMode("live");
    setBattleSoundMode("invalid_value");
    expect(getBattleSoundMode()).toBe("live");
  });

  test("toggleBattleSoundMode switches back and forth", () => {
    expect(getBattleSoundMode()).toBe("debug");
    toggleBattleSoundMode();
    expect(getBattleSoundMode()).toBe("live");
    toggleBattleSoundMode();
    expect(getBattleSoundMode()).toBe("debug");
  });
});

// ── localStorage 持久化 ──

describe("localStorage persistence", () => {
  beforeEach(() => { localStorage.clear(); setBattleSoundMode("debug"); });

  test("setBattleSoundMode writes to localStorage", () => {
    setBattleSoundMode("live");
    expect(localStorage.getItem(LS_KEY)).toBe("live");
  });

  test("setBattleSoundMode('debug') writes debug to localStorage", () => {
    setBattleSoundMode("debug");
    expect(localStorage.getItem(LS_KEY)).toBe("debug");
  });

  test("initBattleSound can be called multiple times without throwing", () => {
    expect(() => { initBattleSound(); }).not.toThrow();
  });
});

// ── debug 模式 ──

describe("playBattleSound in debug mode", () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(console, "log").mockImplementation(() => {});
    setBattleSoundMode("debug");
  });
  afterEach(() => { spy.mockRestore(); });

  test("calls console.log", () => {
    playBattleSound("victory_cheer", {});
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[SOUND]"));
  });

  test("includes context data in log", () => {
    playBattleSound("arrow_hit", { arrowIdx: 1, score: "X", dmg: 78 });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("X"));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("78"));
  });
});

// ── live 模式 ──

describe("playBattleSound in live mode", () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(console, "log").mockImplementation(() => {});
    setBattleSoundMode("live");
  });
  afterEach(() => { spy.mockRestore(); });

  test("does NOT call console.log", () => {
    playBattleSound("victory_cheer", {});
    expect(spy).not.toHaveBeenCalled();
  });

  test("does not throw for any SOUND_IDS", () => {
    SOUND_IDS.forEach((id) => {
      expect(() => playBattleSound(id, {})).not.toThrow();
    });
  });
});

// ── SOUND_DEFS 完整性 ──

describe("SOUND_DEFS completeness", () => {
  test("all sound IDs play without error in debug mode", () => {
    setBattleSoundMode("debug");
    SOUND_IDS.forEach((id) => {
      expect(() => playBattleSound(id, {})).not.toThrow();
    });
  });

  test("all sound IDs play without error in live mode", () => {
    setBattleSoundMode("live");
    SOUND_IDS.forEach((id) => {
      expect(() => playBattleSound(id, {})).not.toThrow();
    });
  });

  test("SOUND_IDS is non-empty array", () => {
    expect(Array.isArray(SOUND_IDS)).toBe(true);
    expect(SOUND_IDS.length).toBeGreaterThan(0);
    SOUND_IDS.forEach((id) => { expect(typeof id).toBe("string"); });
  });
});

// ── 無效 soundId ──

describe("invalid sound ID", () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    setBattleSoundMode("debug");
  });
  afterEach(() => { spy.mockRestore(); });

  test("calls console.warn", () => {
    playBattleSound("nonexistent_sound", {});
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test("does not throw", () => {
    expect(() => playBattleSound("nope", {})).not.toThrow();
  });
});

// ── createBattleSoundInstance 實例隔離 ──

describe("createBattleSoundInstance isolation", () => {
  let spy;
  beforeEach(() => {
    spy = jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => { spy.mockRestore(); });

  test("instance can be created with live mode", () => {
    const inst = createBattleSoundInstance("live");
    expect(inst.getBattleSoundMode()).toBe("live");
  });

  test("instance defaults to debug", () => {
    const inst = createBattleSoundInstance();
    expect(inst.getBattleSoundMode()).toBe("debug");
  });

  test("two instances have independent modes", () => {
    const a = createBattleSoundInstance("debug");
    const b = createBattleSoundInstance("debug");
    expect(a.getBattleSoundMode()).toBe("debug");
    expect(b.getBattleSoundMode()).toBe("debug");
    a.toggleBattleSoundMode();
    expect(a.getBattleSoundMode()).toBe("live");
    expect(b.getBattleSoundMode()).toBe("debug");
  });

  test("instance debug mode calls console.log", () => {
    const inst = createBattleSoundInstance("debug");
    inst.playBattleSound("victory_cheer", {});
    expect(spy).toHaveBeenCalled();
  });

  test("instance live mode does not call console.log", () => {
    const inst = createBattleSoundInstance("live");
    inst.playBattleSound("victory_cheer", {});
    expect(spy).not.toHaveBeenCalled();
  });

  test("instance toggle switches mode", () => {
    const inst = createBattleSoundInstance("debug");
    inst.toggleBattleSoundMode();
    expect(inst.getBattleSoundMode()).toBe("live");
    inst.toggleBattleSoundMode();
    expect(inst.getBattleSoundMode()).toBe("debug");
  });

  test("instance rejects invalid mode", () => {
    const inst = createBattleSoundInstance("debug");
    inst.setBattleSoundMode("invalid");
    expect(inst.getBattleSoundMode()).toBe("debug");
  });

  test("instance handles unknown sound ID", () => {
    const inst = createBattleSoundInstance("debug");
    expect(() => inst.playBattleSound("non_existent", {})).not.toThrow();
  });
});

// ── initBattleSound ──

describe("initBattleSound", () => {
  beforeEach(() => { localStorage.clear(); setBattleSoundMode("debug"); });

  test("can be called twice without throwing", () => {
    initBattleSound();
    expect(() => initBattleSound()).not.toThrow();
  });

  test("module-level playback works after init", () => {
    setBattleSoundMode("debug");
    expect(() => playBattleSound("victory_cheer", {})).not.toThrow();
  });
});

// ── SOUND_IDS 包含關鍵 ID ──

describe("SOUND_IDS covers expected IDs", () => {
  test("includes core narrative IDs", () => {
    ["arrow_hit", "victory_cheer", "soft_fail", "monster_counter"].forEach(
      (id) => expect(SOUND_IDS).toContain(id)
    );
  });

  test("includes battle_intro and monster_death", () => {
    expect(SOUND_IDS).toContain("battle_intro");
    expect(SOUND_IDS).toContain("monster_death");
  });

  test("total count is 12", () => {
    expect(SOUND_IDS.length).toBe(12);
  });
});
