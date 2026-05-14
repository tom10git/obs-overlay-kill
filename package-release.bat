@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo package:release（ビルド → release\dist にコピー）を実行します...
call npm run package:release
if errorlevel 1 (
  echo 失敗しました。
  if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
  exit /b 1
)
echo.
echo 配布用は release フォルダを zip などにまとめてください。
if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
