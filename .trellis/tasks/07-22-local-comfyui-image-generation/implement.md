# 執行計畫：第一輪並行工作

## Parent Checklist

1. 建立並啟動三個 child tasks。
2. ComfyUI child 建立共用 client、profiles、manifest 與 staging ignore，先提交試點批次。
3. Rules child 建立 collection 權限矩陣與 Emulator test baseline，不部署。
4. Asset/deploy child 建立 tracked snapshots、public assets、生成來源與 tooling dependency 清冊，不刪檔。
5. 利用生成等待時間完成另外兩個 child 的可交付成果。
6. 回收 ComfyUI history/output，執行自動品質檢查並產生 contact sheet／審核清單。
7. 向使用者展示結果；批准前不移入正式路徑。
8. 各 child 獨立 quality check、commit 與 archive；父任務最後做整合檢查。

## Validation

```powershell
Invoke-RestMethod http://127.0.0.1:8188/system_stats
Invoke-RestMethod http://127.0.0.1:8188/queue
git status --short
git diff --check
npm test -- --watchAll=false
Push-Location functions; npm test; Pop-Location
```

ComfyUI 驗證另包含 manifest schema、六張 portrait 結果、一張 transparent 結果、alpha extrema、尺寸、WebP、staging 路徑與失敗恢復紀錄。

## Rollback

- 試點不得覆寫正式圖片；回滾只需捨棄 staging 與新工具程式。
- Rules 本輪不部署；測試／矩陣可單獨回退。
- 清冊本輪不刪檔；不觸發 Git history rewrite。

