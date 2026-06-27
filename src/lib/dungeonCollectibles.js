// src/lib/dungeonCollectibles.js — 地下城收藏品資料與掉落邏輯

// ── 六族系普通收藏品（42種）──────────────────────────────────
export const FAMILY_COLLECTIBLES = {
  ghost: {
    common: [
      { id:"shadow_stone",   name:"暗影石",   icon:"🪨", desc:"從幽靈廢墟碎壁上剝落的石頭，帶著淡淡冷光。"    },
      { id:"bone_fragment",  name:"骸骨碎片", icon:"🦴", desc:"不知名亡靈的骨骸碎片，仍有不死氣息縈繞。"      },
    ],
    rare: [
      { id:"void_crystal",   name:"虛空水晶", icon:"💎", desc:"在幽靈廢墟深處凝結的神秘結晶，散發紫色光芒。"  },
      { id:"lich_essence",   name:"巫妖精華", icon:"⚗️",  desc:"從巫妖身上提取的本質，是強大魔力的結晶。"      },
    ],
    boss: [
      { id:"shadow_crown",   name:"暗影王冠", icon:"👑", desc:"死靈王的象徵，凝聚了幽冥之地的最高權威。"       },
      { id:"lich_scepter",   name:"巫妖法杖", icon:"🪄", desc:"巫妖使用過的法杖，其中封印著古老的死靈咒術。"  },
      { id:"void_eye",       name:"虛空之眼", icon:"👁️",  desc:"能看穿生死界限的神秘眼球，至今仍在顫動。"      },
    ],
  },
  mountain: {
    common: [
      { id:"rough_stone",    name:"粗糙岩石", icon:"🗿", desc:"山嶺地帶隨處可見的岩石，質地堅硬。"             },
      { id:"mountain_herb",  name:"山嶺藥草", icon:"🌿", desc:"生長在峭壁縫隙的稀有藥草，帶有清涼香氣。"      },
    ],
    rare: [
      { id:"ore_crystal",    name:"礦晶石",   icon:"💠", desc:"山脈深處的珍貴結晶礦石，蘊含巨大能量。"         },
      { id:"peak_core",      name:"山巔核心", icon:"⛰️",  desc:"從山嶺最高處採集的能量核心，充滿地脈之力。"    },
    ],
    boss: [
      { id:"summit_gem",     name:"巔峰寶珠", icon:"🔮", desc:"山嶺之王的核心寶物，象徵著對高山的征服。"       },
      { id:"mountain_throne",name:"山嶺王座", icon:"🪑", desc:"雕刻在巨岩上的古老王座碎片，承載歷代霸主記憶。" },
      { id:"peak_essence",   name:"峰頂精氣", icon:"✨", desc:"凝聚在最高峰頂的純淨天地靈氣結晶。"              },
    ],
  },
  insect: {
    common: [
      { id:"insect_shell",   name:"蟲殼",     icon:"🐚", desc:"昆蟲脫落的外殼，硬度驚人，可作為防護材料。"    },
      { id:"silk_thread",    name:"蟲絲線",   icon:"🧵", desc:"蟲后族群紡出的特殊絲線，韌性極強。"             },
    ],
    rare: [
      { id:"wing_dust",      name:"翅翼粉末", icon:"🦋", desc:"稀有蝴蝶翅翼上的魔法鱗粉，可增強魔力。"         },
      { id:"queen_pheromone",name:"女王費洛蒙",icon:"💜",desc:"蟲后分泌的神秘物質，能操縱昆蟲的意志。"          },
    ],
    boss: [
      { id:"queen_crystal",  name:"蟲后結晶", icon:"💎", desc:"蟲后身體結晶化的精華，蘊含巨大的生命力。"       },
      { id:"hive_core",      name:"蜂巢核心", icon:"🏠", desc:"從古老蜂巢中取出的核心，記錄著種族的記憶。"     },
      { id:"ancient_silk",   name:"古絲",     icon:"🕸️",  desc:"萬年蟲后所結的古老絲線，堅固如鋼鐵。"           },
    ],
  },
  workplace: {
    common: [
      { id:"memo_paper",     name:"便條紙",   icon:"📋", desc:"遺落在廢棄辦公室的便條，上面寫滿了工作指令。"  },
      { id:"coffee_bean",    name:"咖啡豆",   icon:"☕", desc:"已過期的咖啡豆，但仍散發著濃郁香氣。"           },
    ],
    rare: [
      { id:"boss_seal",      name:"主管印章", icon:"📮", desc:"神秘主管遺留的公司印章，上面刻有詭異符文。"     },
      { id:"overtime_crystal",name:"加班水晶",icon:"⌛", desc:"無數工作人員的血汗凝聚而成的晶體，帶有哀傷氣息。"},
    ],
    boss: [
      { id:"gold_badge",     name:"黃金徽章", icon:"🏅", desc:"傳說中最高職級的身份徽章，象徵至高的企業地位。"  },
      { id:"ceo_key",        name:"執行長之鑰",icon:"🗝️",desc:"開啟最高機密保險箱的鑰匙，不知道裡面藏著什麼。" },
      { id:"annual_report",  name:"年度報告", icon:"📊", desc:"記載公司黑歷史的年度報告，每頁都暗藏玄機。"     },
    ],
  },
  exam: {
    common: [
      { id:"exam_paper",     name:"考卷",     icon:"📝", desc:"被塗滿紅叉的考試卷，仍殘留著考生的絕望氣息。" },
      { id:"pencil_stub",    name:"鉛筆頭",   icon:"✏️",  desc:"磨到幾乎不剩的鉛筆，見證了無數個苦讀之夜。"   },
    ],
    rare: [
      { id:"answer_key",     name:"解答本",   icon:"📖", desc:"傳說中的考試解答本，持有者能看穿任何試題。"     },
      { id:"study_crystal",  name:"讀書結晶", icon:"🔷", desc:"學霸的努力凝聚而成的結晶，散發智慧的光芒。"    },
    ],
    boss: [
      { id:"diploma",        name:"畢業證書", icon:"🎓", desc:"通過最終試煉的象徵，上面的名字竟然是你的。"    },
      { id:"exam_god_seal",  name:"考神印記", icon:"⭐", desc:"傳說中考神親自蓋下的印記，保佑持有者考試順利。" },
      { id:"knowledge_core", name:"知識核心", icon:"🧠", desc:"收納了無數知識的結晶體，智慧的終極結晶。"      },
    ],
  },
  temple: {
    common: [
      { id:"stone_tablet",   name:"石板",     icon:"🗽", desc:"刻有古代文字的神廟石板，記載著遠古的神諭。"    },
      { id:"incense_ash",    name:"香灰",     icon:"🔥", desc:"祭祀儀式後留下的香灰，散發神聖的氣息。"         },
    ],
    rare: [
      { id:"relic_fragment", name:"遺物碎片", icon:"🏺", desc:"古代神廟遺物的碎片，蘊含著神明的力量。"         },
      { id:"divine_jade",    name:"神玉",     icon:"💚", desc:"神廟守護者珍藏的翠玉，據說能感應神明旨意。"    },
    ],
    boss: [
      { id:"oracle_staff",   name:"神諭法杖", icon:"⚡", desc:"神廟最高祭司使用的法杖，能傳達神明的旨意。"    },
      { id:"divine_crown",   name:"神冠",     icon:"👸", desc:"供奉在神廟最深處的神聖王冠，代表神明的祝福。"  },
      { id:"eternal_flame",  name:"永恆之火", icon:"🕯️",  desc:"在神廟中燃燒了萬年的神聖火焰結晶。"            },
    ],
  },
};

// ── 初次通關限定品（24種，每個地下城一件）──────────────────
// 格式：{dungeonId}_trophy
const FIRST_CLEAR_DEFS = {
  // 幽靈系
  ghost_normal:    { name:"廢墟探索章",   icon:"🏆", desc:"首次征服幽靈廢墟的紀念勳章，刻有你的到訪日期。"       },
  ghost_advanced:  { name:"幽冥地窖章",   icon:"🥇", desc:"征服幽冥地窖的榮耀勳章，見證了對死亡的超越。"         },
  ghost_hard:      { name:"亡靈禁地章",   icon:"💀", desc:"踏入亡靈禁地並生還的極少數人才能得到的殊榮。"         },
  ghost_hell:      { name:"死神殿堂章",   icon:"☠️",  desc:"只有征服死神殿堂的英雄才能持有，散發強大的死靈之氣。" },
  // 山嶺系
  mountain_normal: { name:"山麓探道章",   icon:"🏆", desc:"首次踏遍山麓探道的紀念章，帶有清新的山風氣息。"       },
  mountain_advanced:{ name:"岩壁迷宮章",  icon:"🥇", desc:"在岩壁迷宮中找到出路的成就章，堅硬如岩石。"           },
  mountain_hard:   { name:"險峰試煉章",   icon:"⛰️",  desc:"通過險峰試煉的登頂紀念章，只有真正的勇者才能獲得。"  },
  mountain_hell:   { name:"天柱巔峰章",   icon:"👑", desc:"登上天柱巔峰的傳說成就章，鑄造者已無人知曉。"         },
  // 昆蟲系
  insect_normal:   { name:"草叢探索章",   icon:"🏆", desc:"首次深入草叢探索的紀念章，上面停著一隻蝴蝶標本。"     },
  insect_advanced: { name:"蟲穴迷宮章",   icon:"🥇", desc:"走出蟲穴迷宮的紀念章，蟲絲包覆著金屬外殼。"           },
  insect_hard:     { name:"蟲后禁地章",   icon:"🦋", desc:"挑戰蟲后禁地的成就章，散發著蟲后費洛蒙的氣味。"      },
  insect_hell:     { name:"螞蟻帝國章",   icon:"🐜", desc:"推翻螞蟻帝國的傳說章，銘刻著最終戰役的場景。"         },
  // 職場系
  workplace_normal:{ name:"職場初探章",   icon:"🏆", desc:"第一天上班就混到下班的紀念章，附贈加班費收據。"        },
  workplace_advanced:{ name:"會議室逃脫章",icon:"🥇",desc:"從無止盡的會議室逃脫的成就章，印有會議記錄殘骸。"      },
  workplace_hard:  { name:"加班煉獄章",   icon:"💼", desc:"在加班煉獄中存活的鐵人章，凌晨三點的時鐘永遠定格。"  },
  workplace_hell:  { name:"企業黑洞章",   icon:"🌑", desc:"逃出企業黑洞的傳說章，上面的文字只有前員工才看得懂。" },
  // 考試系
  exam_normal:     { name:"小考及格章",   icon:"🏆", desc:"首次通過小考練習場的紀念章，上面有個歪歪斜斜的60分。"  },
  exam_advanced:   { name:"期中優等章",   icon:"🥇", desc:"期中考迷宮的優等生章，每個字都是用血淚寫成的。"      },
  exam_hard:       { name:"聯考英雄章",   icon:"📝", desc:"通過聯考禁地的英雄章，是無數個深夜苦讀的結晶。"      },
  exam_hell:       { name:"最終試煉章",   icon:"🎓", desc:"完成最終試驗的傳說章，上面印有全滿分的成績單。"       },
  // 神廟系
  temple_normal:   { name:"神廟訪客章",   icon:"🏆", desc:"首次參訪神廟前廳的紀念章，沾有神聖的香灰。"           },
  temple_advanced: { name:"神廟探索章",   icon:"🥇", desc:"深入神廟迷宮的成就章，神明的眼睛在上面望著你。"      },
  temple_hard:     { name:"神聖禁地章",   icon:"🏛️",  desc:"踏入神聖禁地並生還的稀有章，散發神聖光輝。"           },
  temple_hell:     { name:"神明試煉章",   icon:"⚡", desc:"通過神明試煉的傳說章，與神明締結的永恆契約。"         },
};

// ── 扁平化查詢 MAP ─────────────────────────────────────────────
export const COLLECTIBLE_MAP = {}; // { itemId: { id, name, icon, desc, family, rarity } }

Object.entries(FAMILY_COLLECTIBLES).forEach(([family, tiers]) => {
  Object.entries(tiers).forEach(([rarity, items]) => {
    items.forEach(item => {
      COLLECTIBLE_MAP[item.id] = { ...item, family, rarity };
    });
  });
});

Object.entries(FIRST_CLEAR_DEFS).forEach(([dungeonId, item]) => {
  const id = `${dungeonId}_trophy`;
  COLLECTIBLE_MAP[id] = { id, ...item, family: dungeonId.split("_")[0], rarity:"exclusive", dungeonId };
});

// ── 掉落邏輯 ──────────────────────────────────────────────────

// 普通戰鬥/寶箱房掉落（依族系）
// roomType: "chest" | "monster" | "elite"
// 回傳 { itemId } 或 null
export function rollFamilyDrop(family, roomType) {
  const pool = FAMILY_COLLECTIBLES[family];
  if (!pool) return null;

  const rand = Math.random();

  if (roomType === "chest") {
    // 寶箱：50% 掉普通，20% 掉稀有
    if (rand < 0.20) {
      const items = pool.rare;
      return { itemId: items[Math.floor(Math.random() * items.length)].id };
    }
    if (rand < 0.70) {
      const items = pool.common;
      return { itemId: items[Math.floor(Math.random() * items.length)].id };
    }
    return null;
  }

  if (roomType === "elite") {
    // 精英房：35% 掉稀有，30% 掉普通
    if (rand < 0.35) {
      const items = pool.rare;
      return { itemId: items[Math.floor(Math.random() * items.length)].id };
    }
    if (rand < 0.65) {
      const items = pool.common;
      return { itemId: items[Math.floor(Math.random() * items.length)].id };
    }
    return null;
  }

  if (roomType === "monster") {
    // 普通怪物房：10% 掉普通
    if (rand < 0.10) {
      const items = pool.common;
      return { itemId: items[Math.floor(Math.random() * items.length)].id };
    }
    return null;
  }

  return null;
}

// Boss 房掉落（必掉 1 件 boss 收藏品）
export function rollBossDrop(family) {
  const pool = FAMILY_COLLECTIBLES[family];
  if (!pool?.boss?.length) return null;
  const items = pool.boss;
  return { itemId: items[Math.floor(Math.random() * items.length)].id };
}

// 初次通關限定品
export function getFirstClearTrophy(dungeonId) {
  const id = `${dungeonId}_trophy`;
  return COLLECTIBLE_MAP[id] ? { itemId: id } : null;
}
