#Requires -Version 5.1
# Shared ffmpeg helpers for transparent WebM / APNG batch conversion.

function Resolve-FfmpegPath {
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
        [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }
    return $null
}

# 透過ピクセルの RGB を 0 にする（alpha=0 なのに白残り → 不透過に見える問題の対策）
function Get-StraightAlphaRgbFilter {
    return "geq=r='if(lte(alpha(X,Y)\,0)\,0\,r(X,Y))':g='if(lte(alpha(X,Y)\,0)\,0\,g(X,Y))':b='if(lte(alpha(X,Y)\,0)\,0\,b(X,Y))':a='alpha(X,Y)'"
}

function Get-TransparentPadFilter {
    param(
        [int] $Width,
        [int] $Height
    )

    if ($Width -le 0 -or $Height -le 0) {
        return $null
    }
    return "pad=${Width}:${Height}:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
}

function Get-PrepareCropVideoFilter {
    param(
        [string] $CropFilter,
        [bool] $PreserveAlpha,
        [bool] $CleanAlphaRgb,
        [int] $CanvasWidth = 0,
        [int] $CanvasHeight = 0,
        [int] $CropOutWidth = 0,
        [int] $CropOutHeight = 0
    )

    if (-not $CropFilter) {
        return $null
    }

    $parts = @()
    if ($PreserveAlpha) {
        $parts += 'format=rgba'
    }

    $normalizePad = Get-TransparentPadFilter -Width $CanvasWidth -Height $CanvasHeight
    if ($normalizePad) {
        $parts += $normalizePad
    }

    $parts += $CropFilter

    $outputPad = Get-TransparentPadFilter -Width $CropOutWidth -Height $CropOutHeight
    if ($outputPad) {
        $parts += $outputPad
    }

    if ($PreserveAlpha -and $CleanAlphaRgb) {
        $parts += (Get-StraightAlphaRgbFilter)
    }
    return ($parts -join ',')
}

function Get-EncodeVideoFilter {
    param(
        [ValidateSet('webm', 'apng')]
        [string] $Kind,
        [bool] $PreserveAlpha,
        [bool] $FromPreparedPng = $true
    )

    if (-not $PreserveAlpha) {
        return $null
    }
    if ($Kind -eq 'webm') {
        # 中間 PNG (rgba) → VP9: straight alpha を premultiply してから yuva420p
        return 'format=rgba,premultiply=inplace=1,format=yuva420p'
    }
    if (-not $FromPreparedPng) {
        return 'format=rgba'
    }
    return $null
}

# GIF 一括変換など、1 パスでエンコードするとき用
function Get-AlphaAwareVideoFilter {
    param(
        [string] $BaseFilter,
        [ValidateSet('webm', 'apng')]
        [string] $Kind,
        [bool] $PreserveAlpha,
        [bool] $CleanAlphaRgb = $true
    )

    if (-not $PreserveAlpha) {
        return $BaseFilter
    }

    if ($BaseFilter -and $BaseFilter -match '(^|,)format=') {
        return $BaseFilter
    }

    $parts = @('format=rgba')
    if ($BaseFilter) {
        $parts += $BaseFilter
    }
    if ($CleanAlphaRgb) {
        $parts += (Get-StraightAlphaRgbFilter)
    }
    $encodeFmt = if ($Kind -eq 'webm') { 'format=yuva420p' } else { 'format=rgba' }
    $parts += $encodeFmt
    return ($parts -join ',')
}

function Get-Vp9WebmEncoderArgs {
    param(
        [int] $Crf,
        [bool] $PreserveAlpha
    )

    $args = @(
        '-c:v', 'libvpx-vp9',
        '-crf', "$Crf",
        '-b:v', '0',
        '-an'
    )
    if ($PreserveAlpha) {
        $args += @('-pix_fmt', 'yuva420p', '-auto-alt-ref', '0')
    }
    else {
        $args += @('-pix_fmt', 'yuv420p')
    }
    return $args
}

function Get-ApngEncoderArgs {
    param(
        [int] $ApngPlays,
        [bool] $PreserveAlpha
    )

    $args = @('-c:v', 'apng', '-plays', "$ApngPlays", '-f', 'apng')
    if ($PreserveAlpha) {
        # none: フレーム間予測を抑え、透過のにじみを減らす
        $args += @('-pix_fmt', 'rgba', '-pred', 'none')
    }
    return $args
}

function Invoke-StripPngIccProfiles {
    param([string] $PngDir)

    if (-not (Test-Path -LiteralPath $PngDir)) {
        return
    }

    $magick = Get-Command magick -ErrorAction SilentlyContinue
    if ($magick) {
        Write-Host '            strip ICC (ImageMagick)' -ForegroundColor DarkGray
        & $magick.Source mogrify -strip (Join-Path $PngDir '*.png')
        if ($LASTEXITCODE -ne 0) {
            throw "ImageMagick mogrify failed (exit $LASTEXITCODE)"
        }
        return
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Write-Host '[warn] Cannot strip ICC (install Python+Pillow or ImageMagick). APNG may look opaque.' -ForegroundColor Yellow
        return
    }

    $stripScript = Join-Path $PSScriptRoot 'strip_png_icc.py'
    Write-Host '            strip ICC (Pillow)' -ForegroundColor DarkGray
    & $python.Source $stripScript $PngDir
    if ($LASTEXITCODE -ne 0) {
        throw "strip_png_icc.py failed (exit $LASTEXITCODE)"
    }
}

function Invoke-ApngSequenceEncode {
    param(
        [string] $Ffmpeg,
        [string] $InputDir,
        [int] $FrameCount,
        [double] $Fps,
        [string] $OutPath,
        [int] $ApngPlays,
        [bool] $PreserveAlpha
    )

    if ($PreserveAlpha) {
        Invoke-StripPngIccProfiles -PngDir $InputDir
    }

    $videoFilter = Get-EncodeVideoFilter -Kind apng -PreserveAlpha:$PreserveAlpha -FromPreparedPng:$true
    if ($videoFilter) {
        Write-Host "            encode vf: $videoFilter" -ForegroundColor DarkGray
    }

    $args = @(
        '-hide_banner', '-loglevel', 'warning', '-stats',
        '-y',
        '-framerate', "$Fps",
        '-i', (Join-Path $InputDir 'frame_%04d.png'),
        '-frames:v', "$FrameCount"
    )
    if ($videoFilter) {
        $args += @('-vf', $videoFilter)
    }
    $args += Get-ApngEncoderArgs -ApngPlays $ApngPlays -PreserveAlpha:$PreserveAlpha
    $args += $OutPath

    & $Ffmpeg @args
    if ($LASTEXITCODE -ne 0) {
        throw "ffmpeg APNG encode failed (exit $LASTEXITCODE) for $OutPath"
    }
}

function Write-AlphaModeLine {
    param(
        [bool] $PreserveAlpha,
        [bool] $CleanAlphaRgb
    )
    if ($PreserveAlpha) {
        $clean = if ($CleanAlphaRgb) { ', zero RGB under alpha=0' } else { '' }
        Write-Host "Alpha:      preserve (WebM=VP9+yuva420p, APNG=rgba+ICC strip$clean)" -ForegroundColor DarkGray
    }
    else {
        Write-Host 'Alpha:      disabled (-NoAlpha)' -ForegroundColor DarkGray
    }
}

function Invoke-PrepareCroppedPngSequence {
    param(
        [string] $Ffmpeg,
        [string] $StagingDir,
        [string] $PreparedDir,
        [int] $FrameCount,
        [double] $Fps,
        [string] $CropFilter,
        [bool] $PreserveAlpha,
        [bool] $CleanAlphaRgb,
        [int] $CanvasWidth = 0,
        [int] $CanvasHeight = 0,
        [int] $CropOutWidth = 0,
        [int] $CropOutHeight = 0
    )

    $vf = Get-PrepareCropVideoFilter -CropFilter $CropFilter -PreserveAlpha:$PreserveAlpha `
        -CleanAlphaRgb:$CleanAlphaRgb -CanvasWidth $CanvasWidth -CanvasHeight $CanvasHeight `
        -CropOutWidth $CropOutWidth -CropOutHeight $CropOutHeight
    if (-not $vf) {
        throw 'CropFilter is required for Invoke-PrepareCroppedPngSequence'
    }

    Write-Host "            prepare vf: $vf" -ForegroundColor DarkGray

    if (-not (Test-Path -LiteralPath $PreparedDir)) {
        New-Item -ItemType Directory -Path $PreparedDir -Force | Out-Null
    }

    $args = @(
        '-hide_banner', '-loglevel', 'warning', '-stats',
        '-y',
        '-framerate', "$Fps",
        '-i', (Join-Path $StagingDir 'frame_%04d.png'),
        '-vf', $vf,
        '-frames:v', "$FrameCount",
        '-map_metadata', '-1',
        '-c:v', 'png',
        '-pix_fmt', 'rgba',
        (Join-Path $PreparedDir 'frame_%04d.png')
    )

    & $Ffmpeg @args
    if ($LASTEXITCODE -ne 0) {
        throw "ffmpeg prepare/crop failed (exit $LASTEXITCODE)"
    }
}
