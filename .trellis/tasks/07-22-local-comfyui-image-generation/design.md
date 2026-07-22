# 技術設計：本機 ComfyUI 圖片生成遷移

## Architecture

採 local-first、manifest-driven 的圖片生成架構：

`asset spec -> profile workflow -> local ComfyUI API -> staging -> automated checks -> human approval -> optimize/place -> reference validation`

GPT 只在本機多次嘗試仍無法滿足主視覺需求、保存失敗證據並取得使用者明確批准後使用。Gemini 不保留 provider 或 fallback。

## Components

- `ComfyClient`：health、queue、submit、history、view、interrupt、timeout/retry。
- `Workflow profiles`：portrait、transparent-asset；後續擴充 card、background、icon、isometric tile。
- `Asset manifest`：asset id、prompt、negative prompt、seed、checkpoint、LoRA、sampler、scheduler、steps、CFG、尺寸、workflow version、輸出與狀態。
- `Staging`：所有生成輸出先進 Git/Vercel 排除路徑；禁止直接覆寫 `public/`。
- `Post-processing`：rembg、RGBA、crop/pad、resize、WebP、quality/size budget。
- `Quality gate`：格式、尺寸、alpha、命名、檔案大小、數量、生成完成狀態；視覺品質由人審。
- `Canonical monster art`：每個 monster id 只批准一張透明高解析母版；battle 直接使用母版，card 將同一母版合成到卡片背景，dex 使用裁切縮圖，dungeon 將同一母版縮放／等角合成，不重新生成另一個角色。

## Pilot

- Portrait profile：六隻世界王小王，沿用既有 prompts 與固定 boss keys。
- Transparent profile：選一個測試資產，輸出 staging，不覆寫正式素材。
- 基線模型：DreamShaperXL Turbo；新增模型／LoRA 需有來源、license、hash、10 GB VRAM 結果。

## Parallel Work Boundaries

- Child A：ComfyUI 試點與生成 staging。
- Child B：Firestore Rules 權限矩陣與 Emulator 測試；不部署。
- Child C：tracked deploy snapshots／public assets／tooling dependencies 清冊；不刪檔、不搬移、不修改依賴。
- 不在本輪拆 `db.js` 或大型 React 頁面。

## Failure and Recovery

- 每個 asset 狀態：planned、queued、running、generated、failed、reviewed、approved、rejected、escalation_requested。
- timeout 前查 queue/history；卡住時只中斷本批 prompt，保留 manifest 與錯誤。
- ComfyUI 重啟後依 prompt id/history 與檔案 hash 恢復，不重複覆寫。
- GPT 升級必須附本機嘗試紀錄並由使用者逐批批准。

## Security and Storage

- API 只綁 loopback，不對公網開放。
- 模型、ComfyUI output、staging、cache 與中間 PNG 不進 Git/Vercel。
- 正式素材批准後才進 `public/`，並受檔案大小 budget 控制。
