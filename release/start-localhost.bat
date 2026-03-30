@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo [エラー] dist フォルダまたは index.html がありません。
  echo リポジトリでビルド済みの場合は、次を実行してから配布用フォルダを作り直してください:
  echo   npm run package:release
  echo.
  pause
  exit /b 1
)

set "PORT=4173"
if not "%OVERLAY_PORT%"=="" set "PORT=%OVERLAY_PORT%"

echo ========================================
echo  OBS Overlay Kill - ローカル表示
echo ========================================
echo.
echo 静的ファイルを次のポートで配信します: %PORT%
echo 終了するときはこのウィンドウで Ctrl+C を押してください。
echo.
echo OBS ブラウザソースの URL 例:
echo   http://localhost:%PORT%/overlay
echo.
echo ブラウザで開く場合は、起動後に上記を開いてください。
echo ========================================
echo.

npx --yes serve@14 "dist" -s -l %PORT%

endlocal
pause
