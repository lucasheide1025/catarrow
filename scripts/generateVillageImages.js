/**
 * 自動生成貓貓村建築物圖片
 * 需要先安裝：npm install @google/genai
 * 執行方式：node scripts/generateVillageImages.js
 * 環境變數：GEMINI_API_KEY=你的金鑰
 */

const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ 請設定 GEMINI_API_KEY 環境變數");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const OUTPUT_DIR = path.join(__dirname, "..", "public", "ui", "village");

const STYLE = `Cozy Japanese picture book illustration, Sumikko Gurashi / Chiikawa aesthetic.
Single building on a small grassy round ground patch, soft cream or light sky-blue background.
Slightly isometric 3/4 view, NOT top-down. TALL chubby proportions with big cute roofs.
1-2 round mochi-blob cats with dot eyes working near the building. Cats have NO visible legs, fluffy round body, no ears visible, Sumikko Gurashi proportions.
No shadows, flat soft shading, rounded outlines, pastel colors.
IMPORTANT: absolutely no text, no signs with words, no Chinese characters anywhere in the image.`;

// 9 棟 × 5 階段 = 45 張
const BUILDINGS = {
  mine: [
    "A tiny wooden mine entrance with two log beams forming an arch, small pile of grey rocks on ground. One tiny mochi cat with a little pickaxe.",
    "A small stone mine entrance with wooden support beams, cart tracks leading in, small ore pile beside. One mochi cat pushing a little wooden cart.",
    "A medium mine building with stone arch entrance, two lanterns hanging, ore cart on tracks, ore pile on side. Two mochi cats working.",
    "A sturdy mine with reinforced stone arches, two cart tracks, glowing blue ore chunks stacked up, mining gear outside. Two mochi cats with small helmets.",
    "A grand crystal mine with tall stone tower, glowing blue crystal veins on walls, ore carts, sparkling gems piled high. Two happy mochi cats.",
  ],
  farm: [
    "A tiny garden patch with 3 small round melon plants in a row, little wooden fence, small watering can. One mochi cat watering plants.",
    "A small farm plot with rows of melon vines on wooden stakes, small scarecrow with straw hat. One mochi cat in a straw hat.",
    "A cozy farm with one glass greenhouse dome, round green melon fruits hanging inside, flower borders around. Two mochi cats harvesting.",
    "A full farm with TWO glass greenhouse buildings with clean smooth glass dome arches (NOT thatched roof). Outside: rows of fat round green melons on ground. A small wooden wheelbarrow cart full of round green melons. Two round mochi-blob cats helping with harvest.",
    "A flourishing farm estate with large glass greenhouse, hanging melons everywhere, fruit storage shed beside, rainbow flower border around. Two joyful mochi cats.",
  ],
  harbor: [
    "A tiny wooden dock extending into calm blue water, single fishing rod on dock, small bucket of fish. One mochi cat fishing.",
    "A small harbor with a wooden pier, one tiny fishing boat tied up, fish bucket and net hanging on post. One mochi cat on pier.",
    "A medium harbor with fish storage shed, wooden pier, two small boats, nets drying on poles. Two mochi cats.",
    "A busy harbor with a two-story storage building, three colorful boats, fish crates stacked on dock, lighthouse post with light. Two mochi cats.",
    "A grand harbor with tall lighthouse, multiple colorful boats, large fish warehouse, fish flags and banners flying. Two cheerful mochi cats.",
  ],
  hunting: [
    "A tiny forest clearing with a small campfire and one wooden hunting post with arrow target. One mochi cat holding a tiny bow.",
    "A small hunting lodge, small log cabin with simple antler decoration above door, campfire outside. One mochi cat with bow and arrow.",
    "A medium hunting lodge with pointed brown roof, antler decor, meat drying rack beside, campfire in front. Two mochi cats.",
    "A sturdy hunting lodge with tall peaked roof, two drying racks with meat, hunting trophies on wall, large bonfire. Two mochi cats.",
    "A grand hunting hall with massive peaked roof, many trophy mounts, large bonfire, meat storehouse beside, forest backdrop. Two proud mochi cats.",
  ],
  market: [
    "A tiny market stall with a striped red-and-white awning, small wooden table with dried fish displayed. One mochi cat shopkeeper.",
    "A small market booth with colorful awning, shelves behind with dried fish and goods, simple sign post. One mochi cat behind counter.",
    "A medium market building with double stall awnings, colorful triangular flags hanging, shelves of cat goods. Two mochi cats.",
    "A lively market with triple stall building, round paper lanterns hanging, fish and goods on display shelves, cat banner flags. Two mochi cats.",
    "A grand cat market with tall building, many colorful stalls, hanging lanterns everywhere, overflowing goods display, festive atmosphere. Two busy mochi cats.",
  ],
  warehouse: [
    "A tiny wooden shed with one small shelf holding cat food cans. One mochi cat carrying a small can.",
    "A small wooden warehouse with open front, neatly stacked cat food cans, simple wooden shelf. One mochi cat stacking cans.",
    "A medium warehouse with double wooden doors, many cans stacked in rows, wooden crates on side. Two mochi cats.",
    "A large warehouse with reinforced plank walls, very tall can stacks, loading platform with rope pulley. Two mochi cats working.",
    "A grand storage warehouse with big curved roof, enormous can towers, crate pyramid, flag on top. Two proud mochi cats.",
  ],
  alchemy: [
    "A tiny round hut with a small bubbling cauldron outside, small catnip herb garden. One mochi cat stirring with a wooden spoon.",
    "A small alchemy hut with pointed witch-hat style roof, two small cauldrons outside, herb bundles hanging from eaves. One mochi cat mixing potions.",
    "A medium alchemy tower with two floors, purple glowing potion bottles on window shelves, swirling steam, catnip garden. Two mochi cats.",
    "A tall alchemy tower with three floors, many colored glowing potions visible in windows, catnip garden, smoke from chimney. Two mochi cats.",
    "A grand alchemy spire with star-topped observatory roof, glowing magic orbs floating, rainbow potion waterfall, catnip garden. Two magical mochi cats.",
  ],
  gacha: [
    "A tiny gacha capsule machine kiosk on a small stand, colorful capsules inside. One excited mochi cat reaching up.",
    "A small gacha booth with two round capsule machines, colorful star decorations, capsules spilling from a bag. One mochi cat.",
    "A medium gacha arcade building with four machines, colorful striped awning, capsule display shelf. Two mochi cats.",
    "A gacha parlor building with many machines visible through window, star-shaped lights, pile of capsules outside. Two mochi cats.",
    "A grand gacha palace with tall decorative sign post, wall of capsule machines, rainbow star lights, overflow of colorful capsules everywhere. Two thrilled mochi cats.",
  ],
  archery: [
    "A tiny archery range with one round straw target on a pole, single arrow stuck in it. One small mochi cat holding a tiny bow.",
    "A small archery range with two targets, simple wooden shooting line marker, arrow quiver hanging on post. One mochi cat aiming.",
    "A medium archery hall with three targets in a row, wooden roof cover overhead, equipment rack with bows. Two mochi cats practicing.",
    "A proper archery dojo with four lanes, elegant curved wooden roof, trophy shelf with small cups, equipment storage box. Two mochi cats in practice stance.",
    "A grand archery stadium with six lanes, grand curved tiered roof, many trophies on display, colorful cat banners flying. Two champion mochi cats.",
  ],
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function generateImage(buildingId, stage, description) {
  const prompt = `${STYLE}\n\n${description}`;
  const filename = `building-${buildingId}-stage${stage}.webp`;
  const filepath = path.join(OUTPUT_DIR, filename);

  if (fs.existsSync(filepath)) {
    console.log(`⏭️  跳過（已存在）：${filename}`);
    return;
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: ["IMAGE"] },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData);
      if (!imgPart) throw new Error("未收到圖片資料");

      const buffer = Buffer.from(imgPart.inlineData.data, "base64");
      fs.writeFileSync(filepath, buffer);
      console.log(`✅ ${filename}`);
      return;
    } catch (err) {
      const msg = err.message || "";
      const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
      if (is429 && attempt < 5) {
        const waitSec = 65 * attempt;
        console.log(`⏳ ${filename} 限流中，等 ${waitSec}s 後重試（第 ${attempt} 次）...\n   錯誤：${msg}`);
        await sleep(waitSec * 1000);
      } else {
        console.error(`❌ ${filename}：${msg.slice(0, 120)}`);
        return;
      }
    }
  }
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const tasks = [];
  for (const [buildingId, stages] of Object.entries(BUILDINGS)) {
    for (let i = 0; i < stages.length; i++) {
      tasks.push({ buildingId, stage: i + 1, description: stages[i] });
    }
  }

  console.log(`🚀 開始生成 ${tasks.length} 張建築物圖片...\n`);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    await generateImage(task.buildingId, task.stage, task.description);
    // 每張間隔 65 秒，避免 rate limit
    if (i < tasks.length - 1) await sleep(65000);
  }

  console.log("\n🎉 完成！");
}

main();
