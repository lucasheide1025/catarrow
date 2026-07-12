const https = require("https");
const key = process.env.GEMINI_API_KEY;

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, res => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    const json = JSON.parse(data);
    const imageModels = (json.models || []).filter(m =>
      m.supportedGenerationMethods?.includes("generateContent") &&
      (m.name.includes("imagen") || m.name.includes("flash") || m.name.includes("image"))
    );
    console.log("=== 圖片相關可用模型 ===");
    imageModels.forEach(m => console.log(m.name, "|", m.displayName));
    console.log("\n=== 全部模型 ===");
    (json.models || []).forEach(m => console.log(m.name));
  });
});
