#Requires -Version 5.1

function Test-CropParametersSpecified {
    param(
        [int] $CropSize,
        [int] $CropWidth,
        [int] $CropHeight,
        [string] $CropFilter,
        [string] $CropAnchor,
        [int] $CropX,
        [int] $CropY,
        [int] $CropOffsetX,
        [int] $CropOffsetY
    )

    if ($CropFilter) { return $true }
    if ($CropSize -gt 0) { return $true }
    if ($CropWidth -gt 0 -or $CropHeight -gt 0) { return $true }
    if ($CropOffsetX -ne 0 -or $CropOffsetY -ne 0) { return $true }
    if ($CropAnchor -eq 'custom' -and ($CropX -ne 0 -or $CropY -ne 0)) { return $true }
    return $false
}

function Read-IntWithDefault {
    param(
        [string] $Prompt,
        [int] $Default,
        [int] $Min = 1,
        [int] $Max = 10000
    )

    while ($true) {
        $raw = Read-Host "$Prompt [$Default]"
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $Default
        }
        if ($raw -match '^\d+$') {
            $value = [int]$raw
            if ($value -ge $Min -and $value -le $Max) {
                return $value
            }
        }
        Write-Host "  Enter an integer from $Min to $Max." -ForegroundColor Yellow
    }
}

function Read-OptionalInt {
    param(
        [string] $Prompt,
        [int] $Default = 0,
        [int] $Min = -10000,
        [int] $Max = 10000
    )

    while ($true) {
        $label = if ($Default -ne 0) { "$Prompt [$Default]" } else { "$Prompt [0]" }
        $raw = Read-Host $label
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $Default
        }
        if ($raw -match '^-?\d+$') {
            $value = [int]$raw
            if ($value -ge $Min -and $value -le $Max) {
                return $value
            }
        }
        Write-Host "  Enter an integer from $Min to $Max." -ForegroundColor Yellow
    }
}

function Read-InteractivePngSequenceSettings {
    param(
        [System.IO.FileInfo[]] $PngFiles,
        [string] $DefaultOutputName,
        [string] $DefaultFormat,
        [double] $DefaultFps,
        [hashtable] $DimensionStats
    )

    Write-Host ''
    Write-Host '----------------------------------------'
    Write-Host '  Interactive mode (crop / output)'
    Write-Host '----------------------------------------'
    Write-Host ''

    $probeW = 0
    $probeH = 0
    $minW = 0
    $minH = 0
    if ($DimensionStats) {
        $probeW = $DimensionStats.MaxWidth
        $probeH = $DimensionStats.MaxHeight
        $minW = $DimensionStats.MinWidth
        $minH = $DimensionStats.MinHeight
        if ($minW -eq $probeW -and $minH -eq $probeH) {
            Write-Host ('Source size: {0} x {1} (all frames)' -f $probeW, $probeH)
        }
        else {
            Write-Host ('Source size: min {0}x{1}, max {2}x{3}' -f $minW, $minH, $probeW, $probeH)
        }
        Write-Host ''
    }
    elseif ($PngFiles.Count -gt 0) {
        $dim = & ffprobe -v error -select_streams v:0 `
            -show_entries stream=width,height -of csv=p=0:s=x `
            $PngFiles[0].FullName 2>$null
        if ($dim -match '^(\d+)x(\d+)$') {
            $probeW = [int]$Matches[1]
            $probeH = [int]$Matches[2]
            $minW = $probeW
            $minH = $probeH
            Write-Host ('Source size: {0} x {1} (first frame)' -f $probeW, $probeH)
            Write-Host ''
        }
    }

    $doCrop = $true
    $cropAnswer = Read-Host 'Crop the image? (Y/n) [Y]'
    if ($cropAnswer -in @('n', 'no', 'N', 'No', 'NO')) {
        $doCrop = $false
    }

    $cropSize = 0
    $cropWidth = 0
    $cropHeight = 0
    $cropAnchor = 'topCenter'
    $cropX = 0
    $cropY = 0
    $cropOffsetX = 0
    $cropOffsetY = 0
    $cropSizeMode = 'clamp'
    $cropNormalizeCanvas = $false

    if ($doCrop) {
        Write-Host ''
        Write-Host '--- Crop size ---'
        $cropWidth = Read-IntWithDefault -Prompt 'Width (px)' -Default 720 -Min 1 -Max 10000

        $heightRaw = Read-Host "Height (px) [same as width = $cropWidth]"
        if ([string]::IsNullOrWhiteSpace($heightRaw)) {
            $cropHeight = $cropWidth
        }
        else {
            while ($heightRaw -notmatch '^\d+$' -or [int]$heightRaw -lt 1) {
                Write-Host '  Enter an integer >= 1.' -ForegroundColor Yellow
                $heightRaw = Read-Host "Height (px) [same as width = $cropWidth]"
            }
            $cropHeight = [int]$heightRaw
        }

        if ($cropWidth -eq $cropHeight) {
            $cropSize = $cropWidth
        }

        $refW = if ($minW -gt 0) { $minW } else { $probeW }
        $refH = if ($minH -gt 0) { $minH } else { $probeH }
        if ($refW -gt 0 -and $cropWidth -gt $refW) {
            Write-Host ('[warn] Width {0} exceeds smallest frame width {1}.' -f $cropWidth, $refW) -ForegroundColor Yellow
        }
        if ($refH -gt 0 -and $cropHeight -gt $refH) {
            Write-Host ('[warn] Height {0} exceeds smallest frame height {1}.' -f $cropHeight, $refH) -ForegroundColor Yellow
        }

        Write-Host ''
        Write-Host '--- Crop vs source size ---'
        Write-Host '  1  Reference source size (clamp) [default]'
        Write-Host '     If crop is 720px but a frame is 698px wide, use 698px for that frame.'
        Write-Host '  2  Fixed pixels (exact size)'
        Write-Host '     Always crop the requested size; fails if any frame is too small.'
        Write-Host ''
        while ($true) {
            $modePick = Read-Host 'Choose number [1]'
            if ([string]::IsNullOrWhiteSpace($modePick)) { $modePick = '1' }
            if ($modePick -eq '1') {
                $cropSizeMode = 'clamp'
                break
            }
            if ($modePick -eq '2') {
                $cropSizeMode = 'fixed'
                if ($refW -gt 0 -and ($cropWidth -gt $refW -or $cropHeight -gt $refH)) {
                    Write-Host '[warn] Fixed mode with oversized crop may fail on the smallest frames.' -ForegroundColor Yellow
                }
                break
            }
            Write-Host '  Enter 1 or 2.' -ForegroundColor Yellow
        }

        $hasMixedSizes = ($minW -gt 0) -and ($probeW -gt 0) -and (($minW -ne $probeW) -or ($minH -ne $probeH))
        if ($hasMixedSizes) {
            Write-Host ''
            Write-Host '--- Frame size alignment (optional) ---'
            Write-Host '  PNG sizes differ across frames. With clamp (default), the crop region may'
            Write-Host '  shift slightly; padding to max canvas before crop can reduce shake.'
            Write-Host ''
            Write-Host '  Default batch run auto-enables this when sizes differ.'
            $normAnswer = Read-Host 'Pad to max canvas before crop? (Y/n) [Y]'
            if ($normAnswer -notin @('n', 'no', 'N', 'No', 'NO')) {
                $cropNormalizeCanvas = $true
            }
        }

        Write-Host ''
        Write-Host '--- Crop anchor ---'
        Write-Host '  1  topLeft'
        Write-Host '  2  topCenter (recommended)'
        Write-Host '  3  topRight'
        Write-Host '  4  centerLeft'
        Write-Host '  5  center'
        Write-Host '  6  centerRight'
        Write-Host '  7  bottomLeft'
        Write-Host '  8  bottomCenter'
        Write-Host '  9  bottomRight'
        Write-Host ' 10  custom (top-left X,Y)'
        Write-Host ''

        $anchorMap = @{
            '1' = 'topLeft'; '2' = 'topCenter'; '3' = 'topRight'
            '4' = 'centerLeft'; '5' = 'center'; '6' = 'centerRight'
            '7' = 'bottomLeft'; '8' = 'bottomCenter'; '9' = 'bottomRight'
            '10' = 'custom'
        }

        while ($true) {
            $pick = Read-Host 'Choose number [2]'
            if ([string]::IsNullOrWhiteSpace($pick)) { $pick = '2' }
            if ($anchorMap.ContainsKey($pick)) {
                $cropAnchor = $anchorMap[$pick]
                break
            }
            Write-Host '  Enter 1-10.' -ForegroundColor Yellow
        }

        if ($cropAnchor -eq 'custom') {
            Write-Host ''
            Write-Host 'Top-left position (px):'
            $maxX = if ($probeW -gt 0) { [Math]::Max(0, $probeW - $cropWidth) } else { 10000 }
            $maxY = if ($probeH -gt 0) { [Math]::Max(0, $probeH - $cropHeight) } else { 10000 }
            $cropX = Read-IntWithDefault -Prompt 'X (left)' -Default 0 -Min 0 -Max $maxX
            $cropY = Read-IntWithDefault -Prompt 'Y (top)' -Default 0 -Min 0 -Max $maxY
        }

        Write-Host ''
        Write-Host '--- Fine tune (optional) ---'
        $cropOffsetX = Read-OptionalInt -Prompt 'Offset X (px)' -Default 0
        $cropOffsetY = Read-OptionalInt -Prompt 'Offset Y (px)' -Default 0
    }

    Write-Host ''
    Write-Host '--- Output format ---'
    Write-Host '  Use transparent WebM in OBS overlay settings.'
    Write-Host '  1  WebM only (recommended)'
    Write-Host '  2  APNG only'
    Write-Host '  3  Both'
    Write-Host ''
    $formatPick = Read-Host 'Choose number [3]'
    $format = switch ($formatPick) {
        '1' { 'webm' }
        '2' { 'apng' }
        default { 'both' }
    }

    Write-Host ''
    $fpsRaw = Read-Host "FPS [$DefaultFps]"
    $fps = $DefaultFps
    if (-not [string]::IsNullOrWhiteSpace($fpsRaw)) {
        if ($fpsRaw -match '^\d+(\.\d+)?$') {
            $fps = [double]$fpsRaw
        }
    }

    $suggestedName = $DefaultOutputName
    if ($doCrop -and $cropWidth -gt 0) {
        $suggestedName = "animation-$cropWidth"
        if ($cropHeight -ne $cropWidth) {
            $suggestedName = "animation-${cropWidth}x${cropHeight}"
        }
    }

    Write-Host ''
    $outputName = Read-Host "Output base name (no extension) [$suggestedName]"
    if ([string]::IsNullOrWhiteSpace($outputName)) {
        $outputName = $suggestedName
    }

    $forceAnswer = Read-Host 'Overwrite existing files? (y/N) [N]'
    $force = $forceAnswer -in @('y', 'yes', 'Y', 'Yes', 'YES')

    Write-Host ''
    Write-Host '--- Confirm ---'
    if ($doCrop) {
        $modeText = if ($cropSizeMode -eq 'fixed') { 'fixed px' } else { 'reference source (clamp)' }
        if ($cropNormalizeCanvas) {
            $modeText += ' + max-canvas pad'
        }
        Write-Host ('Crop: {0}x{1}  anchor={2}  offset=({3},{4})  ({5})' -f `
            $cropWidth, $cropHeight, $cropAnchor, $cropOffsetX, $cropOffsetY, $modeText)
    }
    else {
        Write-Host 'Crop: none (full frame)'
    }
    Write-Host "Format: $format / FPS: $fps / Name: $outputName"
    Write-Host 'Alpha: on (WebM=VP9, APNG=rgba)'
    Write-Host ''

    $confirm = Read-Host 'Start conversion? (Y/n) [Y]'
    if ($confirm -in @('n', 'no', 'N', 'No', 'NO')) {
        Write-Host '[cancelled]' -ForegroundColor Yellow
        exit 0
    }

    return @{
        CropSize = $cropSize
        CropWidth = $cropWidth
        CropHeight = $cropHeight
        CropAnchor = $cropAnchor
        CropX = $cropX
        CropY = $cropY
        CropOffsetX = $cropOffsetX
        CropOffsetY = $cropOffsetY
        CropSizeMode = $cropSizeMode
        CropNormalizeCanvas = $cropNormalizeCanvas
        Format = $format
        Fps = $fps
        OutputName = $outputName
        Force = $force
    }
}
