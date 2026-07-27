import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repo = process.cwd();
const staging = path.join(repo, ".staging", "image-generation", "gpt-mountain-t1-t6");
const catalogPath = path.join(repo, "src", "data", "monsterExpansionCatalog.json");
const cardOutputDir = path.join(repo, "public", "cards", "monsters");
const battleOutputDir = path.join(repo, "public", "monsters-battle");

const identities = {
  mountain_t1_normal_a: ["苔帽跳童", "苔石滑步", "濕苔帽"],
  mountain_1: ["竹徑採露女", "晨露潑灑", "竹節露瓶"],
  mountain_t1_normal_b: ["礫背團狸", "礫背滾撞", "團狸礫甲"],
  mountain_t1_mini_a: ["木樁守路人", "木盾逼陣", "山樁盾片"],
  mountain_t1_mini_b: ["赤鬃坡羊", "斜坡猛頂", "赤鬃彎角"],
  mountain_t1_boss: ["老樟穴熊", "樟根震掌", "老樟熊爪"],
  mountain_t2_normal_a: ["溪繩渡客", "飛索橫渡", "溪渡繩結"],
  mountain_2: ["青簍藥獵", "青藤麻矢", "青簍藥藤"],
  mountain_t2_normal_b: ["水紋甲蜥", "水尾掃石", "水紋甲片"],
  mountain_t2_mini_a: ["白瀑雙鉤手", "瀑影雙鉤", "白瀑鉤刃"],
  mountain_t2_mini_b: ["藤冠伏虎", "藤影撲殺", "藤冠虎鬚"],
  mountain_t2_boss: ["黑潭叉王", "黑潭裂浪", "黑潭叉尖"],
  mountain_t3_normal_a: ["松燈巡夜者", "松燈照影", "松脂燈芯"],
  mountain_3: ["鹿鈴祝女", "鹿鈴迷步", "祝女鹿鈴"],
  mountain_t3_normal_b: ["枯根拳猿", "根拳封路", "枯根拳骨"],
  mountain_t3_mini_a: ["銅斧寨衛", "銅斧斷徑", "寨衛銅扣"],
  mountain_t3_mini_b: ["翠羽哨弓", "翠哨標獵", "翠羽哨片"],
  mountain_t3_boss: ["千年盤根獸", "古根翻林", "千年根心"],
  mountain_t4_normal_a: ["霜索攀峰客", "霜索墜擊", "攀峰霜扣"],
  mountain_4: ["紫晶峰衛", "晶壁回震", "紫晶盾屑"],
  mountain_t4_normal_b: ["鐵喙崖鷲", "鐵喙俯衝", "崖鷲鐵羽"],
  mountain_t4_mini_a: ["雪甲岩犀", "雪甲崩陣", "岩犀雪甲"],
  mountain_t4_mini_b: ["風砲寨將", "風砲貫寨", "寨將風芯"],
  mountain_t4_boss: ["雷旗岳侯", "雷旗鎮岳", "岳侯雷纓"],
  mountain_t5_normal_a: ["月桂尋碑使", "月桂刻印", "月桂碑拓"],
  mountain_5: ["金茸靈獸使", "金茸共襲", "金茸契毛"],
  mountain_t5_normal_b: ["玉脊雲豹", "玉脊裂雲", "雲豹玉脊"],
  mountain_t5_mini_a: ["玄岩誓斧", "誓斧開山", "玄岩誓片"],
  mountain_t5_mini_b: ["丹霞九尾鹿", "九霞封谷", "丹霞鹿角"],
  mountain_t5_boss: ["雲金山盟主", "雲金定盟", "山盟金印"],
  mountain_t6_normal_a: ["晝夜界碑童", "晝夜換界", "兩儀碑屑"],
  mountain_6: ["星瀑司雨姬", "星瀑垂天", "星雨天綃"],
  mountain_t6_normal_b: ["食嵐天蜈", "百節食嵐", "天蜈雲節"],
  mountain_t6_mini_a: ["萬岳律令官", "萬岳聽令", "律令玉簡"],
  mountain_t6_mini_b: ["四季輪角獸", "四季輪轉", "輪歲神角"],
  mountain_t6_boss: ["開天嶺祖", "天嶺開闔", "嶺祖天核"],
};

function tierOf(id) {
  const expanded = id.match(/^mountain_t(\d)_/);
  return Number(expanded?.[1] ?? id.match(/^mountain_(\d)$/)?.[1]);
}

async function newestVersionFile(directory, id, suffix = "") {
  const pattern = new RegExp(`^${id.replaceAll("_", "\\_")}${suffix}-v(\\d+)\\.png$`);
  const candidates = (await readdir(directory))
    .map((name) => ({ name, version: Number(name.match(pattern)?.[1] ?? -1) }))
    .filter(({ version }) => version >= 0)
    .sort((a, b) => b.version - a.version);
  if (!candidates[0]) throw new Error(`Missing source for ${id} in ${directory}`);
  return path.join(directory, candidates[0].name);
}

await mkdir(cardOutputDir, { recursive: true });
await mkdir(battleOutputDir, { recursive: true });

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const mountain = catalog.monsters.filter((monster) => monster.family === "mountain");
if (mountain.length !== 36) throw new Error(`Expected 36 mountain monsters, got ${mountain.length}`);

for (const monster of mountain) {
  const identity = identities[monster.id];
  if (!identity) throw new Error(`Missing identity for ${monster.id}`);
  const [name, signatureName, materialName] = identity;
  const mechanics = monster.signatureSummary.includes("：")
    ? monster.signatureSummary.slice(monster.signatureSummary.indexOf("："))
    : "";
  monster.name = name;
  monster.signatureName = signatureName;
  monster.signatureSummary = `${signatureName}${mechanics}`;
  monster.material.name = materialName;
}
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const assets = [];
for (const id of Object.keys(identities)) {
  const tier = tierOf(id);
  const cardSource = await newestVersionFile(path.join(staging, "cards", `t${tier}`), id);
  const battleSource = await newestVersionFile(
    path.join(staging, "battle", `t${tier}`, "transparent"),
    id,
    "-transparent",
  );
  const cardOutput = path.join(cardOutputDir, `${id}.webp`);
  const battleOutput = path.join(battleOutputDir, `${id}.webp`);

  await sharp(cardSource).webp({ quality: 88, effort: 5 }).toFile(cardOutput);
  await sharp(battleSource)
    .resize(512, 512, { fit: "contain" })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toFile(battleOutput);

  for (const [kind, output] of [["card", cardOutput], ["battle", battleOutput]]) {
    const bytes = await readFile(output);
    const info = await stat(output);
    const metadata = await sharp(output).metadata();
    const stats = await sharp(output).stats();
    assets.push({
      id,
      kind,
      output: path.relative(repo, output).replaceAll("\\", "/"),
      width: metadata.width,
      height: metadata.height,
      hasAlpha: metadata.hasAlpha,
      alphaMin: stats.channels[3]?.min ?? null,
      alphaMax: stats.channels[3]?.max ?? null,
      bytes: info.size,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

await writeFile(
  path.join(staging, "manifest-integrated.json"),
  `${JSON.stringify({ assets }, null, 2)}\n`,
  "utf8",
);
console.log(`Integrated ${mountain.length} catalog entries and ${assets.length} assets.`);
