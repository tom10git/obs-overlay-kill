@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo [エラー] release\dist\index.html が見つかりません。
  echo.
  echo よくある原因:
  echo   1^) zip を展開せずに、zip の中から .bat を直接実行している
  echo      ^- いったん zip を任意フォルダに「すべて展開」してから実行してください
  echo   2^) 配布物に dist/ が含まれていない（作成者が package:release を実行していない）
  echo   3^) release フォルダだけを移動してしまい、dist/ が置き去りになっている
  echo.
  echo.
  echo ---- 自動生成（リポジトリ内で実行している場合）----
  if exist "..\package.json" (
    echo [情報] 上の階層に package.json を検出しました（リポジトリ内の release と判断）。
    echo [情報] release\dist を自動生成します: npm run package:release
    echo.
    pushd "%~dp0.."
    call npm run package:release
    if errorlevel 1 (
      popd
      echo.
      echo [エラー] package:release に失敗しました。上のログを確認してください。
      pause
      exit /b 1
    )
    popd
    echo.
    echo [成功] release\dist を生成しました。続けて起動します。
    echo.
    if not exist "dist\index.html" (
      echo [エラー] 生成後も dist\index.html が見つかりません。手動で package:release の結果を確認してください。
      pause
      exit /b 1
    )
  ) else (
    echo もし「リポジトリ（ソース）」を入手しただけの場合:
    echo   ^- Node.js（npm）が必要です: https://nodejs.org/
    echo   ^- ルートで次を実行すると release\dist が作られます:
    echo       npm install
    echo       npm run package:release
  )
  echo.
  echo 確認: このフォルダ直下に dist\index.html がある状態で再実行してください。
  echo.
  pause
  exit /b 1
)

set "PORT=4173"
if not "%OVERLAY_PORT%"=="" set "PORT=%OVERLAY_PORT%"

echo ========================================
echo  OBS Overlay Kill - ローカル表示
echo ========================================
echo.
echo 静的ファイルを次のポートで配信します: %PORT%
echo 終了するときはこのウィンドウで Ctrl+C を押してください。
echo.
echo OBS ブラウザソースの URL 例:
echo   http://localhost:%PORT%/overlay
echo.
echo ブラウザで開く場合は、起動後に上記を開いてください。
echo ========================================
echo.

npx --yes serve@14 "dist" -s -l %PORT%

endlocal
pause
