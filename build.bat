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

REM Node.js/npm の存在確認
where npm >nul 2>&1
if errorlevel 1 (
    echo [エラー] npm が見つかりません。
    echo [情報] 先に Node.js（LTS）をインストールしてください: https://nodejs.org/
    echo [情報] または install.bat を実行してください（winget が使える環境では自動インストールします）。
    echo.
    pause
    exit /b 1
)

REM package.json の存在確認
if not exist "package.json" (
    echo [エラー] package.json が見つかりません。
    echo [情報] このバッチファイルはプロジェクトルートで実行してください。
    echo.
    pause
    exit /b 1
)

REM .env の存在確認（無い場合は .env.example から作成して案内）
if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo [警告] .env が無かったため .env.example から .env を作成しました。
        echo [情報] Twitch 認証情報（VITE_TWITCH_TOKEN_APP_CLIENT_ID / SECRET 等）を .env に設定してから再実行してください。
        echo.
        pause
        exit /b 1
    ) else (
        echo [エラー] .env と .env.example の両方が見つかりません。
        echo [情報] リポジトリ一式が揃っているか確認してください。
        echo.
        pause
        exit /b 1
    )
)

REM .env がデフォルト値のままか簡易チェック（よくある設定忘れを早期検出）
findstr /c:"your_token_app_client_id_here" ".env" >nul 2>&1
if not errorlevel 1 (
    echo [警告] .env にサンプル値（your_token_app_client_id_here）が残っています。
    echo [情報] Twitch 認証情報を .env に設定してから build.bat を再実行してください。
    echo.
    pause
    exit /b 1
)

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
