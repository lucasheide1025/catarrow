# Quickstart: 在 CatArrow 使用 Spec Kit

## 0. 先重新啟動終端與 Codex

安裝時已將 `C:\Users\broud\.local\bin` 加入 PATH，但目前終端尚未重啟。請先關閉並重新開啟終端，
再從 `C:\Users\broud\Desktop\catarrow` 啟動 Codex，讓 `specify` 與 `$speckit-*` skills 生效。

```powershell
specify --version
specify integration list
```

舊終端可暫時使用：

```powershell
& 'C:\Users\broud\.local\bin\specify.exe' --version
```

## 1. 建立工作邊界

先依 AGENTS.md 建立並核准 Trellis task。確認一個 task 對應一個主要 feature，且不要把無關重構混入。

## 2. 執行 Spec Kit 流程

在 Codex 對話中依序使用：

```text
$speckit-specify 描述使用者、問題、價值、範圍與成功條件
$speckit-clarify
$speckit-plan 說明技術限制、既有模組與部署要求
$speckit-tasks
$speckit-analyze
$speckit-implement
$speckit-converge
```

只有全域原則需要更新時才先執行：

```text
$speckit-constitution 說明要新增或修改的不可協商原則
```

## 3. 驗證 artifacts

```powershell
Get-Content .specify\feature.json
Get-ChildItem -Recurse specs
rg -n 'NEEDS CLARIFICATION|TBD|\[[A-Z][A-Z0-9_]+\]' .specify\memory specs
git diff --check
```

## 4. 驗證產品變更

依受影響範圍執行：

```powershell
npm test -- --watchAll=false
npm run build
Push-Location functions
npm test
Pop-Location
```

Rules、Functions 或正式部署另需按 plan 取得權限、先做 bounded/preview 驗證，並記錄回滾方式。

## Expected Outcome

- feature directory 中有無歧義 spec、plan、design artifacts 與 tasks。
- constitution gates 全部通過或有明確、限期的例外。
- 每個 task 可追溯到 user story，且驗證結果可重現。
- Trellis task 通過 check、文件同步與提交審閱後才完成。
