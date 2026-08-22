Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded-rect background (indigo)
  $radius = [int]($size * 0.22)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $bgPath.AddArc($size - $d, 0, $d, $d, 270, 90)
  $bgPath.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $bgPath.AddArc(0, $size - $d, $d, $d, 90, 90)
  $bgPath.AddArc(0, 0, $d, $d, 180, 90)
  $bgPath.CloseFigure()

  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($size, $size)),
    [System.Drawing.Color]::FromArgb(255, 79, 70, 229),
    [System.Drawing.Color]::FromArgb(255, 124, 58, 237)
  )
  $g.FillPath($brush, $bgPath)

  # Draw a stylized "box" glyph: three stacked rounded bars
  $white = [System.Drawing.Brushes]::White
  $barH = [int]($size * 0.11)
  $barW = [int]($size * 0.5)
  $x = [int](($size - $barW) / 2)
  $y1 = [int]($size * 0.30)
  $y2 = $y1 + $barH + [int]($size * 0.06)
  $y3 = $y2 + $barH + [int]($size * 0.06)

  foreach ($y in @($y1, $y2)) {
    $r = [int]($barH / 2)
    $b = New-Object System.Drawing.Rectangle($x, $y, $barW, $barH)
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $dd = $r * 2
    $p.AddArc($b.X + $b.Width - $dd, $b.Y, $dd, $dd, 270, 90)
    $p.AddArc($b.X + $b.Width - $dd, $b.Y + $b.Height - $dd, $dd, $dd, 0, 90)
    $p.AddArc($b.X, $b.Y + $b.Height - $dd, $dd, $dd, 90, 90)
    $p.AddArc($b.X, $b.Y, $dd, $dd, 180, 90)
    $p.CloseFigure()
    $g.FillPath($white, $p)
  }

  # Bottom bar shorter (box lid effect)
  $shortW = [int]($barW * 0.6)
  $xs = [int](($size - $shortW) / 2)
  $r3 = [int]($barH / 2)
  $b3 = New-Object System.Drawing.Rectangle($xs, $y3, $shortW, $barH)
  $p3 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $dd3 = $r3 * 2
  $p3.AddArc($b3.X + $b3.Width - $dd3, $b3.Y, $dd3, $dd3, 270, 90)
  $p3.AddArc($b3.X + $b3.Width - $dd3, $b3.Y + $b3.Height - $dd3, $dd3, $dd3, 0, 90)
  $p3.AddArc($b3.X, $b3.Y + $b3.Height - $dd3, $dd3, $dd3, 90, 90)
  $p3.AddArc($b3.X, $b3.Y, $dd3, $dd3, 180, 90)
  $p3.CloseFigure()
  $g.FillPath($white, $p3)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Created $path"
}

$root = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force -Path $root | Out-Null
New-Icon -size 512 -path (Join-Path $root "icon-512.png")
New-Icon -size 192 -path (Join-Path $root "icon-192.png")
New-Icon -size 180 -path (Join-Path $root "apple-touch-icon.png")
Write-Host "Icons done."
