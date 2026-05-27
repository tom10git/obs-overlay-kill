@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0\.."

set "EC=0"

echo.
echo === 招待コード一括登録 ===
echo 作業フォルダ: %CD%
echo.

call :LoadDotEnv

if "%BILLING_ADMIN_SECRET%"=="" (
  echo [エラー] BILLING_ADMIN_SECRET が未設定です。
  echo.
  echo 【やること】Supabase に入れたのと同じ文字列を .env に書く:
  echo   BILLING_ADMIN_SECRET=あなたが決めた長いパスワード
  echo.
  echo Supabase 側（まだなら）:
  echo   ブラウザで Supabase プロジェクト → Edge Functions → Secrets
  echo   名前: BILLING_ADMIN_SECRET
  echo.
  echo .env を保存したら、この bat をもう一度ダブルクリックしてください。
  echo.
  set "EC=1"
  goto :finish
)

if "%SUPABASE_URL%"=="" (
  echo [エラー] SUPABASE_URL / VITE_SUPABASE_URL が .env にありません。
  echo   VITE_SUPABASE_URL=https://xxxx.supabase.co
  echo.
  set "EC=1"
  goto :finish
)

set "JSON=%~1"
if "%JSON%"=="" set "JSON=scripts\billing-invites.json"

if not exist "%JSON%" (
  echo [エラー] JSON が見つかりません: %JSON%
  echo 例: scripts\create-invites.bat scripts\billing-invites.json
  echo.
  set "EC=1"
  goto :finish
)

echo 実行中: %JSON%
echo.
node "%~dp0create-invites.mjs" "%JSON%"
set "EC=!ERRORLEVEL!"

goto :finish

:LoadDotEnv
if not exist ".env" exit /b 0
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
  if /i "%%~a"=="BILLING_ADMIN_SECRET" if not "%%~b"=="" if "!BILLING_ADMIN_SECRET!"=="" (
    set "BILLING_ADMIN_SECRET=%%~b"
  )
  if /i "%%~a"=="SUPABASE_URL" if not "%%~b"=="" if "!SUPABASE_URL!"=="" (
    set "SUPABASE_URL=%%~b"
  )
  if /i "%%~a"=="VITE_SUPABASE_URL" if not "%%~b"=="" if "!SUPABASE_URL!"=="" (
    set "SUPABASE_URL=%%~b"
  )
)
if defined BILLING_ADMIN_SECRET set "BILLING_ADMIN_SECRET=!BILLING_ADMIN_SECRET:"=!"
if defined SUPABASE_URL set "SUPABASE_URL=!SUPABASE_URL:"=!"
exit /b 0

:finish
echo.
if "%EC%"=="0" (
  echo 完了しました。created-invites-*.json をプロジェクト直下で確認してください。
) else (
  echo 失敗しました（終了コード %EC%）。上のメッセージを確認してください。
)
echo.
echo このウィンドウを閉じるには何かキーを押してください...
pause >nul
exit /b %EC%
