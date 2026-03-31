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
    echo [警告] npm が見つかりません。
    echo [情報] Node.js を自動インストールします...
    echo.
    
    REM winget の存在確認
    where winget >nul 2>&1
    if errorlevel 1 (
        echo [警告] winget が見つかりません。
        echo [情報] winget を使用できないため、手動インストールが必要です。
        echo [情報] Node.js をインストールしてください: https://nodejs.org/
        echo [情報] インストール後、このバッチファイルを再実行してください。
        pause
        exit /b 1
    )
    
    REM winget で Node.js をインストール
    echo [情報] winget を使用して Node.js をインストールしています...
    echo [情報] 管理者権限が必要な場合があります。
    echo.
    
    REM winget install OpenJS.NodeJS.LTS を実行
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    
    if errorlevel 1 (
        echo [エラー] Node.js のインストールに失敗しました。
        echo [情報] 手動で Node.js をインストールしてください: https://nodejs.org/
        echo [情報] インストール後、このバッチファイルを再実行してください。
        pause
        exit /b 1
    )
    
    echo [成功] Node.js のインストールが完了しました。
    echo [情報] 環境変数を更新するため、数秒待機します...
    timeout /t 3 /nobreak >nul
    
    REM 環境変数PATHを更新（現在のセッションのみ）
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYSTEM_PATH=%%b"
    if defined SYSTEM_PATH (
        set "PATH=%SYSTEM_PATH%;%PATH%"
    )
    
    REM 一般的なNode.jsのインストールパスを確認
    if exist "%ProgramFiles%\nodejs\npm.cmd" (
        set "PATH=%ProgramFiles%\nodejs;%PATH%"
    )
    if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" (
        set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    )
    if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\npm.cmd" (
        REM winget経由でインストールされた場合のパス
        set "PATH=%LOCALAPPDATA%\Microsoft\WindowsApps;%PATH%"
    )
    
    REM 再度 npm の存在確認
    where npm >nul 2>&1
    if errorlevel 1 (
        echo [警告] インストール後も npm が見つかりません。
        echo [情報] 環境変数の更新には新しいコマンドプロンプトが必要です。
        echo [情報] このウィンドウを閉じて、新しいコマンドプロンプトで再実行してください。
        echo [情報] または、システムを再起動してください。
        pause
        exit /b 1
    )
    
    echo [成功] npm が見つかりました。続行します...
    echo.
)

REM package.json の存在確認
if not exist "package.json" (
    echo [エラー] package.json が見つかりません。
    echo [情報] このバッチファイルはプロジェクトルートで実行してください。
    pause
    exit /b 1
)

REM .env の存在確認（無い場合は .env.example から作成して案内）
if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
        echo [警告] .env が無かったため .env.example から .env を作成しました。
        echo [情報] Twitch 認証情報（VITE_TWITCH_TOKEN_APP_CLIENT_ID / SECRET 等）を .env に設定してください。
        echo [情報] 依存関係のインストールは続行しますが、ビルドは .env 未設定だと失敗することがあります。
        echo.
    ) else (
        echo [警告] .env と .env.example の両方が見つかりません。
        echo [情報] リポジトリ一式が揃っているか確認してください。
        echo.
    )
)

REM .env がサンプル値のままか簡易チェック（設定忘れの注意喚起）
if exist ".env" (
    findstr /c:"your_token_app_client_id_here" ".env" >nul 2>&1
    if not errorlevel 1 (
        echo [注意] .env にサンプル値（your_token_app_client_id_here）が残っています。
        echo [注意] 後で build.bat / npm run build を行う前に .env を設定してください。
        echo.
    )
)

REM 依存関係をインストール（package.jsonに記載されているもののみ）
echo [情報] 依存関係をインストール中...
echo [情報] package.jsonに記載されている依存関係のみをインストールします...
call npm install --omit=optional --legacy-peer-deps

if errorlevel 1 (
    echo [エラー] 依存関係のインストールに失敗しました。
    echo [情報] ネットワーク接続を確認するか、npm のキャッシュをクリアしてください。
    echo [情報] キャッシュクリア: npm cache clean --force
    echo [情報] 再試行: npm install --omit=optional --legacy-peer-deps
    pause
    exit /b 1
)

echo.
echo [成功] 依存関係のインストールが完了しました！
echo.

pause
