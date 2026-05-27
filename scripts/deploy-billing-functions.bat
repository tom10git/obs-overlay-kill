@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0\.."

set "EC=0"

echo.
echo === Supabase Edge Functions デプロイ（課金・招待）===
echo.

call :LoadDotEnv

if "%PROJECT_REF%"=="" (
  echo [エラー] .env からプロジェクト ID を読めませんでした。
  echo   VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
  echo   ^(abcdefghijkl の部分がプロジェクト ID^)
  echo.
  set "EC=1"
  goto :finish
)

if /i "%PROJECT_REF%"=="supabase" (
  echo [エラー] プロジェクト ID の読み取りに失敗しました（"supabase" になっています）。
  echo   .env の VITE_SUPABASE_URL が正しいか確認してください。
  echo   例: https://あなたの20文字ID.supabase.co
  echo.
  set "EC=1"
  goto :finish
)

echo プロジェクト ID: %PROJECT_REF%
echo.
echo [必須] まだログインしていない場合、今すぐ別ウィンドウで:
echo   cd /d %CD%
echo   npx supabase login
echo.
echo ブラウザでログインが終わったら、この画面で Enter を押してください...
pause >nul
echo.

set "FUNCS=invite-redeem admin-create-invite admin-create-invites admin-list-invites admin-revoke-invite stripe-checkout stripe-portal stripe-confirm-checkout stripe-webhook twitch-oauth"

for %%f in (%FUNCS%) do (
  echo --- deploy %%f ---
  call npx supabase functions deploy %%f --project-ref %PROJECT_REF%
  if errorlevel 1 (
    echo.
    echo [失敗] %%f
    echo.
    echo よくある原因:
    echo   - npx supabase login していない
    echo   - プロジェクト ID が間違っている
    echo.
    set "EC=1"
    goto :finish
  )
)

echo.
echo すべてデプロイしました。scripts\create-invites.bat を再実行してください。

:finish
echo.
if "%EC%"=="0" (echo 完了) else (echo 失敗 — 上のメッセージを確認)
echo.
echo キーを押すと閉じます...
pause >nul
exit /b %EC%

:LoadDotEnv
set "PROJECT_REF="
set "URL="
if not exist ".env" exit /b 0
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
  if /i "%%~a"=="VITE_SUPABASE_URL" if not "%%~b"=="" set "URL=%%~b"
)
if not defined URL exit /b 0
set "URL=!URL:"=!"
set "URL=!URL:https://=!"
set "URL=!URL:http://=!"
if "!URL:~-1!"=="/" set "URL=!URL:~0,-1!"
for /f "tokens=1 delims=." %%r in ("!URL!") do set "PROJECT_REF=%%r"
exit /b 0
