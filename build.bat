@echo off
chcp 65001 >nul
REM ============================================
REM ビルドバッチファイル
REM ============================================
echo.
echo ========================================
echo   OBS Overlay Kill - ビルド
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

REM ビルドを実行
echo [情報] アプリケーションをビルドしています...
call npm run build

if errorlevel 1 (
    echo [エラー] ビルドに失敗しました。
    pause
    exit /b 1
)

echo.
echo [成功] ビルドが完了しました！
echo [情報] ビルドされたファイルは dist ディレクトリに出力されています。
echo.

pause
