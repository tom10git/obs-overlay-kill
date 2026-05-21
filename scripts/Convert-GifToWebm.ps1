#Requires -Version 5.1
<#
.SYNOPSIS
  Convert all GIF files in a folder to transparent WebM (VP9).

.PARAMETER InputDir
  Folder containing source GIFs (default: gif-inbox at project root).

.PARAMETER OutputDir
  Destination for WebM files (default: src\images). Ignored when -InPlace is set.

.PARAMETER Crf
  VP9 quality (lower = better quality, larger file). Default: 32.

.PARAMETER Force
  Overwrite existing WebM even if newer than the source GIF.

.PARAMETER InPlace
  Write .webm next to each .gif in the input folder.

.PARAMETER Recurse
  Include GIFs in subfolders.

.PARAMETER NoAlpha
  Disable alpha preservation (opaque yuv420p WebM).
#>
[CmdletBinding()]
param(
    [string] $InputDir,
    [string] $OutputDir,
    [int] $Crf = 32,
    [switch] $Force,
    [switch] $InPlace,
    [switch] $Recurse,
    [switch] $NoAlpha
)

$PreserveAlpha = -not $NoAlpha
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'FfmpegAlphaCommon.ps1')

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $InputDir) {
    $InputDir = Join-Path $ProjectRoot 'gif-inbox'
}
if (-not $OutputDir) {
    $OutputDir = Join-Path $ProjectRoot 'src\images'
}

function Convert-OneGif {
    param(
        [string] $Ffmpeg,
        [System.IO.FileInfo] $Gif,
        [string] $DestDir,
        [int] $Crf,
        [bool] $PreserveAlpha,
        [switch] $Force
    )

    $outName = [System.IO.Path]::ChangeExtension($Gif.Name, '.webm')
    $outPath = Join-Path $DestDir $outName

    if ((Test-Path -LiteralPath $outPath) -and -not $Force) {
        $outFile = Get-Item -LiteralPath $outPath
        if ($outFile.LastWriteTime -ge $Gif.LastWriteTime) {
            Write-Host "[skip] $($Gif.Name) -> $outName (webm is up to date)" -ForegroundColor DarkYellow
            return 'skipped'
        }
    }

    if (-not (Test-Path -LiteralPath $DestDir)) {
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }

    Write-Host "[convert] $($Gif.Name) -> $outPath" -ForegroundColor Cyan

    $videoFilter = Get-AlphaAwareVideoFilter -BaseFilter $null -Kind webm -PreserveAlpha:$PreserveAlpha `
        -CleanAlphaRgb:$PreserveAlpha
    $ffmpegArgs = @(
        '-hide_banner', '-loglevel', 'warning', '-stats',
        '-y',
        '-i', $Gif.FullName
    )
    if ($videoFilter) {
        $ffmpegArgs += @('-vf', $videoFilter)
    }
    $ffmpegArgs += Get-Vp9WebmEncoderArgs -Crf $Crf -PreserveAlpha:$PreserveAlpha
    $ffmpegArgs += $outPath

    & $Ffmpeg @ffmpegArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[fail] $($Gif.Name) (ffmpeg exit $LASTEXITCODE)" -ForegroundColor Red
        return 'failed'
    }

    $sizeMb = [math]::Round((Get-Item -LiteralPath $outPath).Length / 1MB, 2)
    Write-Host "[done] $outName (${sizeMb} MB)" -ForegroundColor Green
    return 'ok'
}

Write-Host ''
Write-Host '========================================'
Write-Host '  GIF -> transparent WebM (batch)'
Write-Host '========================================'
Write-Host ''

$ffmpeg = Resolve-FfmpegPath
if (-not $ffmpeg) {
    Write-Host '[error] ffmpeg not found.' -ForegroundColor Red
    Write-Host '[hint] Restart the terminal, or run: winget install Gyan.FFmpeg' -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path -LiteralPath $InputDir)) {
    New-Item -ItemType Directory -Path $InputDir -Force | Out-Null
    Write-Host "[info] Created input folder: $InputDir"
    Write-Host '[info] Add .gif files there and run again.'
    exit 0
}

$gifFiles = @(Get-ChildItem -LiteralPath $InputDir -Filter '*.gif' -File -Recurse:$Recurse |
    Sort-Object FullName)

if ($gifFiles.Count -eq 0) {
    Write-Host "[info] No GIF files in: $InputDir" -ForegroundColor Yellow
    exit 0
}

$destRoot = if ($InPlace) { $InputDir } else { $OutputDir }

Write-Host "Input:  $InputDir"
Write-Host "Output: $destRoot"
Write-Host "ffmpeg: $ffmpeg"
Write-Host "CRF:    $Crf"
Write-Host "Files:  $($gifFiles.Count)"
Write-AlphaModeLine -PreserveAlpha:$PreserveAlpha -CleanAlphaRgb:$PreserveAlpha
Write-Host ''

$ok = 0
$skipped = 0
$failed = 0

foreach ($gif in $gifFiles) {
    $destDir = if ($InPlace) { $gif.DirectoryName } else { $destRoot }
    $result = Convert-OneGif -Ffmpeg $ffmpeg -Gif $gif -DestDir $destDir -Crf $Crf `
        -PreserveAlpha:$PreserveAlpha -Force:$Force
    switch ($result) {
        'ok' { $ok++ }
        'skipped' { $skipped++ }
        'failed' { $failed++ }
    }
    Write-Host ''
}

Write-Host '----------------------------------------'
Write-Host "OK: $ok / Skipped: $skipped / Failed: $failed"
Write-Host '----------------------------------------'

if ($failed -gt 0) {
    exit 1
}

exit 0
