@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo package:release（AppData 取込 → exe ビルド）を実行します...
echo 同梱元: %LOCALAPPDATA%\OBS-Overlay-Kill\data
call npm run package:release
if errorlevel 1 (
  echo 失敗しました。
  if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
  exit /b 1
)
echo.
echo 完了後 release\ には OBS-Overlay-Kill.exe のみがあります。
echo 同梱した効果音・画像も AppData\data\src\sounds と src\images に同期されます。
echo src\constants\customTechniqueNames.ts は AppData\data\config\ にコピーされます。
echo overlay-config.json の素材パスも src/sounds^|images 形式に更新されます。
if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
