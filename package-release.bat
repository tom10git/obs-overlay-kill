@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo package:release（ビルド → release\dist にコピー）を実行します...
call npm run package:release
if errorlevel 1 (
  echo 失敗しました。
  pause
  exit /b 1
)
echo.
echo 配布用は release フォルダを zip などにまとめてください。
pause
