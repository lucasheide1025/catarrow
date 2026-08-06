@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在啟動射箭系統備份...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0備份到D槽.ps1"
echo.
echo ────────────────────────────────
echo 備份程序結束，按任意鍵關閉視窗。
pause >nul
