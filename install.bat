@echo off
chcp 65001 >nul
REM ============================================
REM 依存関係インストールバッチファイル
REM ============================================
echo.
echo ========================================
echo   OBS Overlay Kill - 依存関係インストール
echo ========================================
echo.

REM カレントディレクトリをバッチファイルの場所に設定
cd /d "%~dp0"

REM Node.js/npm の存在確認
where npm >nul 2>&1
if errorlevel 1 (
    echo [エラー] npm が見つかりません。
    echo [情報] Node.js をインストールしてください: https://nodejs.org/
    pause
    exit /b 1
)

REM package.json の存在確認
if not exist "package.json" (
    echo [エラー] package.json が見つかりません。
    echo [情報] このバッチファイルはプロジェクトルートで実行してください。
    pause
    exit /b 1
)

REM 依存関係をインストール
echo [情報] 依存関係をインストールしています...
call npm install

if errorlevel 1 (
    echo [エラー] 依存関係のインストールに失敗しました。
    echo [情報] ネットワーク接続を確認するか、npm のキャッシュをクリアしてください。
    echo [情報] キャッシュクリア: npm cache clean --force
    pause
    exit /b 1
)

echo.
echo [成功] 依存関係のインストールが完了しました！
echo.

pause
