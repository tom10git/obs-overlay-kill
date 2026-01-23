@echo off
chcp 65001 >nul
REM ============================================
REM OAuth認証トークン取得バッチファイル
REM ============================================
echo.
echo ========================================
echo   OAuth認証トークン取得ツール
echo ========================================
echo.

REM カレントディレクトリをバッチファイルの場所に設定
cd /d "%~dp0"

REM node_modulesが存在するか確認
if not exist "node_modules\" (
    echo [警告] node_modules が見つかりません。
    echo [情報] 依存関係をインストールしています...
    call npm install
    if errorlevel 1 (
        echo [エラー] 依存関係のインストールに失敗しました。
        pause
        exit /b 1
    )
    echo.
)

REM .envファイルが存在するか確認
if not exist ".env" (
    echo [エラー] .env ファイルが見つかりません。
    echo [情報] .env ファイルを作成して、VITE_TWITCH_CLIENT_ID と VITE_TWITCH_CLIENT_SECRET を設定してください。
    pause
    exit /b 1
)

REM Node.jsスクリプトを実行
echo [情報] OAuth認証を開始しています...
echo [情報] ブラウザが自動的に開きます
echo [情報] 認証を完了すると、自動的にトークンが取得されます
echo.
node scripts/get-oauth-token.js

if errorlevel 1 (
    echo.
    echo [エラー] トークンの取得に失敗しました。
    pause
    exit /b 1
)

echo.
echo [完了] トークンの取得が完了しました。
echo [情報] 開発サーバーを再起動してください。
echo.
pause
