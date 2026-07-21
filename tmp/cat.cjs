var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/lib/monsterExpansionCatalog.js
var monsterExpansionCatalog_exports = {};
__export(monsterExpansionCatalog_exports, {
  EXPANSION_CARDS: () => EXPANSION_CARDS,
  EXPANSION_MATERIALS: () => EXPANSION_MATERIALS,
  EXPANSION_MONSTERS: () => EXPANSION_MONSTERS,
  EXPANSION_MONSTER_BY_ID: () => EXPANSION_MONSTER_BY_ID,
  MONSTER_EXPANSION_VERSION: () => MONSTER_EXPANSION_VERSION,
  validateMonsterExpansionCatalog: () => validateMonsterExpansionCatalog
});
module.exports = __toCommonJS(monsterExpansionCatalog_exports);

// src/data/monsterExpansionCatalog.json
var monsterExpansionCatalog_default = {
  version: 1,
  monsters: [
    {
      id: "ghost_t1_normal_a",
      family: "ghost",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalA",
      name: "\u63D0\u71C8\u5C0F\u9748",
      title: null,
      hp: 200,
      atk: 16,
      def: 11,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t1_normal_a",
      signatureName: "\u5F15\u71C8\u9583\u8EAB",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u5F15\u71C8\u9583\u8EAB\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u547D\u4E2D\u5F8C\u73A9\u5BB6 ATK-5% 1\u56DE\u5408",
      counterSummary: "\u5C04\u5411\u71C8\u5149\uFF0C70% \u4EE5\u4E0A\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "mat_ghost_t1_normal_a",
        name: "\u5FAE\u5149\u71C8\u82AF",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "ghost_t1_normal_a",
        artKey: "ghost_t1_normal_a"
      },
      artKey: "ghost_t1_normal_a"
    },
    {
      id: "ghost_1",
      family: "ghost",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalExisting",
      name: "\u597D\u5144\u5F1F",
      title: null,
      hp: 250,
      atk: 20,
      def: 14,
      passive: false,
      existing: true,
      signatureSkillId: "sig_ghost_1",
      signatureName: "\u4F9B\u54C1\u5206\u4EAB",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u4F9B\u54C1\u5206\u4EAB\uFF1A\u7121\u50B7\u5BB3\uFF1B\u81EA\u8EAB\u8B77\u76FE=\u6700\u5927HP 5%",
      counterSummary: "\u64CA\u4E2D\u4F9B\u54C1\u5149\u9EDE\u53EF\u7834\u76FE",
      material: {
        id: "ghost_m1",
        name: "\u8DEF\u908A\u4F9B\u54C1",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "ghost_1",
        artKey: "ghost_1"
      },
      artKey: "ghost_1"
    },
    {
      id: "ghost_t1_normal_b",
      family: "ghost",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalB",
      name: "\u661F\u9727\u5B88\u885B",
      title: null,
      hp: 300,
      atk: 24,
      def: 17,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t1_normal_b",
      signatureName: "\u661F\u9727\u63A8\u9032",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u661F\u9727\u63A8\u9032\uFF1A\u57FA\u6E96\u50B7\u5BB3",
      counterSummary: "\u661F\u9727\u805A\u6210\u7BAD\u982D\u6642\u5C04\u6563",
      material: {
        id: "mat_ghost_t1_normal_b",
        name: "\u661F\u9727\u5FBD\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "ghost_t1_normal_b",
        artKey: "ghost_t1_normal_b"
      },
      artKey: "ghost_t1_normal_b"
    },
    {
      id: "ghost_t1_mini_a",
      family: "ghost",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE1\u591C\u71C8\u7AE5",
      title: null,
      hp: 325,
      atk: 30,
      def: 18,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t1_mini_a",
      signatureName: "\u5C0E\u5149\u7A81\u9032",
      commonSkillIds: [
        "common_charge",
        "common_weakpoint"
      ],
      signatureSummary: "\u5C0E\u5149\u7A81\u9032\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u8FFD\u6E96\u79FB\u52D5\u71C8\u6A19\u53EF\u524A\u5F31\u7A81\u9032",
      material: {
        id: "mat_ghost_t1_mini_a",
        name: "\u5DE1\u591C\u71C8\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t1_mini_a",
        artKey: "ghost_t1_mini_a"
      },
      artKey: "ghost_t1_mini_a"
    },
    {
      id: "ghost_t1_mini_b",
      family: "ghost",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u521D\u968E\u5F71\u885B",
      title: null,
      hp: 375,
      atk: 26,
      def: 21,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t1_mini_b",
      signatureName: "\u9727\u6B65\u5C01\u8DEF",
      commonSkillIds: [
        "common_armor",
        "common_weaken"
      ],
      signatureSummary: "\u9727\u6B65\u5C01\u8DEF\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u6253\u4EAE\u9727\u4E2D\u4E09\u500B\u8DB3\u5370",
      material: {
        id: "mat_ghost_t1_mini_b",
        name: "\u5F71\u885B\u62AB\u7247",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t1_mini_b",
        artKey: "ghost_t1_mini_b"
      },
      artKey: "ghost_t1_mini_b"
    },
    {
      id: "ghost_t1_boss",
      family: "ghost",
      tier: "common",
      tierIndex: 1,
      encounter: "boss",
      role: "boss",
      name: "\u93AE\u754C\u9748\u5C07\u30FB\u521D\u9663",
      title: null,
      hp: 425,
      atk: 30,
      def: 22,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t1_boss",
      signatureName: "\u93AE\u754C\u5149\u9663",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u93AE\u754C\u5149\u9663\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u81EA\u8EAB\u8B77\u76FE5%",
      counterSummary: "\u64CA\u7834\u4E09\u679A\u5149\u5370\uFF1B70% HP\u8B77\u76FE\u91CF+2%\uFF0C40% HP\u6280\u80FD\u50B7\u5BB3+5%",
      material: {
        id: "mat_ghost_t1_boss",
        name: "\u93AE\u754C\u4EE4\u788E\u7247",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t1_boss",
        artKey: "ghost_t1_boss"
      },
      artKey: "ghost_t1_boss"
    },
    {
      id: "ghost_t2_normal_a",
      family: "ghost",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalA",
      name: "\u8FF7\u9014\u7D19\u8776",
      title: null,
      hp: 320,
      atk: 28,
      def: 19,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t2_normal_a",
      signatureName: "\u56DE\u5149\u5F15\u8DEF",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u56DE\u5149\u5F15\u8DEF\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u4E0B\u6B21\u9AD8\u54C1\u8CEA\u7BAD\u50B7\u5BB3+10%",
      counterSummary: "70% \u4EE5\u4E0A\u540C\u6642\u53D6\u6D88\u602A\u7269\u4E0B\u6B21\u53CD\u64CA\u589E\u5E45",
      material: {
        id: "mat_ghost_t2_normal_a",
        name: "\u7D19\u8776\u9C57\u7C89",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "ghost_t2_normal_a",
        artKey: "ghost_t2_normal_a"
      },
      artKey: "ghost_t2_normal_a"
    },
    {
      id: "ghost_2",
      family: "ghost",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalExisting",
      name: "\u9B54\u795E\u4ED4",
      title: null,
      hp: 400,
      atk: 35,
      def: 24,
      passive: false,
      existing: true,
      signatureSkillId: "sig_ghost_2",
      signatureName: "\u8FF7\u9727\u7E5E\u8DEF",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u8FF7\u9727\u7E5E\u8DEF\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u547D\u4E2D\u9727\u4E2D\u8DEF\u6A19\u53EF\u6E05\u9664\u5F31\u5316",
      material: {
        id: "ghost_m2",
        name: "\u9B54\u795E\u4ED4\u8FF7\u9727",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "ghost_2",
        artKey: "ghost_2"
      },
      artKey: "ghost_2"
    },
    {
      id: "ghost_t2_normal_b",
      family: "ghost",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalB",
      name: "\u9748\u8DEF\u5DE1\u885B",
      title: null,
      hp: 480,
      atk: 42,
      def: 29,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t2_normal_b",
      signatureName: "\u8FF4\u5ECA\u5C01\u9396",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u8FF4\u5ECA\u5C01\u9396\uFF1A\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u4F9D\u5E8F\u64CA\u4E2D\u767C\u4EAE\u9580\u6846",
      material: {
        id: "mat_ghost_t2_normal_b",
        name: "\u9748\u8DEF\u5FBD\u7AE0",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "ghost_t2_normal_b",
        artKey: "ghost_t2_normal_b"
      },
      artKey: "ghost_t2_normal_b"
    },
    {
      id: "ghost_t2_mini_a",
      family: "ghost",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE1\u591C\u71C8\u4F7F",
      title: null,
      hp: 520,
      atk: 53,
      def: 31,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t2_mini_a",
      signatureName: "\u5F15\u71C8\u8FFD\u5F71",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u5F15\u71C8\u8FFD\u5F71\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u5169\u500B\u71C8\u6A19\u5404\u9700\u4E00\u6B21\u6709\u6548\u547D\u4E2D",
      material: {
        id: "mat_ghost_t2_mini_a",
        name: "\u9577\u660E\u71C8\u82AF",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t2_mini_a",
        artKey: "ghost_t2_mini_a"
      },
      artKey: "ghost_t2_mini_a"
    },
    {
      id: "ghost_t2_mini_b",
      family: "ghost",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u9727\u884C\u5F71\u885B",
      title: null,
      hp: 600,
      atk: 46,
      def: 36,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t2_mini_b",
      signatureName: "\u9727\u884C\u622A\u6B65",
      commonSkillIds: [
        "common_armor",
        "common_weaken"
      ],
      signatureSummary: "\u9727\u884C\u622A\u6B65\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u9727\u6563\u524D\u905470%\u53EF\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_ghost_t2_mini_b",
        name: "\u9727\u884C\u62AB\u98A8",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t2_mini_b",
        artKey: "ghost_t2_mini_b"
      },
      artKey: "ghost_t2_mini_b"
    },
    {
      id: "ghost_t2_boss",
      family: "ghost",
      tier: "rare",
      tierIndex: 2,
      encounter: "boss",
      role: "boss",
      name: "\u93AE\u754C\u9748\u5C07\u30FB\u5DE1\u5883",
      title: null,
      hp: 680,
      atk: 53,
      def: 38,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t2_boss",
      signatureName: "\u56DB\u65B9\u5DE1\u754C",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u56DB\u65B9\u5DE1\u754C\uFF1A\u5927\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE10%",
      counterSummary: "\u56DB\u65B9\u5149\u5370\u9010\u4E00\u4EAE\u8D77\uFF1B70% HP\u6E1B\u50B7+5%\uFF0C40% HP\u7121\u8996\u8B77\u76FE\u518D+5%",
      material: {
        id: "mat_ghost_t2_boss",
        name: "\u5DE1\u5883\u4EE4\u724C",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t2_boss",
        artKey: "ghost_t2_boss"
      },
      artKey: "ghost_t2_boss"
    },
    {
      id: "ghost_t3_normal_a",
      family: "ghost",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalA",
      name: "\u6797\u5149\u82B1\u9748",
      title: null,
      hp: 520,
      atk: 44,
      def: 32,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t3_normal_a",
      signatureName: "\u82B1\u9727\u65CB\u821E",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u82B1\u9727\u65CB\u821E\uFF1A\u57FA\u6E96\xD70.9\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u82B1\u74E3\u4E2D\u5FC3\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mat_ghost_t3_normal_a",
        name: "\u6797\u5149\u82B1\u74E3",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "ghost_t3_normal_a",
        artKey: "ghost_t3_normal_a"
      },
      artKey: "ghost_t3_normal_a"
    },
    {
      id: "ghost_3",
      family: "ghost",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalExisting",
      name: "\u6797\u6295\u59D0",
      title: null,
      hp: 650,
      atk: 55,
      def: 40,
      passive: false,
      existing: true,
      signatureSkillId: "sig_ghost_3",
      signatureName: "\u6797\u6295\u8449\u9663",
      commonSkillIds: [
        "common_poison"
      ],
      signatureSummary: "\u6797\u6295\u8449\u9663\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96",
      counterSummary: "\u5169\u7247\u8449\u6A19\u7686\u9054\u6709\u6548\u54C1\u8CEA\u53EF\u5927\u5E45\u524A\u5F31",
      material: {
        id: "ghost_m3",
        name: "\u6797\u6295\u8449",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "ghost_3",
        artKey: "ghost_3"
      },
      artKey: "ghost_3"
    },
    {
      id: "ghost_t3_normal_b",
      family: "ghost",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalB",
      name: "\u9752\u8449\u5F71\u4F8D",
      title: null,
      hp: 780,
      atk: 66,
      def: 48,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t3_normal_b",
      signatureName: "\u8449\u5F71\u9023\u65AC",
      commonSkillIds: [
        "common_shock"
      ],
      signatureSummary: "\u8449\u5F71\u9023\u65AC\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.05",
      counterSummary: "\u9023\u7E8C\u9AD8\u54C1\u8CEA\u547D\u4E2D\u53EF\u5207\u65B7\u7B2C\u4E8C\u6BB5",
      material: {
        id: "mat_ghost_t3_normal_b",
        name: "\u9752\u8449\u8B77\u7B26",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "ghost_t3_normal_b",
        artKey: "ghost_t3_normal_b"
      },
      artKey: "ghost_t3_normal_b"
    },
    {
      id: "ghost_t3_mini_a",
      family: "ghost",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE1\u591C\u71C8\u885B",
      title: null,
      hp: 845,
      atk: 83,
      def: 52,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t3_mini_a",
      signatureName: "\u767E\u71C8\u8B77\u884C",
      commonSkillIds: [
        "common_charge",
        "common_cleanse"
      ],
      signatureSummary: "\u767E\u71C8\u8B77\u884C\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u81EA\u8EAB\u8B77\u76FE7%",
      counterSummary: "\u71C8\u5217\u5B8C\u6210\u524D\u905470%\u53EF\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_ghost_t3_mini_a",
        name: "\u9748\u6797\u71C8\u7F69",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t3_mini_a",
        artKey: "ghost_t3_mini_a"
      },
      artKey: "ghost_t3_mini_a"
    },
    {
      id: "ghost_t3_mini_b",
      family: "ghost",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u9752\u8449\u5F71\u885B",
      title: null,
      hp: 975,
      atk: 72,
      def: 60,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t3_mini_b",
      signatureName: "\u9752\u5F71\u5C01\u5F91",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u9752\u5F71\u5C01\u5F91\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u9752\u8449\u7B26\u5370\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mat_ghost_t3_mini_b",
        name: "\u5F71\u8449\u80A9\u7532",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t3_mini_b",
        artKey: "ghost_t3_mini_b"
      },
      artKey: "ghost_t3_mini_b"
    },
    {
      id: "ghost_t3_boss",
      family: "ghost",
      tier: "elite",
      tierIndex: 3,
      encounter: "boss",
      role: "boss",
      name: "\u93AE\u754C\u9748\u5C07\u30FB\u68EE\u7F85",
      title: null,
      hp: 1105,
      atk: 83,
      def: 64,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t3_boss",
      signatureName: "\u68EE\u7F85\u5217\u9663",
      commonSkillIds: [
        "common_reflect",
        "common_cleanse"
      ],
      signatureSummary: "\u68EE\u7F85\u5217\u9663\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u7834\u89E3\u4E2D\u592E\u4EE4\u65D7\uFF1B70% HP\u7372\u4E00\u6B215%\u8B77\u76FE\uFF0C40% HP\u591A\u6BB5\u7E3D\u50B7+5%",
      material: {
        id: "mat_ghost_t3_boss",
        name: "\u68EE\u7F85\u4EE4\u65D7",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t3_boss",
        artKey: "ghost_t3_boss"
      },
      artKey: "ghost_t3_boss"
    },
    {
      id: "ghost_t4_normal_a",
      family: "ghost",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalA",
      name: "\u5224\u7C3F\u66F8\u9748",
      title: null,
      hp: 800,
      atk: 66,
      def: 54,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t4_normal_a",
      signatureName: "\u58A8\u4EE4\u98DB\u5377",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u58A8\u4EE4\u98DB\u5377\uFF1A\u57FA\u6E96\uFF0BATK-8% 1\u56DE\u5408",
      counterSummary: "\u5C04\u4E2D\u58A8\u5B57\u800C\u975E\u5377\u8EF8\u908A\u7DE3",
      material: {
        id: "mat_ghost_t4_normal_a",
        name: "\u5224\u7C3F\u58A8\u6676",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "ghost_t4_normal_a",
        artKey: "ghost_t4_normal_a"
      },
      artKey: "ghost_t4_normal_a"
    },
    {
      id: "ghost_4",
      family: "ghost",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalExisting",
      name: "\u57CE\u968D\u723A",
      title: null,
      hp: 1e3,
      atk: 82,
      def: 68,
      passive: false,
      existing: true,
      signatureSkillId: "sig_ghost_4",
      signatureName: "\u57CE\u968D\u5224\u4EE4",
      commonSkillIds: [
        "common_stance"
      ],
      signatureSummary: "\u57CE\u968D\u5224\u4EE4\uFF1A\u57FA\u6E96\uFF0B\u6307\u5B9A9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5B8C\u6210\u5247\u672C\u56DE\u5408\u73A9\u5BB6\u50B7\u5BB3+10%",
      counterSummary: "9\u5206\u4EE5\u4E0A\u7BAD\u6578\u9054\u672C\u56DE\u5408\u4E00\u534A\u5373\u7834\u89E3",
      material: {
        id: "ghost_m4",
        name: "\u751F\u6B7B\u7C3F\u788E\u9801",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "ghost_4",
        artKey: "ghost_4"
      },
      artKey: "ghost_4"
    },
    {
      id: "ghost_t4_normal_b",
      family: "ghost",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalB",
      name: "\u93AE\u8857\u9748\u5DEE",
      title: null,
      hp: 1200,
      atk: 98,
      def: 82,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t4_normal_b",
      signatureName: "\u5DE1\u754C\u559D\u6B62",
      commonSkillIds: [
        "common_shock"
      ],
      signatureSummary: "\u5DE1\u754C\u559D\u6B62\uFF1A\u57FA\u6E96\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u53E3\u4EE4\u5149\u5708\u6536\u675F\u524D\u905470%",
      material: {
        id: "mat_ghost_t4_normal_b",
        name: "\u93AE\u8857\u8170\u724C",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "ghost_t4_normal_b",
        artKey: "ghost_t4_normal_b"
      },
      artKey: "ghost_t4_normal_b"
    },
    {
      id: "ghost_t4_mini_a",
      family: "ghost",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE1\u591C\u53F8\u71C8\u5B98",
      title: null,
      hp: 1300,
      atk: 123,
      def: 88,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t4_mini_a",
      signatureName: "\u842C\u6236\u9EDE\u71C8",
      commonSkillIds: [
        "common_charge",
        "common_cleanse"
      ],
      signatureSummary: "\u842C\u6236\u9EDE\u71C8\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u6BCF\u76DE\u71C8\u5C0D\u61C9\u4E00\u6BB5\uFF0C\u54C1\u8CEA\u8D8A\u9AD8\u53D6\u6D88\u8D8A\u591A\u6BB5",
      material: {
        id: "mat_ghost_t4_mini_a",
        name: "\u53F8\u71C8\u5B98\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t4_mini_a",
        artKey: "ghost_t4_mini_a"
      },
      artKey: "ghost_t4_mini_a"
    },
    {
      id: "ghost_t4_mini_b",
      family: "ghost",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5224\u754C\u5F71\u885B",
      title: null,
      hp: 1500,
      atk: 107,
      def: 102,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t4_mini_b",
      signatureName: "\u5F71\u4EE4\u9396\u9663",
      commonSkillIds: [
        "common_armor",
        "common_reflect"
      ],
      signatureSummary: "\u5F71\u4EE4\u9396\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-8% 2\u56DE\u5408",
      counterSummary: "\u5B8C\u6574\u7834\u89E3\u65AC\u65B7\u5F71\u9396\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_ghost_t4_mini_b",
        name: "\u5224\u754C\u81C2\u7532",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t4_mini_b",
        artKey: "ghost_t4_mini_b"
      },
      artKey: "ghost_t4_mini_b"
    },
    {
      id: "ghost_t4_boss",
      family: "ghost",
      tier: "fierce",
      tierIndex: 4,
      encounter: "boss",
      role: "boss",
      name: "\u93AE\u754C\u9748\u5C07\u30FB\u5224\u754C",
      title: null,
      hp: 1700,
      atk: 123,
      def: 109,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t4_boss",
      signatureName: "\u5929\u5E73\u88C1\u754C",
      commonSkillIds: [
        "common_reflect",
        "common_cleanse"
      ],
      signatureSummary: "\u5929\u5E73\u88C1\u754C\uFF1A\u5927\u738B\u57FA\u6E96\uFF1B\u8F03\u4F4E\u7684\u73A9\u5BB6ATK\u6216DEF\u518D-8% 1\u56DE\u5408",
      counterSummary: "\u8B93\u5DE6\u53F3\u5929\u5E73\u54C1\u8CEA\u5DEE\u226410%\uFF1B70% HP\u53CD\u5C04+3%\uFF0C40% HP\u72C0\u614B\u5E45\u5EA6+2%",
      material: {
        id: "mat_ghost_t4_boss",
        name: "\u5224\u754C\u91D1\u4EE4",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t4_boss",
        artKey: "ghost_t4_boss"
      },
      artKey: "ghost_t4_boss"
    },
    {
      id: "ghost_t5_normal_a",
      family: "ghost",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalA",
      name: "\u7FA9\u72AC\u71C8\u9748",
      title: null,
      hp: 1280,
      atk: 100,
      def: 84,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t5_normal_a",
      signatureName: "\u8B77\u4E3B\u8FFD\u5149",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u8B77\u4E3B\u8FFD\u5149\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u81EA\u8EAB\u8B77\u76FE7%",
      counterSummary: "\u5169\u6B219\u5206\u4EE5\u4E0A\u53EF\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_ghost_t5_normal_a",
        name: "\u5FE0\u7FA9\u71C8\u706B",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "ghost_t5_normal_a",
        artKey: "ghost_t5_normal_a"
      },
      artKey: "ghost_t5_normal_a"
    },
    {
      id: "ghost_5",
      family: "ghost",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5341\u516B\u738B\u516C",
      title: null,
      hp: 1600,
      atk: 125,
      def: 105,
      passive: false,
      existing: true,
      signatureSkillId: "sig_ghost_5",
      signatureName: "\u5FE0\u7FA9\u93AE\u5B88",
      commonSkillIds: [
        "common_stance"
      ],
      signatureSummary: "\u5FE0\u7FA9\u93AE\u5B88\uFF1A\u57FA\u6E96\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5FE0\u7FA9\u5FBD\u5370\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "ghost_m5",
        name: "\u7FA9\u72AC\u9B42\u9B44",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "ghost_5",
        artKey: "ghost_5"
      },
      artKey: "ghost_5"
    },
    {
      id: "ghost_t5_normal_b",
      family: "ghost",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalB",
      name: "\u9999\u706B\u795E\u885B",
      title: null,
      hp: 1920,
      atk: 150,
      def: 126,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t5_normal_b",
      signatureName: "\u9858\u706B\u8B77\u9663",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u9858\u706B\u8B77\u9663\uFF1A\u57FA\u6E96\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u64CA\u6563\u4E09\u7C07\u9858\u706B\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_ghost_t5_normal_b",
        name: "\u9999\u706B\u91D1\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "ghost_t5_normal_b",
        artKey: "ghost_t5_normal_b"
      },
      artKey: "ghost_t5_normal_b"
    },
    {
      id: "ghost_t5_mini_a",
      family: "ghost",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE1\u591C\u5929\u71C8\u5C07",
      title: null,
      hp: 2080,
      atk: 188,
      def: 137,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t5_mini_a",
      signatureName: "\u5929\u71C8\u7167\u591C",
      commonSkillIds: [
        "common_charge",
        "common_regen"
      ],
      signatureSummary: "\u5929\u71C8\u7167\u591C\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A615%",
      counterSummary: "\u5929\u71C8\u5347\u9802\u524D\u7D2F\u7A4D70%\u53EF\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_ghost_t5_mini_a",
        name: "\u5929\u71C8\u6230\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t5_mini_a",
        artKey: "ghost_t5_mini_a"
      },
      artKey: "ghost_t5_mini_a"
    },
    {
      id: "ghost_t5_mini_b",
      family: "ghost",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u9999\u706B\u5F71\u5C07",
      title: null,
      hp: 2400,
      atk: 163,
      def: 158,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t5_mini_b",
      signatureName: "\u842C\u9858\u5F71\u9663",
      commonSkillIds: [
        "common_reflect",
        "common_weaken"
      ],
      signatureSummary: "\u842C\u9858\u5F71\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u4F9D\u5E8F\u547D\u4E2D\u4E09\u679A\u9858\u5370",
      material: {
        id: "mat_ghost_t5_mini_b",
        name: "\u9858\u706B\u80A9\u93A7",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t5_mini_b",
        artKey: "ghost_t5_mini_b"
      },
      artKey: "ghost_t5_mini_b"
    },
    {
      id: "ghost_t5_boss",
      family: "ghost",
      tier: "boss",
      tierIndex: 5,
      encounter: "boss",
      role: "boss",
      name: "\u93AE\u754C\u9748\u5C07\u30FB\u738B\u4EE4",
      title: null,
      hp: 2720,
      atk: 188,
      def: 168,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t5_boss",
      signatureName: "\u738B\u4EE4\u93AE\u57DF",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u738B\u4EE4\u93AE\u57DF\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u64CA\u788E\u738B\u4EE4\u56DB\u89D2\uFF1B70% HP\u8B77\u76FE10%\uFF0C40% HP\u57FA\u6E96\u50B7\u5BB3+8%",
      material: {
        id: "mat_ghost_t5_boss",
        name: "\u738B\u4EE4\u7389\u724C",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t5_boss",
        artKey: "ghost_t5_boss"
      },
      artKey: "ghost_t5_boss"
    },
    {
      id: "ghost_t6_normal_a",
      family: "ghost",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalA",
      name: "\u8F2A\u8FF4\u661F\u4F7F",
      title: null,
      hp: 2e3,
      atk: 140,
      def: 124,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t6_normal_a",
      signatureName: "\u661F\u8F2A\u8FF4\u8F49",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u661F\u8F2A\u8FF4\u8F49\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\uFF0BDEF-10% 1\u56DE\u5408",
      counterSummary: "\u5169\u500B\u661F\u8F2A\u5404\u9700\u9AD8\u54C1\u8CEA\u547D\u4E2D",
      material: {
        id: "mat_ghost_t6_normal_a",
        name: "\u8F2A\u8FF4\u661F\u7802",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t6_normal_a",
        artKey: "ghost_t6_normal_a"
      },
      artKey: "ghost_t6_normal_a"
    },
    {
      id: "ghost_6",
      family: "ghost",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5730\u7344\u95BB\u7F85",
      title: null,
      hp: 2500,
      atk: 175,
      def: 155,
      passive: false,
      existing: true,
      signatureSkillId: "sig_ghost_6",
      signatureName: "\u95BB\u7F85\u88C1\u6C7A",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u5730\u5E9C\u8F2A\u8FF4\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.5\u65BC\u4E0B\u56DE\u5408",
      counterSummary: "\u986F\u793A\u4E00\u56DE\u5408\u5012\u6578\uFF1B\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u5EF6\u9072\u6BB5",
      material: {
        id: "ghost_m6",
        name: "\u95BB\u7F85\u4EE4\u724C",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_6",
        artKey: "ghost_6"
      },
      artKey: "ghost_6"
    },
    {
      id: "ghost_t6_normal_b",
      family: "ghost",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalB",
      name: "\u5E7D\u754C\u93AE\u5C07",
      title: null,
      hp: 3e3,
      atk: 210,
      def: 186,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t6_normal_b",
      signatureName: "\u516D\u9053\u93AE\u9663",
      commonSkillIds: [
        "common_shock"
      ],
      signatureSummary: "\u795E\u5370\u93AE\u754C\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE10%",
      counterSummary: "\u64CA\u4E2D\u795E\u5370\u6838\u5FC3\u53D6\u6D88\u7A7F\u76FE",
      material: {
        id: "mat_ghost_t6_normal_b",
        name: "\u5E7D\u754C\u6230\u5370",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t6_normal_b",
        artKey: "ghost_t6_normal_b"
      },
      artKey: "ghost_t6_normal_b"
    },
    {
      id: "ghost_t6_mini_a",
      family: "ghost",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE1\u591C\u5929\u71C8\u8056\u4F7F",
      title: null,
      hp: 3250,
      atk: 263,
      def: 202,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t6_mini_a",
      signatureName: "\u661F\u6D77\u9577\u660E",
      commonSkillIds: [
        "common_charge",
        "common_regen"
      ],
      signatureSummary: "\u5929\u71C8\u7167\u4E16\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.1",
      counterSummary: "\u4E09\u679A\u5929\u71C8\u4F9D\u547D\u4E2D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_ghost_t6_mini_a",
        name: "\u8056\u71C8\u6838\u5FC3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t6_mini_a",
        artKey: "ghost_t6_mini_a"
      },
      artKey: "ghost_t6_mini_a"
    },
    {
      id: "ghost_t6_mini_b",
      family: "ghost",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u661F\u9727\u5F71\u4FAF",
      title: null,
      hp: 3750,
      atk: 228,
      def: 233,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t6_mini_b",
      signatureName: "\u661F\u9727\u5C01\u5929",
      commonSkillIds: [
        "common_reflect",
        "common_cleanse"
      ],
      signatureSummary: "\u795E\u706B\u5F71\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BDEF-10% 2\u56DE\u5408",
      counterSummary: "\u795E\u706B\u74B0\u7E2E\u5C0F\u524D\u905470%",
      material: {
        id: "mat_ghost_t6_mini_b",
        name: "\u661F\u9727\u738B\u62AB",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t6_mini_b",
        artKey: "ghost_t6_mini_b"
      },
      artKey: "ghost_t6_mini_b"
    },
    {
      id: "ghost_t6_boss",
      family: "ghost",
      tier: "mythic",
      tierIndex: 6,
      encounter: "boss",
      role: "boss",
      name: "\u93AE\u754C\u9748\u5C07\u30FB\u8F2A\u8FF4",
      title: null,
      hp: 4250,
      atk: 263,
      def: 248,
      passive: false,
      existing: false,
      signatureSkillId: "sig_ghost_t6_boss",
      signatureName: "\u516D\u754C\u93AE\u661F",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u8F2A\u8FF4\u5929\u547D\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.6",
      counterSummary: "\u660E\u793A\u8F2A\u8FF4\u5012\u6578\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u5EF6\u9072\u6BB5+10%\uFF0C\u4ECD\u53EF\u5B8C\u6574\u7834\u89E3",
      material: {
        id: "mat_ghost_t6_boss",
        name: "\u8F2A\u8FF4\u738B\u4EE4",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "ghost_t6_boss",
        artKey: "ghost_t6_boss"
      },
      artKey: "ghost_t6_boss"
    },
    {
      id: "mountain_t1_normal_a",
      family: "mountain",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalA",
      name: "\u82D4\u89D2\u5E7C\u9748",
      title: null,
      hp: 216,
      atk: 14,
      def: 12,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t1_normal_a",
      signatureName: "\u82D4\u5F91\u8E8D\u6B65",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u82D4\u5F91\u8E8D\u6B65\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u81EA\u8EAB\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u82D4\u77F3\u843D\u9EDE\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_mountain_t1_normal_a",
        name: "\u9752\u82D4\u5C0F\u89D2",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "mountain_t1_normal_a",
        artKey: "mountain_t1_normal_a"
      },
      artKey: "mountain_t1_normal_a"
    },
    {
      id: "mountain_1",
      family: "mountain",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5C71\u8C6C\u7CBE",
      title: null,
      hp: 270,
      atk: 18,
      def: 15,
      passive: false,
      existing: true,
      signatureSkillId: "sig_mountain_1",
      signatureName: "\u5C71\u8C6C\u885D\u649E",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u5C71\u8C6C\u885D\u649E\uFF1A\u57FA\u6E96\u50B7\u5BB3",
      counterSummary: "\u885D\u649E\u7DDA\u4EAE\u8D77\u6642\u7D2F\u7A4D70%\u53EF\u5927\u5E45\u524A\u5F31",
      material: {
        id: "mountain_m1",
        name: "\u5C71\u8C6C\u7360\u7259",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "mountain_1",
        artKey: "mountain_1"
      },
      artKey: "mountain_1"
    },
    {
      id: "mountain_t1_normal_b",
      family: "mountain",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalB",
      name: "\u5C71\u5F91\u77F3\u885B",
      title: null,
      hp: 324,
      atk: 22,
      def: 18,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t1_normal_b",
      signatureName: "\u788E\u77F3\u63A8\u9032",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u788E\u77F3\u63A8\u9032\uFF1A\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u788E\u4E09\u9846\u767C\u4EAE\u788E\u77F3\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mat_mountain_t1_normal_b",
        name: "\u5C71\u5F91\u77F3\u724C",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "mountain_t1_normal_b",
        artKey: "mountain_t1_normal_b"
      },
      artKey: "mountain_t1_normal_b"
    },
    {
      id: "mountain_t1_mini_a",
      family: "mountain",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u77F3\u89D2\u5E7C\u885B",
      title: null,
      hp: 351,
      atk: 27,
      def: 20,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t1_mini_a",
      signatureName: "\u77F3\u89D2\u7A81\u9032",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u77F3\u89D2\u7A81\u9032\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u5C04\u4E2D\u77F3\u89D2\u5149\u9EDE\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_mountain_t1_mini_a",
        name: "\u77F3\u89D2\u8B77\u7247",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t1_mini_a",
        artKey: "mountain_t1_mini_a"
      },
      artKey: "mountain_t1_mini_a"
    },
    {
      id: "mountain_t1_mini_b",
      family: "mountain",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u68EE\u98A8\u5B78\u5F92",
      title: null,
      hp: 405,
      atk: 23,
      def: 23,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t1_mini_b",
      signatureName: "\u9010\u98A8\u9023\u5C04",
      commonSkillIds: [
        "common_armor",
        "common_weakpoint"
      ],
      signatureSummary: "\u9010\u98A8\u9023\u5C04\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u5169\u679A\u98A8\u7FBD\u5404\u5C0D\u61C9\u4E00\u6BB5\u653B\u64CA",
      material: {
        id: "mat_mountain_t1_mini_b",
        name: "\u68EE\u98A8\u7BAD\u7FBD",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t1_mini_b",
        artKey: "mountain_t1_mini_b"
      },
      artKey: "mountain_t1_mini_b"
    },
    {
      id: "mountain_t1_boss",
      family: "mountain",
      tier: "common",
      tierIndex: 1,
      encounter: "boss",
      role: "boss",
      name: "\u96F2\u5DBA\u9F8D\u738B\u30FB\u521D\u9192",
      title: null,
      hp: 459,
      atk: 27,
      def: 24,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t1_boss",
      signatureName: "\u5E7C\u9F8D\u9707\u8C37",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u5E7C\u9F8D\u9707\u8C37\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u5C71\u8C37\u5149\u74B0\u6536\u675F\u524D\u7834\u89E3\uFF1B70% HP\u8B77\u76FE+2%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_mountain_t1_boss",
        name: "\u521D\u9192\u96F2\u9C57",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t1_boss",
        artKey: "mountain_t1_boss"
      },
      artKey: "mountain_t1_boss"
    },
    {
      id: "mountain_t2_normal_a",
      family: "mountain",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalA",
      name: "\u6EAA\u8C37\u98A8\u86C7",
      title: null,
      hp: 346,
      atk: 26,
      def: 21,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t2_normal_a",
      signatureName: "\u6EAA\u98A8\u7E8F\u7E5E",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u6EAA\u98A8\u7E8F\u7E5E\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u5C04\u65B7\u5169\u9053\u6EAA\u98A8\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "mat_mountain_t2_normal_a",
        name: "\u6EAA\u98A8\u86C7\u9C57",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "mountain_t2_normal_a",
        artKey: "mountain_t2_normal_a"
      },
      artKey: "mountain_t2_normal_a"
    },
    {
      id: "mountain_2",
      family: "mountain",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalExisting",
      name: "\u767E\u6B65\u86C7\u738B",
      title: null,
      hp: 432,
      atk: 32,
      def: 26,
      passive: false,
      existing: true,
      signatureSkillId: "sig_mountain_2",
      signatureName: "\u767E\u6B65\u6BD2\u8972",
      commonSkillIds: [
        "common_poison"
      ],
      signatureSummary: "\u767E\u6B65\u6BD2\u8972\uFF1A\u57FA\u6E96\uFF0B\u6700\u5927HP 2%\u6BD2\u50B71\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u6BD2\u5149\u56CA\u53D6\u6D88\u6BD2\u50B7",
      material: {
        id: "mountain_m2",
        name: "\u767E\u6B65\u86C7\u6BD2\u56CA",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "mountain_2",
        artKey: "mountain_2"
      },
      artKey: "mountain_2"
    },
    {
      id: "mountain_t2_normal_b",
      family: "mountain",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalB",
      name: "\u5CA9\u7532\u5C71\u885B",
      title: null,
      hp: 518,
      atk: 38,
      def: 31,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t2_normal_b",
      signatureName: "\u5CA9\u58C1\u56FA\u5B88",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u5CA9\u58C1\u56FA\u5B88\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE=\u6700\u5927HP 5%\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5CA9\u58C1\u88C2\u7D0B\uFF1B\u4E0D\u5F97\u540C\u6642\u7372\u5F97\u56DE\u5FA9",
      material: {
        id: "mat_mountain_t2_normal_b",
        name: "\u5CA9\u7532\u80CC\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "mountain_t2_normal_b",
        artKey: "mountain_t2_normal_b"
      },
      artKey: "mountain_t2_normal_b"
    },
    {
      id: "mountain_t2_mini_a",
      family: "mountain",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u77F3\u89D2\u65A5\u5019",
      title: null,
      hp: 562,
      atk: 48,
      def: 34,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t2_mini_a",
      signatureName: "\u5CA9\u5F91\u8FFD\u64CA",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u5CA9\u5F91\u8FFD\u64CA\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u4F9D\u5E8F\u547D\u4E2D\u5169\u500B\u5CA9\u5F91\u6A19\u8A18",
      material: {
        id: "mat_mountain_t2_mini_a",
        name: "\u65A5\u5019\u89D2\u74B0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t2_mini_a",
        artKey: "mountain_t2_mini_a"
      },
      artKey: "mountain_t2_mini_a"
    },
    {
      id: "mountain_t2_mini_b",
      family: "mountain",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5DE1\u6797\u7375\u624B",
      title: null,
      hp: 648,
      atk: 42,
      def: 39,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t2_mini_b",
      signatureName: "\u6797\u9593\u9F4A\u5C04",
      commonSkillIds: [
        "common_armor",
        "common_weakpoint"
      ],
      signatureSummary: "\u6797\u9593\u9F4A\u5C04\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u5C04\u6563\u4E09\u679A\u98A8\u7FBD\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "mat_mountain_t2_mini_b",
        name: "\u5DE1\u6797\u7FBD\u98FE",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t2_mini_b",
        artKey: "mountain_t2_mini_b"
      },
      artKey: "mountain_t2_mini_b"
    },
    {
      id: "mountain_t2_boss",
      family: "mountain",
      tier: "rare",
      tierIndex: 2,
      encounter: "boss",
      role: "boss",
      name: "\u96F2\u5DBA\u9F8D\u738B\u30FB\u805A\u96F2",
      title: null,
      hp: 734,
      atk: 48,
      def: 42,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t2_boss",
      signatureName: "\u805A\u96F2\u5410\u606F",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u805A\u96F2\u5410\u606F\uFF1A\u5927\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE10%",
      counterSummary: "\u96F2\u5718\u4E2D\u5FC3\u4EAE\u8D77\u6642\u5C04\u6563\uFF1B70% HP\u6E1B\u50B7+5%\uFF0C40% HP\u7A7F\u76FE+5%",
      material: {
        id: "mat_mountain_t2_boss",
        name: "\u805A\u96F2\u9006\u9C57",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t2_boss",
        artKey: "mountain_t2_boss"
      },
      artKey: "mountain_t2_boss"
    },
    {
      id: "mountain_t3_normal_a",
      family: "mountain",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalA",
      name: "\u677E\u98A8\u72D0\u9748",
      title: null,
      hp: 562,
      atk: 41,
      def: 34,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t3_normal_a",
      signatureName: "\u677E\u5F71\u9583\u8EAB",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u677E\u5F71\u9583\u8EAB\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u547D\u4E2D\u771F\u6B63\u677E\u5F71\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_mountain_t3_normal_a",
        name: "\u677E\u98A8\u5C3E\u7FBD",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "mountain_t3_normal_a",
        artKey: "mountain_t3_normal_a"
      },
      artKey: "mountain_t3_normal_a"
    },
    {
      id: "mountain_3",
      family: "mountain",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5C71\u9B48",
      title: null,
      hp: 702,
      atk: 51,
      def: 43,
      passive: false,
      existing: true,
      signatureSkillId: "sig_mountain_3",
      signatureName: "\u5C71\u9B48\u5E7B\u6B65",
      commonSkillIds: [
        "common_stance"
      ],
      signatureSummary: "\u5C71\u9B48\u5E7B\u6B65\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96",
      counterSummary: "\u771F\u8EAB\u6A19\u8A18\u547D\u4E2D\u53EF\u53D6\u6D88\u7B2C\u4E8C\u6BB5",
      material: {
        id: "mountain_m3",
        name: "\u5C71\u9B48\u5E7B\u5F71\u77F3",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "mountain_3",
        artKey: "mountain_3"
      },
      artKey: "mountain_3"
    },
    {
      id: "mountain_t3_normal_b",
      family: "mountain",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalB",
      name: "\u53E4\u6728\u5B88\u885B",
      title: null,
      hp: 842,
      atk: 61,
      def: 52,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t3_normal_b",
      signatureName: "\u6839\u8108\u5C01\u8DEF",
      commonSkillIds: [
        "common_shock"
      ],
      signatureSummary: "\u6839\u8108\u5C01\u8DEF\uFF1A\u57FA\u6E96\xD70.9\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u4F9D\u5E8F\u547D\u4E2D\u4E09\u500B\u6839\u7BC0\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mat_mountain_t3_normal_b",
        name: "\u53E4\u6728\u5FC3\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "mountain_t3_normal_b",
        artKey: "mountain_t3_normal_b"
      },
      artKey: "mountain_t3_normal_b"
    },
    {
      id: "mountain_t3_mini_a",
      family: "mountain",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u77F3\u89D2\u6230\u885B",
      title: null,
      hp: 913,
      atk: 77,
      def: 56,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t3_mini_a",
      signatureName: "\u77F3\u89D2\u7834\u9663",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u77F3\u89D2\u7834\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A615%",
      counterSummary: "\u64CA\u4E2D\u89D2\u5C16\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_mountain_t3_mini_a",
        name: "\u6230\u885B\u77F3\u93A7",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t3_mini_a",
        artKey: "mountain_t3_mini_a"
      },
      artKey: "mountain_t3_mini_a"
    },
    {
      id: "mountain_t3_mini_b",
      family: "mountain",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u68EE\u8A9E\u7375\u5E2B",
      title: null,
      hp: 1053,
      atk: 66,
      def: 65,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t3_mini_b",
      signatureName: "\u68EE\u8A9E\u6A19\u8A18",
      commonSkillIds: [
        "common_weakpoint",
        "common_cleanse"
      ],
      signatureSummary: "\u68EE\u8A9E\u6A19\u8A18\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5931\u6557\u5247ATK-8% 1\u56DE\u5408",
      counterSummary: "\u7576\u56DE\u5408\u534A\u6578\u7BAD\u90549\u5206\u5373\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_mountain_t3_mini_b",
        name: "\u68EE\u8A9E\u5F26\u7DDA",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t3_mini_b",
        artKey: "mountain_t3_mini_b"
      },
      artKey: "mountain_t3_mini_b"
    },
    {
      id: "mountain_t3_boss",
      family: "mountain",
      tier: "elite",
      tierIndex: 3,
      encounter: "boss",
      role: "boss",
      name: "\u96F2\u5DBA\u9F8D\u738B\u30FB\u559A\u96E8",
      title: null,
      hp: 1193,
      atk: 77,
      def: 69,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t3_boss",
      signatureName: "\u96E8\u5E55\u9F8D\u606F",
      commonSkillIds: [
        "common_regen",
        "common_armor"
      ],
      signatureSummary: "\u96E8\u5E55\u9F8D\u606F\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BATK-8% 1\u56DE\u5408",
      counterSummary: "\u96E8\u5E55\u4E09\u8655\u4EAE\u9EDE\u53EF\u88AB\u5C04\u6563\uFF1B70% HP\u8B77\u76FE7%\uFF0C40% HP\u591A\u6BB5\u7E3D\u50B7+5%",
      material: {
        id: "mat_mountain_t3_boss",
        name: "\u559A\u96E8\u9F8D\u73E0",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t3_boss",
        artKey: "mountain_t3_boss"
      },
      artKey: "mountain_t3_boss"
    },
    {
      id: "mountain_t4_normal_a",
      family: "mountain",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalA",
      name: "\u96F2\u9727\u77F3\u7AE5",
      title: null,
      hp: 864,
      atk: 60,
      def: 58,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t4_normal_a",
      signatureName: "\u9727\u77F3\u7FFB\u6EFE",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u9727\u77F3\u7FFB\u6EFE\uFF1A\u57FA\u6E96\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u7FFB\u6EFE\u8ECC\u8DE1\u524D\u7AEF\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_mountain_t4_normal_a",
        name: "\u96F2\u9727\u77F3\u9234",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "mountain_t4_normal_a",
        artKey: "mountain_t4_normal_a"
      },
      artKey: "mountain_t4_normal_a"
    },
    {
      id: "mountain_4",
      family: "mountain",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalExisting",
      name: "\u9727\u793E\u5DE8\u4EBA",
      title: null,
      hp: 1080,
      atk: 75,
      def: 73,
      passive: false,
      existing: true,
      signatureSkillId: "sig_mountain_4",
      signatureName: "\u9727\u5DBA\u8E0F\u64CA",
      commonSkillIds: [
        "common_shock"
      ],
      signatureSummary: "\u9727\u5DBA\u8E0F\u64CA\uFF1A\u57FA\u6E96\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u9707\u6CE2\u62B5\u9054\u524D\u905470%\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mountain_m4",
        name: "\u9727\u793E\u5DE8\u77F3",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "mountain_4",
        artKey: "mountain_4"
      },
      artKey: "mountain_4"
    },
    {
      id: "mountain_t4_normal_b",
      family: "mountain",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalB",
      name: "\u5CF0\u810A\u5DE8\u885B",
      title: null,
      hp: 1296,
      atk: 90,
      def: 88,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t4_normal_b",
      signatureName: "\u5C71\u810A\u9707\u843D",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u5C71\u810A\u9707\u843D\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.4",
      counterSummary: "\u660E\u793A\u843D\u77F3\u4F4D\u7F6E\uFF1B\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u5EF6\u9072\u6BB5",
      material: {
        id: "mat_mountain_t4_normal_b",
        name: "\u5CF0\u810A\u80A9\u5CA9",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "mountain_t4_normal_b",
        artKey: "mountain_t4_normal_b"
      },
      artKey: "mountain_t4_normal_b"
    },
    {
      id: "mountain_t4_mini_a",
      family: "mountain",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u77F3\u89D2\u5C07\u8ECD",
      title: null,
      hp: 1404,
      atk: 113,
      def: 95,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t4_mini_a",
      signatureName: "\u5D29\u5CA9\u865F\u4EE4",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u5D29\u5CA9\u865F\u4EE4\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u4E09\u9762\u5CA9\u65D7\u5404\u9700\u6709\u6548\u547D\u4E2D",
      material: {
        id: "mat_mountain_t4_mini_a",
        name: "\u5C07\u8ECD\u5CA9\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t4_mini_a",
        artKey: "mountain_t4_mini_a"
      },
      artKey: "mountain_t4_mini_a"
    },
    {
      id: "mountain_t4_mini_b",
      family: "mountain",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u9727\u5CF0\u7375\u5C07",
      title: null,
      hp: 1620,
      atk: 98,
      def: 110,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t4_mini_b",
      signatureName: "\u7A7F\u9727\u72D9\u64CA",
      commonSkillIds: [
        "common_weakpoint",
        "common_cleanse"
      ],
      signatureSummary: "\u7A7F\u9727\u72D9\u64CA\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A615%",
      counterSummary: "\u9727\u4E2D\u7784\u6E96\u7DDA\u986F\u793A\uFF0C\u64CA\u4E2D\u5149\u9EDE\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_mountain_t4_mini_b",
        name: "\u9727\u5CF0\u7784\u5177",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t4_mini_b",
        artKey: "mountain_t4_mini_b"
      },
      artKey: "mountain_t4_mini_b"
    },
    {
      id: "mountain_t4_boss",
      family: "mountain",
      tier: "fierce",
      tierIndex: 4,
      encounter: "boss",
      role: "boss",
      name: "\u96F2\u5DBA\u9F8D\u738B\u30FB\u9707\u5DBA",
      title: null,
      hp: 1836,
      atk: 113,
      def: 117,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t4_boss",
      signatureName: "\u9F8D\u5A01\u9707\u5CB3",
      commonSkillIds: [
        "common_regen",
        "common_armor"
      ],
      signatureSummary: "\u9F8D\u5A01\u9707\u5CB3\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BDEF-8% 2\u56DE\u5408",
      counterSummary: "\u64CA\u788E\u5C71\u5F62\u7B26\u5370\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u72C0\u614B\u5E45\u5EA6+2%",
      material: {
        id: "mat_mountain_t4_boss",
        name: "\u9707\u5DBA\u9F8D\u89D2",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t4_boss",
        artKey: "mountain_t4_boss"
      },
      artKey: "mountain_t4_boss"
    },
    {
      id: "mountain_t5_normal_a",
      family: "mountain",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalA",
      name: "\u871C\u679C\u718A\u9748",
      title: null,
      hp: 1382,
      atk: 92,
      def: 90,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t5_normal_a",
      signatureName: "\u871C\u9999\u62CD\u64CA",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u871C\u9999\u62CD\u64CA\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u81EA\u8EAB\u8B77\u76FE7%",
      counterSummary: "\u64CA\u4E2D\u871C\u679C\u6A19\u8A18\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_mountain_t5_normal_a",
        name: "\u871C\u679C\u8B77\u722A",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "mountain_t5_normal_a",
        artKey: "mountain_t5_normal_a"
      },
      artKey: "mountain_t5_normal_a"
    },
    {
      id: "mountain_5",
      family: "mountain",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalExisting",
      name: "\u98DF\u4EBA\u5DE8\u718A",
      title: null,
      hp: 1728,
      atk: 115,
      def: 113,
      passive: false,
      existing: true,
      signatureSkillId: "sig_mountain_5",
      signatureName: "\u5DE8\u718A\u88C2\u6728",
      commonSkillIds: [
        "common_rage"
      ],
      signatureSummary: "\u5DE8\u718A\u88C2\u6728\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u6728\u7D0B\u88C2\u958B\u524D\u905470%\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mountain_m5",
        name: "\u5DE8\u718A\u5229\u722A",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "mountain_5",
        artKey: "mountain_5"
      },
      artKey: "mountain_5"
    },
    {
      id: "mountain_t5_normal_b",
      family: "mountain",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalB",
      name: "\u96EA\u5CF0\u6230\u718A",
      title: null,
      hp: 2074,
      atk: 138,
      def: 136,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t5_normal_b",
      signatureName: "\u96EA\u5D29\u718A\u638C",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u96EA\u5D29\u718A\u638C\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.5",
      counterSummary: "\u96EA\u5761\u986F\u793A\u4E00\u56DE\u5408\u5012\u6578\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88",
      material: {
        id: "mat_mountain_t5_normal_b",
        name: "\u96EA\u5CF0\u80F8\u7532",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "mountain_t5_normal_b",
        artKey: "mountain_t5_normal_b"
      },
      artKey: "mountain_t5_normal_b"
    },
    {
      id: "mountain_t5_mini_a",
      family: "mountain",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u77F3\u89D2\u5C71\u541B",
      title: null,
      hp: 2246,
      atk: 173,
      def: 147,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t5_mini_a",
      signatureName: "\u842C\u5CA9\u5954\u6D41",
      commonSkillIds: [
        "common_rage",
        "common_armor"
      ],
      signatureSummary: "\u842C\u5CA9\u5954\u6D41\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9053\u5CA9\u6D41\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_mountain_t5_mini_a",
        name: "\u5C71\u541B\u51A0\u89D2",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t5_mini_a",
        artKey: "mountain_t5_mini_a"
      },
      artKey: "mountain_t5_mini_a"
    },
    {
      id: "mountain_t5_mini_b",
      family: "mountain",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5929\u6797\u7375\u4FAF",
      title: null,
      hp: 2592,
      atk: 150,
      def: 170,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t5_mini_b",
      signatureName: "\u767E\u7FBD\u5C01\u5C71",
      commonSkillIds: [
        "common_weakpoint",
        "common_cleanse"
      ],
      signatureSummary: "\u767E\u7FBD\u5C01\u5C71\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u4E09\u679A\u4E3B\u7FBD\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_mountain_t5_mini_b",
        name: "\u5929\u6797\u7375\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t5_mini_b",
        artKey: "mountain_t5_mini_b"
      },
      artKey: "mountain_t5_mini_b"
    },
    {
      id: "mountain_t5_boss",
      family: "mountain",
      tier: "boss",
      tierIndex: 5,
      encounter: "boss",
      role: "boss",
      name: "\u96F2\u5DBA\u9F8D\u738B\u30FB\u51CC\u9704",
      title: null,
      hp: 2938,
      atk: 173,
      def: 181,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t5_boss",
      signatureName: "\u51CC\u9704\u9F8D\u6372",
      commonSkillIds: [
        "common_regen",
        "common_rage"
      ],
      signatureSummary: "\u51CC\u9704\u9F8D\u6372\uFF1A\u5927\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE20%",
      counterSummary: "\u9F8D\u6372\u773C\u4EAE\u8D77\u6642\u53EF\u7834\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u50B7\u5BB3+8%",
      material: {
        id: "mat_mountain_t5_boss",
        name: "\u51CC\u9704\u96F2\u51A0",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t5_boss",
        artKey: "mountain_t5_boss"
      },
      artKey: "mountain_t5_boss"
    },
    {
      id: "mountain_t6_normal_a",
      family: "mountain",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalA",
      name: "\u6F6D\u5149\u5E7C\u86DF",
      title: null,
      hp: 2160,
      atk: 129,
      def: 134,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t6_normal_a",
      signatureName: "\u6F6D\u5149\u6C34\u74B0",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u6F6D\u5149\u6C34\u74B0\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u6C34\u74B0\u9589\u5408\u524D\u64CA\u4E2D\u4E09\u500B\u5149\u9EDE",
      material: {
        id: "mat_mountain_t6_normal_a",
        name: "\u6F6D\u5149\u5E7C\u9C57",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t6_normal_a",
        artKey: "mountain_t6_normal_a"
      },
      artKey: "mountain_t6_normal_a"
    },
    {
      id: "mountain_6",
      family: "mountain",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalExisting",
      name: "\u6DF1\u5C71\u60E1\u86DF",
      title: null,
      hp: 2700,
      atk: 161,
      def: 167,
      passive: false,
      existing: true,
      signatureSkillId: "sig_mountain_6",
      signatureName: "\u6DF1\u6F6D\u98A8\u96E8",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u6DF1\u6F6D\u98A8\u96E8\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.05\uFF0BDEF-10% 1\u56DE\u5408",
      counterSummary: "\u98A8\u773C\u8207\u96E8\u6838\u5404\u5C0D\u61C9\u4E00\u6BB5\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mountain_m6",
        name: "\u60E1\u86DF\u9006\u9C57",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_6",
        artKey: "mountain_6"
      },
      artKey: "mountain_6"
    },
    {
      id: "mountain_t6_normal_b",
      family: "mountain",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalB",
      name: "\u5929\u5DBA\u9F8D\u885B",
      title: null,
      hp: 3240,
      atk: 193,
      def: 200,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t6_normal_b",
      signatureName: "\u5929\u5DBA\u9F8D\u9663",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u5929\u5DBA\u9F8D\u9663\uFF1A\u57FA\u6E96\uFF0B\u8B77\u76FE10%",
      counterSummary: "\u64CA\u788E\u9F8D\u9663\u4E09\u89D2\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_mountain_t6_normal_b",
        name: "\u5929\u5DBA\u6230\u9C57",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t6_normal_b",
        artKey: "mountain_t6_normal_b"
      },
      artKey: "mountain_t6_normal_b"
    },
    {
      id: "mountain_t6_mini_a",
      family: "mountain",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u77F3\u89D2\u8056\u885B",
      title: null,
      hp: 3510,
      atk: 242,
      def: 217,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t6_mini_a",
      signatureName: "\u842C\u5CB3\u93AE\u5B88",
      commonSkillIds: [
        "common_rage",
        "common_armor"
      ],
      signatureSummary: "\u842C\u5CB3\u93AE\u5B88\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5C71\u6838\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_mountain_t6_mini_a",
        name: "\u8056\u885B\u5C71\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t6_mini_a",
        artKey: "mountain_t6_mini_a"
      },
      artKey: "mountain_t6_mini_a"
    },
    {
      id: "mountain_t6_mini_b",
      family: "mountain",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u68EE\u98A8\u8056\u7375",
      title: null,
      hp: 4050,
      atk: 209,
      def: 251,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t6_mini_b",
      signatureName: "\u5929\u98A8\u8FFD\u661F",
      commonSkillIds: [
        "common_weakpoint",
        "common_cleanse"
      ],
      signatureSummary: "\u5929\u98A8\u8FFD\u661F\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.1",
      counterSummary: "\u4E09\u679A\u661F\u7FBD\u4F9D\u547D\u4E2D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_mountain_t6_mini_b",
        name: "\u8056\u7375\u661F\u7FBD",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t6_mini_b",
        artKey: "mountain_t6_mini_b"
      },
      artKey: "mountain_t6_mini_b"
    },
    {
      id: "mountain_t6_boss",
      family: "mountain",
      tier: "mythic",
      tierIndex: 6,
      encounter: "boss",
      role: "boss",
      name: "\u96F2\u5DBA\u9F8D\u738B\u30FB\u5929\u7A79",
      title: null,
      hp: 4590,
      atk: 242,
      def: 267,
      passive: false,
      existing: false,
      signatureSkillId: "sig_mountain_t6_boss",
      signatureName: "\u5929\u7A79\u8986\u5DBA",
      commonSkillIds: [
        "common_regen",
        "common_rage"
      ],
      signatureSummary: "\u5929\u7A79\u8986\u5DBA\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.6",
      counterSummary: "\u5C71\u5F71\u5012\u6578\u4E00\u56DE\u5408\uFF1B70% HP\u8B77\u76FE10%\uFF0C40% HP\u5EF6\u9072\u6BB5+10%\uFF0C\u4ECD\u53EF\u5B8C\u6574\u7834\u89E3",
      material: {
        id: "mat_mountain_t6_boss",
        name: "\u5929\u7A79\u9F8D\u5FC3",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "mountain_t6_boss",
        artKey: "mountain_t6_boss"
      },
      artKey: "mountain_t6_boss"
    },
    {
      id: "insect_t1_normal_a",
      family: "insect",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalA",
      name: "\u9732\u73E0\u74E2\u87F2",
      title: null,
      hp: 170,
      atk: 18,
      def: 10,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t1_normal_a",
      signatureName: "\u9732\u73E0\u5F48\u8DF3",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u9732\u73E0\u5F48\u8DF3\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u81EA\u8EAB\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u9732\u73E0\u843D\u9EDE\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_insect_t1_normal_a",
        name: "\u9732\u73E0\u7FC5\u6BBC",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "insect_t1_normal_a",
        artKey: "insect_t1_normal_a"
      },
      artKey: "insect_t1_normal_a"
    },
    {
      id: "insect_1",
      family: "insect",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5927\u87D1\u8782",
      title: null,
      hp: 213,
      atk: 23,
      def: 12,
      passive: false,
      existing: true,
      signatureSkillId: "sig_insect_1",
      signatureName: "\u75BE\u8D70\u7A81\u8972",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u75BE\u8D70\u7A81\u8972\uFF1A\u57FA\u6E96\u50B7\u5BB3",
      counterSummary: "\u767C\u5149\u79FB\u52D5\u7DDA\u6536\u675F\u524D\u905470%",
      material: {
        id: "insect_m1",
        name: "\u87D1\u8782\u89F8\u89D2",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "insect_1",
        artKey: "insect_1"
      },
      artKey: "insect_1"
    },
    {
      id: "insect_t1_normal_b",
      family: "insect",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalB",
      name: "\u9435\u6BBC\u7532\u87F2",
      title: null,
      hp: 256,
      atk: 28,
      def: 14,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t1_normal_b",
      signatureName: "\u7532\u6BBC\u885D\u92D2",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u7532\u6BBC\u885D\u92D2\uFF1A\u57FA\u6E96\uFF0B\u8B77\u76FE5%",
      counterSummary: "\u64CA\u4E2D\u80CC\u7532\u4EAE\u9EDE\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_insect_t1_normal_b",
        name: "\u9435\u6BBC\u80CC\u7532",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "insect_t1_normal_b",
        artKey: "insect_t1_normal_b"
      },
      artKey: "insect_t1_normal_b"
    },
    {
      id: "insect_t1_mini_a",
      family: "insect",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u7532\u885B\u4F8D\u5F9E",
      title: null,
      hp: 277,
      atk: 35,
      def: 16,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t1_mini_a",
      signatureName: "\u5C0F\u76FE\u731B\u9032",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u5C0F\u76FE\u731B\u9032\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u5C04\u4E2D\u5C0F\u76FE\u4E2D\u592E\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_insect_t1_mini_a",
        name: "\u4F8D\u5F9E\u7532\u7247",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t1_mini_a",
        artKey: "insect_t1_mini_a"
      },
      artKey: "insect_t1_mini_a"
    },
    {
      id: "insect_t1_mini_b",
      family: "insect",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u82B1\u7FFC\u65A5\u5019",
      title: null,
      hp: 320,
      atk: 30,
      def: 18,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t1_mini_b",
      signatureName: "\u82B1\u7C89\u98DB\u8972",
      commonSkillIds: [
        "common_weaken",
        "common_weakpoint"
      ],
      signatureSummary: "\u82B1\u7C89\u98DB\u8972\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u6563\u4E09\u7C07\u5F69\u8272\u82B1\u7C89",
      material: {
        id: "mat_insect_t1_mini_b",
        name: "\u82B1\u7FFC\u7C89\u5875",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t1_mini_b",
        artKey: "insect_t1_mini_b"
      },
      artKey: "insect_t1_mini_b"
    },
    {
      id: "insect_t1_boss",
      family: "insect",
      tier: "common",
      tierIndex: 1,
      encounter: "boss",
      role: "boss",
      name: "\u842C\u7FFC\u87F2\u7687\u30FB\u840C\u82BD",
      title: null,
      hp: 362,
      atk: 35,
      def: 19,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t1_boss",
      signatureName: "\u842C\u7FFC\u521D\u9CF4",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u842C\u7FFC\u521D\u9CF4\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u4E09\u679A\u7FFC\u7D0B\u4F9D\u5E8F\u4EAE\u8D77\uFF1B70% HP\u8B77\u76FE+2%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_insect_t1_boss",
        name: "\u840C\u82BD\u738B\u7FC5",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t1_boss",
        artKey: "insect_t1_boss"
      },
      artKey: "insect_t1_boss"
    },
    {
      id: "insect_t2_normal_a",
      family: "insect",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalA",
      name: "\u82B1\u7C89\u8702\u9748",
      title: null,
      hp: 272,
      atk: 32,
      def: 16,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t2_normal_a",
      signatureName: "\u871C\u5149\u8FF4\u65CB",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u871C\u5149\u8FF4\u65CB\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD70.9",
      counterSummary: "\u5169\u9846\u871C\u5149\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_insect_t2_normal_a",
        name: "\u82B1\u7C89\u871C\u6676",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "insect_t2_normal_a",
        artKey: "insect_t2_normal_a"
      },
      artKey: "insect_t2_normal_a"
    },
    {
      id: "insect_2",
      family: "insect",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalExisting",
      name: "\u864E\u982D\u8702",
      title: null,
      hp: 340,
      atk: 40,
      def: 20,
      passive: false,
      existing: true,
      signatureSkillId: "sig_insect_2",
      signatureName: "\u8702\u738B\u7A81\u523A",
      commonSkillIds: [
        "common_poison"
      ],
      signatureSummary: "\u8702\u738B\u7A81\u523A\uFF1A\u57FA\u6E96\uFF0B\u6700\u5927HP 2%\u6BD2\u50B71\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5C3E\u91DD\u5149\u9EDE\u53D6\u6D88\u6BD2\u50B7",
      material: {
        id: "insect_m2",
        name: "\u864E\u982D\u8702\u523A",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "insect_2",
        artKey: "insect_2"
      },
      artKey: "insect_2"
    },
    {
      id: "insect_t2_normal_b",
      family: "insect",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalB",
      name: "\u91D1\u7532\u8702\u885B",
      title: null,
      hp: 408,
      atk: 48,
      def: 24,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t2_normal_b",
      signatureName: "\u91D1\u8702\u7A7F\u5217",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u91D1\u8702\u7A7F\u5217\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u91D1\u8272\u98DB\u884C\u7DDA\u4EAE\u8D77\u6642\u7834\u89E3",
      material: {
        id: "mat_insect_t2_normal_b",
        name: "\u91D1\u7532\u8179\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "insect_t2_normal_b",
        artKey: "insect_t2_normal_b"
      },
      artKey: "insect_t2_normal_b"
    },
    {
      id: "insect_t2_mini_a",
      family: "insect",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u7532\u885B\u9A0E\u624B",
      title: null,
      hp: 442,
      atk: 60,
      def: 26,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t2_mini_a",
      signatureName: "\u7532\u9A0E\u7A81\u5217",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u7532\u9A0E\u7A81\u5217\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u524D\u5F8C\u5169\u7247\u7532\u6A19\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_insect_t2_mini_a",
        name: "\u9A0E\u624B\u978D\u7532",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t2_mini_a",
        artKey: "insect_t2_mini_a"
      },
      artKey: "insect_t2_mini_a"
    },
    {
      id: "insect_t2_mini_b",
      family: "insect",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u8702\u7FFC\u5075\u5BDF",
      title: null,
      hp: 510,
      atk: 52,
      def: 30,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t2_mini_b",
      signatureName: "\u8702\u7FFC\u6A19\u8A18",
      commonSkillIds: [
        "common_weaken",
        "common_weakpoint"
      ],
      signatureSummary: "\u8702\u7FFC\u6A19\u8A18\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5931\u6557ATK-5% 1\u56DE\u5408",
      counterSummary: "\u534A\u6578\u7BAD\u90549\u5206\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_insect_t2_mini_b",
        name: "\u5075\u5BDF\u7FFC\u819C",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t2_mini_b",
        artKey: "insect_t2_mini_b"
      },
      artKey: "insect_t2_mini_b"
    },
    {
      id: "insect_t2_boss",
      family: "insect",
      tier: "rare",
      tierIndex: 2,
      encounter: "boss",
      role: "boss",
      name: "\u842C\u7FFC\u87F2\u7687\u30FB\u5C55\u7FFC",
      title: null,
      hp: 578,
      atk: 60,
      def: 32,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t2_boss",
      signatureName: "\u767E\u7FFC\u98A8\u65CB",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u767E\u7FFC\u98A8\u65CB\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5927\u738B\u57FA\u6E96",
      counterSummary: "\u4E09\u7247\u4E3B\u7FFC\u5404\u5C0D\u61C9\u4E00\u6BB5\uFF1B70% HP\u6E1B\u50B7+5%\uFF0C40% HP\u7E3D\u50B7+5%",
      material: {
        id: "mat_insect_t2_boss",
        name: "\u5C55\u7FFC\u738B\u7C89",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t2_boss",
        artKey: "insect_t2_boss"
      },
      artKey: "insect_t2_boss"
    },
    {
      id: "insect_t3_normal_a",
      family: "insect",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalA",
      name: "\u7D72\u8449\u5E7C\u8836",
      title: null,
      hp: 442,
      atk: 50,
      def: 27,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t3_normal_a",
      signatureName: "\u67D4\u7D72\u7E8F\u8DB3",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u67D4\u7D72\u7E8F\u8DB3\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5169\u500B\u7D72\u7D50\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "mat_insect_t3_normal_a",
        name: "\u7D72\u8449\u7E6D\u7DDA",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "insect_t3_normal_a",
        artKey: "insect_t3_normal_a"
      },
      artKey: "insect_t3_normal_a"
    },
    {
      id: "insect_3",
      family: "insect",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalExisting",
      name: "\u8708\u86A3\u7CBE",
      title: null,
      hp: 553,
      atk: 63,
      def: 34,
      passive: false,
      existing: true,
      signatureSkillId: "sig_insect_3",
      signatureName: "\u767E\u8DB3\u9023\u64CA",
      commonSkillIds: [
        "common_poison"
      ],
      signatureSummary: "\u767E\u8DB3\u9023\u64CA\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u500B\u5149\u7BC0\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "insect_m3",
        name: "\u8708\u86A3\u767E\u8173",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "insect_3",
        artKey: "insect_3"
      },
      artKey: "insect_3"
    },
    {
      id: "insect_t3_normal_b",
      family: "insect",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalB",
      name: "\u767E\u7BC0\u7532\u885B",
      title: null,
      hp: 664,
      atk: 76,
      def: 41,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t3_normal_b",
      signatureName: "\u7BC0\u7532\u5C01\u8DEF",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u7BC0\u7532\u5C01\u8DEF\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u788E\u4E2D\u592E\u7BC0\u7532\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_insect_t3_normal_b",
        name: "\u767E\u7BC0\u8B77\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "insect_t3_normal_b",
        artKey: "insect_t3_normal_b"
      },
      artKey: "insect_t3_normal_b"
    },
    {
      id: "insect_t3_mini_a",
      family: "insect",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u7532\u885B\u9A0E\u58EB",
      title: null,
      hp: 719,
      atk: 95,
      def: 44,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t3_mini_a",
      signatureName: "\u9435\u7532\u8CAB\u9663",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u9435\u7532\u8CAB\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A615%",
      counterSummary: "\u7532\u7E2B\u767C\u4EAE\u6642\u547D\u4E2D\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_insect_t3_mini_a",
        name: "\u9A0E\u58EB\u80F8\u7532",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t3_mini_a",
        artKey: "insect_t3_mini_a"
      },
      artKey: "insect_t3_mini_a"
    },
    {
      id: "insect_t3_mini_b",
      family: "insect",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u6BD2\u7FFC\u904A\u4FE0",
      title: null,
      hp: 830,
      atk: 82,
      def: 51,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t3_mini_b",
      signatureName: "\u6BD2\u7FBD\u8FFD\u5C04",
      commonSkillIds: [
        "common_poison",
        "common_weakpoint"
      ],
      signatureSummary: "\u6BD2\u7FBD\u8FFD\u5C04\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u6700\u5927HP 3%\u6BD2\u50B71\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5F69\u7FBD\u5C16\u7AEF\u53D6\u6D88\u6BD2\u50B7",
      material: {
        id: "mat_insect_t3_mini_b",
        name: "\u904A\u4FE0\u5C3E\u7FBD",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t3_mini_b",
        artKey: "insect_t3_mini_b"
      },
      artKey: "insect_t3_mini_b"
    },
    {
      id: "insect_t3_boss",
      family: "insect",
      tier: "elite",
      tierIndex: 3,
      encounter: "boss",
      role: "boss",
      name: "\u842C\u7FFC\u87F2\u7687\u30FB\u5343\u7FC5",
      title: null,
      hp: 940,
      atk: 95,
      def: 54,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t3_boss",
      signatureName: "\u5343\u7FC5\u98A8\u66B4",
      commonSkillIds: [
        "common_regen",
        "common_armor"
      ],
      signatureSummary: "\u5343\u7FC5\u98A8\u66B4\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5927\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9053\u7FFC\u74B0\u9010\u6BB5\u7834\u89E3\uFF1B70% HP\u8B77\u76FE7%\uFF0C40% HP\u591A\u6BB5\u7E3D\u50B7+5%",
      material: {
        id: "mat_insect_t3_boss",
        name: "\u5343\u7FC5\u738B\u7D0B",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t3_boss",
        artKey: "insect_t3_boss"
      },
      artKey: "insect_t3_boss"
    },
    {
      id: "insect_t4_normal_a",
      family: "insect",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalA",
      name: "\u6676\u5C3E\u5C0F\u880D",
      title: null,
      hp: 680,
      atk: 75,
      def: 46,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t4_normal_a",
      signatureName: "\u6676\u5C3E\u9EDE\u523A",
      commonSkillIds: [
        "common_shock"
      ],
      signatureSummary: "\u6676\u5C3E\u9EDE\u523A\uFF1A\u57FA\u6E96\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u6676\u5C3E\u5149\u9EDE\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mat_insect_t4_normal_a",
        name: "\u6676\u5C3E\u788E\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "insect_t4_normal_a",
        artKey: "insect_t4_normal_a"
      },
      artKey: "insect_t4_normal_a"
    },
    {
      id: "insect_4",
      family: "insect",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalExisting",
      name: "\u880D\u5B50\u738B",
      title: null,
      hp: 850,
      atk: 94,
      def: 58,
      passive: false,
      existing: true,
      signatureSkillId: "sig_insect_4",
      signatureName: "\u880D\u738B\u6A6B\u6383",
      commonSkillIds: [
        "common_poison"
      ],
      signatureSummary: "\u880D\u738B\u6A6B\u6383\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\uFF0B\u6700\u5927HP 3%\u6BD2\u50B71\u56DE\u5408",
      counterSummary: "\u9257\u8207\u5C3E\u5404\u5C0D\u61C9\u4E00\u6BB5\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u6BD2\u50B7",
      material: {
        id: "insect_m4",
        name: "\u880D\u738B\u6BD2\u523A",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "insect_4",
        artKey: "insect_4"
      },
      artKey: "insect_4"
    },
    {
      id: "insect_t4_normal_b",
      family: "insect",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalB",
      name: "\u8D64\u7532\u6230\u880D",
      title: null,
      hp: 1020,
      atk: 113,
      def: 70,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t4_normal_b",
      signatureName: "\u8D64\u5C3E\u7834\u76FE",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u8D64\u5C3E\u7834\u76FE\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE10%",
      counterSummary: "\u8D64\u5C3E\u84C4\u5149\u6642\u547D\u4E2D\u53D6\u6D88\u7A7F\u76FE",
      material: {
        id: "mat_insect_t4_normal_b",
        name: "\u8D64\u7532\u5C3E\u93A7",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "insect_t4_normal_b",
        artKey: "insect_t4_normal_b"
      },
      artKey: "insect_t4_normal_b"
    },
    {
      id: "insect_t4_mini_a",
      family: "insect",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u7532\u885B\u968A\u9577",
      title: null,
      hp: 1105,
      atk: 141,
      def: 75,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t4_mini_a",
      signatureName: "\u7532\u885B\u5217\u9663",
      commonSkillIds: [
        "common_armor",
        "common_stance"
      ],
      signatureSummary: "\u7532\u885B\u5217\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u4E09\u9762\u7532\u76FE\u4F9D\u5E8F\u64CA\u7834\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_insect_t4_mini_a",
        name: "\u968A\u9577\u7532\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t4_mini_a",
        artKey: "insect_t4_mini_a"
      },
      artKey: "insect_t4_mini_a"
    },
    {
      id: "insect_t4_mini_b",
      family: "insect",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u96F7\u7FFC\u65A5\u5019",
      title: null,
      hp: 1275,
      atk: 122,
      def: 87,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t4_mini_b",
      signatureName: "\u96F7\u7FBD\u4FEF\u885D",
      commonSkillIds: [
        "common_shock",
        "common_weakpoint"
      ],
      signatureSummary: "\u96F7\u7FBD\u4FEF\u885D\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u96F7\u7FBD\u843D\u9EDE\u986F\u793A\u5F8C\u905470%",
      material: {
        id: "mat_insect_t4_mini_b",
        name: "\u96F7\u7FFC\u5C0E\u7247",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t4_mini_b",
        artKey: "insect_t4_mini_b"
      },
      artKey: "insect_t4_mini_b"
    },
    {
      id: "insect_t4_boss",
      family: "insect",
      tier: "fierce",
      tierIndex: 4,
      encounter: "boss",
      role: "boss",
      name: "\u842C\u7FFC\u87F2\u7687\u30FB\u5929\u5E55",
      title: null,
      hp: 1445,
      atk: 141,
      def: 93,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t4_boss",
      signatureName: "\u87F2\u7FFC\u853D\u7A7A",
      commonSkillIds: [
        "common_reflect",
        "common_armor"
      ],
      signatureSummary: "\u87F2\u7FFC\u853D\u7A7A\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BATK-8% 2\u56DE\u5408",
      counterSummary: "\u64CA\u7A7F\u5929\u5E55\u4E09\u500B\u5149\u5B54\uFF1B70% HP\u53CD\u5C04+3%\uFF0C40% HP\u72C0\u614B\u5E45\u5EA6+2%",
      material: {
        id: "mat_insect_t4_boss",
        name: "\u5929\u5E55\u7FFC\u6676",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t4_boss",
        artKey: "insect_t4_boss"
      },
      artKey: "insect_t4_boss"
    },
    {
      id: "insect_t5_normal_a",
      family: "insect",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalA",
      name: "\u6708\u7D0B\u86DB\u9748",
      title: null,
      hp: 1088,
      atk: 115,
      def: 71,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t5_normal_a",
      signatureName: "\u6708\u7D72\u727D\u5F15",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u6708\u7D72\u727D\u5F15\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u6708\u7D72\u5169\u7AEF\u7686\u547D\u4E2D\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_insect_t5_normal_a",
        name: "\u6708\u7D0B\u7D72\u7403",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "insect_t5_normal_a",
        artKey: "insect_t5_normal_a"
      },
      artKey: "insect_t5_normal_a"
    },
    {
      id: "insect_5",
      family: "insect",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalExisting",
      name: "\u8718\u86DB\u5973\u738B",
      title: null,
      hp: 1360,
      atk: 144,
      def: 89,
      passive: false,
      existing: true,
      signatureSkillId: "sig_insect_5",
      signatureName: "\u547D\u904B\u86DB\u7DB2",
      commonSkillIds: [
        "common_poison"
      ],
      signatureSummary: "\u547D\u904B\u86DB\u7DB2\uFF1A\u57FA\u6E96\uFF0B\u6CBB\u7642\u91CF-15% 2\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u86DB\u7DB2\u56DB\u89D2\u53D6\u6D88\u6CBB\u7642\u5F31\u5316",
      material: {
        id: "insect_m5",
        name: "\u86DB\u540E\u6BD2\u817A",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "insect_5",
        artKey: "insect_5"
      },
      artKey: "insect_5"
    },
    {
      id: "insect_t5_normal_b",
      family: "insect",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalB",
      name: "\u5929\u7DB2\u86DB\u885B",
      title: null,
      hp: 1632,
      atk: 173,
      def: 107,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t5_normal_b",
      signatureName: "\u5929\u7DB2\u5C01\u9663",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u5929\u7DB2\u5C01\u9663\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE7%\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u7834\u5929\u7DB2\u6838\u5FC3\uFF0C\u6548\u679C\u4F9D\u7D14\u8B77\u76FE\u7D1A\u8DDD",
      material: {
        id: "mat_insect_t5_normal_b",
        name: "\u5929\u7DB2\u7D72\u8EF8",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "insect_t5_normal_b",
        artKey: "insect_t5_normal_b"
      },
      artKey: "insect_t5_normal_b"
    },
    {
      id: "insect_t5_mini_a",
      family: "insect",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u7532\u885B\u4FAF\u7235",
      title: null,
      hp: 1768,
      atk: 216,
      def: 116,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t5_mini_a",
      signatureName: "\u91D1\u7532\u865F\u4EE4",
      commonSkillIds: [
        "common_rage",
        "common_armor"
      ],
      signatureSummary: "\u91D1\u7532\u865F\u4EE4\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u8B77\u76FE7%",
      counterSummary: "\u64CA\u4E2D\u91D1\u7532\u5FBD\u7AE0\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_insect_t5_mini_a",
        name: "\u4FAF\u7235\u91D1\u7532",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t5_mini_a",
        artKey: "insect_t5_mini_a"
      },
      artKey: "insect_t5_mini_a"
    },
    {
      id: "insect_t5_mini_b",
      family: "insect",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u738B\u7FFC\u7375\u5C07",
      title: null,
      hp: 2040,
      atk: 187,
      def: 134,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t5_mini_b",
      signatureName: "\u738B\u7FFC\u8FFD\u7375",
      commonSkillIds: [
        "common_poison",
        "common_weakpoint"
      ],
      signatureSummary: "\u738B\u7FFC\u8FFD\u7375\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.05\uFF0B\u6CBB\u7642\u91CF-15% 1\u56DE\u5408",
      counterSummary: "\u5169\u7247\u738B\u7FFC\u7686\u547D\u4E2D\u53EF\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_insect_t5_mini_b",
        name: "\u738B\u7FFC\u7375\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t5_mini_b",
        artKey: "insect_t5_mini_b"
      },
      artKey: "insect_t5_mini_b"
    },
    {
      id: "insect_t5_boss",
      family: "insect",
      tier: "boss",
      tierIndex: 5,
      encounter: "boss",
      role: "boss",
      name: "\u842C\u7FFC\u87F2\u7687\u30FB\u738B\u5EA7",
      title: null,
      hp: 2312,
      atk: 216,
      def: 142,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t5_boss",
      signatureName: "\u842C\u7FFC\u671D\u738B",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u842C\u7FFC\u671D\u738B\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.5",
      counterSummary: "\u7FFC\u51A0\u5012\u6578\u4E00\u56DE\u5408\uFF1B70% HP\u8B77\u76FE10%\uFF0C40% HP\u5EF6\u9072\u6BB5+8%",
      material: {
        id: "mat_insect_t5_boss",
        name: "\u738B\u5EA7\u7FC5\u51A0",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t5_boss",
        artKey: "insect_t5_boss"
      },
      artKey: "insect_t5_boss"
    },
    {
      id: "insect_t6_normal_a",
      family: "insect",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalA",
      name: "\u661F\u7FFC\u8776\u4F7F",
      title: null,
      hp: 1700,
      atk: 161,
      def: 106,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t6_normal_a",
      signatureName: "\u661F\u7C89\u5E7B\u821E",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u661F\u7C89\u5E7B\u821E\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u4E09\u9846\u4E3B\u661F\u7C89\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_insect_t6_normal_a",
        name: "\u661F\u7FFC\u8776\u7C89",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t6_normal_a",
        artKey: "insect_t6_normal_a"
      },
      artKey: "insect_t6_normal_a"
    },
    {
      id: "insect_6",
      family: "insect",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalExisting",
      name: "\u87F2\u795E",
      title: null,
      hp: 2125,
      atk: 201,
      def: 132,
      passive: false,
      existing: true,
      signatureSkillId: "sig_insect_6",
      signatureName: "\u842C\u87F2\u671D\u8056",
      commonSkillIds: [
        "common_poison"
      ],
      signatureSummary: "\u842C\u87F2\u671D\u8056\uFF1A3\u6BB5\u5149\u7FFC\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.1\uFF0B\u6CBB\u7642\u91CF-20% 1\u56DE\u5408",
      counterSummary: "\u4E09\u500B\u65CF\u5FBD\u9010\u6BB5\u7834\u89E3\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "insect_m6",
        name: "\u87F2\u795E\u6838\u5FC3",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_6",
        artKey: "insect_6"
      },
      artKey: "insect_6"
    },
    {
      id: "insect_t6_normal_b",
      family: "insect",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalB",
      name: "\u842C\u7532\u87F2\u885B",
      title: null,
      hp: 2550,
      atk: 241,
      def: 158,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t6_normal_b",
      signatureName: "\u842C\u7532\u5929\u58C1",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u842C\u7532\u5929\u58C1\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE10%",
      counterSummary: "\u64CA\u788E\u5929\u58C1\u4E2D\u592E\u7532\u6838\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_insect_t6_normal_b",
        name: "\u842C\u7532\u6838\u5FC3",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t6_normal_b",
        artKey: "insect_t6_normal_b"
      },
      artKey: "insect_t6_normal_b"
    },
    {
      id: "insect_t6_mini_a",
      family: "insect",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u7532\u885B\u8056\u9A0E",
      title: null,
      hp: 2763,
      atk: 302,
      def: 172,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t6_mini_a",
      signatureName: "\u8056\u7532\u5929\u5F81",
      commonSkillIds: [
        "common_rage",
        "common_armor"
      ],
      signatureSummary: "\u8056\u7532\u5929\u5F81\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A615%\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u8056\u7532\u5341\u5B57\u4E2D\u5FC3\u547D\u4E2D\u53EF\u540C\u6642\u53D6\u6D88\u5169\u9805\u6548\u679C",
      material: {
        id: "mat_insect_t6_mini_a",
        name: "\u8056\u9A0E\u795E\u7532",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t6_mini_a",
        artKey: "insect_t6_mini_a"
      },
      artKey: "insect_t6_mini_a"
    },
    {
      id: "insect_t6_mini_b",
      family: "insect",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u795E\u7FFC\u65A5\u5019",
      title: null,
      hp: 3188,
      atk: 261,
      def: 198,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t6_mini_b",
      signatureName: "\u795E\u7FFC\u7A7F\u661F",
      commonSkillIds: [
        "common_poison",
        "common_weakpoint"
      ],
      signatureSummary: "\u795E\u7FFC\u7A7F\u661F\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.1\uFF0C\u7121\u8996\u8B77\u76FE20%",
      counterSummary: "\u4E09\u679A\u661F\u7FBD\u9010\u6BB5\u53D6\u6D88\uFF0C85%\u53D6\u6D88\u7A7F\u76FE",
      material: {
        id: "mat_insect_t6_mini_b",
        name: "\u795E\u7FFC\u661F\u7FBD",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t6_mini_b",
        artKey: "insect_t6_mini_b"
      },
      artKey: "insect_t6_mini_b"
    },
    {
      id: "insect_t6_boss",
      family: "insect",
      tier: "mythic",
      tierIndex: 6,
      encounter: "boss",
      role: "boss",
      name: "\u842C\u7FFC\u87F2\u7687\u30FB\u795E\u8A71",
      title: null,
      hp: 3613,
      atk: 302,
      def: 211,
      passive: false,
      existing: false,
      signatureSkillId: "sig_insect_t6_boss",
      signatureName: "\u842C\u7FFC\u5929\u7A79",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u842C\u7FFC\u5929\u7A79\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u6CBB\u7642\u91CF-20% 2\u56DE\u5408",
      counterSummary: "\u56DB\u7FFC\u5929\u5E55\u9010\u4E00\u64CA\u7834\uFF1B70% HP\u53CD\u5C04+3%\uFF0C40% HP\u50B7\u5BB3+8%\uFF0C\u72C0\u614B\u4ECD\u53D7\u7834\u89E3",
      material: {
        id: "mat_insect_t6_boss",
        name: "\u795E\u8A71\u7FFC\u5FC3",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "insect_t6_boss",
        artKey: "insect_t6_boss"
      },
      artKey: "insect_t6_boss"
    },
    {
      id: "workplace_t1_normal_a",
      family: "workplace",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalA",
      name: "\u8DD1\u817F\u7D19\u5076",
      title: null,
      hp: 200,
      atk: 18,
      def: 11,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t1_normal_a",
      signatureName: "\u6025\u4EF6\u98DB\u9001",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u6025\u4EF6\u98DB\u9001\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u547D\u4E2D\u5F8CATK-5% 1\u56DE\u5408",
      counterSummary: "\u5C04\u4E2D\u767C\u4EAE\u4FBF\u689D\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "mat_workplace_t1_normal_a",
        name: "\u8DD1\u817F\u4FBF\u689D",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "workplace_t1_normal_a",
        artKey: "workplace_t1_normal_a"
      },
      artKey: "workplace_t1_normal_a"
    },
    {
      id: "workplace_1",
      family: "workplace",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5967\u5BA2",
      title: null,
      hp: 250,
      atk: 22,
      def: 14,
      passive: false,
      existing: true,
      signatureSkillId: "sig_workplace_1",
      signatureName: "\u5BA2\u8A34\u9023\u767C",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u5BA2\u8A34\u9023\u767C\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96",
      counterSummary: "\u5169\u5F35\u5BA2\u8A34\u55AE\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "workplace_m1",
        name: "\u6295\u8A34\u66F8",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "workplace_1",
        artKey: "workplace_1"
      },
      artKey: "workplace_1"
    },
    {
      id: "workplace_t1_normal_b",
      family: "workplace",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalB",
      name: "\u6AC3\u53F0\u9435\u885B",
      title: null,
      hp: 300,
      atk: 26,
      def: 17,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t1_normal_b",
      signatureName: "\u6392\u968A\u5C01\u9396",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u6392\u968A\u5C01\u9396\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE5%",
      counterSummary: "\u64CA\u4E2D\u968A\u4F0D\u6700\u524D\u65B9\u6A19\u8A18\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_workplace_t1_normal_b",
        name: "\u6AC3\u53F0\u540D\u724C",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "workplace_t1_normal_b",
        artKey: "workplace_t1_normal_b"
      },
      artKey: "workplace_t1_normal_b"
    },
    {
      id: "workplace_t1_mini_a",
      family: "workplace",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE5\u574A\u52A9\u7406",
      title: null,
      hp: 325,
      atk: 33,
      def: 18,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t1_mini_a",
      signatureName: "\u5DE5\u5177\u5FEB\u6253",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u5DE5\u5177\u5FEB\u6253\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u6273\u624B\u8207\u6728\u69CC\u5716\u793A\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_workplace_t1_mini_a",
        name: "\u52A9\u7406\u5DE5\u5177\u6263",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t1_mini_a",
        artKey: "workplace_t1_mini_a"
      },
      artKey: "workplace_t1_mini_a"
    },
    {
      id: "workplace_t1_mini_b",
      family: "workplace",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u898B\u7FD2\u57F7\u884C\u54E1",
      title: null,
      hp: 375,
      atk: 29,
      def: 21,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t1_mini_b",
      signatureName: "\u7D05\u5370\u8FFD\u4EF6",
      commonSkillIds: [
        "common_armor",
        "common_weaken"
      ],
      signatureSummary: "\u7D05\u5370\u8FFD\u4EF6\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u7D05\u5370\u4E2D\u592E\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "mat_workplace_t1_mini_b",
        name: "\u898B\u7FD2\u5951\u7D04\u89D2",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t1_mini_b",
        artKey: "workplace_t1_mini_b"
      },
      artKey: "workplace_t1_mini_b"
    },
    {
      id: "workplace_t1_boss",
      family: "workplace",
      tier: "common",
      tierIndex: 1,
      encounter: "boss",
      role: "boss",
      name: "\u9EC3\u91D1\u5951\u7D04\u738B\u30FB\u8349\u7D04",
      title: null,
      hp: 425,
      atk: 33,
      def: 22,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t1_boss",
      signatureName: "\u5951\u7D04\u521D\u4EE4",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u5951\u7D04\u521D\u4EE4\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u5951\u7D04\u4E09\u89D2\u4F9D\u5E8F\u4EAE\u8D77\uFF1B70% HP\u8B77\u76FE+2%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_workplace_t1_boss",
        name: "\u8349\u7D04\u91D1\u9801",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t1_boss",
        artKey: "workplace_t1_boss"
      },
      artKey: "workplace_t1_boss"
    },
    {
      id: "workplace_t2_normal_a",
      family: "workplace",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalA",
      name: "\u5496\u5561\u4FE1\u4F7F",
      title: null,
      hp: 320,
      atk: 30,
      def: 19,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t2_normal_a",
      signatureName: "\u9192\u8166\u98DB\u676F",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u9192\u8166\u98DB\u676F\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u4E0B\u6B21\u9AD8\u54C1\u8CEA\u7BAD\u50B7\u5BB3+10%",
      counterSummary: "\u64CA\u4E2D\u676F\u7DE3\u5149\u5708\u53D6\u5F97\u52A0\u6210\u4E26\u524A\u5F31\u53CD\u64CA",
      material: {
        id: "mat_workplace_t2_normal_a",
        name: "\u9999\u6C23\u5496\u5561\u8C46",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "workplace_t2_normal_a",
        artKey: "workplace_t2_normal_a"
      },
      artKey: "workplace_t2_normal_a"
    },
    {
      id: "workplace_2",
      family: "workplace",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalExisting",
      name: "\u721B\u4E3B\u7BA1",
      title: null,
      hp: 400,
      atk: 38,
      def: 24,
      passive: false,
      existing: true,
      signatureSkillId: "sig_workplace_2",
      signatureName: "\u8A71\u8853\u65BD\u58D3",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u8A71\u8853\u65BD\u58D3\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u5C04\u6563\u4E09\u500B\u5C0D\u8A71\u6CE1\u6CE1\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "workplace_m2",
        name: "PUA\u8A9E\u9304",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "workplace_2",
        artKey: "workplace_2"
      },
      artKey: "workplace_2"
    },
    {
      id: "workplace_t2_normal_b",
      family: "workplace",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalB",
      name: "\u6703\u8B70\u5B88\u885B",
      title: null,
      hp: 480,
      atk: 46,
      def: 29,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t2_normal_b",
      signatureName: "\u5EF6\u6642\u8B70\u7A0B",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u5EF6\u6642\u8B70\u7A0B\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.35",
      counterSummary: "\u6642\u9418\u660E\u793A\u4E00\u56DE\u5408\u5012\u6578\uFF1B\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u5EF6\u9072\u6BB5",
      material: {
        id: "mat_workplace_t2_normal_b",
        name: "\u6703\u8B70\u6642\u9418",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "workplace_t2_normal_b",
        artKey: "workplace_t2_normal_b"
      },
      artKey: "workplace_t2_normal_b"
    },
    {
      id: "workplace_t2_mini_a",
      family: "workplace",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE5\u574A\u76E3\u7763",
      title: null,
      hp: 520,
      atk: 57,
      def: 31,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t2_mini_a",
      signatureName: "\u5DE5\u5E8F\u865F\u4EE4",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u5DE5\u5E8F\u865F\u4EE4\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u4F9D\u6B63\u78BA\u9806\u5E8F\u547D\u4E2D\u4E09\u500B\u9F52\u8F2A",
      material: {
        id: "mat_workplace_t2_mini_a",
        name: "\u76E3\u7763\u9285\u54E8",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t2_mini_a",
        artKey: "workplace_t2_mini_a"
      },
      artKey: "workplace_t2_mini_a"
    },
    {
      id: "workplace_t2_mini_b",
      family: "workplace",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5951\u7D04\u57F7\u884C\u54E1",
      title: null,
      hp: 600,
      atk: 49,
      def: 36,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t2_mini_b",
      signatureName: "\u9650\u671F\u57F7\u884C",
      commonSkillIds: [
        "common_armor",
        "common_weaken"
      ],
      signatureSummary: "\u9650\u671F\u57F7\u884C\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u5012\u6578\u7D50\u675F\u524D\u905470%\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_workplace_t2_mini_b",
        name: "\u57F7\u884C\u7D05\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t2_mini_b",
        artKey: "workplace_t2_mini_b"
      },
      artKey: "workplace_t2_mini_b"
    },
    {
      id: "workplace_t2_boss",
      family: "workplace",
      tier: "rare",
      tierIndex: 2,
      encounter: "boss",
      role: "boss",
      name: "\u9EC3\u91D1\u5951\u7D04\u738B\u30FB\u5B9A\u7A3F",
      title: null,
      hp: 680,
      atk: 57,
      def: 38,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t2_boss",
      signatureName: "\u5B9A\u7A3F\u5C01\u4EE4",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u5B9A\u7A3F\u5C01\u4EE4\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u8B77\u76FE5%",
      counterSummary: "\u64CA\u4E2D\u5B9A\u7A3F\u7AE0\u56DB\u89D2\uFF1B70% HP\u6E1B\u50B7+5%\uFF0C40% HP\u8B77\u76FE+2%",
      material: {
        id: "mat_workplace_t2_boss",
        name: "\u5B9A\u7A3F\u91D1\u58A8",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t2_boss",
        artKey: "workplace_t2_boss"
      },
      artKey: "workplace_t2_boss"
    },
    {
      id: "workplace_t3_normal_a",
      family: "workplace",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalA",
      name: "\u5831\u8868\u5C0F\u7CBE\u9748",
      title: null,
      hp: 520,
      atk: 47,
      def: 32,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t3_normal_a",
      signatureName: "\u6578\u5B57\u98DB\u6563",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u6578\u5B57\u98DB\u6563\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96",
      counterSummary: "\u4E09\u500B\u767C\u4EAE\u6578\u5B57\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_workplace_t3_normal_a",
        name: "\u5831\u8868\u5149\u9801",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "workplace_t3_normal_a",
        artKey: "workplace_t3_normal_a"
      },
      artKey: "workplace_t3_normal_a"
    },
    {
      id: "workplace_3",
      family: "workplace",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalExisting",
      name: "\u58DE\u8001\u95C6",
      title: null,
      hp: 650,
      atk: 59,
      def: 40,
      passive: false,
      existing: true,
      signatureSkillId: "sig_workplace_3",
      signatureName: "\u756B\u9905\u653B\u52E2",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u756B\u9905\u653B\u52E2\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-8% 1\u56DE\u5408",
      counterSummary: "\u64CA\u7834\u4E2D\u592E\u5F69\u8272\u5713\u9905\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "workplace_m3",
        name: "\u7A7A\u982D\u652F\u7968",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "workplace_3",
        artKey: "workplace_3"
      },
      artKey: "workplace_3"
    },
    {
      id: "workplace_t3_normal_b",
      family: "workplace",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalB",
      name: "\u5951\u7D04\u7A3D\u6838\u5B98",
      title: null,
      hp: 780,
      atk: 71,
      def: 48,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t3_normal_b",
      signatureName: "\u689D\u6B3E\u6383\u63CF",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u689D\u6B3E\u6383\u63CF\uFF1A\u57FA\u6E96\uFF0B\u6307\u5B9A9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5931\u6557DEF-5% 1\u56DE\u5408",
      counterSummary: "\u534A\u6578\u7BAD\u90549\u5206\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_workplace_t3_normal_b",
        name: "\u7A3D\u6838\u93E1\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "workplace_t3_normal_b",
        artKey: "workplace_t3_normal_b"
      },
      artKey: "workplace_t3_normal_b"
    },
    {
      id: "workplace_t3_mini_a",
      family: "workplace",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE5\u574A\u4E3B\u4EFB",
      title: null,
      hp: 845,
      atk: 89,
      def: 52,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t3_mini_a",
      signatureName: "\u5DE5\u574A\u8F2A\u8F49",
      commonSkillIds: [
        "common_charge",
        "common_cleanse"
      ],
      signatureSummary: "\u5DE5\u574A\u8F2A\u8F49\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u679A\u9F52\u8F2A\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_workplace_t3_mini_a",
        name: "\u4E3B\u4EFB\u9F52\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t3_mini_a",
        artKey: "workplace_t3_mini_a"
      },
      artKey: "workplace_t3_mini_a"
    },
    {
      id: "workplace_t3_mini_b",
      family: "workplace",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5951\u7D04\u5BE9\u6838\u5B98",
      title: null,
      hp: 975,
      atk: 77,
      def: 60,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t3_mini_b",
      signatureName: "\u689D\u6587\u5C01\u6B65",
      commonSkillIds: [
        "common_armor",
        "common_weaken"
      ],
      signatureSummary: "\u689D\u6587\u5C01\u6B65\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BATK-8% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u689D\u6587\u4E2D\u7684\u4E09\u8655\u91D1\u5B57",
      material: {
        id: "mat_workplace_t3_mini_b",
        name: "\u5BE9\u6838\u9280\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t3_mini_b",
        artKey: "workplace_t3_mini_b"
      },
      artKey: "workplace_t3_mini_b"
    },
    {
      id: "workplace_t3_boss",
      family: "workplace",
      tier: "elite",
      tierIndex: 3,
      encounter: "boss",
      role: "boss",
      name: "\u9EC3\u91D1\u5951\u7D04\u738B\u30FB\u5C01\u5370",
      title: null,
      hp: 1105,
      atk: 89,
      def: 64,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t3_boss",
      signatureName: "\u9EC3\u91D1\u84CB\u5370",
      commonSkillIds: [
        "common_reflect",
        "common_cleanse"
      ],
      signatureSummary: "\u9EC3\u91D1\u84CB\u5370\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u91D1\u5370\u843D\u4E0B\u524D\u64CA\u4E2D\u4E2D\u5FC3\uFF1B70% HP\u8B77\u76FE7%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_workplace_t3_boss",
        name: "\u5C01\u5370\u91D1\u7AE0",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t3_boss",
        artKey: "workplace_t3_boss"
      },
      artKey: "workplace_t3_boss"
    },
    {
      id: "workplace_t4_normal_a",
      family: "workplace",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalA",
      name: "\u79DF\u5C4B\u4FE1\u5DEE",
      title: null,
      hp: 800,
      atk: 71,
      def: 54,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t4_normal_a",
      signatureName: "\u6F32\u79DF\u5FEB\u905E",
      commonSkillIds: [
        "common_shock"
      ],
      signatureSummary: "\u6F32\u79DF\u5FEB\u905E\uFF1A\u57FA\u6E96\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u4FE1\u5C01\u5C01\u881F\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mat_workplace_t4_normal_a",
        name: "\u79DF\u7D04\u4FE1\u5C01",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "workplace_t4_normal_a",
        artKey: "workplace_t4_normal_a"
      },
      artKey: "workplace_t4_normal_a"
    },
    {
      id: "workplace_4",
      family: "workplace",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalExisting",
      name: "\u9ED1\u5FC3\u5305\u79DF\u5A46",
      title: null,
      hp: 1e3,
      atk: 89,
      def: 68,
      passive: false,
      existing: true,
      signatureSkillId: "sig_workplace_4",
      signatureName: "\u79DF\u7D04\u8FFD\u64CA",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u79DF\u7D04\u8FFD\u64CA\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\uFF0BATK-8% 1\u56DE\u5408",
      counterSummary: "\u5169\u4EFD\u79DF\u7D04\u5404\u5C0D\u61C9\u4E00\u6BB5\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "workplace_m4",
        name: "\u6F32\u79DF\u901A\u77E5",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "workplace_4",
        artKey: "workplace_4"
      },
      artKey: "workplace_4"
    },
    {
      id: "workplace_t4_normal_b",
      family: "workplace",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalB",
      name: "\u5927\u6A13\u7BA1\u7406\u5C07",
      title: null,
      hp: 1200,
      atk: 107,
      def: 82,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t4_normal_b",
      signatureName: "\u9580\u7981\u5C01\u9663",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u9580\u7981\u5C01\u9663\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE7%\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u4E09\u628A\u767C\u4EAE\u9470\u5319\u4F9D\u5E8F\u64CA\u7834",
      material: {
        id: "mat_workplace_t4_normal_b",
        name: "\u7BA1\u7406\u91D1\u9470",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "workplace_t4_normal_b",
        artKey: "workplace_t4_normal_b"
      },
      artKey: "workplace_t4_normal_b"
    },
    {
      id: "workplace_t4_mini_a",
      family: "workplace",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE5\u574A\u7E3D\u76E3",
      title: null,
      hp: 1300,
      atk: 134,
      def: 88,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t4_mini_a",
      signatureName: "\u7522\u7DDA\u58D3\u9663",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u7522\u7DDA\u58D3\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5C0F\u738B\u57FA\u6E96\xD70.4",
      counterSummary: "\u8F38\u9001\u5E36\u986F\u793A\u5012\u6578\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u5EF6\u9072\u6BB5",
      material: {
        id: "mat_workplace_t4_mini_a",
        name: "\u7E3D\u76E3\u91CF\u5C3A",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t4_mini_a",
        artKey: "workplace_t4_mini_a"
      },
      artKey: "workplace_t4_mini_a"
    },
    {
      id: "workplace_t4_mini_b",
      family: "workplace",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5951\u7D04\u88C1\u5B9A\u5B98",
      title: null,
      hp: 1500,
      atk: 116,
      def: 102,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t4_mini_b",
      signatureName: "\u88C1\u5B9A\u7D05\u7DDA",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u88C1\u5B9A\u7D05\u7DDA\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BDEF-8% 2\u56DE\u5408",
      counterSummary: "\u5C04\u65B7\u7D05\u7DDA\u5169\u7AEF\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_workplace_t4_mini_b",
        name: "\u88C1\u5B9A\u91D1\u7B46",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t4_mini_b",
        artKey: "workplace_t4_mini_b"
      },
      artKey: "workplace_t4_mini_b"
    },
    {
      id: "workplace_t4_boss",
      family: "workplace",
      tier: "fierce",
      tierIndex: 4,
      encounter: "boss",
      role: "boss",
      name: "\u9EC3\u91D1\u5951\u7D04\u738B\u30FB\u738B\u4EE4",
      title: null,
      hp: 1700,
      atk: 134,
      def: 109,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t4_boss",
      signatureName: "\u738B\u4EE4\u8FFD\u7E73",
      commonSkillIds: [
        "common_reflect",
        "common_cleanse"
      ],
      signatureSummary: "\u738B\u4EE4\u8FFD\u7E73\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BATK-8% 2\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u4E09\u679A\u738B\u4EE4\u5370\uFF1B70% HP\u53CD\u5C04+3%\uFF0C40% HP\u72C0\u614B\u5E45\u5EA6+2%",
      material: {
        id: "mat_workplace_t4_boss",
        name: "\u738B\u4EE4\u91D1\u7D19",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t4_boss",
        artKey: "workplace_t4_boss"
      },
      artKey: "workplace_t4_boss"
    },
    {
      id: "workplace_t5_normal_a",
      family: "workplace",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalA",
      name: "\u91D1\u7AE0\u79D8\u66F8",
      title: null,
      hp: 1280,
      atk: 108,
      def: 84,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t5_normal_a",
      signatureName: "\u884C\u7A0B\u6392\u6EFF",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u884C\u7A0B\u6392\u6EFF\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.45",
      counterSummary: "\u884C\u4E8B\u66C6\u660E\u793A\u4E00\u56DE\u5408\u5012\u6578",
      material: {
        id: "mat_workplace_t5_normal_a",
        name: "\u91D1\u7AE0\u7DDE\u5E36",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "workplace_t5_normal_a",
        artKey: "workplace_t5_normal_a"
      },
      artKey: "workplace_t5_normal_a"
    },
    {
      id: "workplace_5",
      family: "workplace",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalExisting",
      name: "\u8CA1\u95A5\u7E3D\u88C1",
      title: null,
      hp: 1600,
      atk: 135,
      def: 105,
      passive: false,
      existing: true,
      signatureSkillId: "sig_workplace_5",
      signatureName: "\u8CA1\u95A5\u865F\u4EE4",
      commonSkillIds: [
        "common_rage"
      ],
      signatureSummary: "\u8CA1\u95A5\u865F\u4EE4\uFF1A\u57FA\u6E96\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u64CA\u788E\u91D1\u5370\u53D6\u6D88\u5F31\u5316\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "workplace_m5",
        name: "\u8CA1\u95A5\u5370\u7AE0",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "workplace_5",
        artKey: "workplace_5"
      },
      artKey: "workplace_5"
    },
    {
      id: "workplace_t5_normal_b",
      family: "workplace",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalB",
      name: "\u8CA1\u5EAB\u8FD1\u885B",
      title: null,
      hp: 1920,
      atk: 162,
      def: 126,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t5_normal_b",
      signatureName: "\u91D1\u5EAB\u58C1\u58D8",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u91D1\u5EAB\u58C1\u58D8\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE10%\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u91D1\u5EAB\u8F49\u76E4\u4E09\u500B\u4EAE\u9EDE",
      material: {
        id: "mat_workplace_t5_normal_b",
        name: "\u8CA1\u5EAB\u8B77\u724C",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "workplace_t5_normal_b",
        artKey: "workplace_t5_normal_b"
      },
      artKey: "workplace_t5_normal_b"
    },
    {
      id: "workplace_t5_mini_a",
      family: "workplace",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE5\u574A\u7763\u5C0E",
      title: null,
      hp: 2080,
      atk: 203,
      def: 137,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t5_mini_a",
      signatureName: "\u5343\u5DE5\u9F4A\u4F5C",
      commonSkillIds: [
        "common_rage",
        "common_stance"
      ],
      signatureSummary: "\u5343\u5DE5\u9F4A\u4F5C\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u500B\u5DE5\u574A\u5716\u6A19\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_workplace_t5_mini_a",
        name: "\u7763\u5C0E\u738B\u5C3A",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t5_mini_a",
        artKey: "workplace_t5_mini_a"
      },
      artKey: "workplace_t5_mini_a"
    },
    {
      id: "workplace_t5_mini_b",
      family: "workplace",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u9996\u5E2D\u57F7\u884C\u5B98",
      title: null,
      hp: 2400,
      atk: 176,
      def: 158,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t5_mini_b",
      signatureName: "\u7D42\u5C40\u57F7\u884C",
      commonSkillIds: [
        "common_armor",
        "common_weaken"
      ],
      signatureSummary: "\u7D42\u5C40\u57F7\u884C\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u9ED1\u5370\u5B8C\u6210\u524D\u905470%\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_workplace_t5_mini_b",
        name: "\u9996\u5E2D\u9ED1\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t5_mini_b",
        artKey: "workplace_t5_mini_b"
      },
      artKey: "workplace_t5_mini_b"
    },
    {
      id: "workplace_t5_boss",
      family: "workplace",
      tier: "boss",
      tierIndex: 5,
      encounter: "boss",
      role: "boss",
      name: "\u9EC3\u91D1\u5951\u7D04\u738B\u30FB\u738B\u5EA7",
      title: null,
      hp: 2720,
      atk: 203,
      def: 168,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t5_boss",
      signatureName: "\u842C\u7D04\u6B78\u4E00",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u842C\u7D04\u6B78\u4E00\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.5",
      counterSummary: "\u5951\u7D04\u5377\u986F\u793A\u5012\u6578\uFF1B70% HP\u8B77\u76FE10%\uFF0C40% HP\u5EF6\u9072\u6BB5+8%",
      material: {
        id: "mat_workplace_t5_boss",
        name: "\u738B\u5EA7\u91D1\u5951",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t5_boss",
        artKey: "workplace_t5_boss"
      },
      artKey: "workplace_t5_boss"
    },
    {
      id: "workplace_t6_normal_a",
      family: "workplace",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalA",
      name: "\u6C38\u7E8C\u6587\u66F8\u9748",
      title: null,
      hp: 2e3,
      atk: 151,
      def: 124,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t6_normal_a",
      signatureName: "\u7121\u76E1\u6284\u9304",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u7121\u76E1\u6284\u9304\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9801\u5377\u8EF8\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_workplace_t6_normal_a",
        name: "\u6C38\u7E8C\u5377\u8EF8",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t6_normal_a",
        artKey: "workplace_t6_normal_a"
      },
      artKey: "workplace_t6_normal_a"
    },
    {
      id: "workplace_6",
      family: "workplace",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalExisting",
      name: "\u8CC7\u672C\u9B54\u738B",
      title: null,
      hp: 2500,
      atk: 189,
      def: 155,
      passive: false,
      existing: true,
      signatureSkillId: "sig_workplace_6",
      signatureName: "\u8CC7\u672C\u6D2A\u6D41",
      commonSkillIds: [
        "common_rage"
      ],
      signatureSummary: "\u8CC7\u672C\u6D2A\u6D41\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE10%\uFF0BATK-10% 1\u56DE\u5408",
      counterSummary: "\u6D2A\u6D41\u4E2D\u592E\u91D1\u5E63\u6A19\u8A18\u53EF\u53D6\u6D88\u7A7F\u76FE\u8207\u72C0\u614B",
      material: {
        id: "workplace_m6",
        name: "\u8CC7\u672C\u6838\u5FC3",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_6",
        artKey: "workplace_6"
      },
      artKey: "workplace_6"
    },
    {
      id: "workplace_t6_normal_b",
      family: "workplace",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalB",
      name: "\u6C38\u7E8C\u57F7\u884C\u5B98",
      title: null,
      hp: 3e3,
      atk: 227,
      def: 186,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t6_normal_b",
      signatureName: "\u6C38\u7E8C\u88C1\u4EE4",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u6C38\u7E8C\u88C1\u4EE4\uFF1A\u57FA\u6E96\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u6C38\u7E8C\u74B0\u9589\u5408\u524D\u64CA\u4E2D\u4E09\u500B\u7BC0\u9EDE",
      material: {
        id: "mat_workplace_t6_normal_b",
        name: "\u6C38\u7E8C\u5FBD\u5370",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t6_normal_b",
        artKey: "workplace_t6_normal_b"
      },
      artKey: "workplace_t6_normal_b"
    },
    {
      id: "workplace_t6_mini_a",
      family: "workplace",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5DE5\u574A\u5927\u5320",
      title: null,
      hp: 3250,
      atk: 284,
      def: 202,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t6_mini_a",
      signatureName: "\u842C\u6A5F\u5171\u9CF4",
      commonSkillIds: [
        "common_rage",
        "common_stance"
      ],
      signatureSummary: "\u842C\u6A5F\u5171\u9CF4\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.1",
      counterSummary: "\u4E09\u5EA7\u6A5F\u95DC\u4F9D\u5E8F\u4EAE\u8D77\u4E26\u9010\u6BB5\u7834\u89E3",
      material: {
        id: "mat_workplace_t6_mini_a",
        name: "\u5927\u5320\u91D1\u8F2A",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t6_mini_a",
        artKey: "workplace_t6_mini_a"
      },
      artKey: "workplace_t6_mini_a"
    },
    {
      id: "workplace_t6_mini_b",
      family: "workplace",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u8056\u5370\u57F7\u884C\u5B98",
      title: null,
      hp: 3750,
      atk: 246,
      def: 233,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t6_mini_b",
      signatureName: "\u5929\u7D04\u57F7\u884C",
      commonSkillIds: [
        "common_reflect",
        "common_weaken"
      ],
      signatureSummary: "\u5929\u7D04\u57F7\u884C\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u5929\u7D04\u56DB\u89D2\u4F9D\u5E8F\u64CA\u7834\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_workplace_t6_mini_b",
        name: "\u8056\u5370\u5951\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t6_mini_b",
        artKey: "workplace_t6_mini_b"
      },
      artKey: "workplace_t6_mini_b"
    },
    {
      id: "workplace_t6_boss",
      family: "workplace",
      tier: "mythic",
      tierIndex: 6,
      encounter: "boss",
      role: "boss",
      name: "\u9EC3\u91D1\u5951\u7D04\u738B\u30FB\u6C38\u6046",
      title: null,
      hp: 4250,
      atk: 284,
      def: 248,
      passive: false,
      existing: false,
      signatureSkillId: "sig_workplace_t6_boss",
      signatureName: "\u6C38\u6046\u5DE5\u6642",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u6C38\u6046\u5DE5\u6642\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.6",
      counterSummary: "\u6642\u9418\u660E\u793A\u4E00\u56DE\u5408\u5012\u6578\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u5EF6\u9072\u6BB5+10%\uFF0C\u4ECD\u53EF\u7834\u89E3",
      material: {
        id: "mat_workplace_t6_boss",
        name: "\u6C38\u6046\u91D1\u5951",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "workplace_t6_boss",
        artKey: "workplace_t6_boss"
      },
      artKey: "workplace_t6_boss"
    },
    {
      id: "exam_t1_normal_a",
      family: "exam",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalA",
      name: "\u925B\u7B46\u5C0F\u7CBE\u9748",
      title: null,
      hp: 190,
      atk: 15,
      def: 10,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t1_normal_a",
      signatureName: "\u7B46\u5C16\u7A81\u523A",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u7B46\u5C16\u7A81\u523A\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u547D\u4E2D\u5F8CATK-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u767C\u4EAE\u7B46\u5C16\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "mat_exam_t1_normal_a",
        name: "\u661F\u5C51\u7B46\u82AF",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "exam_t1_normal_a",
        artKey: "exam_t1_normal_a"
      },
      artKey: "exam_t1_normal_a"
    },
    {
      id: "exam_1",
      family: "exam",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5C0F\u8003",
      title: null,
      hp: 238,
      atk: 19,
      def: 13,
      passive: false,
      existing: true,
      signatureSkillId: "sig_exam_1",
      signatureName: "\u81E8\u6642\u62BD\u8003",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u81E8\u6642\u62BD\u8003\uFF1A\u57FA\u6E96\uFF0B9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5B8C\u6210\u5247\u73A9\u5BB6\u672C\u56DE\u5408\u50B7\u5BB3+10%",
      counterSummary: "\u534A\u6578\u7BAD\u90549\u5206\u5373\u7834\u89E3\u4E26\u53D6\u5F97\u734E\u52F5",
      material: {
        id: "exam_m1",
        name: "\u5C0F\u8003\u5377",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "exam_1",
        artKey: "exam_1"
      },
      artKey: "exam_1"
    },
    {
      id: "exam_t1_normal_b",
      family: "exam",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalB",
      name: "\u65B9\u683C\u7B54\u984C\u5175",
      title: null,
      hp: 286,
      atk: 23,
      def: 16,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t1_normal_b",
      signatureName: "\u65B9\u683C\u5217\u9663",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u65B9\u683C\u5217\u9663\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE5%",
      counterSummary: "\u4F9D\u5E8F\u547D\u4E2D\u4E09\u500B\u767C\u4EAE\u65B9\u683C",
      material: {
        id: "mat_exam_t1_normal_b",
        name: "\u65B9\u683C\u7D19\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "exam_t1_normal_b",
        artKey: "exam_t1_normal_b"
      },
      artKey: "exam_t1_normal_b"
    },
    {
      id: "exam_t1_mini_a",
      family: "exam",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u898B\u7FD2\u5377\u8EF8\u8003\u5B98",
      title: null,
      hp: 309,
      atk: 29,
      def: 17,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t1_mini_a",
      signatureName: "\u958B\u5377\u9EDE\u540D",
      commonSkillIds: [
        "common_charge",
        "common_weakpoint"
      ],
      signatureSummary: "\u958B\u5377\u9EDE\u540D\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u88AB\u9EDE\u4EAE\u7684\u5377\u8EF8\u540D\u5B57\u4F4D\u7F6E\u70BA\u5F31\u9EDE",
      material: {
        id: "mat_exam_t1_mini_a",
        name: "\u898B\u7FD2\u8003\u5B98\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t1_mini_a",
        artKey: "exam_t1_mini_a"
      },
      artKey: "exam_t1_mini_a"
    },
    {
      id: "exam_t1_mini_b",
      family: "exam",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u52A0\u6CD5\u5B88\u9580\u54E1",
      title: null,
      hp: 357,
      atk: 25,
      def: 20,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t1_mini_b",
      signatureName: "\u52A0\u7E3D\u5C01\u9580",
      commonSkillIds: [
        "common_armor",
        "common_stance"
      ],
      signatureSummary: "\u52A0\u7E3D\u5C01\u9580\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u547D\u4E2D\u5408\u8A08\u70BA10\u7684\u5169\u500B\u6578\u5B57\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_exam_t1_mini_b",
        name: "\u52A0\u6CD5\u7B97\u73E0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t1_mini_b",
        artKey: "exam_t1_mini_b"
      },
      artKey: "exam_t1_mini_b"
    },
    {
      id: "exam_t1_boss",
      family: "exam",
      tier: "common",
      tierIndex: 1,
      encounter: "boss",
      role: "boss",
      name: "\u8A66\u7149\u5927\u8CE2\u8005\u30FB\u555F\u8499",
      title: null,
      hp: 405,
      atk: 29,
      def: 21,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t1_boss",
      signatureName: "\u555F\u8499\u8A66\u7149\u9663",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u555F\u8499\u8A66\u7149\u9663\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u4E09\u679A\u521D\u968E\u7B26\u865F\u4F9D\u5E8F\u4EAE\u8D77\uFF1B70% HP\u8B77\u76FE+2%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_exam_t1_boss",
        name: "\u555F\u8499\u8CE2\u8005\u5370",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t1_boss",
        artKey: "exam_t1_boss"
      },
      artKey: "exam_t1_boss"
    },
    {
      id: "exam_t2_normal_a",
      family: "exam",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalA",
      name: "\u7B46\u8A18\u7D19\u9DB4",
      title: null,
      hp: 304,
      atk: 26,
      def: 18,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t2_normal_a",
      signatureName: "\u7D19\u9DB4\u50B3\u984C",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u7D19\u9DB4\u50B3\u984C\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD70.9",
      counterSummary: "\u5169\u96BB\u7D19\u9DB4\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_exam_t2_normal_a",
        name: "\u647A\u9801\u7B46\u8A18",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "exam_t2_normal_a",
        artKey: "exam_t2_normal_a"
      },
      artKey: "exam_t2_normal_a"
    },
    {
      id: "exam_2",
      family: "exam",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalExisting",
      name: "\u6BB5\u8003",
      title: null,
      hp: 380,
      atk: 33,
      def: 23,
      passive: false,
      existing: true,
      signatureSkillId: "sig_exam_2",
      signatureName: "\u7BC4\u570D\u64F4\u5F35",
      commonSkillIds: [
        "common_weaken"
      ],
      signatureSummary: "\u7BC4\u570D\u64F4\u5F35\uFF1A\u57FA\u6E96\xD70.9\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5377\u8EF8\u4E0A\u4E09\u500B\u767C\u4EAE\u7AE0\u7BC0\u53D6\u6D88\u5F31\u5316",
      material: {
        id: "exam_m2",
        name: "\u6BB5\u8003\u7B46\u8A18",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "exam_2",
        artKey: "exam_2"
      },
      artKey: "exam_2"
    },
    {
      id: "exam_t2_normal_b",
      family: "exam",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalB",
      name: "\u9078\u64C7\u984C\u528D\u58EB",
      title: null,
      hp: 456,
      atk: 40,
      def: 28,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t2_normal_b",
      signatureName: "\u56DB\u9078\u7A81\u64CA",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u56DB\u9078\u7A81\u64CA\uFF1A\u57FA\u6E96\uFF0B\u6307\u5B9A\u5149\u8272\u6311\u6230\uFF1B\u5931\u6557DEF-5% 1\u56DE\u5408",
      counterSummary: "\u56DB\u500B\u9078\u9805\u4E2D\u547D\u4E2D\u767C\u4EAE\u9078\u9805\u5373\u53EF\u524A\u5F31",
      material: {
        id: "mat_exam_t2_normal_b",
        name: "\u9078\u9805\u5FBD\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "exam_t2_normal_b",
        artKey: "exam_t2_normal_b"
      },
      artKey: "exam_t2_normal_b"
    },
    {
      id: "exam_t2_mini_a",
      family: "exam",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u9280\u7FBD\u5377\u8EF8\u8003\u5B98",
      title: null,
      hp: 494,
      atk: 50,
      def: 30,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t2_mini_a",
      signatureName: "\u9280\u7FBD\u95B1\u5377",
      commonSkillIds: [
        "common_charge",
        "common_weakpoint"
      ],
      signatureSummary: "\u9280\u7FBD\u95B1\u5377\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u7FBD\u7B46\u8207\u5377\u5370\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_exam_t2_mini_a",
        name: "\u9280\u7FBD\u8003\u5B98\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t2_mini_a",
        artKey: "exam_t2_mini_a"
      },
      artKey: "exam_t2_mini_a"
    },
    {
      id: "exam_t2_mini_b",
      family: "exam",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u4E58\u6CD5\u5B88\u9580\u54E1",
      title: null,
      hp: 570,
      atk: 43,
      def: 35,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t2_mini_b",
      signatureName: "\u500D\u6578\u5C4F\u969C",
      commonSkillIds: [
        "common_armor",
        "common_stance"
      ],
      signatureSummary: "\u500D\u6578\u5C4F\u969C\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE5%\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u547D\u4E2D\u540C\u8272\u500D\u6578\u7B26\u865F\u53D6\u6D88\u6548\u679C",
      material: {
        id: "mat_exam_t2_mini_b",
        name: "\u4E58\u6CD5\u7B97\u73E0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t2_mini_b",
        artKey: "exam_t2_mini_b"
      },
      artKey: "exam_t2_mini_b"
    },
    {
      id: "exam_t2_boss",
      family: "exam",
      tier: "rare",
      tierIndex: 2,
      encounter: "boss",
      role: "boss",
      name: "\u8A66\u7149\u5927\u8CE2\u8005\u30FB\u535A\u805E",
      title: null,
      hp: 646,
      atk: 50,
      def: 37,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t2_boss",
      signatureName: "\u767E\u5377\u554F\u7B54\u9663",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u767E\u5377\u554F\u7B54\u9663\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BATK-5% 1\u56DE\u5408",
      counterSummary: "\u4E09\u5377\u4E2D\u767C\u4EAE\u4E3B\u5377\u70BA\u5F31\u9EDE\uFF1B70% HP\u6E1B\u50B7+5%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_exam_t2_boss",
        name: "\u535A\u805E\u8CE2\u8005\u5370",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t2_boss",
        artKey: "exam_t2_boss"
      },
      artKey: "exam_t2_boss"
    },
    {
      id: "exam_t3_normal_a",
      family: "exam",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalA",
      name: "\u58A8\u6C34\u66F8\u9748",
      title: null,
      hp: 494,
      atk: 42,
      def: 30,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t3_normal_a",
      signatureName: "\u58A8\u8DE1\u8FFD\u984C",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u58A8\u8DE1\u8FFD\u984C\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD70.9",
      counterSummary: "\u5169\u6EF4\u661F\u58A8\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_exam_t3_normal_a",
        name: "\u9748\u58A8\u5C0F\u74F6",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "exam_t3_normal_a",
        artKey: "exam_t3_normal_a"
      },
      artKey: "exam_t3_normal_a"
    },
    {
      id: "exam_3",
      family: "exam",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalExisting",
      name: "\u671F\u672B\u8003",
      title: null,
      hp: 618,
      atk: 52,
      def: 38,
      passive: false,
      existing: true,
      signatureSkillId: "sig_exam_3",
      signatureName: "\u5168\u79D1\u7A81\u8972",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u5168\u79D1\u7A81\u8972\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u500B\u79D1\u76EE\u5FBD\u7AE0\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "exam_m3",
        name: "\u671F\u672B\u8003\u5377",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "exam_3",
        artKey: "exam_3"
      },
      artKey: "exam_3"
    },
    {
      id: "exam_t3_normal_b",
      family: "exam",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalB",
      name: "\u5E7E\u4F55\u5713\u898F\u9A0E\u58EB",
      title: null,
      hp: 742,
      atk: 62,
      def: 46,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t3_normal_b",
      signatureName: "\u5713\u5F27\u5C01\u9396",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u5713\u5F27\u5C01\u9396\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u547D\u4E2D\u5713\u5FC3\u8207\u5F27\u7DDA\u4EA4\u9EDE\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_exam_t3_normal_b",
        name: "\u5E7E\u4F55\u9280\u91DD",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "exam_t3_normal_b",
        artKey: "exam_t3_normal_b"
      },
      artKey: "exam_t3_normal_b"
    },
    {
      id: "exam_t3_mini_a",
      family: "exam",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u85CD\u7D0B\u5377\u8EF8\u8003\u5B98",
      title: null,
      hp: 803,
      atk: 78,
      def: 49,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t3_mini_a",
      signatureName: "\u85CD\u5377\u8FFD\u554F",
      commonSkillIds: [
        "common_charge",
        "common_cleanse"
      ],
      signatureSummary: "\u85CD\u5377\u8FFD\u554F\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5931\u6557ATK-8% 1\u56DE\u5408",
      counterSummary: "\u534A\u6578\u7BAD\u90549\u5206\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_exam_t3_mini_a",
        name: "\u85CD\u7D0B\u8003\u5B98\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t3_mini_a",
        artKey: "exam_t3_mini_a"
      },
      artKey: "exam_t3_mini_a"
    },
    {
      id: "exam_t3_mini_b",
      family: "exam",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5206\u6578\u5B88\u9580\u54E1",
      title: null,
      hp: 927,
      atk: 68,
      def: 57,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t3_mini_b",
      signatureName: "\u5206\u5272\u7D50\u754C",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u5206\u5272\u7D50\u754C\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u5DE6\u53F3\u5340\u57DF\u54C1\u8CEA\u5DEE\u226410%\u53EF\u5B8C\u6574\u7834\u89E3",
      material: {
        id: "mat_exam_t3_mini_b",
        name: "\u5206\u6578\u6676\u677F",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t3_mini_b",
        artKey: "exam_t3_mini_b"
      },
      artKey: "exam_t3_mini_b"
    },
    {
      id: "exam_t3_boss",
      family: "exam",
      tier: "elite",
      tierIndex: 3,
      encounter: "boss",
      role: "boss",
      name: "\u8A66\u7149\u5927\u8CE2\u8005\u30FB\u842C\u5377",
      title: null,
      hp: 1051,
      atk: 78,
      def: 61,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t3_boss",
      signatureName: "\u842C\u5377\u8FF4\u5ECA",
      commonSkillIds: [
        "common_regen",
        "common_armor"
      ],
      signatureSummary: "\u842C\u5377\u8FF4\u5ECA\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.4",
      counterSummary: "\u5377\u8EF8\u8DEF\u5F91\u5012\u6578\u4E00\u56DE\u5408\uFF1B70% HP\u8B77\u76FE7%\uFF0C40% HP\u5EF6\u9072\u6BB5+5%",
      material: {
        id: "mat_exam_t3_boss",
        name: "\u842C\u5377\u8CE2\u8005\u5370",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t3_boss",
        artKey: "exam_t3_boss"
      },
      artKey: "exam_t3_boss"
    },
    {
      id: "exam_t4_normal_a",
      family: "exam",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalA",
      name: "\u661F\u5716\u5C3A\u7CBE\u9748",
      title: null,
      hp: 760,
      atk: 62,
      def: 52,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t4_normal_a",
      signatureName: "\u661F\u7DDA\u5B9A\u4F4D",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u661F\u7DDA\u5B9A\u4F4D\uFF1A\u57FA\u6E96\uFF0B\u6307\u5B9A9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5B8C\u6210\u5247\u73A9\u5BB6\u50B7\u5BB3+10%",
      counterSummary: "\u547D\u4E2D\u661F\u7DDA\u4EA4\u9EDE\u4E26\u905470%\u53D6\u5F97\u734E\u52F5",
      material: {
        id: "mat_exam_t4_normal_a",
        name: "\u661F\u5716\u523B\u5EA6",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "exam_t4_normal_a",
        artKey: "exam_t4_normal_a"
      },
      artKey: "exam_t4_normal_a"
    },
    {
      id: "exam_4",
      family: "exam",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5B78\u6E2C\u9B54\u738B",
      title: null,
      hp: 950,
      atk: 78,
      def: 65,
      passive: false,
      existing: true,
      signatureSkillId: "sig_exam_4",
      signatureName: "\u5012\u6578\u9418\u8072",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u5012\u6578\u9418\u8072\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.45",
      counterSummary: "\u660E\u793A\u4E00\u56DE\u5408\u5012\u6578\uFF1B\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u5EF6\u9072\u6BB5",
      material: {
        id: "exam_m4",
        name: "\u5B78\u6E2C\u51C6\u8003\u8B49",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "exam_4",
        artKey: "exam_4"
      },
      artKey: "exam_4"
    },
    {
      id: "exam_t4_normal_b",
      family: "exam",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalB",
      name: "\u7B54\u984C\u5361\u91CD\u885B",
      title: null,
      hp: 1140,
      atk: 94,
      def: 78,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t4_normal_b",
      signatureName: "\u9ED1\u683C\u76FE\u9663",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u9ED1\u683C\u76FE\u9663\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE7%\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u4F9D\u4EAE\u8D77\u9806\u5E8F\u547D\u4E2D\u4E09\u500B\u65B9\u683C",
      material: {
        id: "mat_exam_t4_normal_b",
        name: "\u7B54\u984C\u6676\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "exam_t4_normal_b",
        artKey: "exam_t4_normal_b"
      },
      artKey: "exam_t4_normal_b"
    },
    {
      id: "exam_t4_mini_a",
      family: "exam",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u91D1\u5370\u5377\u8EF8\u8003\u5B98",
      title: null,
      hp: 1235,
      atk: 117,
      def: 85,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t4_mini_a",
      signatureName: "\u91D1\u5370\u5C01\u5377",
      commonSkillIds: [
        "common_charge",
        "common_cleanse"
      ],
      signatureSummary: "\u91D1\u5370\u5C01\u5377\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-8% 2\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u91D1\u5370\u56DB\u89D2\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_exam_t4_mini_a",
        name: "\u91D1\u5370\u8003\u5B98\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t4_mini_a",
        artKey: "exam_t4_mini_a"
      },
      artKey: "exam_t4_mini_a"
    },
    {
      id: "exam_t4_mini_b",
      family: "exam",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u65B9\u7A0B\u5B88\u9580\u54E1",
      title: null,
      hp: 1425,
      atk: 101,
      def: 98,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t4_mini_b",
      signatureName: "\u672A\u77E5\u6578\u7262\u7C60",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u672A\u77E5\u6578\u7262\u7C60\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BDEF-8% 2\u56DE\u5408",
      counterSummary: "\u547D\u4E2D\u552F\u4E00\u767C\u4EAE\u672A\u77E5\u6578\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_exam_t4_mini_b",
        name: "\u65B9\u7A0B\u7B26\u77F3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t4_mini_b",
        artKey: "exam_t4_mini_b"
      },
      artKey: "exam_t4_mini_b"
    },
    {
      id: "exam_t4_boss",
      family: "exam",
      tier: "fierce",
      tierIndex: 4,
      encounter: "boss",
      role: "boss",
      name: "\u8A66\u7149\u5927\u8CE2\u8005\u30FB\u661F\u7B97",
      title: null,
      hp: 1615,
      atk: 117,
      def: 104,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t4_boss",
      signatureName: "\u661F\u7B97\u5929\u76E4",
      commonSkillIds: [
        "common_regen",
        "common_armor"
      ],
      signatureSummary: "\u661F\u7B97\u5929\u76E4\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5927\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9846\u4E3B\u661F\u9010\u6BB5\u7834\u89E3\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u7E3D\u50B7+5%",
      material: {
        id: "mat_exam_t4_boss",
        name: "\u661F\u7B97\u8CE2\u8005\u5370",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t4_boss",
        artKey: "exam_t4_boss"
      },
      artKey: "exam_t4_boss"
    },
    {
      id: "exam_t5_normal_a",
      family: "exam",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalA",
      name: "\u69AE\u8B7D\u5FBD\u7AE0\u9748",
      title: null,
      hp: 1216,
      atk: 95,
      def: 80,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t5_normal_a",
      signatureName: "\u69AE\u5149\u9F13\u821E",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u69AE\u5149\u9F13\u821E\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u81EA\u8EAB\u8B77\u76FE7%",
      counterSummary: "\u64CA\u4E2D\u5FBD\u7AE0\u4E2D\u592E\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_exam_t5_normal_a",
        name: "\u69AE\u8B7D\u7DDE\u5E36",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "exam_t5_normal_a",
        artKey: "exam_t5_normal_a"
      },
      artKey: "exam_t5_normal_a"
    },
    {
      id: "exam_5",
      family: "exam",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalExisting",
      name: "\u570B\u8003\u7149\u7344",
      title: null,
      hp: 1520,
      atk: 119,
      def: 100,
      passive: false,
      existing: true,
      signatureSkillId: "sig_exam_5",
      signatureName: "\u9577\u5E74\u8A66\u7149",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u9577\u5E74\u8A66\u7149\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.5",
      counterSummary: "\u5E74\u8F2A\u986F\u793A\u4E00\u56DE\u5408\u5012\u6578\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88",
      material: {
        id: "exam_m5",
        name: "\u570B\u8003\u8B49\u66F8",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "exam_5",
        artKey: "exam_5"
      },
      artKey: "exam_5"
    },
    {
      id: "exam_t5_normal_b",
      family: "exam",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalB",
      name: "\u77E5\u8B58\u8056\u5178\u885B",
      title: null,
      hp: 1824,
      atk: 143,
      def: 120,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t5_normal_b",
      signatureName: "\u8056\u5178\u93AE\u9801",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u8056\u5178\u93AE\u9801\uFF1A\u57FA\u6E96\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u66F8\u6263\u5169\u5074\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_exam_t5_normal_b",
        name: "\u8056\u5178\u66F8\u6263",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "exam_t5_normal_b",
        artKey: "exam_t5_normal_b"
      },
      artKey: "exam_t5_normal_b"
    },
    {
      id: "exam_t5_mini_a",
      family: "exam",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u738B\u7ACB\u5377\u8EF8\u8003\u5B98",
      title: null,
      hp: 1976,
      atk: 179,
      def: 130,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t5_mini_a",
      signatureName: "\u738B\u7ACB\u88C1\u5377",
      commonSkillIds: [
        "common_charge",
        "common_cleanse"
      ],
      signatureSummary: "\u738B\u7ACB\u88C1\u5377\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u738B\u7ACB\u5370\u843D\u4E0B\u524D\u905470%\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_exam_t5_mini_a",
        name: "\u738B\u7ACB\u8003\u5B98\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t5_mini_a",
        artKey: "exam_t5_mini_a"
      },
      artKey: "exam_t5_mini_a"
    },
    {
      id: "exam_t5_mini_b",
      family: "exam",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u51FD\u6578\u5B88\u9580\u54E1",
      title: null,
      hp: 2280,
      atk: 155,
      def: 150,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t5_mini_b",
      signatureName: "\u66F2\u7DDA\u8FF7\u5BAE",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u66F2\u7DDA\u8FF7\u5BAE\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BDEF-10% 2\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u66F2\u7DDA\u8F49\u6298\u9EDE\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_exam_t5_mini_b",
        name: "\u51FD\u6578\u661F\u76E4",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t5_mini_b",
        artKey: "exam_t5_mini_b"
      },
      artKey: "exam_t5_mini_b"
    },
    {
      id: "exam_t5_boss",
      family: "exam",
      tier: "boss",
      tierIndex: 5,
      encounter: "boss",
      role: "boss",
      name: "\u8A66\u7149\u5927\u8CE2\u8005\u30FB\u771F\u77E5",
      title: null,
      hp: 2584,
      atk: 179,
      def: 160,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t5_boss",
      signatureName: "\u771F\u77E5\u88C1\u554F",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u771F\u77E5\u88C1\u554F\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B9\u5206\u4EE5\u4E0A\u6311\u6230\uFF1B\u5931\u6557ATK-10% 2\u56DE\u5408",
      counterSummary: "\u534A\u6578\u7BAD\u90549\u5206\u53D6\u6D88\u72C0\u614B\uFF1B70% HP\u8B77\u76FE10%\uFF0C40% HP\u50B7\u5BB3+8%",
      material: {
        id: "mat_exam_t5_boss",
        name: "\u771F\u77E5\u8CE2\u8005\u5370",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t5_boss",
        artKey: "exam_t5_boss"
      },
      artKey: "exam_t5_boss"
    },
    {
      id: "exam_t6_normal_a",
      family: "exam",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalA",
      name: "\u5929\u7A79\u7FBD\u7B46\u4F7F",
      title: null,
      hp: 1900,
      atk: 133,
      def: 118,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t6_normal_a",
      signatureName: "\u5929\u66F8\u75BE\u7B46",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u5929\u66F8\u75BE\u7B46\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9053\u7FBD\u7B46\u5149\u75D5\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_exam_t6_normal_a",
        name: "\u5929\u7A79\u7FBD\u5C16",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t6_normal_a",
        artKey: "exam_t6_normal_a"
      },
      artKey: "exam_t6_normal_a"
    },
    {
      id: "exam_6",
      family: "exam",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5347\u5B78\u5236\u5EA6\u672C\u9AD4",
      title: null,
      hp: 2375,
      atk: 166,
      def: 147,
      passive: false,
      existing: true,
      signatureSkillId: "sig_exam_6",
      signatureName: "\u5236\u5EA6\u8FF7\u5BAE",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u5236\u5EA6\u8FF7\u5BAE\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.55",
      counterSummary: "\u8DEF\u7DDA\u6E05\u695A\u5012\u6578\u4E00\u56DE\u5408\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88",
      material: {
        id: "exam_m6",
        name: "\u5347\u5B78\u5236\u5EA6\u788E\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_6",
        artKey: "exam_6"
      },
      artKey: "exam_6"
    },
    {
      id: "exam_t6_normal_b",
      family: "exam",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalB",
      name: "\u661F\u754C\u5178\u7C4D\u5C07",
      title: null,
      hp: 2850,
      atk: 199,
      def: 176,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t6_normal_b",
      signatureName: "\u661F\u5178\u93AE\u754C",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u661F\u5178\u93AE\u754C\uFF1A\u57FA\u6E96\uFF0B\u8B77\u76FE10%",
      counterSummary: "\u64CA\u4E2D\u66F8\u810A\u4E09\u9846\u661F\u77F3\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_exam_t6_normal_b",
        name: "\u661F\u754C\u66F8\u810A",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t6_normal_b",
        artKey: "exam_t6_normal_b"
      },
      artKey: "exam_t6_normal_b"
    },
    {
      id: "exam_t6_mini_a",
      family: "exam",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5929\u547D\u5377\u8EF8\u8003\u5B98",
      title: null,
      hp: 3088,
      atk: 249,
      def: 191,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t6_mini_a",
      signatureName: "\u5929\u547D\u7D42\u5377",
      commonSkillIds: [
        "common_charge",
        "common_cleanse"
      ],
      signatureSummary: "\u5929\u547D\u7D42\u5377\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BATK-10% 2\u56DE\u5408",
      counterSummary: "\u5929\u547D\u5377\u56DB\u89D2\u9010\u4E00\u64CA\u7834\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_exam_t6_mini_a",
        name: "\u5929\u547D\u8003\u5B98\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t6_mini_a",
        artKey: "exam_t6_mini_a"
      },
      artKey: "exam_t6_mini_a"
    },
    {
      id: "exam_t6_mini_b",
      family: "exam",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u7121\u9650\u7B97\u5F0F\u5B88\u9580\u54E1",
      title: null,
      hp: 3563,
      atk: 216,
      def: 221,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t6_mini_b",
      signatureName: "\u7121\u9650\u63A8\u6F14",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u7121\u9650\u63A8\u6F14\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.1\uFF0BDEF-10% 1\u56DE\u5408",
      counterSummary: "\u4E09\u500B\u7121\u9650\u74B0\u7BC0\u9010\u6BB5\u7834\u89E3\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_exam_t6_mini_b",
        name: "\u7121\u9650\u7B97\u74B0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t6_mini_b",
        artKey: "exam_t6_mini_b"
      },
      artKey: "exam_t6_mini_b"
    },
    {
      id: "exam_t6_boss",
      family: "exam",
      tier: "mythic",
      tierIndex: 6,
      encounter: "boss",
      role: "boss",
      name: "\u8A66\u7149\u5927\u8CE2\u8005\u30FB\u5168\u77E5",
      title: null,
      hp: 4038,
      atk: 249,
      def: 235,
      passive: false,
      existing: false,
      signatureSkillId: "sig_exam_t6_boss",
      signatureName: "\u5168\u77E5\u7D42\u6975\u8A66\u7149",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u5168\u77E5\u7D42\u6975\u8A66\u7149\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.6",
      counterSummary: "\u5168\u77E5\u661F\u76E4\u5012\u6578\u4E00\u56DE\u5408\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u5EF6\u9072\u6BB5+10%\uFF0C\u4ECD\u53EF\u7834\u89E3",
      material: {
        id: "mat_exam_t6_boss",
        name: "\u5168\u77E5\u8CE2\u8005\u51A0",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "exam_t6_boss",
        artKey: "exam_t6_boss"
      },
      artKey: "exam_t6_boss"
    },
    {
      id: "temple_t1_normal_a",
      family: "temple",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalA",
      name: "\u8611\u83C7\u5E3D\u5C0F\u5996",
      title: null,
      hp: 210,
      atk: 17,
      def: 12,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t1_normal_a",
      signatureName: "\u8611\u83C7\u5F48\u8DF3",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u8611\u83C7\u5F48\u8DF3\uFF1A\u57FA\u6E96\xD70.9\uFF1B\u81EA\u8EAB\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u8611\u83C7\u5E3D\u4EAE\u9EDE\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_temple_t1_normal_a",
        name: "\u6591\u9EDE\u5E3D\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "temple_t1_normal_a",
        artKey: "temple_t1_normal_a"
      },
      artKey: "temple_t1_normal_a"
    },
    {
      id: "temple_1",
      family: "temple",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalExisting",
      name: "\u54E5\u5E03\u6797",
      title: null,
      hp: 263,
      atk: 21,
      def: 15,
      passive: false,
      existing: true,
      signatureSkillId: "sig_temple_1",
      signatureName: "\u91D1\u7259\u7A81\u8972",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u91D1\u7259\u7A81\u8972\uFF1A\u57FA\u6E96\u50B7\u5BB3",
      counterSummary: "\u91D1\u7259\u84C4\u5149\u6642\u905470%\u53EF\u5927\u5E45\u524A\u5F31",
      material: {
        id: "temple_m1",
        name: "\u54E5\u5E03\u6797\u91D1\u7259",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "temple_1",
        artKey: "temple_1"
      },
      artKey: "temple_1"
    },
    {
      id: "temple_t1_normal_b",
      family: "temple",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalB",
      name: "\u6728\u76FE\u5730\u7CBE\u5175",
      title: null,
      hp: 316,
      atk: 25,
      def: 18,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t1_normal_b",
      signatureName: "\u6728\u76FE\u63A8\u9032",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u6728\u76FE\u63A8\u9032\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE5%",
      counterSummary: "\u64CA\u4E2D\u6728\u76FE\u4E2D\u592E\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_temple_t1_normal_b",
        name: "\u6A61\u6728\u76FE\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "temple_t1_normal_b",
        artKey: "temple_t1_normal_b"
      },
      artKey: "temple_t1_normal_b"
    },
    {
      id: "temple_t1_mini_a",
      family: "temple",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u57CE\u5821\u898B\u7FD2\u5148\u92D2",
      title: null,
      hp: 342,
      atk: 32,
      def: 20,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t1_mini_a",
      signatureName: "\u5148\u92D2\u885D\u9663",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u5148\u92D2\u885D\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u64CA\u4E2D\u65D7\u5E5F\u7BAD\u982D\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_temple_t1_mini_a",
        name: "\u898B\u7FD2\u5148\u92D2\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t1_mini_a",
        artKey: "temple_t1_mini_a"
      },
      artKey: "temple_t1_mini_a"
    },
    {
      id: "temple_t1_mini_b",
      family: "temple",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u5B78\u5F92\u7B26\u6587\u6CD5\u885B",
      title: null,
      hp: 395,
      atk: 27,
      def: 23,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t1_mini_b",
      signatureName: "\u7B26\u6587\u5149\u5F48",
      commonSkillIds: [
        "common_armor",
        "common_weakpoint"
      ],
      signatureSummary: "\u7B26\u6587\u5149\u5F48\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u5169\u679A\u7B26\u6587\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_temple_t1_mini_b",
        name: "\u521D\u523B\u7B26\u77F3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t1_mini_b",
        artKey: "temple_t1_mini_b"
      },
      artKey: "temple_t1_mini_b"
    },
    {
      id: "temple_t1_boss",
      family: "temple",
      tier: "common",
      tierIndex: 1,
      encounter: "boss",
      role: "boss",
      name: "\u5929\u7A79\u9F8D\u7687\u30FB\u5E7C\u7FFC",
      title: null,
      hp: 447,
      atk: 32,
      def: 24,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t1_boss",
      signatureName: "\u5E7C\u9F8D\u7FD4\u64CA",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u5E7C\u9F8D\u7FD4\u64CA\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u5169\u7FFC\u9593\u7684\u9F8D\u51A0\u4EAE\u8D77\uFF1B70% HP\u8B77\u76FE+2%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_temple_t1_boss",
        name: "\u5E7C\u7FFC\u9F8D\u51A0\u7247",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t1_boss",
        artKey: "temple_t1_boss"
      },
      artKey: "temple_t1_boss"
    },
    {
      id: "temple_t2_normal_a",
      family: "temple",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalA",
      name: "\u93A7\u7532\u5C0F\u9748",
      title: null,
      hp: 336,
      atk: 30,
      def: 20,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t2_normal_a",
      signatureName: "\u93A7\u7532\u8FF4\u65CB",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u93A7\u7532\u8FF4\u65CB\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD70.9",
      counterSummary: "\u80A9\u7532\u5169\u5074\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_temple_t2_normal_a",
        name: "\u7A7A\u5FC3\u93A7\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "temple_t2_normal_a",
        artKey: "temple_t2_normal_a"
      },
      artKey: "temple_t2_normal_a"
    },
    {
      id: "temple_2",
      family: "temple",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalExisting",
      name: "\u9AB7\u9ACF\u528D\u58EB",
      title: null,
      hp: 420,
      atk: 37,
      def: 25,
      passive: false,
      existing: true,
      signatureSkillId: "sig_temple_2",
      signatureName: "\u6708\u5149\u528D\u821E",
      commonSkillIds: [
        "common_stance"
      ],
      signatureSummary: "\u6708\u5149\u528D\u821E\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96",
      counterSummary: "\u5169\u9053\u6708\u5149\u528D\u75D5\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "temple_m2",
        name: "\u788E\u9AA8\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "temple_2",
        artKey: "temple_2"
      },
      artKey: "temple_2"
    },
    {
      id: "temple_t2_normal_b",
      family: "temple",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalB",
      name: "\u77F3\u5854\u9577\u69CD\u5175",
      title: null,
      hp: 504,
      atk: 44,
      def: 30,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t2_normal_b",
      signatureName: "\u9577\u69CD\u5C01\u8DEF",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u9577\u69CD\u5C01\u8DEF\uFF1A\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u69CD\u5C16\u5149\u9EDE\u53D6\u6D88\u964D\u9632",
      material: {
        id: "mat_temple_t2_normal_b",
        name: "\u77F3\u5854\u69CD\u5C16",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "temple_t2_normal_b",
        artKey: "temple_t2_normal_b"
      },
      artKey: "temple_t2_normal_b"
    },
    {
      id: "temple_t2_mini_a",
      family: "temple",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u9280\u76FE\u57CE\u5821\u5148\u92D2",
      title: null,
      hp: 546,
      atk: 56,
      def: 33,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t2_mini_a",
      signatureName: "\u9280\u76FE\u7A81\u9032",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u9280\u76FE\u7A81\u9032\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u9280\u76FE\u958B\u555F\u6642\u547D\u4E2D\u4E2D\u592E\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_temple_t2_mini_a",
        name: "\u9280\u76FE\u5148\u92D2\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t2_mini_a",
        artKey: "temple_t2_mini_a"
      },
      artKey: "temple_t2_mini_a"
    },
    {
      id: "temple_t2_mini_b",
      family: "temple",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u9752\u7D0B\u7B26\u6587\u6CD5\u885B",
      title: null,
      hp: 630,
      atk: 48,
      def: 38,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t2_mini_b",
      signatureName: "\u9752\u7D0B\u5C4F\u969C",
      commonSkillIds: [
        "common_armor",
        "common_weakpoint"
      ],
      signatureSummary: "\u9752\u7D0B\u5C4F\u969C\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE5%\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u4E09\u679A\u9752\u7D0B\u7BC0\u9EDE",
      material: {
        id: "mat_temple_t2_mini_b",
        name: "\u9752\u7D0B\u7B26\u77F3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t2_mini_b",
        artKey: "temple_t2_mini_b"
      },
      artKey: "temple_t2_mini_b"
    },
    {
      id: "temple_t2_boss",
      family: "temple",
      tier: "rare",
      tierIndex: 2,
      encounter: "boss",
      role: "boss",
      name: "\u5929\u7A79\u9F8D\u7687\u30FB\u632F\u7FFC",
      title: null,
      hp: 714,
      atk: 56,
      def: 40,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t2_boss",
      signatureName: "\u632F\u7FFC\u98A8\u58D3",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u632F\u7FFC\u98A8\u58D3\uFF1A\u5927\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE10%",
      counterSummary: "\u7FFC\u98A8\u4E2D\u592E\u51FA\u73FE\u5F31\u9EDE\uFF1B70% HP\u6E1B\u50B7+5%\uFF0C40% HP\u7A7F\u76FE+5%",
      material: {
        id: "mat_temple_t2_boss",
        name: "\u632F\u7FFC\u9F8D\u51A0\u7247",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t2_boss",
        artKey: "temple_t2_boss"
      },
      artKey: "temple_t2_boss"
    },
    {
      id: "temple_t3_normal_a",
      family: "temple",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalA",
      name: "\u6708\u5F71\u72D0\u9748",
      title: null,
      hp: 546,
      atk: 46,
      def: 34,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t3_normal_a",
      signatureName: "\u6708\u5F71\u75BE\u884C",
      commonSkillIds: [
        "common_weakpoint"
      ],
      signatureSummary: "\u6708\u5F71\u75BE\u884C\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD70.9",
      counterSummary: "\u771F\u6B63\u6708\u5F71\u5E36\u6709\u661F\u9EDE\uFF0C\u53EF\u53D6\u6D88\u7B2C\u4E8C\u6BB5",
      material: {
        id: "mat_temple_t3_normal_a",
        name: "\u6708\u5F71\u5C3E\u6BDB",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "temple_t3_normal_a",
        artKey: "temple_t3_normal_a"
      },
      artKey: "temple_t3_normal_a"
    },
    {
      id: "temple_3",
      family: "temple",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalExisting",
      name: "\u72FC\u4EBA",
      title: null,
      hp: 683,
      atk: 58,
      def: 42,
      passive: false,
      existing: true,
      signatureSkillId: "sig_temple_3",
      signatureName: "\u6708\u4E0B\u8FFD\u7375",
      commonSkillIds: [
        "common_rage"
      ],
      signatureSummary: "\u6708\u4E0B\u8FFD\u7375\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u6708\u8F2A\u4E2D\u592E\u4EAE\u8D77\u6642\u547D\u4E2D\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "temple_m3",
        name: "\u72FC\u4EBA\u4E4B\u722A",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "temple_3",
        artKey: "temple_3"
      },
      artKey: "temple_3"
    },
    {
      id: "temple_t3_normal_b",
      family: "temple",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalB",
      name: "\u7345\u9DF2\u65A5\u5019",
      title: null,
      hp: 820,
      atk: 70,
      def: 50,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t3_normal_b",
      signatureName: "\u9AD8\u7A7A\u4FEF\u885D",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u9AD8\u7A7A\u4FEF\u885D\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.4",
      counterSummary: "\u5730\u9762\u843D\u9EDE\u660E\u793A\u4E00\u56DE\u5408\u5012\u6578",
      material: {
        id: "mat_temple_t3_normal_b",
        name: "\u7345\u9DF2\u7FBD\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "temple_t3_normal_b",
        artKey: "temple_t3_normal_b"
      },
      artKey: "temple_t3_normal_b"
    },
    {
      id: "temple_t3_mini_a",
      family: "temple",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u6708\u5821\u57CE\u5821\u5148\u92D2",
      title: null,
      hp: 888,
      atk: 87,
      def: 55,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t3_mini_a",
      signatureName: "\u6708\u5821\u9023\u65AC",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u6708\u5821\u9023\u65AC\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9762\u6708\u65D7\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_temple_t3_mini_a",
        name: "\u6708\u5821\u5148\u92D2\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t3_mini_a",
        artKey: "temple_t3_mini_a"
      },
      artKey: "temple_t3_mini_a"
    },
    {
      id: "temple_t3_mini_b",
      family: "temple",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u96F7\u7D0B\u7B26\u6587\u6CD5\u885B",
      title: null,
      hp: 1025,
      atk: 75,
      def: 63,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t3_mini_b",
      signatureName: "\u96F7\u7D0B\u9396\u93C8",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u96F7\u7D0B\u9396\u93C8\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u5169\u500B\u96F7\u7D0B\u63A5\u9EDE\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_temple_t3_mini_b",
        name: "\u96F7\u7D0B\u7B26\u77F3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t3_mini_b",
        artKey: "temple_t3_mini_b"
      },
      artKey: "temple_t3_mini_b"
    },
    {
      id: "temple_t3_boss",
      family: "temple",
      tier: "elite",
      tierIndex: 3,
      encounter: "boss",
      role: "boss",
      name: "\u5929\u7A79\u9F8D\u7687\u30FB\u84BC\u7FFC",
      title: null,
      hp: 1161,
      atk: 87,
      def: 67,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t3_boss",
      signatureName: "\u84BC\u7FFC\u65CB\u98A8",
      commonSkillIds: [
        "common_regen",
        "common_armor"
      ],
      signatureSummary: "\u84BC\u7FFC\u65CB\u98A8\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5927\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9053\u7FFC\u98A8\u9010\u6BB5\u7834\u89E3\uFF1B70% HP\u8B77\u76FE7%\uFF0C40% HP\u7E3D\u50B7+5%",
      material: {
        id: "mat_temple_t3_boss",
        name: "\u84BC\u7FFC\u9F8D\u51A0\u7247",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t3_boss",
        artKey: "temple_t3_boss"
      },
      artKey: "temple_t3_boss"
    },
    {
      id: "temple_t4_normal_a",
      family: "temple",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalA",
      name: "\u591C\u5BB4\u8759\u8760\u4F8D",
      title: null,
      hp: 840,
      atk: 69,
      def: 57,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t4_normal_a",
      signatureName: "\u7DDE\u5E36\u65CB\u821E",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u7DDE\u5E36\u65CB\u821E\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\uFF0BATK-8% 1\u56DE\u5408",
      counterSummary: "\u5169\u689D\u7DDE\u5E36\u5404\u5C0D\u61C9\u4E00\u6BB5\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_temple_t4_normal_a",
        name: "\u591C\u5BB4\u7DDE\u5E36",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "temple_t4_normal_a",
        artKey: "temple_t4_normal_a"
      },
      artKey: "temple_t4_normal_a"
    },
    {
      id: "temple_4",
      family: "temple",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5438\u8840\u9B3C\u4F2F\u7235",
      title: null,
      hp: 1050,
      atk: 86,
      def: 71,
      passive: false,
      existing: true,
      signatureSkillId: "sig_temple_4",
      signatureName: "\u7D05\u6708\u79AE\u528D",
      commonSkillIds: [
        "common_stance"
      ],
      signatureSummary: "\u7D05\u6708\u79AE\u528D\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u64CA\u4E2D\u975E\u8840\u8272\u7684\u7D05\u6708\u5BF6\u77F3\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "temple_m4",
        name: "\u5438\u8840\u9B3C\u7360\u7259",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "temple_4",
        artKey: "temple_4"
      },
      artKey: "temple_4"
    },
    {
      id: "temple_t4_normal_b",
      family: "temple",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalB",
      name: "\u53E4\u5821\u8594\u8587\u9A0E\u58EB",
      title: null,
      hp: 1260,
      atk: 103,
      def: 85,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t4_normal_b",
      signatureName: "\u8594\u8587\u528D\u9663",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u8594\u8587\u528D\u9663\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u679A\u9280\u8594\u8587\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_temple_t4_normal_b",
        name: "\u9280\u8594\u8587\u7AE0",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "temple_t4_normal_b",
        artKey: "temple_t4_normal_b"
      },
      artKey: "temple_t4_normal_b"
    },
    {
      id: "temple_t4_mini_a",
      family: "temple",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u738B\u5BB6\u57CE\u5821\u5148\u92D2",
      title: null,
      hp: 1365,
      atk: 129,
      def: 92,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t4_mini_a",
      signatureName: "\u738B\u65D7\u885D\u92D2",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u738B\u65D7\u885D\u92D2\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A615%",
      counterSummary: "\u738B\u65D7\u5C16\u7AEF\u4EAE\u8D77\u6642\u547D\u4E2D\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_temple_t4_mini_a",
        name: "\u738B\u5BB6\u5148\u92D2\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t4_mini_a",
        artKey: "temple_t4_mini_a"
      },
      artKey: "temple_t4_mini_a"
    },
    {
      id: "temple_t4_mini_b",
      family: "temple",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u708E\u7D0B\u7B26\u6587\u6CD5\u885B",
      title: null,
      hp: 1575,
      atk: 112,
      def: 107,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t4_mini_b",
      signatureName: "\u708E\u7D0B\u6CD5\u74B0",
      commonSkillIds: [
        "common_armor",
        "common_shock"
      ],
      signatureSummary: "\u708E\u7D0B\u6CD5\u74B0\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BDEF-8% 2\u56DE\u5408",
      counterSummary: "\u64CA\u7834\u6CD5\u74B0\u4E09\u500B\u706B\u7D0B\uFF1B\u90E8\u5206\u7834\u89E3\u7E2E\u70BA1\u56DE\u5408",
      material: {
        id: "mat_temple_t4_mini_b",
        name: "\u708E\u7D0B\u7B26\u77F3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t4_mini_b",
        artKey: "temple_t4_mini_b"
      },
      artKey: "temple_t4_mini_b"
    },
    {
      id: "temple_t4_boss",
      family: "temple",
      tier: "fierce",
      tierIndex: 4,
      encounter: "boss",
      role: "boss",
      name: "\u5929\u7A79\u9F8D\u7687\u30FB\u71BE\u7FFC",
      title: null,
      hp: 1785,
      atk: 129,
      def: 114,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t4_boss",
      signatureName: "\u71BE\u7FFC\u5410\u606F",
      commonSkillIds: [
        "common_regen",
        "common_armor"
      ],
      signatureSummary: "\u71BE\u7FFC\u5410\u606F\uFF1A\u5927\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE20%",
      counterSummary: "\u71BE\u7FFC\u5408\u650F\u524D\u64CA\u4E2D\u9F8D\u51A0\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_temple_t4_boss",
        name: "\u71BE\u7FFC\u9F8D\u51A0\u7247",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t4_boss",
        artKey: "temple_t4_boss"
      },
      artKey: "temple_t4_boss"
    },
    {
      id: "temple_t5_normal_a",
      family: "temple",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalA",
      name: "\u661F\u888D\u66F8\u9748",
      title: null,
      hp: 1344,
      atk: 105,
      def: 88,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t5_normal_a",
      signatureName: "\u661F\u9801\u98DB\u821E",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u661F\u9801\u98DB\u821E\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96",
      counterSummary: "\u4E09\u9801\u661F\u66F8\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_temple_t5_normal_a",
        name: "\u661F\u888D\u5E03\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "temple_t5_normal_a",
        artKey: "temple_t5_normal_a"
      },
      artKey: "temple_t5_normal_a"
    },
    {
      id: "temple_5",
      family: "temple",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5DEB\u5996\u738B",
      title: null,
      hp: 1680,
      atk: 131,
      def: 110,
      passive: false,
      existing: true,
      signatureSkillId: "sig_temple_5",
      signatureName: "\u738B\u5EA7\u79D8\u6CD5",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u738B\u5EA7\u79D8\u6CD5\uFF1A\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.5",
      counterSummary: "\u738B\u5EA7\u7B26\u6587\u5012\u6578\u4E00\u56DE\u5408\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88",
      material: {
        id: "temple_m5",
        name: "\u5DEB\u5996\u9B54\u6CD5\u66F8",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "temple_5",
        artKey: "temple_5"
      },
      artKey: "temple_5"
    },
    {
      id: "temple_t5_normal_b",
      family: "temple",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalB",
      name: "\u5967\u8853\u5854\u5B88\u885B",
      title: null,
      hp: 2016,
      atk: 157,
      def: 132,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t5_normal_b",
      signatureName: "\u5967\u8853\u58C1\u58D8",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u5967\u8853\u58C1\u58D8\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE10%\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u6676\u6838\u56DB\u89D2\u53D6\u6D88\u6548\u679C",
      material: {
        id: "mat_temple_t5_normal_b",
        name: "\u5967\u8853\u6676\u6838",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "temple_t5_normal_b",
        artKey: "temple_t5_normal_b"
      },
      artKey: "temple_t5_normal_b"
    },
    {
      id: "temple_t5_mini_a",
      family: "temple",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u8056\u51A0\u57CE\u5821\u5148\u92D2",
      title: null,
      hp: 2184,
      atk: 197,
      def: 143,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t5_mini_a",
      signatureName: "\u8056\u51A0\u7834\u9663",
      commonSkillIds: [
        "common_rage",
        "common_stance"
      ],
      signatureSummary: "\u8056\u51A0\u7834\u9663\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A615%",
      counterSummary: "\u8056\u51A0\u4E2D\u592E\u5BF6\u77F3\u70BA\u5F31\u9EDE",
      material: {
        id: "mat_temple_t5_mini_a",
        name: "\u8056\u51A0\u5148\u92D2\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t5_mini_a",
        artKey: "temple_t5_mini_a"
      },
      artKey: "temple_t5_mini_a"
    },
    {
      id: "temple_t5_mini_b",
      family: "temple",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u661F\u7D0B\u7B26\u6587\u6CD5\u885B",
      title: null,
      hp: 2520,
      atk: 170,
      def: 165,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t5_mini_b",
      signatureName: "\u661F\u7D0B\u5929\u5E55",
      commonSkillIds: [
        "common_reflect",
        "common_cleanse"
      ],
      signatureSummary: "\u661F\u7D0B\u5929\u5E55\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u64CA\u7834\u5929\u5E55\u4E09\u9846\u4E3B\u661F\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_temple_t5_mini_b",
        name: "\u661F\u7D0B\u7B26\u77F3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t5_mini_b",
        artKey: "temple_t5_mini_b"
      },
      artKey: "temple_t5_mini_b"
    },
    {
      id: "temple_t5_boss",
      family: "temple",
      tier: "boss",
      tierIndex: 5,
      encounter: "boss",
      role: "boss",
      name: "\u5929\u7A79\u9F8D\u7687\u30FB\u661F\u7FFC",
      title: null,
      hp: 2856,
      atk: 197,
      def: 176,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t5_boss",
      signatureName: "\u661F\u7FFC\u6D41\u5149",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u661F\u7FFC\u6D41\u5149\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5927\u738B\u57FA\u6E96\xD71.1",
      counterSummary: "\u4E09\u9053\u661F\u7FFC\u5149\u6D41\u9010\u6BB5\u7834\u89E3\uFF1B70% HP\u8B77\u76FE10%\uFF0C40% HP\u7E3D\u50B7+8%",
      material: {
        id: "mat_temple_t5_boss",
        name: "\u661F\u7FFC\u9F8D\u51A0\u7247",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t5_boss",
        artKey: "temple_t5_boss"
      },
      artKey: "temple_t5_boss"
    },
    {
      id: "temple_t6_normal_a",
      family: "temple",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalA",
      name: "\u5929\u7A7A\u5CF6\u98A8\u9748",
      title: null,
      hp: 2100,
      atk: 147,
      def: 130,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t6_normal_a",
      signatureName: "\u96F2\u7AEF\u63A8\u9032",
      commonSkillIds: [
        "common_cleanse"
      ],
      signatureSummary: "\u96F2\u7AEF\u63A8\u9032\uFF1A\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u96F2\u74B0\u4E2D\u5FC3\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_temple_t6_normal_a",
        name: "\u5929\u7A7A\u98A8\u6676",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t6_normal_a",
        artKey: "temple_t6_normal_a"
      },
      artKey: "temple_t6_normal_a"
    },
    {
      id: "temple_6",
      family: "temple",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalExisting",
      name: "\u672B\u65E5\u60E1\u9F8D",
      title: null,
      hp: 2625,
      atk: 184,
      def: 163,
      passive: false,
      existing: true,
      signatureSkillId: "sig_temple_6",
      signatureName: "\u672B\u65E5\u9F8D\u606F",
      commonSkillIds: [
        "common_rage"
      ],
      signatureSummary: "\u672B\u65E5\u9F8D\u606F\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u8B77\u76FE10%\uFF0BDEF-10% 1\u56DE\u5408",
      counterSummary: "\u9F8D\u606F\u6838\u5FC3\u660E\u78BA\u4EAE\u8D77\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u9644\u52A0\u6548\u679C",
      material: {
        id: "temple_m6",
        name: "\u672B\u65E5\u9F8D\u9C57",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_6",
        artKey: "temple_6"
      },
      artKey: "temple_6"
    },
    {
      id: "temple_t6_normal_b",
      family: "temple",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalB",
      name: "\u795E\u8A71\u8056\u528D\u5C07",
      title: null,
      hp: 3150,
      atk: 221,
      def: 196,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t6_normal_b",
      signatureName: "\u8056\u528D\u958B\u5929",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u8056\u528D\u958B\u5929\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u8056\u528D\u4EA4\u53C9\u9EDE\u547D\u4E2D\u53EF\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_temple_t6_normal_b",
        name: "\u795E\u8A71\u528D\u6676",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t6_normal_b",
        artKey: "temple_t6_normal_b"
      },
      artKey: "temple_t6_normal_b"
    },
    {
      id: "temple_t6_mini_a",
      family: "temple",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5929\u7A79\u57CE\u5821\u5148\u92D2",
      title: null,
      hp: 3413,
      atk: 276,
      def: 212,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t6_mini_a",
      signatureName: "\u5929\u7A79\u9060\u5F81",
      commonSkillIds: [
        "common_rage",
        "common_stance"
      ],
      signatureSummary: "\u5929\u7A79\u9060\u5F81\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.1",
      counterSummary: "\u4E09\u9762\u5929\u7A79\u65D7\u5E5F\u9010\u6BB5\u7834\u89E3",
      material: {
        id: "mat_temple_t6_mini_a",
        name: "\u5929\u7A79\u5148\u92D2\u7AE0",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t6_mini_a",
        artKey: "temple_t6_mini_a"
      },
      artKey: "temple_t6_mini_a"
    },
    {
      id: "temple_t6_mini_b",
      family: "temple",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u795E\u57DF\u7B26\u6587\u6CD5\u885B",
      title: null,
      hp: 3938,
      atk: 239,
      def: 245,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t6_mini_b",
      signatureName: "\u795E\u57DF\u5C01\u754C",
      commonSkillIds: [
        "common_reflect",
        "common_cleanse"
      ],
      signatureSummary: "\u795E\u57DF\u5C01\u754C\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE10%",
      counterSummary: "\u64CA\u7834\u795E\u57DF\u6CD5\u9663\u56DB\u500B\u7BC0\u9EDE\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_temple_t6_mini_b",
        name: "\u795E\u57DF\u7B26\u77F3",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t6_mini_b",
        artKey: "temple_t6_mini_b"
      },
      artKey: "temple_t6_mini_b"
    },
    {
      id: "temple_t6_boss",
      family: "temple",
      tier: "mythic",
      tierIndex: 6,
      encounter: "boss",
      role: "boss",
      name: "\u5929\u7A79\u9F8D\u7687\u30FB\u5E1D\u7FFC",
      title: null,
      hp: 4463,
      atk: 276,
      def: 261,
      passive: false,
      existing: false,
      signatureSkillId: "sig_temple_t6_boss",
      signatureName: "\u5E1D\u7FFC\u661F\u9695",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u5E1D\u7FFC\u661F\u9695\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.6",
      counterSummary: "\u661F\u9695\u843D\u9EDE\u5012\u6578\u4E00\u56DE\u5408\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u5EF6\u9072\u6BB5+10%\uFF0C\u4ECD\u53EF\u7834\u89E3",
      material: {
        id: "mat_temple_t6_boss",
        name: "\u5E1D\u7FFC\u9F8D\u51A0",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "temple_t6_boss",
        artKey: "temple_t6_boss"
      },
      artKey: "temple_t6_boss"
    },
    {
      id: "treasure_1_real",
      family: "treasure",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalA",
      name: "\u5B89\u5206\u5BF6\u7BB1\u602A",
      title: null,
      hp: 80,
      atk: 1,
      def: 20,
      passive: true,
      existing: true,
      signatureSkillId: "sig_treasure_1_real",
      signatureName: "\u5B89\u975C\u85CF\u5BF6",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u5B89\u975C\u85CF\u5BF6\uFF1A\u7121\u50B7\u5BB3\uFF1B\u81EA\u8EAB\u8B77\u76FE5%",
      counterSummary: "\u64CA\u4E2D\u9396\u5B54\u53D6\u6D88\u8B77\u76FE\uFF1B\u6C38\u4E0D\u5B89\u6392\u53CD\u64CA",
      material: {
        id: "mat_treasure_1_real",
        name: "\u820A\u6728\u9396\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "treasure_1_real",
        artKey: "treasure_1_real"
      },
      artKey: "treasure_1_real"
    },
    {
      id: "treasure_1",
      family: "treasure",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalExisting",
      name: "\u5BF6\u7BB1\u602A",
      title: null,
      hp: 100,
      atk: 5,
      def: 15,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_1",
      signatureName: "\u7BB1\u84CB\u53CD\u5F48",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u7BB1\u84CB\u53CD\u5F48\uFF1A\u57FA\u6E96\xD70.8\uFF1B\u4E0D\u9644\u52A0\u72C0\u614B",
      counterSummary: "\u7BB1\u84CB\u958B\u555F\u524D\u64CA\u4E2D\u9396\u5B54\u53EF\u5B8C\u6574\u7834\u89E3",
      material: {
        id: "mat_treasure_1",
        name: "\u6D3B\u6728\u7BB1\u6263",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "treasure_1",
        artKey: "treasure_1"
      },
      artKey: "treasure_1"
    },
    {
      id: "treasure_t1_normal_b",
      family: "treasure",
      tier: "common",
      tierIndex: 1,
      encounter: "normal",
      role: "normalB",
      name: "\u6728\u5EAB\u5BF6\u7BB1\u5B88\u885B",
      title: null,
      hp: 120,
      atk: 6,
      def: 18,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t1_normal_b",
      signatureName: "\u6728\u7BB1\u885D\u649E",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u6728\u7BB1\u885D\u649E\uFF1A\u57FA\u6E96\u50B7\u5BB3",
      counterSummary: "\u6728\u8F2A\u8DEF\u7DDA\u4EAE\u8D77\u6642\u905470%",
      material: {
        id: "mat_treasure_t1_normal_b",
        name: "\u6728\u5EAB\u8B77\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 2
      },
      card: {
        id: "treasure_t1_normal_b",
        artKey: "treasure_t1_normal_b"
      },
      artKey: "treasure_t1_normal_b"
    },
    {
      id: "treasure_king_small_1",
      family: "treasure",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5BF6\u7BB1\u5C0F\u738B",
      title: "\u9285\u9396\u9818\u4E3B",
      hp: 130,
      atk: 8,
      def: 20,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_small_1",
      signatureName: "\u9285\u9396\u865F\u4EE4",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u9285\u9396\u865F\u4EE4\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u8B77\u76FE5%",
      counterSummary: "\u64CA\u4E2D\u9285\u9396\u4E09\u500B\u6263\u9EDE\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_treasure_king_small_1",
        name: "\u9285\u9396\u738B\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_small_1",
        artKey: "treasure_king_small_1"
      },
      artKey: "treasure_king_small_1"
    },
    {
      id: "treasure_t1_mini_b",
      family: "treasure",
      tier: "common",
      tierIndex: 1,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u539F\u77F3\u5BF6\u77F3\u9B54\u5076",
      title: null,
      hp: 150,
      atk: 7,
      def: 23,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t1_mini_b",
      signatureName: "\u539F\u77F3\u91CD\u62F3",
      commonSkillIds: [
        "common_armor",
        "common_stance"
      ],
      signatureSummary: "\u539F\u77F3\u91CD\u62F3\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u539F\u77F3\u62F3\u5FC3\u4EAE\u8D77\u6642\u547D\u4E2D\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_treasure_t1_mini_b",
        name: "\u539F\u77F3\u9B54\u5076\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_t1_mini_b",
        artKey: "treasure_t1_mini_b"
      },
      artKey: "treasure_t1_mini_b"
    },
    {
      id: "treasure_king_big_1",
      family: "treasure",
      tier: "common",
      tierIndex: 1,
      encounter: "boss",
      role: "boss",
      name: "\u5BF6\u7BB1\u5927\u738B",
      title: "\u738B\u51A0\u6728\u5EAB",
      hp: 170,
      atk: 8,
      def: 24,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_big_1",
      signatureName: "\u738B\u5EAB\u9707\u5730",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u738B\u5EAB\u9707\u5730\uFF1A\u5927\u738B\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u5730\u9762\u4E09\u679A\u91D1\u5E63\u5708\u4F9D\u5E8F\u4EAE\u8D77\uFF1B70% HP\u8B77\u76FE+2%\uFF0C40% HP\u50B7\u5BB3+5%",
      material: {
        id: "mat_treasure_king_big_1",
        name: "\u6728\u5EAB\u738B\u6838",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_big_1",
        artKey: "treasure_king_big_1"
      },
      artKey: "treasure_king_big_1"
    },
    {
      id: "treasure_2_real",
      family: "treasure",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalA",
      name: "\u5B89\u5206\u9EC3\u91D1\u5BF6\u7BB1\u602A",
      title: null,
      hp: 140,
      atk: 1,
      def: 35,
      passive: true,
      existing: true,
      signatureSkillId: "sig_treasure_2_real",
      signatureName: "\u91D1\u5149\u85CF\u5BF6",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u91D1\u5149\u85CF\u5BF6\uFF1A\u7121\u50B7\u5BB3\uFF1B\u81EA\u8EAB\u8B77\u76FE5%",
      counterSummary: "\u64CA\u4E2D\u91D1\u9396\u53D6\u6D88\u8B77\u76FE\uFF1B\u6C38\u4E0D\u5B89\u6392\u53CD\u64CA",
      material: {
        id: "mat_treasure_2_real",
        name: "\u6EAB\u91D1\u9396\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "treasure_2_real",
        artKey: "treasure_2_real"
      },
      artKey: "treasure_2_real"
    },
    {
      id: "treasure_2",
      family: "treasure",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalExisting",
      name: "\u9EC3\u91D1\u5BF6\u7BB1\u602A",
      title: null,
      hp: 180,
      atk: 8,
      def: 30,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_2",
      signatureName: "\u91D1\u5E63\u98DB\u6563",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u91D1\u5E63\u98DB\u6563\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD70.8",
      counterSummary: "\u5169\u679A\u4E3B\u91D1\u5E63\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_treasure_2",
        name: "\u9EC3\u91D1\u7BB1\u6263",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "treasure_2",
        artKey: "treasure_2"
      },
      artKey: "treasure_2"
    },
    {
      id: "treasure_t2_normal_b",
      family: "treasure",
      tier: "rare",
      tierIndex: 2,
      encounter: "normal",
      role: "normalB",
      name: "\u9EC3\u91D1\u5BF6\u7BB1\u5B88\u885B",
      title: null,
      hp: 216,
      atk: 10,
      def: 36,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t2_normal_b",
      signatureName: "\u91D1\u5EAB\u63A8\u9032",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u91D1\u5EAB\u63A8\u9032\uFF1A\u57FA\u6E96\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u63A8\u9032\u8DEF\u7DDA\u4E2D\u592E\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_treasure_t2_normal_b",
        name: "\u9EC3\u91D1\u8B77\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 3
      },
      card: {
        id: "treasure_t2_normal_b",
        artKey: "treasure_t2_normal_b"
      },
      artKey: "treasure_t2_normal_b"
    },
    {
      id: "treasure_king_small_2",
      family: "treasure",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5BF6\u7BB1\u5C0F\u738B",
      title: "\u9280\u9396\u9818\u4E3B",
      hp: 234,
      atk: 12,
      def: 39,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_small_2",
      signatureName: "\u9280\u9396\u5C01\u9580",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u9280\u9396\u5C01\u9580\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE5%",
      counterSummary: "\u9280\u9396\u5DE6\u53F3\u6263\u9EDE\u7686\u547D\u4E2D\u53EF\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_treasure_king_small_2",
        name: "\u9280\u9396\u738B\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_small_2",
        artKey: "treasure_king_small_2"
      },
      artKey: "treasure_king_small_2"
    },
    {
      id: "treasure_t2_mini_b",
      family: "treasure",
      tier: "rare",
      tierIndex: 2,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u7425\u73C0\u5BF6\u77F3\u9B54\u5076",
      title: null,
      hp: 270,
      atk: 10,
      def: 45,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t2_mini_b",
      signatureName: "\u7425\u73C0\u9707\u6CE2",
      commonSkillIds: [
        "common_armor",
        "common_stance"
      ],
      signatureSummary: "\u7425\u73C0\u9707\u6CE2\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BDEF-5% 1\u56DE\u5408",
      counterSummary: "\u7425\u73C0\u6838\u5FC3\u4EAE\u8D77\u6642\u905470%",
      material: {
        id: "mat_treasure_t2_mini_b",
        name: "\u7425\u73C0\u9B54\u5076\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_t2_mini_b",
        artKey: "treasure_t2_mini_b"
      },
      artKey: "treasure_t2_mini_b"
    },
    {
      id: "treasure_king_big_2",
      family: "treasure",
      tier: "rare",
      tierIndex: 2,
      encounter: "boss",
      role: "boss",
      name: "\u5BF6\u7BB1\u5927\u738B",
      title: "\u738B\u51A0\u91D1\u5EAB",
      hp: 306,
      atk: 12,
      def: 48,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_big_2",
      signatureName: "\u738B\u5EAB\u91D1\u96E8",
      commonSkillIds: [
        "common_charge",
        "common_armor"
      ],
      signatureSummary: "\u738B\u5EAB\u91D1\u96E8\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5927\u738B\u57FA\u6E96",
      counterSummary: "\u4E09\u679A\u738B\u51A0\u91D1\u5E63\u9010\u6BB5\u7834\u89E3\uFF1B70% HP\u6E1B\u50B7+5%\uFF0C40% HP\u7E3D\u50B7+5%",
      material: {
        id: "mat_treasure_king_big_2",
        name: "\u91D1\u5EAB\u738B\u6838",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_big_2",
        artKey: "treasure_king_big_2"
      },
      artKey: "treasure_king_big_2"
    },
    {
      id: "treasure_3_real",
      family: "treasure",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalA",
      name: "\u5B89\u5206\u947D\u77F3\u5BF6\u7BB1\u602A",
      title: null,
      hp: 220,
      atk: 1,
      def: 60,
      passive: true,
      existing: true,
      signatureSkillId: "sig_treasure_3_real",
      signatureName: "\u947D\u5149\u85CF\u5BF6",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u947D\u5149\u85CF\u5BF6\uFF1A\u7121\u50B7\u5BB3\uFF1B\u81EA\u8EAB\u8B77\u76FE7%",
      counterSummary: "\u64CA\u4E2D\u947D\u9396\u6298\u5149\u9EDE\u53D6\u6D88\u8B77\u76FE\uFF1B\u6C38\u4E0D\u5B89\u6392\u53CD\u64CA",
      material: {
        id: "mat_treasure_3_real",
        name: "\u67D4\u5149\u947D\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "treasure_3_real",
        artKey: "treasure_3_real"
      },
      artKey: "treasure_3_real"
    },
    {
      id: "treasure_3",
      family: "treasure",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalExisting",
      name: "\u947D\u77F3\u5BF6\u7BB1\u602A",
      title: null,
      hp: 280,
      atk: 12,
      def: 50,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_3",
      signatureName: "\u947D\u5149\u6298\u5C04",
      commonSkillIds: [
        "common_reflect"
      ],
      signatureSummary: "\u947D\u5149\u6298\u5C04\uFF1A\u57FA\u6E96\xD70.8\uFF0B\u6709\u9650\u53CD\u5C045% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u975E\u9583\u720D\u7684\u56FA\u5B9A\u947D\u9762\u53D6\u6D88\u53CD\u5C04",
      material: {
        id: "mat_treasure_3",
        name: "\u947D\u77F3\u7BB1\u6263",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "treasure_3",
        artKey: "treasure_3"
      },
      artKey: "treasure_3"
    },
    {
      id: "treasure_t3_normal_b",
      family: "treasure",
      tier: "elite",
      tierIndex: 3,
      encounter: "normal",
      role: "normalB",
      name: "\u947D\u6676\u5BF6\u7BB1\u5B88\u885B",
      title: null,
      hp: 336,
      atk: 14,
      def: 60,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t3_normal_b",
      signatureName: "\u6676\u76FE\u885D\u92D2",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u6676\u76FE\u885D\u92D2\uFF1A\u57FA\u6E96\uFF0B\u8B77\u76FE7%",
      counterSummary: "\u64CA\u4E2D\u6676\u76FE\u4E2D\u5FC3\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_treasure_t3_normal_b",
        name: "\u947D\u6676\u8B77\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 4
      },
      card: {
        id: "treasure_t3_normal_b",
        artKey: "treasure_t3_normal_b"
      },
      artKey: "treasure_t3_normal_b"
    },
    {
      id: "treasure_king_small_3",
      family: "treasure",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5BF6\u7BB1\u5C0F\u738B",
      title: "\u6676\u9396\u9818\u4E3B",
      hp: 364,
      atk: 18,
      def: 65,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_small_3",
      signatureName: "\u6676\u9396\u7D50\u754C",
      commonSkillIds: [
        "common_reflect",
        "common_armor"
      ],
      signatureSummary: "\u6676\u9396\u7D50\u754C\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE7%\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u4E09\u500B\u6676\u9396\u7BC0\u9EDE",
      material: {
        id: "mat_treasure_king_small_3",
        name: "\u6676\u9396\u738B\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_small_3",
        artKey: "treasure_king_small_3"
      },
      artKey: "treasure_king_small_3"
    },
    {
      id: "treasure_t3_mini_b",
      family: "treasure",
      tier: "elite",
      tierIndex: 3,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u85CD\u6676\u5BF6\u77F3\u9B54\u5076",
      title: null,
      hp: 420,
      atk: 16,
      def: 75,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t3_mini_b",
      signatureName: "\u85CD\u6676\u8108\u885D",
      commonSkillIds: [
        "common_charge",
        "common_stance"
      ],
      signatureSummary: "\u85CD\u6676\u8108\u885D\uFF1A2\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96",
      counterSummary: "\u5167\u5916\u5169\u5708\u8108\u885D\u5404\u5C0D\u61C9\u4E00\u6BB5",
      material: {
        id: "mat_treasure_t3_mini_b",
        name: "\u85CD\u6676\u9B54\u5076\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_t3_mini_b",
        artKey: "treasure_t3_mini_b"
      },
      artKey: "treasure_t3_mini_b"
    },
    {
      id: "treasure_king_big_3",
      family: "treasure",
      tier: "elite",
      tierIndex: 3,
      encounter: "boss",
      role: "boss",
      name: "\u5BF6\u7BB1\u5927\u738B",
      title: "\u738B\u51A0\u6676\u5EAB",
      hp: 476,
      atk: 18,
      def: 80,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_big_3",
      signatureName: "\u738B\u5EAB\u6298\u5149",
      commonSkillIds: [
        "common_reflect",
        "common_armor"
      ],
      signatureSummary: "\u738B\u5EAB\u6298\u5149\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u6709\u9650\u53CD\u5C045% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u56FA\u5B9A\u738B\u51A0\u6676\u9762\uFF1B70% HP\u8B77\u76FE7%\uFF0C40% HP\u53CD\u5C04+3%",
      material: {
        id: "mat_treasure_king_big_3",
        name: "\u6676\u5EAB\u738B\u6838",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_big_3",
        artKey: "treasure_king_big_3"
      },
      artKey: "treasure_king_big_3"
    },
    {
      id: "treasure_4_real",
      family: "treasure",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalA",
      name: "\u5B89\u5206\u7955\u9280\u5BF6\u7BB1\u602A",
      title: null,
      hp: 340,
      atk: 1,
      def: 95,
      passive: true,
      existing: true,
      signatureSkillId: "sig_treasure_4_real",
      signatureName: "\u7955\u9280\u85CF\u5BF6",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u7955\u9280\u85CF\u5BF6\uFF1A\u7121\u50B7\u5BB3\uFF1B\u81EA\u8EAB\u8B77\u76FE7%\uFF0B\u6E1B\u50B710% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u7955\u9280\u9396\u82AF\u53D6\u6D88\u6548\u679C\uFF1B\u6C38\u4E0D\u5B89\u6392\u53CD\u64CA",
      material: {
        id: "mat_treasure_4_real",
        name: "\u6EAB\u6F64\u7955\u9280\u7247",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "treasure_4_real",
        artKey: "treasure_4_real"
      },
      artKey: "treasure_4_real"
    },
    {
      id: "treasure_4",
      family: "treasure",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalExisting",
      name: "\u7955\u9280\u5BF6\u7BB1\u602A",
      title: null,
      hp: 420,
      atk: 18,
      def: 85,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_4",
      signatureName: "\u7955\u9280\u58C1\u58D8",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u7955\u9280\u58C1\u58D8\uFF1A\u7121\u50B7\u5BB3\uFF1B\u8B77\u76FE7%\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u4E09\u9053\u7955\u9280\u88C2\u7D0B\u4F9D\u5E8F\u64CA\u7834",
      material: {
        id: "mat_treasure_4",
        name: "\u7955\u9280\u7BB1\u6263",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "treasure_4",
        artKey: "treasure_4"
      },
      artKey: "treasure_4"
    },
    {
      id: "treasure_t4_normal_b",
      family: "treasure",
      tier: "fierce",
      tierIndex: 4,
      encounter: "normal",
      role: "normalB",
      name: "\u7955\u9280\u5BF6\u7BB1\u5B88\u885B",
      title: null,
      hp: 504,
      atk: 22,
      def: 102,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t4_normal_b",
      signatureName: "\u9280\u58C1\u63A8\u9032",
      commonSkillIds: [
        "common_charge"
      ],
      signatureSummary: "\u9280\u58C1\u63A8\u9032\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%",
      counterSummary: "\u9280\u58C1\u63A8\u9032\u524D\u64CA\u4E2D\u4E2D\u592E\u53D6\u6D88\u7A7F\u900F",
      material: {
        id: "mat_treasure_t4_normal_b",
        name: "\u7955\u9280\u8B77\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 5
      },
      card: {
        id: "treasure_t4_normal_b",
        artKey: "treasure_t4_normal_b"
      },
      artKey: "treasure_t4_normal_b"
    },
    {
      id: "treasure_king_small_4",
      family: "treasure",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5BF6\u7BB1\u5C0F\u738B",
      title: "\u7955\u9280\u9818\u4E3B",
      hp: 546,
      atk: 27,
      def: 111,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_small_4",
      signatureName: "\u7955\u9280\u5C01\u5EAB",
      commonSkillIds: [
        "common_reflect",
        "common_armor"
      ],
      signatureSummary: "\u7955\u9280\u5C01\u5EAB\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u56DB\u679A\u7955\u9280\u925A\u91D8\u53D6\u6D88\u6E1B\u50B7",
      material: {
        id: "mat_treasure_king_small_4",
        name: "\u7955\u9280\u738B\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_small_4",
        artKey: "treasure_king_small_4"
      },
      artKey: "treasure_king_small_4"
    },
    {
      id: "treasure_t4_mini_b",
      family: "treasure",
      tier: "fierce",
      tierIndex: 4,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u7D2B\u6676\u5BF6\u77F3\u9B54\u5076",
      title: null,
      hp: 630,
      atk: 23,
      def: 128,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t4_mini_b",
      signatureName: "\u7D2B\u6676\u91CD\u58D3",
      commonSkillIds: [
        "common_charge",
        "common_shock"
      ],
      signatureSummary: "\u7D2B\u6676\u91CD\u58D3\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0BDEF-8% 1\u56DE\u5408",
      counterSummary: "\u7D2B\u6676\u843D\u9EDE\u660E\u78BA\u986F\u793A\uFF0C\u905470%\u53D6\u6D88\u72C0\u614B",
      material: {
        id: "mat_treasure_t4_mini_b",
        name: "\u7D2B\u6676\u9B54\u5076\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_t4_mini_b",
        artKey: "treasure_t4_mini_b"
      },
      artKey: "treasure_t4_mini_b"
    },
    {
      id: "treasure_king_big_4",
      family: "treasure",
      tier: "fierce",
      tierIndex: 4,
      encounter: "boss",
      role: "boss",
      name: "\u5BF6\u7BB1\u5927\u738B",
      title: "\u738B\u51A0\u7955\u5EAB",
      hp: 714,
      atk: 27,
      def: 136,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_big_4",
      signatureName: "\u738B\u5EAB\u9280\u7246",
      commonSkillIds: [
        "common_reflect",
        "common_armor"
      ],
      signatureSummary: "\u738B\u5EAB\u9280\u7246\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u8B77\u76FE10%",
      counterSummary: "\u9280\u7246\u4E09\u6BB5\u4F9D\u5E8F\u64CA\u7834\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u8B77\u76FE+2%",
      material: {
        id: "mat_treasure_king_big_4",
        name: "\u7955\u5EAB\u738B\u6838",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_big_4",
        artKey: "treasure_king_big_4"
      },
      artKey: "treasure_king_big_4"
    },
    {
      id: "treasure_5_real",
      family: "treasure",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalA",
      name: "\u5B89\u5206\u9060\u53E4\u5BF6\u7BB1\u602A",
      title: null,
      hp: 500,
      atk: 1,
      def: 150,
      passive: true,
      existing: true,
      signatureSkillId: "sig_treasure_5_real",
      signatureName: "\u53E4\u5EAB\u85CF\u5BF6",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u53E4\u5EAB\u85CF\u5BF6\uFF1A\u7121\u50B7\u5BB3\uFF1B\u81EA\u8EAB\u8B77\u76FE10%",
      counterSummary: "\u64CA\u4E2D\u9060\u53E4\u9396\u6587\u53D6\u6D88\u8B77\u76FE\uFF1B\u6C38\u4E0D\u5B89\u6392\u53CD\u64CA",
      material: {
        id: "mat_treasure_5_real",
        name: "\u53E4\u820A\u7B26\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "treasure_5_real",
        artKey: "treasure_5_real"
      },
      artKey: "treasure_5_real"
    },
    {
      id: "treasure_5",
      family: "treasure",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalExisting",
      name: "\u9060\u53E4\u5BF6\u7BB1\u602A",
      title: null,
      hp: 650,
      atk: 25,
      def: 130,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_5",
      signatureName: "\u53E4\u4EE3\u6A5F\u95DC",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u53E4\u4EE3\u6A5F\u95DC\uFF1A\u57FA\u6E96\xD70.8\uFF0B\u5EF6\u9072\u653B\u64CA\u57FA\u6E96\xD70.4",
      counterSummary: "\u6A5F\u95DC\u5012\u6578\u4E00\u56DE\u5408\uFF0C\u5B8C\u6574\u7834\u89E3\u53D6\u6D88\u5EF6\u9072\u6BB5",
      material: {
        id: "mat_treasure_5",
        name: "\u9060\u53E4\u7BB1\u6263",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "treasure_5",
        artKey: "treasure_5"
      },
      artKey: "treasure_5"
    },
    {
      id: "treasure_t5_normal_b",
      family: "treasure",
      tier: "boss",
      tierIndex: 5,
      encounter: "normal",
      role: "normalB",
      name: "\u9060\u53E4\u5BF6\u7BB1\u5B88\u885B",
      title: null,
      hp: 780,
      atk: 30,
      def: 156,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t5_normal_b",
      signatureName: "\u53E4\u5EAB\u93AE\u5B88",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u53E4\u5EAB\u93AE\u5B88\uFF1A\u57FA\u6E96\uFF0B\u6E1B\u50B715% 1\u56DE\u5408",
      counterSummary: "\u9060\u53E4\u8B77\u9396\u56DB\u89D2\u9010\u4E00\u64CA\u7834",
      material: {
        id: "mat_treasure_t5_normal_b",
        name: "\u9060\u53E4\u8B77\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 5,
        upgradesToTier: 6
      },
      card: {
        id: "treasure_t5_normal_b",
        artKey: "treasure_t5_normal_b"
      },
      artKey: "treasure_t5_normal_b"
    },
    {
      id: "treasure_king_small_5",
      family: "treasure",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5BF6\u7BB1\u5C0F\u738B",
      title: "\u9060\u53E4\u9818\u4E3B",
      hp: 845,
      atk: 38,
      def: 169,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_small_5",
      signatureName: "\u9060\u53E4\u5C01\u5370",
      commonSkillIds: [
        "common_reflect",
        "common_armor"
      ],
      signatureSummary: "\u9060\u53E4\u5C01\u5370\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE10%",
      counterSummary: "\u64CA\u4E2D\u5C01\u5370\u4E2D\u5FC3\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_treasure_king_small_5",
        name: "\u9060\u53E4\u738B\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_small_5",
        artKey: "treasure_king_small_5"
      },
      artKey: "treasure_king_small_5"
    },
    {
      id: "treasure_t5_mini_b",
      family: "treasure",
      tier: "boss",
      tierIndex: 5,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u661F\u947D\u5BF6\u77F3\u9B54\u5076",
      title: null,
      hp: 975,
      atk: 33,
      def: 195,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t5_mini_b",
      signatureName: "\u661F\u947D\u589C\u64CA",
      commonSkillIds: [
        "common_charge",
        "common_shock"
      ],
      signatureSummary: "\u661F\u947D\u589C\u64CA\uFF1A\u5C0F\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5C0F\u738B\u57FA\u6E96\xD70.5",
      counterSummary: "\u661F\u947D\u843D\u9EDE\u5012\u6578\u4E00\u56DE\u5408",
      material: {
        id: "mat_treasure_t5_mini_b",
        name: "\u661F\u947D\u9B54\u5076\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_t5_mini_b",
        artKey: "treasure_t5_mini_b"
      },
      artKey: "treasure_t5_mini_b"
    },
    {
      id: "treasure_king_big_5",
      family: "treasure",
      tier: "boss",
      tierIndex: 5,
      encounter: "boss",
      role: "boss",
      name: "\u5BF6\u7BB1\u5927\u738B",
      title: "\u738B\u51A0\u53E4\u5EAB",
      hp: 1105,
      atk: 38,
      def: 208,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_big_5",
      signatureName: "\u738B\u5EAB\u661F\u9707",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u738B\u5EAB\u661F\u9707\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5927\u738B\u57FA\u6E96\xD71.05",
      counterSummary: "\u4E09\u9846\u5EAB\u661F\u9010\u6BB5\u7834\u89E3\uFF1B70% HP\u8B77\u76FE10%\uFF0C40% HP\u7E3D\u50B7+8%",
      material: {
        id: "mat_treasure_king_big_5",
        name: "\u53E4\u5EAB\u738B\u6838",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_big_5",
        artKey: "treasure_king_big_5"
      },
      artKey: "treasure_king_big_5"
    },
    {
      id: "treasure_6_real",
      family: "treasure",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalA",
      name: "\u5B89\u5206\u795E\u8A71\u5BF6\u7BB1\u5DE8\u50CF",
      title: null,
      hp: 800,
      atk: 1,
      def: 220,
      passive: true,
      existing: true,
      signatureSkillId: "sig_treasure_6_real",
      signatureName: "\u795E\u5EAB\u85CF\u5BF6",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u795E\u5EAB\u85CF\u5BF6\uFF1A\u7121\u50B7\u5BB3\uFF1B\u81EA\u8EAB\u8B77\u76FE10%\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u64CA\u4E2D\u795E\u8A71\u9396\u6838\u53D6\u6D88\u6548\u679C\uFF1B\u6C38\u4E0D\u5B89\u6392\u53CD\u64CA",
      material: {
        id: "mat_treasure_6_real",
        name: "\u795E\u8A71\u975C\u9ED8\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_6_real",
        artKey: "treasure_6_real"
      },
      artKey: "treasure_6_real"
    },
    {
      id: "treasure_6",
      family: "treasure",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalExisting",
      name: "\u795E\u8A71\u5BF6\u7BB1\u5DE8\u50CF",
      title: null,
      hp: 1e3,
      atk: 35,
      def: 190,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_6",
      signatureName: "\u795E\u8A71\u91D1\u6D41",
      commonSkillIds: [
        "common_regen"
      ],
      signatureSummary: "\u795E\u8A71\u91D1\u6D41\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u57FA\u6E96\xD70.9",
      counterSummary: "\u4E09\u9053\u91D1\u6D41\u4F9D\u54C1\u8CEA\u9010\u6BB5\u53D6\u6D88",
      material: {
        id: "mat_treasure_6",
        name: "\u795E\u8A71\u7BB1\u6838",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_6",
        artKey: "treasure_6"
      },
      artKey: "treasure_6"
    },
    {
      id: "treasure_t6_normal_b",
      family: "treasure",
      tier: "mythic",
      tierIndex: 6,
      encounter: "normal",
      role: "normalB",
      name: "\u795E\u8A71\u5BF6\u7BB1\u5B88\u885B",
      title: null,
      hp: 1200,
      atk: 42,
      def: 228,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t6_normal_b",
      signatureName: "\u795E\u5EAB\u9032\u8ECD",
      commonSkillIds: [
        "common_armor"
      ],
      signatureSummary: "\u795E\u5EAB\u9032\u8ECD\uFF1A\u57FA\u6E96\uFF0C\u7121\u8996\u9632\u79A610%\uFF0B\u6E1B\u50B720% 1\u56DE\u5408",
      counterSummary: "\u795E\u5EAB\u5FBD\u7AE0\u4EAE\u8D77\u6642\u547D\u4E2D\u53D6\u6D88\u9644\u52A0\u6548\u679C",
      material: {
        id: "mat_treasure_t6_normal_b",
        name: "\u795E\u8A71\u8B77\u9396",
        kind: "normal",
        convertible: true,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_t6_normal_b",
        artKey: "treasure_t6_normal_b"
      },
      artKey: "treasure_t6_normal_b"
    },
    {
      id: "treasure_king_small_6",
      family: "treasure",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniA",
      name: "\u5BF6\u7BB1\u5C0F\u738B",
      title: "\u795E\u8A71\u9818\u4E3B",
      hp: 1300,
      atk: 53,
      def: 247,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_small_6",
      signatureName: "\u795E\u8A71\u5C01\u5EAB",
      commonSkillIds: [
        "common_reflect",
        "common_armor"
      ],
      signatureSummary: "\u795E\u8A71\u5C01\u5EAB\uFF1A\u5C0F\u738B\u57FA\u6E96\xD70.9\uFF0B\u8B77\u76FE10%",
      counterSummary: "\u64CA\u4E2D\u795E\u8A71\u9396\u7684\u56DB\u500B\u661F\u9EDE\u53D6\u6D88\u8B77\u76FE",
      material: {
        id: "mat_treasure_king_small_6",
        name: "\u795E\u8A71\u738B\u5370",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_small_6",
        artKey: "treasure_king_small_6"
      },
      artKey: "treasure_king_small_6"
    },
    {
      id: "treasure_t6_mini_b",
      family: "treasure",
      tier: "mythic",
      tierIndex: 6,
      encounter: "miniBoss",
      role: "miniB",
      name: "\u8679\u5F69\u5BF6\u77F3\u9B54\u5076",
      title: null,
      hp: 1500,
      atk: 46,
      def: 285,
      passive: false,
      existing: false,
      signatureSkillId: "sig_treasure_t6_mini_b",
      signatureName: "\u8679\u5F69\u661F\u7206",
      commonSkillIds: [
        "common_charge",
        "common_shock"
      ],
      signatureSummary: "\u8679\u5F69\u661F\u7206\uFF1A3\u6BB5\u653B\u64CA\uFF0C\u7E3D\u500D\u7387=\u5C0F\u738B\u57FA\u6E96\xD71.1",
      counterSummary: "\u7D05\u85CD\u91D1\u4E09\u8272\u6676\u6838\u9010\u6BB5\u7834\u89E3\uFF0C\u4E0D\u4EE5\u9583\u720D\u8FA8\u8B58",
      material: {
        id: "mat_treasure_t6_mini_b",
        name: "\u8679\u5F69\u9B54\u5076\u6838",
        kind: "miniBoss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_t6_mini_b",
        artKey: "treasure_t6_mini_b"
      },
      artKey: "treasure_t6_mini_b"
    },
    {
      id: "treasure_king_big_6",
      family: "treasure",
      tier: "mythic",
      tierIndex: 6,
      encounter: "boss",
      role: "boss",
      name: "\u5BF6\u7BB1\u5927\u738B",
      title: "\u738B\u51A0\u795E\u5EAB",
      hp: 1700,
      atk: 53,
      def: 304,
      passive: false,
      existing: true,
      signatureSkillId: "sig_treasure_king_big_6",
      signatureName: "\u738B\u5EAB\u5929\u964D",
      commonSkillIds: [
        "common_regen",
        "common_reflect"
      ],
      signatureSummary: "\u738B\u5EAB\u5929\u964D\uFF1A\u5927\u738B\u57FA\u6E96\uFF0B\u5EF6\u9072\u653B\u64CA\u5927\u738B\u57FA\u6E96\xD70.6",
      counterSummary: "\u738B\u51A0\u843D\u9EDE\u5012\u6578\u4E00\u56DE\u5408\uFF1B70% HP\u6E1B\u50B710%\uFF0C40% HP\u5EF6\u9072\u6BB5+10%\uFF0C\u4ECD\u53EF\u7834\u89E3",
      material: {
        id: "mat_treasure_king_big_6",
        name: "\u795E\u5EAB\u738B\u6838",
        kind: "boss",
        convertible: false,
        upgradeCount: 0,
        upgradesToTier: null
      },
      card: {
        id: "treasure_king_big_6",
        artKey: "treasure_king_big_6"
      },
      artKey: "treasure_king_big_6"
    }
  ]
};

// src/lib/monsterExpansionCatalog.js
var MONSTER_EXPANSION_VERSION = monsterExpansionCatalog_default.version;
var EXPANSION_MONSTERS = Object.freeze(monsterExpansionCatalog_default.monsters);
var EXPANSION_MONSTER_BY_ID = Object.freeze(
  Object.fromEntries(EXPANSION_MONSTERS.map((monster) => [monster.id, monster]))
);
var EXPANSION_MATERIALS = Object.freeze(
  EXPANSION_MONSTERS.map((monster) => ({
    ...monster.material,
    family: monster.family,
    tier: monster.tier,
    tierIndex: monster.tierIndex,
    monsterId: monster.id
  }))
);
var EXPANSION_CARDS = Object.freeze(
  EXPANSION_MONSTERS.map((monster) => ({
    ...monster.card,
    monsterId: monster.id,
    family: monster.family,
    tier: monster.tier,
    tierIndex: monster.tierIndex,
    encounter: monster.encounter,
    role: monster.role,
    name: monster.name
  }))
);
function validateMonsterExpansionCatalog() {
  const errors = [];
  const uniqueCount = (values) => new Set(values).size;
  const counts = EXPANSION_MONSTERS.reduce((result, monster) => {
    const key = `${monster.family}:${monster.tier}`;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  if (EXPANSION_MONSTERS.length !== 252) errors.push("monster_count");
  if (uniqueCount(EXPANSION_MONSTERS.map((item) => item.id)) !== 252) errors.push("monster_id_unique");
  if (uniqueCount(EXPANSION_MATERIALS.map((item) => item.id)) !== 252) errors.push("material_id_unique");
  if (uniqueCount(EXPANSION_CARDS.map((item) => item.id)) !== 252) errors.push("card_id_unique");
  if (uniqueCount(EXPANSION_MONSTERS.map((item) => item.signatureSkillId)) !== 252) errors.push("signature_id_unique");
  if (Object.keys(counts).length !== 42 || Object.values(counts).some((count) => count !== 6)) errors.push("family_tier_shape");
  if (EXPANSION_MONSTERS.filter((item) => item.encounter === "normal").length !== 126) errors.push("normal_count");
  if (EXPANSION_MONSTERS.filter((item) => item.encounter === "miniBoss").length !== 84) errors.push("mini_boss_count");
  if (EXPANSION_MONSTERS.filter((item) => item.encounter === "boss").length !== 42) errors.push("boss_count");
  if (EXPANSION_MATERIALS.some((item) => item.convertible !== (item.kind === "normal"))) errors.push("material_conversion_boundary");
  if (EXPANSION_MATERIALS.some((item) => item.tierIndex === 6 && item.upgradesToTier !== null)) errors.push("t6_upgrade_boundary");
  if (EXPANSION_MONSTERS.some((item) => !item.commonSkillIds.length || !item.signatureName || !item.counterSummary)) errors.push("skill_reference_missing");
  return { ok: errors.length === 0, errors, counts };
}
