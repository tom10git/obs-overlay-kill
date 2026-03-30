# UTF-8
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path 'dist\index.html')) {
    Write-Host '[エラー] dist フォルダまたは index.html がありません。' -ForegroundColor Red
    Write-Host 'リポジトリで: npm run package:release を実行してください。'
    Read-Host 'Enter で終了'
    exit 1
}

$port = if ($env:OVERLAY_PORT) { $env:OVERLAY_PORT } else { '4173' }

Write-Host '========================================'
Write-Host ' OBS Overlay Kill - ローカル表示'
Write-Host '========================================'
Write-Host ''
Write-Host "ポート: $port"
Write-Host "OBS ブラウザソース例: http://localhost:${port}/overlay"
Write-Host '終了: Ctrl+C'
Write-Host '========================================'
Write-Host ''

npx --yes serve@14 dist -s -l $port
