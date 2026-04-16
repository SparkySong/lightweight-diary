Add-Type -AssemblyName System.Drawing
$path = "c:\Users\-\Desktop\weight-tracker-miniprogram\miniprogram\images"
$files = @("tab-weight.png", "tab-weight-active.png")
foreach($f in $files) {
    $bmp = [System.Drawing.Bitmap]::FromFile("$path\$f")
    $c = $bmp.GetPixel(100, 100)
    Write-Host "$f - R=$($c.R) G=$($c.G) B=$($c.B)"
    $bmp.Dispose()
}
