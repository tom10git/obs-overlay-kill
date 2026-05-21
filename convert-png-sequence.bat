@echo off
chcp 65001 >nul
REM ============================================
REM PNG 連番シーケンス → 透過 WebM / APNG
REM ============================================
echo.
echo ========================================
echo   PNG sequence -^> WebM / APNG
echo ========================================
echo.

cd /d "%~dp0"

where powershell >nul 2>&1
if errorlevel 1 (
    echo [エラー] PowerShell が見つかりません。
    if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
    exit /b 1
)

if "%~1"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Convert-PngSequence.ps1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Convert-PngSequence.ps1" %*
)

set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [エラー] 変換中にエラーがありました。
)

echo.
echo [使い方]
echo   1. animation-png に連番 PNG を入れる
echo   2. バッチをダブルクリック → サイズ・起点などを質問形式で入力
echo   3. src\images に出力（OBS では WebM URL を設定）
echo.
echo [対話モード] 引数なしで実行
echo   切り抜きの有無 / 幅・高さ / 元サイズ参照(clamp^|fixed) / 起点 / 形式 / FPS
echo.
echo [コマンドライン例]
echo   convert-png-sequence.bat -NoInteractive -CropSize 720 -CropAnchor topCenter -OutputName animation-720 -Force
echo   （フレームサイズがバラバラなときはキャンバス正規化を自動ON。無効化は -NoCropNormalizeCanvas）
echo   convert-png-sequence.bat -NoInteractive -CropSize 720 -NoCropNormalizeCanvas -Force
echo.

if /i not "%OBS_OVERLAY_KILL_NON_INTERACTIVE%"=="1" pause
exit /b %EXIT_CODE%
