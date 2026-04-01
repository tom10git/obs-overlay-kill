@echo off
setlocal
cd /d "%~dp0"

set "PORT=4173"
if defined OVERLAY_PORT set "PORT=%OVERLAY_PORT%"

if not exist "dist\\index.html" (
  echo [ERROR] release\\dist\\index.html not found.
  echo Run at repo root:
  echo   npm install
  echo   npm run package:release
  echo.
  pause
  exit /b 1
)

node "%~dp0local-server.mjs" --port=%PORT%

endlocal
pause
