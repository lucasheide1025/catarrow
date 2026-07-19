// src/lib/worldBossSkillData.js — 24 隻世界王 R2 強攻／R4 終結技資料（PRD 17/22-26 逐條落地）
// 倍率：教練＋貓王(prime) 1.6x/2.2x;六族 12 王(family) 1.3x/1.8x。
// 結算全部走 worldBossStrikeEngine.resolveWorldBossStrike;此檔只有資料,零邏輯分支。
//
// status.effect 詞彙（沿用 monsterAbilityCatalog 風格）：
//   atkDownPct   玩家 ATK 降低 X%（下一回合）
//   defDownPct   玩家 DEF 降低 X%（下一回合）
//   healDownPct  玩家下一回合藥水/睡飽/治療貓回復量 -X%
//   dealtDownPct 玩家下一回合對世界王傷害 -X%（個人屏障,不影響全服 HP,PRD 24）
//   dotMaxHpPct  最大 HP X% 毒傷（PRD 26 蜈蚣蜂王;毒不致死由呼叫端保底）
// 命中副效果（直接寫在技能上,由引擎縮放/結算）：
//   armorPiercePct  無視玩家 X% 防禦/減傷
//   shieldPiercePct 無視玩家 X% 護盾
//   hits            純演出段數（哈吉2段/YUMI3段,合計傷害不變,PRD 23/25）

import {
  WB_STRIKE_MULTIPLIER, WB_FINISHER_MULTIPLIER,
  WB_FAMILY_STRIKE_MULTIPLIER, WB_FAMILY_FINISHER_MULTIPLIER,
} from "./worldBossStrikeEngine";

const status = (effect, name, strength, duration = 1) => ({ id: effect, name, effect, strength, duration });

function mkR2(bossKey, cls, name, { effectText = "", ...opts } = {}) {
  return {
    skillId: `wb_${bossKey}_strike`,
    name,
    baseMultiplier: cls === "family" ? WB_FAMILY_STRIKE_MULTIPLIER : WB_STRIKE_MULTIPLIER,
    canKnockOut: false, // PRD 17：R2 不可擊倒,最低保 1 HP
    status: null,
    counterText: `本回合射出高分就能削弱「${name}」，85% 以上完全破解${effectText ? `，還能擋下${effectText}` : ""}！`,
    ...opts,
  };
}

function mkR4(bossKey, cls, name, opts = {}) {
  return {
    skillId: `wb_${bossKey}_finisher`,
    name,
    baseMultiplier: cls === "family" ? WB_FAMILY_FINISHER_MULTIPLIER : WB_FINISHER_MULTIPLIER,
    canKnockOut: true,  // PRD 18：R4 可擊倒;倒地後睡飽不可復活
    status: null,       // PRD 20/25/26：終結技一律不追加異常
    counterText: `全力以赴！「${name}」威力極強，85% 以上得分可完全破解、毫髮無傷！`,
    ...opts,
  };
}

// bossKey → { bossClass, color, r2Strike, r4Finisher }
export const WORLD_BOSS_SKILLS = Object.freeze({
  // ── 教練系列（PRD 25）────────────────────────────────
  head_coach: {
    bossClass: "prime", color: "#f59e0b",
    r2Strike: mkR2("head_coach", "prime", "弓聖威壓", {
      status: status("atkDownPct", "威壓", 20), effectText: "下一回合 ATK-20%",
    }),
    r4Finisher: mkR4("head_coach", "prime", "天地一箭"),
  },
  wife: {
    bossClass: "prime", color: "#f0abfc",
    r2Strike: mkR2("wife", "prime", "弓后破陣箭", {
      armorPiercePct: 25, effectText: "無視 25% 防禦的穿透",
    }),
    r4Finisher: mkR4("wife", "prime", "隱世落星"),
  },
  yumi: {
    bossClass: "prime", color: "#6ee7b7",
    r2Strike: mkR2("yumi", "prime", "神速三連射", {
      hits: 3, shieldPiercePct: 20, effectText: "無視 20% 護盾的連射",
    }),
    r4Finisher: mkR4("yumi", "prime", "極限瞬射"),
  },

  // ── 攻擊型貓王（PRD 23）──────────────────────────────
  cat_haji: {
    bossClass: "prime", color: "#fdba74",
    r2Strike: mkR2("cat_haji", "prime", "夢遊連擊", { hits: 2 }),
    r4Finisher: mkR4("cat_haji", "prime", "夢遊大暴走"),
  },
  cat_baobao: {
    bossClass: "prime", color: "#fdba74",
    r2Strike: mkR2("cat_baobao", "prime", "弓袋衝撞", {
      armorPiercePct: 20, effectText: "無視 20% 防禦的衝撞",
    }),
    r4Finisher: mkR4("cat_baobao", "prime", "弓袋大衝鋒"),
  },
  cat_niuniu: {
    bossClass: "prime", color: "#fdba74",
    r2Strike: mkR2("cat_niuniu", "prime", "精準裁決", {
      shieldPiercePct: 30, effectText: "無視 30% 護盾的裁決",
    }),
    r4Finisher: mkR4("cat_niuniu", "prime", "最終裁決"),
  },

  // ── 治癒型貓王（PRD 22：改為輸出＋異常,不回全域 HP）──
  cat_meimei: {
    bossClass: "prime", color: "#fda4af",
    r2Strike: mkR2("cat_meimei", "prime", "柔步擾心", {
      status: status("atkDownPct", "擾心", 15), effectText: "下一回合 ATK-15%",
    }),
    r4Finisher: mkR4("cat_meimei", "prime", "月下終舞"),
  },
  cat_gege: {
    bossClass: "prime", color: "#fda4af",
    r2Strike: mkR2("cat_gege", "prime", "橘光破勢", {
      status: status("defDownPct", "破勢", 15), effectText: "下一回合 DEF-15%",
    }),
    r4Finisher: mkR4("cat_gege", "prime", "橘光極輝"),
  },
  cat_daming: {
    bossClass: "prime", color: "#fda4af",
    r2Strike: mkR2("cat_daming", "prime", "家長威壓", {
      status: status("healDownPct", "威壓", 30), effectText: "下一回合回復量-30%",
    }),
    r4Finisher: mkR4("cat_daming", "prime", "家法降臨"),
  },

  // ── 防禦型貓王（PRD 24：個人屏障,只修正個人出戰提交）──
  cat_youyou: {
    bossClass: "prime", color: "#fda4af",
    r2Strike: mkR2("cat_youyou", "prime", "鷹眼守勢", {
      status: status("dealtDownPct", "鷹眼屏障", 10), effectText: "下一回合對王傷害-10%",
    }),
    r4Finisher: mkR4("cat_youyou", "prime", "鷹眼終斷"),
  },
  cat_xiaoan: {
    bossClass: "prime", color: "#fda4af",
    r2Strike: mkR2("cat_xiaoan", "prime", "勇氣壁壘", {
      status: status("dealtDownPct", "勇氣屏障", 15), effectText: "下一回合對王傷害-15%",
    }),
    r4Finisher: mkR4("cat_xiaoan", "prime", "勇氣爆發"),
  },
  cat_diandian: {
    bossClass: "prime", color: "#fda4af",
    r2Strike: mkR2("cat_diandian", "prime", "暗影觀氣", {
      status: status("dealtDownPct", "暗影屏障", 20), effectText: "下一回合對王傷害-20%",
    }),
    r4Finisher: mkR4("cat_diandian", "prime", "暗影終獵"),
  },

  // ── 六族 12 王（PRD 26,1.3x/1.8x）────────────────────
  ghost_boss_small: {
    bossClass: "family", color: "#818cf8",
    r2Strike: mkR2("ghost_boss_small", "family", "夜霧牽引", {
      status: status("dealtDownPct", "夜霧", 5), effectText: "下一回合對王傷害-5%",
    }),
    r4Finisher: mkR4("ghost_boss_small", "family", "夜半影潮"),
  },
  ghost_boss: {
    bossClass: "family", color: "#818cf8",
    r2Strike: mkR2("ghost_boss", "family", "幽界裁決", {
      status: status("atkDownPct", "幽界", 10), effectText: "下一回合 ATK-10%",
    }),
    r4Finisher: mkR4("ghost_boss", "family", "幽冥王令"),
  },
  forest_boss_small: {
    bossClass: "family", color: "#86efac",
    r2Strike: mkR2("forest_boss_small", "family", "迷霧衝角", {
      status: status("defDownPct", "迷霧", 8), effectText: "下一回合 DEF-8%",
    }),
    r4Finisher: mkR4("forest_boss_small", "family", "迷霧奔襲"),
  },
  forest_boss: {
    bossClass: "family", color: "#86efac",
    r2Strike: mkR2("forest_boss", "family", "山神震岳", {
      shieldPiercePct: 10, effectText: "無視 10% 護盾的震擊",
    }),
    r4Finisher: mkR4("forest_boss", "family", "翠林天崩"),
  },
  poison_boss_small: {
    bossClass: "family", color: "#fcd34d",
    r2Strike: mkR2("poison_boss_small", "family", "百足毒針", {
      status: status("dotMaxHpPct", "蜂毒", 1), effectText: "最大 HP 1% 的毒",
    }),
    r4Finisher: mkR4("poison_boss_small", "family", "千足蜂暴"),
  },
  poison_boss: {
    bossClass: "family", color: "#fcd34d",
    r2Strike: mkR2("poison_boss", "family", "萬蟲毒雲", {
      status: status("healDownPct", "毒雲", 15), effectText: "下一回合治療-15%",
    }),
    r4Finisher: mkR4("poison_boss", "family", "萬蟲朝鳴"),
  },
  office_boss_small: {
    bossClass: "family", color: "#fca5a5",
    r2Strike: mkR2("office_boss_small", "family", "客訴追擊", {
      status: status("atkDownPct", "客訴", 8), effectText: "下一回合 ATK-8%",
    }),
    r4Finisher: mkR4("office_boss_small", "family", "終極客訴"),
  },
  office_boss: {
    bossClass: "family", color: "#fca5a5",
    r2Strike: mkR2("office_boss", "family", "永續加班", {
      status: status("dealtDownPct", "加班疲勞", 10), effectText: "下一回合對王傷害-10%",
    }),
    r4Finisher: mkR4("office_boss", "family", "永恆工時"),
  },
  exam_boss_small: {
    bossClass: "family", color: "#c4b5fd",
    r2Strike: mkR2("exam_boss_small", "family", "期末突襲", {
      status: status("defDownPct", "考前慌亂", 8), effectText: "下一回合 DEF-8%",
    }),
    r4Finisher: mkR4("exam_boss_small", "family", "期末總攻"),
  },
  exam_boss: {
    bossClass: "family", color: "#c4b5fd",
    r2Strike: mkR2("exam_boss", "family", "白卷壓力", {
      status: status("healDownPct", "白卷壓力", 15), effectText: "下一回合治療-15%",
    }),
    r4Finisher: mkR4("exam_boss", "family", "最終空白"),
  },
  western_boss_small: {
    bossClass: "family", color: "#4ade80",
    r2Strike: mkR2("western_boss_small", "family", "月影爪擊", {
      armorPiercePct: 10, effectText: "無視 10% 防禦的爪擊",
    }),
    r4Finisher: mkR4("western_boss_small", "family", "月輪追獵"),
  },
  western_boss: {
    bossClass: "family", color: "#4ade80",
    r2Strike: mkR2("western_boss", "family", "古龍吐息", {
      shieldPiercePct: 10, effectText: "無視 10% 護盾的吐息",
    }),
    r4Finisher: mkR4("western_boss", "family", "西境龍星"),
  },
});

export function getWorldBossSkillConfig(bossKey) {
  return WORLD_BOSS_SKILLS[bossKey] || null;
}
