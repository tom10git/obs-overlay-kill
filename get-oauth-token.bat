@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo OAuth トークン取得（Python スクリプト）
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
  echo Python がインストールされていません。
  echo https://www.python.org/downloads/ から Python 3 をインストールし、
  echo インストール時に "Add Python to PATH" にチェックを入れてください。
  echo.
  pause
  exit /b 1
)

python "scripts\get_oauth_token.py"
set EXIT_CODE=%errorlevel%

echo.
pause
exit /b %EXIT_CODE%
