@echo off
setlocal EnableExtensions
REM 共通: package-lock.json に厳密に従って依存関係をインストール（npm ci）
cd /d "%~dp0\.."

if not exist "package.json" (
    echo [エラー] package.json が見つかりません。
    exit /b 1
)

if not exist "package-lock.json" (
    echo [エラー] package-lock.json が見つかりません。
    echo [情報] 公式リポジトリのクローンか、lockfile 付きの配布物を使用してください。
    echo [情報] npm install で lock を再生成すると、意図しないバージョンが入る可能性があります。
    exit /b 1
)

echo [情報] package-lock.json に従って依存関係をインストールします（npm ci）...
echo [情報] .npmrc の ignore-scripts により install スクリプトは実行されません。
call npm ci
if errorlevel 1 (
    echo [エラー] npm ci に失敗しました。package-lock.json と package.json の整合性を確認してください。
    exit /b 1
)

if /i "%OBS_OVERLAY_KILL_SKIP_AUDIT%"=="1" exit /b 0

echo [情報] 脆弱性スキャン（npm audit --audit-level=high）...
call npm audit --audit-level=high
if errorlevel 1 (
    if /i "%OBS_OVERLAY_KILL_STRICT_AUDIT%"=="1" (
        echo [エラー] high 以上の脆弱性があります。npm audit の結果を確認してください。
        exit /b 1
    )
    echo [警告] high 以上の脆弱性が検出されました。npm audit の結果を確認してください。
    echo [情報] 厳格モード: set OBS_OVERLAY_KILL_STRICT_AUDIT=1
)

exit /b 0
