@echo off
chcp 65001 >nul
REM ============================================
REM 開発サーバー起動バッチファイル
REM ============================================
echo.
echo ========================================
echo   OBS Overlay Kill - 開発サーバー起動
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

REM 開発サーバーを起動
echo [情報] 開発サーバーを起動しています...
echo [情報] ブラウザで http://localhost:5173 にアクセスしてください
echo [情報] 停止する場合は Ctrl+C を押してください
echo.
call npm run dev

pause
