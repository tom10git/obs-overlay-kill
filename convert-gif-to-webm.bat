@echo off
chcp 65001 >nul
REM ============================================
REM GIF → 透過 WebM 一括変換
REM ============================================
echo.
echo ========================================
echo   GIF -^> WebM 一括変換
echo ========================================
echo.

cd /d "%~dp0"

where powershell >nul 2>&1
if errorlevel 1 (
    echo [エラー] PowerShell が見つかりません。
    if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
    exit /b 1
)

REM 引数をそのまま PowerShell に渡す（例: -Force, -InPlace, -InputDir "path"）
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Convert-GifToWebm.ps1" %*

set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [エラー] 変換中にエラーがありました。
)

echo.
echo [使い方]
echo   1. gif-inbox フォルダに .gif を入れる
echo   2. このバッチを実行する
echo   3. src\images に .webm が出力される
echo.
echo [オプション例]
echo   convert-gif-to-webm.bat -Force
echo   convert-gif-to-webm.bat -InPlace
echo   convert-gif-to-webm.bat -InputDir "C:\path\to\gifs" -OutputDir "src\images"
echo.
echo [透過]
echo   デフォルトで GIF の透過を維持（VP9 + yuva420p）
echo   透過不要なら -NoAlpha
echo.

if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
exit /b %EXIT_CODE%
