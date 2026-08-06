# 備份到D槽.ps1
# ─────────────────────────────────────────────────────────────
#  射箭系統一鍵備份：先備 Firebase 資料，再把專案增量鏡像到 D 槽
#  流程：
#    1. Firestore 全庫備份（含子集合）→ D:\射箭系統備份\firebase\firestore-<時間>\
#    2. 比對出「這次有變動的檔」（PowerShell 比時間/大小，跳過 node_modules/.git/build）
#    3. robocopy 增量鏡像整個專案（含 node_modules）→ D:\射箭系統備份\catarrow\
#       （robocopy 預設只複製較新/不同的檔，沒變的自動跳過＝增量）
#    4. 變更清單 → D:\射箭系統備份\_變更清單\changed_<日期>.txt
#  用法：對這個檔按右鍵→用 PowerShell 執行，或雙擊「備份到D槽.bat」。
# ─────────────────────────────────────────────────────────────
$ErrorActionPreference = "Stop"

# ── 路徑設定（要搬專案位置就改這裡）──────────────────────────
$SRC       = "C:\Users\broud\Desktop\catarrow"
$DEST_ROOT = "D:\射箭系統備份"
$MIRROR    = Join-Path $DEST_ROOT "catarrow"
$FB_DIR    = Join-Path $DEST_ROOT "firebase"
$LOG_DIR   = Join-Path $DEST_ROOT "_變更清單"

$stampNow = Get-Date -Format "yyyy-MM-dd_HHmmss"
$dateOnly = Get-Date -Format "yyyy-MM-dd"

# 掃描變更清單時要跳過的頂層資料夾（這些仍會被 robocopy 鏡像，只是不列進清單）
$skipTopDirs  = @("node_modules", ".git", "build", ".tmp.driveupload", ".tmp.drivedownload", "backups")
# robocopy 鏡像時要完全排除的（Google Drive 暫存 + 本地 backups，Firebase 已另存 D 槽）
$excludeDirs  = @(".tmp.driveupload", ".tmp.drivedownload", "backups")
$excludeFiles = @("nul", ".tmp-dev-server.out.log", ".tmp-dev-server.err.log")

# ── 0. 前置檢查 ──────────────────────────────────────────────
if (-not (Test-Path "D:\")) {
  Write-Host "找不到 D 槽，備份中止。請確認 D 槽已連接。" -ForegroundColor Red
  exit 1
}
New-Item -ItemType Directory -Force -Path $MIRROR, $FB_DIR, $LOG_DIR | Out-Null

# ── 1. Firebase 資料備份 ─────────────────────────────────────
Write-Host "════════ 步驟 1/3：備份 Firebase 資料 ════════" -ForegroundColor Cyan
$fbOk = $true
try {
  Push-Location $SRC
  node "scripts\backup-firestore.js" "$FB_DIR"
  if ($LASTEXITCODE -ne 0) { $fbOk = $false }
} catch {
  $fbOk = $false
  Write-Host ("Firebase 備份發生例外：" + $_.Exception.Message) -ForegroundColor Yellow
} finally {
  Pop-Location
}
if (-not $fbOk) {
  Write-Host "⚠️ Firebase 備份未成功（網路/憑證問題？）。仍會繼續做檔案備份；" -ForegroundColor Yellow
  Write-Host "   稍後可單獨重跑：node scripts\backup-firestore.js `"$FB_DIR`"" -ForegroundColor Yellow
}

# ── 2. 先算出「這次有變動的檔」（在 robocopy 覆蓋前比對）──────
Write-Host "`n════════ 步驟 2/3：比對變更檔案 ════════" -ForegroundColor Cyan
$changed = New-Object System.Collections.Generic.List[string]

# 只掃描「非大型資料夾」：頂層檔 + 非 skip 的頂層子資料夾遞迴
$scanFiles = New-Object System.Collections.Generic.List[System.IO.FileInfo]
Get-ChildItem -LiteralPath $SRC -File -Force | ForEach-Object { $scanFiles.Add($_) }
Get-ChildItem -LiteralPath $SRC -Directory -Force |
  Where-Object { $skipTopDirs -notcontains $_.Name } |
  ForEach-Object {
    Get-ChildItem -LiteralPath $_.FullName -Recurse -File -Force | ForEach-Object { $scanFiles.Add($_) }
  }

foreach ($f in $scanFiles) {
  $rel = $f.FullName.Substring($SRC.Length).TrimStart('\')
  $mirrorPath = Join-Path $MIRROR $rel
  if (-not (Test-Path -LiteralPath $mirrorPath)) {
    $changed.Add("新增  $rel")
  } else {
    $m = Get-Item -LiteralPath $mirrorPath
    if (($f.LastWriteTime -gt $m.LastWriteTime) -or ($f.Length -ne $m.Length)) {
      $changed.Add("更新  $rel")
    }
  }
}
Write-Host ("比對完成：有意義變動 {0} 個檔（不含 node_modules/.git/build）" -f $changed.Count)

# ── 3. robocopy 實際增量鏡像（含 node_modules，只看回傳碼不解析 log）──
Write-Host "`n════════ 步驟 3/3：增量鏡像到 D 槽 ════════" -ForegroundColor Cyan
Write-Host "（第一次會比較久，之後只複製有變動的檔）" -ForegroundColor DarkGray
$copyLog = Join-Path $LOG_DIR ("_robocopy_" + $stampNow + ".log")
$rcArgs = @($SRC, $MIRROR, "/E", "/R:1", "/W:1", "/NP", "/NDL", "/NFL")
$rcArgs += "/XD"; $rcArgs += $excludeDirs
$rcArgs += "/XF"; $rcArgs += $excludeFiles
$rcArgs += "/LOG:$copyLog"
robocopy @rcArgs | Out-Null
$rc = $LASTEXITCODE   # robocopy 回傳碼：<8 代表成功（0=沒變動,1=有複製,2=有多餘,3=1+2…；>=8 才是錯誤）

# ── 4. 寫出變更清單 ──────────────────────────────────────────
$changedTxt = Join-Path $LOG_DIR ("changed_" + $dateOnly + ".txt")
$header = @(
  "# 變更清單  $stampNow",
  "# 來源：$SRC",
  "# 鏡像：$MIRROR",
  ("# 本次有意義變動 {0} 個檔（node_modules/.git/build 已鏡像但不列入此清單）" -f $changed.Count),
  "# ─────────────────────────────────────────────"
)
$header | Out-File -FilePath $changedTxt -Encoding utf8
if ($changed.Count -gt 0) {
  $changed | Out-File -FilePath $changedTxt -Append -Encoding utf8
} else {
  "（本次沒有 node_modules/.git/build 以外的檔案變動）" | Out-File -FilePath $changedTxt -Append -Encoding utf8
}

# ── 寫出「最近備份狀態」檔（雙擊一眼就知道有沒有跑、跑得如何）──
$statusFile = Join-Path $DEST_ROOT "最近備份狀態.txt"
if ($fbOk)    { $fbTxt = "✅ 成功" }     else { $fbTxt = "⚠️ 失敗" }
if ($rc -lt 8) { $mirrorTxt = "✅ 成功" } else { $mirrorTxt = "⚠️ 有錯誤（回傳碼 $rc）" }
@(
  "最近一次備份完成時間：$stampNow",
  "Firebase 資料：$fbTxt",
  "檔案鏡像：    $mirrorTxt",
  "本次有意義變動：$($changed.Count) 個檔",
  "",
  "（此檔每次備份自動覆蓋更新。上面的時間＝最後一次成功跑完的時間；",
  "  若時間停在昨天以前，代表最近沒跑成功，需檢查電腦當時是否開機/登入。）"
) | Out-File -FilePath $statusFile -Encoding utf8

# ── 完成總結 ─────────────────────────────────────────────────
Write-Host "`n════════ 備份完成 ════════" -ForegroundColor Green
if ($fbOk) { Write-Host "Firebase：  ✅ 已備份 → $FB_DIR" }
else       { Write-Host "Firebase：  ⚠️ 失敗（見上方訊息）" -ForegroundColor Yellow }
if ($rc -lt 8) { Write-Host "檔案鏡像：  ✅ 完成 → $MIRROR" }
else           { Write-Host "檔案鏡像：  ⚠️ robocopy 回傳碼 $rc（有錯誤，見 $copyLog）" -ForegroundColor Yellow }
Write-Host ("本次有意義變動：{0} 個檔 → 清單：{1}" -f $changed.Count, $changedTxt)
