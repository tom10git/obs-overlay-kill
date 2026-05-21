#Requires -Version 5.1
<#
.SYNOPSIS
  Convert a numbered PNG sequence in a folder to transparent WebM (VP9) and/or APNG.

.PARAMETER InputDir
  Folder containing .png frames (default: animation-png at project root).

.PARAMETER OutputDir
  Destination folder (default: src\images). Ignored when -InPlace is set.

.PARAMETER OutputName
  Base file name without extension (default: input folder name).

.PARAMETER Fps
  Playback frame rate (default: 60). Each PNG is one frame.

.PARAMETER Format
  webm | apng | both

.PARAMETER Crf
  VP9 quality for WebM (lower = better, larger). Default: 32.

.PARAMETER ApngPlays
  APNG loop count. 0 = infinite. Default: 0.

.PARAMETER Force
  Re-encode even if output is newer than the newest source PNG.

.PARAMETER InPlace
  Write outputs next to the PNGs in the input folder.

.PARAMETER CropSize
  Shorthand for a square crop (sets width and height). Same as -CropWidth N -CropHeight N.

.PARAMETER CropWidth
  Crop width in pixels.

.PARAMETER CropHeight
  Crop height in pixels. If omitted while -CropWidth is set, uses -CropWidth (square).

.PARAMETER CropAnchor
  Anchor preset for crop position: topLeft, topCenter, topRight,
  centerLeft, center, centerRight, bottomLeft, bottomCenter, bottomRight, custom.

.PARAMETER CropX
  Left edge in pixels when -CropAnchor custom. Ignored for other anchors.

.PARAMETER CropY
  Top edge in pixels when -CropAnchor custom. Ignored for other anchors.

.PARAMETER CropOffsetX
  Extra horizontal offset in pixels (added after anchor).

.PARAMETER CropOffsetY
  Extra vertical offset in pixels (added after anchor).

.PARAMETER CropFilter
  Raw ffmpeg crop filter (e.g. "crop=720:720:(iw-720)/2:0"). Overrides other crop options.

.PARAMETER CropSizeMode
  clamp | fixed — how crop width/height relate to each source frame.
  clamp (default): reference each frame's size — min(requested, frame size) when smaller.
  fixed: always use the requested pixel size (fails if any frame is too small).

.PARAMETER CropNormalizeCanvas
  Pad every frame to the sequence max width/height before crop (then fixed crop).
  Also enabled automatically when frame sizes differ (unless -NoCropNormalizeCanvas).

.PARAMETER NoCropNormalizeCanvas
  Disable canvas normalize, including auto-enable for mixed frame sizes.

.PARAMETER NoAlpha
  Disable alpha preservation (WebM: opaque VP9 / APNG: no alpha channel).

.PARAMETER NoCleanAlpha
  Do not zero RGB on fully transparent pixels (alpha=0). Default: clean (fixes white fringe).

.PARAMETER NoInteractive
  Skip interactive prompts (use parameters only). Batch uses interactive mode when no crop args.
#>
[CmdletBinding()]
param(
    [string] $InputDir,
    [string] $OutputDir,
    [string] $OutputName,
    [double] $Fps = 60,
    [ValidateSet('webm', 'apng', 'both')]
    [string] $Format = 'webm',
    [int] $Crf = 32,
    [int] $ApngPlays = 0,
    [int] $CropSize = 0,
    [int] $CropWidth = 0,
    [int] $CropHeight = 0,
    [ValidateSet(
        'topLeft', 'topCenter', 'topRight',
        'centerLeft', 'center', 'centerRight',
        'bottomLeft', 'bottomCenter', 'bottomRight',
        'custom'
    )]
    [string] $CropAnchor = 'topCenter',
    [int] $CropX = 0,
    [int] $CropY = 0,
    [int] $CropOffsetX = 0,
    [int] $CropOffsetY = 0,
    [ValidateSet('clamp', 'fixed')]
    [string] $CropSizeMode = 'clamp',
    [switch] $CropNormalizeCanvas,
    [switch] $NoCropNormalizeCanvas,
    [string] $CropFilter,
    [switch] $NoAlpha,
    [switch] $NoCleanAlpha,
    [switch] $NoInteractive,
    [switch] $Force,
    [switch] $InPlace
)

$PreserveAlpha = -not $NoAlpha
$CleanAlphaRgb = $PreserveAlpha -and (-not $NoCleanAlpha)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'FfmpegAlphaCommon.ps1')
. (Join-Path $PSScriptRoot 'Convert-PngSequence.Interactive.ps1')

$envNonInteractive = $env:OBS_OVERLAY_KILL_NON_INTERACTIVE -eq '1'
$cropFromArgs = Test-CropParametersSpecified -CropSize $CropSize -CropWidth $CropWidth `
    -CropHeight $CropHeight -CropFilter $CropFilter -CropAnchor $CropAnchor `
    -CropX $CropX -CropY $CropY -CropOffsetX $CropOffsetX -CropOffsetY $CropOffsetY
$useInteractive = -not $NoInteractive -and -not $envNonInteractive -and -not $cropFromArgs

$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $InputDir) {
    $InputDir = Join-Path $ProjectRoot 'animation-png'
}
if (-not $OutputDir) {
    $OutputDir = Join-Path $ProjectRoot 'src\images'
}

function Get-PngSequenceSortKey {
    param([System.IO.FileInfo] $File)
    # e.g. mahozin_0001_Timeline-1_00216003.png -> 1
    if ($File.BaseName -match '^[^_]+_(\d+)') {
        return [int]$Matches[1]
    }
    $nums = [regex]::Matches($File.BaseName, '\d+')
    if ($nums.Count -gt 0) {
        return [int]$nums[$nums.Count - 1].Value
    }
    return [int]::MaxValue
}

function Get-PngSequenceDimensionStats {
    param([System.IO.FileInfo[]] $PngFiles)

    $minW = [int]::MaxValue
    $minH = [int]::MaxValue
    $maxW = 0
    $maxH = 0
    foreach ($f in $PngFiles) {
        $dim = & ffprobe -v error -select_streams v:0 `
            -show_entries stream=width,height -of csv=p=0 $f.FullName 2>$null
        if ($dim -match '^(\d+),(\d+)$') {
            $w = [int]$Matches[1]
            $h = [int]$Matches[2]
            if ($w -lt $minW) { $minW = $w }
            if ($h -lt $minH) { $minH = $h }
            if ($w -gt $maxW) { $maxW = $w }
            if ($h -gt $maxH) { $maxH = $h }
        }
    }
    if ($minW -eq [int]::MaxValue) {
        return $null
    }
    return @{ MinWidth = $minW; MinHeight = $minH; MaxWidth = $maxW; MaxHeight = $maxH }
}

function Get-NewestPngTime {
    param([System.IO.FileInfo[]] $PngFiles)
    $latest = [datetime]::MinValue
    foreach ($f in $PngFiles) {
        if ($f.LastWriteTime -gt $latest) {
            $latest = $f.LastWriteTime
        }
    }
    return $latest
}

function Should-SkipOutput {
    param(
        [string] $OutPath,
        [datetime] $SourceTime,
        [switch] $Force
    )
    if ($Force) {
        return $false
    }
    if (-not (Test-Path -LiteralPath $OutPath)) {
        return $false
    }
    $outFile = Get-Item -LiteralPath $OutPath
    return $outFile.LastWriteTime -ge $SourceTime
}

function Resolve-CropDimensions {
    param(
        [int] $CropSize,
        [int] $CropWidth,
        [int] $CropHeight
    )

    $w = 0
    $h = 0
    if ($CropWidth -gt 0) { $w = $CropWidth }
    elseif ($CropSize -gt 0) { $w = $CropSize }

    if ($CropHeight -gt 0) { $h = $CropHeight }
    elseif ($CropSize -gt 0) { $h = $CropSize }
    elseif ($w -gt 0) { $h = $w }

    return @{ Width = $w; Height = $h }
}

function Get-CropSpanExpression {
    param(
        [int] $Requested,
        [char] $DimensionLetter,
        [ValidateSet('clamp', 'fixed')]
        [string] $SizeMode = 'clamp'
    )
    if ($SizeMode -eq 'fixed') {
        return "$Requested"
    }
    # 元画像が指定より小さいフレームでも crop が失敗しないよう min() でクランプ
    # ffmpeg フィルタ内のカンマは \, でエスケープ
    return "min($Requested\,i$DimensionLetter)"
}

function Get-CropAxisExpression {
    param(
        [int] $CropSpan,
        [ValidateSet('start', 'center', 'end', 'custom')]
        [string] $AxisMode,
        [int] $CustomValue,
        [int] $Offset,
        [char] $DimensionLetter,
        [ValidateSet('clamp', 'fixed')]
        [string] $SizeMode = 'clamp'
    )

    $span = Get-CropSpanExpression -Requested $CropSpan -DimensionLetter $DimensionLetter `
        -SizeMode $SizeMode

    $base = switch ($AxisMode) {
        'start' { '0' }
        'center' { "(i${DimensionLetter}-${span})/2" }
        'end' { "i${DimensionLetter}-${span}" }
        'custom' { "$CustomValue" }
    }

    if ($Offset -eq 0) {
        return $base
    }
    if ($base -eq '0') {
        return "$Offset"
    }
    return "(${base})+${Offset}"
}

function Get-CropVideoFilter {
    param(
        [int] $Width,
        [int] $Height,
        [string] $Anchor,
        [int] $CropX,
        [int] $CropY,
        [int] $OffsetX,
        [int] $OffsetY,
        [ValidateSet('clamp', 'fixed')]
        [string] $SizeMode = 'clamp'
    )

    if ($Width -le 0 -or $Height -le 0) {
        throw 'Crop width and height must be greater than 0.'
    }

    $wOut = Get-CropSpanExpression -Requested $Width -DimensionLetter 'w' -SizeMode $SizeMode
    $hOut = Get-CropSpanExpression -Requested $Height -DimensionLetter 'h' -SizeMode $SizeMode

    if ($Anchor -eq 'custom') {
        if ($CropX -lt 0 -or $CropY -lt 0) {
            throw 'CropX and CropY must be 0 or greater when CropAnchor is custom.'
        }
        $xExpr = Get-CropAxisExpression -CropSpan $Width -AxisMode custom -CustomValue $CropX `
            -Offset $OffsetX -DimensionLetter 'w' -SizeMode $SizeMode
        $yExpr = Get-CropAxisExpression -CropSpan $Height -AxisMode custom -CustomValue $CropY `
            -Offset $OffsetY -DimensionLetter 'h' -SizeMode $SizeMode
    }
    else {
        $hMode = 'center'
        $vMode = 'center'
        switch ($Anchor) {
            'topLeft' { $hMode = 'start'; $vMode = 'start' }
            'topCenter' { $hMode = 'center'; $vMode = 'start' }
            'topRight' { $hMode = 'end'; $vMode = 'start' }
            'centerLeft' { $hMode = 'start'; $vMode = 'center' }
            'center' { $hMode = 'center'; $vMode = 'center' }
            'centerRight' { $hMode = 'end'; $vMode = 'center' }
            'bottomLeft' { $hMode = 'start'; $vMode = 'end' }
            'bottomCenter' { $hMode = 'center'; $vMode = 'end' }
            'bottomRight' { $hMode = 'end'; $vMode = 'end' }
            default { throw "Unknown CropAnchor: $Anchor" }
        }
        $xExpr = Get-CropAxisExpression -CropSpan $Width -AxisMode $hMode -CustomValue 0 `
            -Offset $OffsetX -DimensionLetter 'w' -SizeMode $SizeMode
        $yExpr = Get-CropAxisExpression -CropSpan $Height -AxisMode $vMode -CustomValue 0 `
            -Offset $OffsetY -DimensionLetter 'h' -SizeMode $SizeMode
    }

    return "crop=${wOut}:${hOut}:${xExpr}:${yExpr}"
}

function Resolve-CropVideoFilter {
    param(
        [string] $CropFilter,
        [int] $CropSize,
        [int] $CropWidth,
        [int] $CropHeight,
        [string] $CropAnchor,
        [int] $CropX,
        [int] $CropY,
        [int] $CropOffsetX,
        [int] $CropOffsetY,
        [ValidateSet('clamp', 'fixed')]
        [string] $CropSizeMode = 'clamp'
    )

    if ($CropFilter) {
        $trimmed = $CropFilter.Trim()
        if ($trimmed -notmatch '^crop=') {
            throw 'CropFilter must start with "crop=" (ffmpeg crop filter).'
        }
        return @{
            Filter = $trimmed
            Width = 0
            Height = 0
            Anchor = 'custom'
            OffsetX = $CropOffsetX
            OffsetY = $CropOffsetY
            IsRaw = $true
        }
    }

    $dims = Resolve-CropDimensions -CropSize $CropSize -CropWidth $CropWidth -CropHeight $CropHeight
    if ($dims.Width -le 0 -and $dims.Height -le 0) {
        return $null
    }

    $filter = Get-CropVideoFilter -Width $dims.Width -Height $dims.Height -Anchor $CropAnchor `
        -CropX $CropX -CropY $CropY -OffsetX $CropOffsetX -OffsetY $CropOffsetY -SizeMode $CropSizeMode

    return @{
        Filter = $filter
        Width = $dims.Width
        Height = $dims.Height
        Anchor = $CropAnchor
        OffsetX = $CropOffsetX
        OffsetY = $CropOffsetY
        SizeMode = $CropSizeMode
        IsRaw = $false
    }
}

function Invoke-PngSequenceEncode {
    param(
        [string] $Ffmpeg,
        [string] $InputDir,
        [int] $FrameCount,
        [double] $Fps,
        [string] $OutPath,
        [ValidateSet('webm', 'apng')]
        [string] $Kind,
        [int] $Crf,
        [int] $ApngPlays,
        [bool] $PreserveAlpha,
        [bool] $CleanAlphaRgb
    )

    $fromPrepared = $PreserveAlpha
    $videoFilter = Get-EncodeVideoFilter -Kind $Kind -PreserveAlpha:$PreserveAlpha `
        -FromPreparedPng:$fromPrepared
    if ($videoFilter) {
        Write-Host "            encode vf: $videoFilter" -ForegroundColor DarkGray
    }

    $inputPattern = Join-Path $InputDir 'frame_%04d.png'
    $args = @(
        '-hide_banner', '-loglevel', 'warning', '-stats',
        '-y',
        '-framerate', "$Fps",
        '-i', $inputPattern,
        '-frames:v', "$FrameCount"
    )

    if ($videoFilter) {
        $args += @('-vf', $videoFilter)
    }

    if ($Kind -eq 'webm') {
        $args += Get-Vp9WebmEncoderArgs -Crf $Crf -PreserveAlpha:$PreserveAlpha
        if ($PreserveAlpha) {
            $args += @('-metadata:s:v:0', 'alpha_mode=1')
        }
    }
    else {
        $args += Get-ApngEncoderArgs -ApngPlays $ApngPlays -PreserveAlpha:$PreserveAlpha
    }

    $args += $OutPath
    & $Ffmpeg @args
    if ($LASTEXITCODE -ne 0) {
        throw "ffmpeg failed (exit $LASTEXITCODE) for $OutPath"
    }
}

Write-Host ''
Write-Host '========================================'
Write-Host '  PNG sequence -> WebM / APNG'
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
    Write-Host '[info] Add numbered .png frames and run again.'
    exit 0
}

$pngFiles = @(Get-ChildItem -LiteralPath $InputDir -Filter '*.png' -File |
    Sort-Object { Get-PngSequenceSortKey $_ }, Name)

if ($pngFiles.Count -eq 0) {
    Write-Host "[info] No PNG files in: $InputDir" -ForegroundColor Yellow
    exit 0
}

$dimStats = Get-PngSequenceDimensionStats -PngFiles $pngFiles
if ($dimStats) {
    Write-Host ('Source size: min {0}x{1}, max {2}x{3}' -f `
        $dimStats.MinWidth, $dimStats.MinHeight, $dimStats.MaxWidth, $dimStats.MaxHeight) -ForegroundColor DarkGray
}

if ($useInteractive) {
    $folderName = (Get-Item -LiteralPath $InputDir).Name
    $defaults = Read-InteractivePngSequenceSettings -PngFiles $pngFiles `
        -DefaultOutputName $folderName -DefaultFormat $Format -DefaultFps $Fps `
        -DimensionStats $dimStats
    $CropSize = $defaults.CropSize
    $CropWidth = $defaults.CropWidth
    $CropHeight = $defaults.CropHeight
    $CropAnchor = $defaults.CropAnchor
    $CropX = $defaults.CropX
    $CropY = $defaults.CropY
    $CropOffsetX = $defaults.CropOffsetX
    $CropOffsetY = $defaults.CropOffsetY
    $CropSizeMode = $defaults.CropSizeMode
    if ($defaults.CropNormalizeCanvas) {
        $CropNormalizeCanvas = $true
    }
    $Format = $defaults.Format
    $Fps = $defaults.Fps
    $OutputName = $defaults.OutputName
    if ($defaults.Force) {
        $Force = $true
    }
}

if ($PreserveAlpha -and $ffmpeg) {
    $samplePix = & ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt `
        -of csv=p=0 $pngFiles[0].FullName 2>$null
    if ($samplePix -and $samplePix -notmatch 'rgba|pal8|yuva|gbrap') {
        Write-Host "[warn] First PNG pix_fmt=$samplePix (no alpha). Output may be opaque." -ForegroundColor Yellow
    }
}

if ($Fps -le 0) {
    Write-Host '[error] Fps must be greater than 0.' -ForegroundColor Red
    exit 1
}

$cropNormalizeCanvas = $false
$prepareCanvasW = 0
$prepareCanvasH = 0
$prepareCropOutW = 0
$prepareCropOutH = 0
$effectiveCropSizeMode = $CropSizeMode
$autoNormalizeMixed = $false

$cropInfo = $null
try {
    $willCrop = (Test-CropParametersSpecified -CropSize $CropSize -CropWidth $CropWidth `
        -CropHeight $CropHeight -CropFilter $CropFilter -CropAnchor $CropAnchor `
        -CropX $CropX -CropY $CropY -CropOffsetX $CropOffsetX -CropOffsetY $CropOffsetY)

    if ($willCrop -and -not $CropFilter -and -not $NoCropNormalizeCanvas -and $dimStats) {
        $autoNormalizeMixed = ($dimStats.MinWidth -ne $dimStats.MaxWidth) `
            -or ($dimStats.MinHeight -ne $dimStats.MaxHeight)
        if ($CropNormalizeCanvas -or $autoNormalizeMixed) {
            $cropNormalizeCanvas = $true
            $prepareCanvasW = $dimStats.MaxWidth
            $prepareCanvasH = $dimStats.MaxHeight
            $effectiveCropSizeMode = 'fixed'
        }
    }

    $cropInfo = Resolve-CropVideoFilter -CropFilter $CropFilter -CropSize $CropSize `
        -CropWidth $CropWidth -CropHeight $CropHeight -CropAnchor $CropAnchor `
        -CropX $CropX -CropY $CropY -CropOffsetX $CropOffsetX -CropOffsetY $CropOffsetY `
        -CropSizeMode $effectiveCropSizeMode
}
catch {
    Write-Host "[error] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
$cropFilter = if ($cropInfo) { $cropInfo.Filter } else { $null }

if ($cropInfo -and -not $cropInfo.IsRaw) {
    $prepareCropOutW = $cropInfo.Width
    $prepareCropOutH = $cropInfo.Height
    if ($cropNormalizeCanvas) {
        $normReason = if ($autoNormalizeMixed) {
            'auto (mixed frame sizes — prevents shake)'
        }
        else {
            'enabled'
        }
        Write-Host ('[info] Canvas normalize ({2}): pad each frame to {0}x{1}, then crop.' -f `
            $prepareCanvasW, $prepareCanvasH, $normReason) -ForegroundColor DarkGray
    }
    elseif ($dimStats) {
        $reqW = $cropInfo.Width
        $reqH = $cropInfo.Height
        $undersized = ($reqW -gt $dimStats.MinWidth) -or ($reqH -gt $dimStats.MinHeight)
        if ($undersized) {
            if ($cropInfo.SizeMode -eq 'clamp') {
                Write-Host ('[info] Some frames are smaller than {0}x{1}; crop clamps per frame; output is center-padded to {0}x{1}.' -f $reqW, $reqH) -ForegroundColor Yellow
            }
            else {
                Write-Host ('[warn] Some frames are smaller than {0}x{1}; fixed crop may fail on those frames.' -f $reqW, $reqH) -ForegroundColor Yellow
            }
            Write-Host ('       Smallest frame: {0}x{1}. Mixed sizes auto-normalize unless -NoCropNormalizeCanvas.' -f `
                $dimStats.MinWidth, $dimStats.MinHeight) -ForegroundColor Yellow
        }
    }
}

$inputFolder = Get-Item -LiteralPath $InputDir
if (-not $OutputName) {
    $OutputName = $inputFolder.Name
}

$destDir = if ($InPlace) { $inputFolder.FullName } else { $OutputDir }
$sourceTime = Get-NewestPngTime -PngFiles $pngFiles
$durationSec = [math]::Round($pngFiles.Count / $Fps, 3)

$wantWebm = $Format -eq 'webm' -or $Format -eq 'both'
$wantApng = $Format -eq 'apng' -or $Format -eq 'both'

$webmPath = Join-Path $destDir "$OutputName.webm"
$apngPath = Join-Path $destDir "$OutputName.apng"

$skipWebm = $wantWebm -and (Should-SkipOutput -OutPath $webmPath -SourceTime $sourceTime -Force:$Force)
$skipApng = $wantApng -and (Should-SkipOutput -OutPath $apngPath -SourceTime $sourceTime -Force:$Force)

if ($skipWebm -and (-not $wantApng -or $skipApng)) {
    Write-Host "[skip] Outputs are up to date (use -Force to re-encode)" -ForegroundColor DarkYellow
    if ($wantWebm) { Write-Host "  $webmPath" }
    if ($wantApng) { Write-Host "  $apngPath" }
    exit 0
}

Write-Host "Input:      $InputDir"
Write-Host "Output dir: $destDir"
Write-Host "Base name:  $OutputName"
Write-Host "Frames:     $($pngFiles.Count)"
Write-Host "FPS:        $Fps (~${durationSec}s)"
Write-Host "Format:     $Format"
if ($cropFilter) {
    if ($cropInfo.IsRaw) {
        Write-Host "Crop:       (raw) $cropFilter"
    }
    else {
        $off = ''
        if ($cropInfo.OffsetX -ne 0 -or $cropInfo.OffsetY -ne 0) {
            $off = " offset=($($cropInfo.OffsetX),$($cropInfo.OffsetY))"
        }
        $pos = if ($cropInfo.Anchor -eq 'custom') { "pos=($CropX,$CropY)" } else { "anchor=$($cropInfo.Anchor)" }
        $modeLabel = if ($cropNormalizeCanvas) {
            'fixed px (after canvas normalize)'
        }
        elseif ($cropInfo.SizeMode -eq 'fixed') {
            'fixed px'
        }
        else {
            'clamp to source'
        }
        Write-Host "Crop:       $($cropInfo.Width)x$($cropInfo.Height) $pos$off ($modeLabel)"
        Write-Host "            -> $cropFilter"
    }
}
Write-AlphaModeLine -PreserveAlpha:$PreserveAlpha -CleanAlphaRgb:$CleanAlphaRgb
if ($cropFilter) {
    Write-Host 'Pipeline:   crop to PNG (rgba) -> encode (2-pass)' -ForegroundColor DarkGray
}
Write-Host "ffmpeg:     $ffmpeg"
Write-Host ''

if (-not (Test-Path -LiteralPath $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("obs-overlay-png-seq-$([Guid]::NewGuid().ToString('N'))")
$stagingDir = Join-Path $tempDir 'staging'
$preparedDir = Join-Path $tempDir 'prepared'
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

try {
    $i = 0
    foreach ($png in $pngFiles) {
        $i++
        $destFrame = Join-Path $stagingDir ("frame_{0:D4}.png" -f $i)
        Copy-Item -LiteralPath $png.FullName -Destination $destFrame
    }
    Write-Host "[staging] $i frames" -ForegroundColor DarkGray

    $encodeInputDir = $stagingDir
    if ($cropFilter) {
        Write-Host '[prepare] crop -> rgba PNG sequence' -ForegroundColor DarkGray
        Invoke-PrepareCroppedPngSequence -Ffmpeg $ffmpeg -StagingDir $stagingDir `
            -PreparedDir $preparedDir -FrameCount $i -Fps $Fps -CropFilter $cropFilter `
            -PreserveAlpha:$PreserveAlpha -CleanAlphaRgb:$CleanAlphaRgb `
            -CanvasWidth $prepareCanvasW -CanvasHeight $prepareCanvasH `
            -CropOutWidth $prepareCropOutW -CropOutHeight $prepareCropOutH
        $encodeInputDir = $preparedDir
    }
    elseif ($PreserveAlpha -and $CleanAlphaRgb) {
        Write-Host '[prepare] clean transparent RGB -> PNG sequence' -ForegroundColor DarkGray
        $vf = "format=rgba,$(Get-StraightAlphaRgbFilter)"
        if (-not (Test-Path -LiteralPath $preparedDir)) {
            New-Item -ItemType Directory -Path $preparedDir -Force | Out-Null
        }
        & $ffmpeg -hide_banner -loglevel warning -stats -y -framerate $Fps `
            -i (Join-Path $stagingDir 'frame_%04d.png') -vf $vf -frames:v $i `
            -map_metadata -1 -c:v png -pix_fmt rgba (Join-Path $preparedDir 'frame_%04d.png')
        if ($LASTEXITCODE -ne 0) {
            throw "ffmpeg alpha clean failed (exit $LASTEXITCODE)"
        }
        $encodeInputDir = $preparedDir
    }

    if ($wantWebm) {
        if ($skipWebm) {
            Write-Host "[skip] $webmPath" -ForegroundColor DarkYellow
        }
        else {
            Write-Host "[convert] WebM -> $webmPath" -ForegroundColor Cyan
            Invoke-PngSequenceEncode -Ffmpeg $ffmpeg -InputDir $encodeInputDir -FrameCount $i `
                -Fps $Fps -OutPath $webmPath -Kind webm -Crf $Crf -ApngPlays $ApngPlays `
                -PreserveAlpha:$PreserveAlpha -CleanAlphaRgb:$CleanAlphaRgb
            $mb = [math]::Round((Get-Item -LiteralPath $webmPath).Length / 1MB, 2)
            Write-Host "[done] $($OutputName).webm (${mb} MB)" -ForegroundColor Green
        }
    }

    if ($wantApng) {
        if ($skipApng) {
            Write-Host "[skip] $apngPath" -ForegroundColor DarkYellow
        }
        else {
            Write-Host "[convert] APNG -> $apngPath" -ForegroundColor Cyan
            if ($PreserveAlpha) {
                Invoke-ApngSequenceEncode -Ffmpeg $ffmpeg -InputDir $encodeInputDir -FrameCount $i `
                    -Fps $Fps -OutPath $apngPath -ApngPlays $ApngPlays -PreserveAlpha:$PreserveAlpha
            }
            else {
                Invoke-PngSequenceEncode -Ffmpeg $ffmpeg -InputDir $encodeInputDir -FrameCount $i `
                    -Fps $Fps -OutPath $apngPath -Kind apng -Crf $Crf -ApngPlays $ApngPlays `
                    -PreserveAlpha:$PreserveAlpha -CleanAlphaRgb:$CleanAlphaRgb
            }
            $mb = [math]::Round((Get-Item -LiteralPath $apngPath).Length / 1MB, 2)
            Write-Host "[done] $($OutputName).apng (${mb} MB)" -ForegroundColor Green
        }
    }
}
finally {
    if (Test-Path -LiteralPath $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ''
Write-Host '----------------------------------------'
Write-Host 'Finished.'
Write-Host '----------------------------------------'
exit 0
