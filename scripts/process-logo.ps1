Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\Admin\.gemini\antigravity\brain\2abec1c0-0d5a-4776-a4f1-32b1f141a5aa\.user_uploaded\media_1787995404714.jpg"
$currentDir = Get-Location
$outDir = Join-Path $currentDir "apps\web\public\brand"

Write-Host "Output Directory: $outDir"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Copy-Item -Path $srcPath -Destination (Join-Path $outDir "pgs-agency-logo-original.jpg") -Force

$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = $bmp.Width
$height = $bmp.Height

$minX = $width
$maxX = 0
$minY = $height
$maxY = 0

for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # Non-white check
        if ($c.R -lt 245 -or $c.G -lt 245 -or $c.B -lt 245) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

# Add small padding (12px)
$padding = 12
$minX = [Math]::Max(0, $minX - $padding)
$minY = [Math]::Max(0, $minY - $padding)
$maxX = [Math]::Min($width - 1, $maxX + $padding)
$maxY = [Math]::Min($height - 1, $maxY + $padding)

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1

Write-Host "Bounding box: minX=$minX, maxX=$maxX, minY=$minY, maxY=$maxY ($cropW x $cropH)"

$cropRect = [System.Drawing.Rectangle]::new($minX, $minY, $cropW, $cropH)
$croppedBmp = $bmp.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$croppedBmp.Save((Join-Path $outDir "pgs-agency-logo.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# 2. Transparent background version (clean cutout for dark or light backgrounds)
$transBmp = [System.Drawing.Bitmap]::new($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $cropH; $y++) {
    for ($x = 0; $x -lt $cropW; $x++) {
        $c = $croppedBmp.GetPixel($x, $y)
        $brightness = ($c.R + $c.G + $c.B) / 3.0
        if ($brightness -gt 250) {
            $transBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($brightness -gt 230) {
            $alpha = [Math]::Max(0, [Math]::Min(255, [int](255 * (250 - $brightness) / 20.0)))
            $transBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
        } else {
            $transBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}
$transBmp.Save((Join-Path $outDir "pgs-agency-logo-transparent.png"), [System.Drawing.Imaging.ImageFormat]::Png)

# 3. Create a compact mark version (focused on PGS + Arrow)
$markMinY = [int]($minY + $cropH * 0.15)
$markCropH = [int]($cropH * 0.85)
$markRect = [System.Drawing.Rectangle]::new($minX, $markMinY, $cropW, $markCropH)
$markBmp = $bmp.Clone($markRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$markTransBmp = [System.Drawing.Bitmap]::new($cropW, $markCropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $markCropH; $y++) {
    for ($x = 0; $x -lt $cropW; $x++) {
        $c = $markBmp.GetPixel($x, $y)
        $brightness = ($c.R + $c.G + $c.B) / 3.0
        if ($brightness -gt 250) {
            $markTransBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($brightness -gt 230) {
            $alpha = [Math]::Max(0, [Math]::Min(255, [int](255 * (250 - $brightness) / 20.0)))
            $markTransBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B))
        } else {
            $markTransBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $c.R, $c.G, $c.B))
        }
    }
}
$markTransBmp.Save((Join-Path $outDir "pgs-agency-logo-mark.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$bmp.Dispose()
$croppedBmp.Dispose()
$transBmp.Dispose()
$markBmp.Dispose()
$markTransBmp.Dispose()

Write-Host "Logo processing successfully finished!"
