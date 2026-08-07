// GPT 校準生圖腳本（通用，各族共用）
// 用法：
//   node scripts/gen-gpt-calibration.mjs <prompts.json> <outdir> [maxImages]
// 說明：
//   - 讀取 prompts.json（陣列，每筆 {id, profile, tier, encounter, subject, prompt}）
//   - 依序呼叫 OpenAI images API（gpt-image-1, 1024×1536, PNG base64）
//   - 輸出 PNG 到 .staging/image-generation/<outdir>/
//   - 產生 manifest.json（provider/execution/assets，符合 scripts/validate-gpt-image-staging.mjs）
// 安全邊界：只寫 .staging/，不碰 public/；provider 標記為手動互動工作流（非 runtime）。
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const [promptsArg, outdirArg, maxArg] = process.argv.slice(2);
if (!promptsArg || !outdirArg) {
  console.error("Usage: node scripts/gen-gpt-calibration.mjs <prompts.json> <outdir> [maxImages]");
  process.exit(2);
}
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY 未設定");
  process.exit(2);
}

const prompts = JSON.parse(await readFile(promptsArg, "utf8"));
const max = maxArg ? Number(maxArg) : prompts.length;
const outRoot = path.resolve(".staging", "image-generation", outdirArg);
await mkdir(outRoot, { recursive: true });

const model = "gpt-image-1";
const size = "1024x1536"; // 3:4，對應正式卡圖 1086×1448 的比例

async function genOne(entry) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt: entry.prompt, size, output_format: "png" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${entry.id}] HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`[${entry.id}] no b64_json in response`);
  const fileName = `${entry.id}.png`;
  const filePath = path.join(outRoot, fileName);
  await writeFile(filePath, Buffer.from(b64, "base64"));
  const bytes = Buffer.from(b64, "base64").length;
  const sha256 = createHash("sha256").update(Buffer.from(b64, "base64")).digest("hex");
  console.log(`✓ ${entry.id} (${entry.tier}/${entry.encounter}) ${bytes} bytes`);
  return {
    id: entry.id,
    profile: entry.profile || "card",
    tier: entry.tier,
    encounter: entry.encounter,
    subject: entry.subject || "",
    output: fileName,
    prompt: entry.prompt,
    bytes,
    sha256,
  };
}

console.log(`生成 ${Math.min(max, prompts.length)} 張（model=${model}, size=${size}）→ ${outRoot}`);
const assets = [];
for (let i = 0; i < Math.min(max, prompts.length); i++) {
  assets.push(await genOne(prompts[i]));
}

const manifest = {
  version: 1,
  family: prompts[0].family || "unknown",
  kind: "calibration",
  provider: "manual-codex-built-in-imagegen",
  execution: "interactive",
  tool: "openai-images-api-gpt-image-1",
  generatedAt: new Date().toISOString(),
  reviewDecision: "pending",
  assets,
};
await writeFile(path.join(outRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`manifest.json 已寫入（${assets.length} assets）`);
console.log(`驗證：node scripts/validate-gpt-image-staging.mjs .staging/image-generation/${outdirArg}/manifest.json`);
