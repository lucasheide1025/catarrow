# ComfyUI 雙 profile 試點

## Goal

建立本機 ComfyUI 共用生成基線並提交雙 profile 試點：六張世界王小王 portrait 與一張不覆寫正式素材的透明 WebP。所有輸出進 staging，保留可重現 manifest，等待使用者審核。

## Requirements

- 僅使用 `127.0.0.1:8188`，不得開放公網。
- 共用 API client，不再複製既有三份腳本的 submit/poll/view 邏輯。
- 保存 prompt、negative prompt、seed、checkpoint、sampler、scheduler、steps、CFG、尺寸、workflow version、prompt id、輸出 hash 與狀態。
- 支援 timeout、queue/history 恢復、單 job 重試與卡住診斷。
- portrait 產出六個既有 boss keys；transparent profile 使用 `rembg` 與 RGBA WebP。
- 未批准輸出不得進入 `public/` 或覆寫現有圖片。

## Acceptance Criteria

- [ ] ComfyUI health/preflight 通過。
- [ ] 六張 portrait 與一張透明測試均有 manifest 狀態及 staging 輸出，或有明確失敗紀錄。
- [ ] 自動驗證尺寸、格式、alpha、檔名、大小與 hash。
- [ ] 產生可供使用者檢視的 contact sheet／審核索引。
- [ ] 不改正式素材、不呼叫 Gemini/GPT、不部署。

## Review Results

- 六張世界王小王 portrait：使用者全部拒絕。
- 主要原因：持弓／持箭與手部表現不適合，角色立繪整體美感不符合需求。
- 處理：保留在 staging 作為模型／profile 失敗證據，不得升級到 `public/`。

## Out of Scope

- 批准或替換正式素材。
- 安裝未經選型的新模型。
- 移除 Gemini 依賴。
