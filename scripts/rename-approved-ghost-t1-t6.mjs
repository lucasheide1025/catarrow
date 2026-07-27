import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const file = path.join(process.cwd(), "src", "data", "monsterExpansionCatalog.json");

const COPY = {
  ghost_t1_normal_a: ["暮燈旅者", "微燈閃身", "暮燈殘芯"],
  ghost_1: ["鏡幕幽姬", "幽鏡護幕", "幽鏡薄片"],
  ghost_t1_normal_b: ["星霧絨獸", "星霧撲襲", "星霧絨毛"],
  ghost_t1_mini_a: ["蒼焰巡獵者", "蒼焰突獵", "蒼焰獵印"],
  ghost_t1_mini_b: ["霧紗影舞者", "霧紗封步", "霧紗足鈴"],
  ghost_t1_boss: ["星環冥鹿", "冥鹿星環", "冥鹿角片"],

  ghost_t2_normal_a: ["紙翼引路人", "紙翼回光", "引路蝶紙"],
  ghost_2: ["霧徑幻姬", "霧徑迷行", "幻霧髮帶"],
  ghost_t2_normal_b: ["石甲路龜", "石甲封路", "路龜甲片"],
  ghost_t2_mini_a: ["夜燈巡使", "夜燈追影", "巡夜燈芯"],
  ghost_t2_mini_b: ["葦衣影犬", "葦影截步", "葦衣殘束"],
  ghost_t2_boss: ["界碑將軍", "四方界令", "界碑將令"],

  ghost_t3_normal_a: ["幽花藥師", "幽花散霧", "幽花藥瓣"],
  ghost_3: ["林投守姬", "林投葉陣", "林投護葉"],
  ghost_t3_normal_b: ["葉甲影獸", "葉影連襲", "葉甲薄片"],
  ghost_t3_mini_a: ["百燈行宮", "百燈護行", "行宮燈罩"],
  ghost_t3_mini_b: ["青葉雙刃衛", "雙刃封徑", "青葉刀穗"],
  ghost_t3_boss: ["森羅戰姬", "森羅列陣", "森羅令旗"],

  ghost_t4_normal_a: ["判簿書吏", "墨令飛卷", "判簿墨晶"],
  ghost_4: ["幽城女判", "幽城判令", "幽城判牒"],
  ghost_t4_normal_b: ["鎮街牌獸", "牌印喝止", "鎮街牌角"],
  ghost_t4_mini_a: ["城門司燈將", "城門點燈", "司燈將印"],
  ghost_t4_mini_b: ["鏡律執行姬", "鏡律鎖陣", "鏡律殘片"],
  ghost_t4_boss: ["判城六臂獸", "六臂裁界", "判城門片"],

  ghost_t5_normal_a: ["誓燈犬守", "護誓追光", "誓犬燈火"],
  ghost_5: ["海誓靈姬", "海誓鎮守", "海誓鈴墜"],
  ghost_t5_normal_b: ["香願爐獸", "願火護陣", "香願爐金"],
  ghost_t5_mini_a: ["遺門誓刃姬", "誓扇焚陣", "遺門金扣"],
  ghost_t5_mini_b: ["雙爐願獸", "萬願煙陣", "雙爐願灰"],
  ghost_t5_boss: ["萬誓王", "萬誓鎮域", "萬誓王牌"],

  ghost_t6_normal_a: ["輪星使者", "星輪迴轉", "輪星玉砂"],
  ghost_6: ["幽府判令姬", "判令追魂", "幽府判令"],
  ghost_t6_normal_b: ["界律玉面獸", "玉面鎮界", "界律玉屑"],
  ghost_t6_mini_a: ["三輪噬界獸", "三輪墜界", "噬界輪片"],
  ghost_t6_mini_b: ["破時守將", "破時封天", "破時鐘芯"],
  ghost_t6_boss: ["終判冥后", "終判輪迴", "終判王令"],
};

const catalog = JSON.parse(await fs.readFile(file, "utf8"));
const ghosts = catalog.monsters.filter((monster) => monster.family === "ghost");
if (ghosts.length !== 36) throw new Error(`Expected 36 ghost monsters, found ${ghosts.length}`);

for (const monster of ghosts) {
  const copy = COPY[monster.id];
  if (!copy) throw new Error(`Missing approved copy for ${monster.id}`);
  const [name, signatureName, materialName] = copy;
  const separator = monster.signatureSummary.indexOf("：");
  const mechanics = separator >= 0 ? monster.signatureSummary.slice(separator + 1) : monster.signatureSummary;
  monster.name = name;
  monster.signatureName = signatureName;
  monster.signatureSummary = `${signatureName}：${mechanics}`;
  if (!monster.material) throw new Error(`Missing material record for ${monster.id}`);
  monster.material.name = materialName;
}

await fs.writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log("Updated monster, signature skill, and material names for 36 ghost identities.");
