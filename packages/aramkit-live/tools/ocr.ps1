param(
  [Parameter(Mandatory = $true)][string]$Raw,
  [Parameter(Mandatory = $true)][int]$Width,
  [Parameter(Mandatory = $true)][int]$Height,
  [string]$Lang = 'zh-Hans-CN',
  [string]$Out = ''
)
# ASCII only on purpose: Windows PowerShell 5.1 reads BOM-less files as ANSI,
# and any CJK bytes here would corrupt the parser before it reaches line 30.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapPixelFormat, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$null = [Windows.Security.Cryptography.CryptographicBuffer, Windows.Security, ContentType = WindowsRuntime]

$asTaskGeneric = $null
foreach ($m in [System.WindowsRuntimeSystemExtensions].GetMethods()) {
  if ($m.Name -ne 'AsTask') { continue }
  $ps = $m.GetParameters()
  if ($ps.Count -eq 1 -and $ps[0].ParameterType.Name -eq 'IAsyncOperation`1') {
    $asTaskGeneric = $m
    break
  }
}
if ($null -eq $asTaskGeneric) { throw 'AsTask bridge not found' }

function Await($op, [Type]$resultType) {
  $task = $asTaskGeneric.MakeGenericMethod($resultType).Invoke($null, @($op))
  $task.Wait(30000) | Out-Null
  $task.Result
}

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $Raw).Path)
$expect = $Width * $Height * 4
if ($bytes.Length -ne $expect) {
  throw "raw size mismatch: $($bytes.Length), expected $expect (${Width}x${Height} BGRA)"
}

# WinRT GetFileFromPathAsync is refused for desktop processes ("not in an
# accessible location"), so feed the pixels through an IBuffer instead.
# CryptographicBuffer returns a bare __ComObject here and blows up overload
# resolution; WindowsRuntimeBufferExtensions.AsBuffer gives a real IBuffer.
$buffer = [System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions]::AsBuffer($bytes)
$bitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::CreateCopyFromBuffer(
  $buffer,
  [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
  $Width,
  $Height
)

$language = New-Object Windows.Globalization.Language($Lang)
if (-not [Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($language)) {
  throw "OCR language pack missing: $Lang"
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

$lines = @()
foreach ($line in $result.Lines) {
  $lines += [string]$line.Text
}
$json = [pscustomobject]@{
  width  = $Width
  height = $Height
  lines  = $lines
  text   = ($lines -join "`n")
} | ConvertTo-Json -Depth 5 -Compress
if ($Out) {
  [System.IO.File]::WriteAllText($Out, $json, (New-Object System.Text.UTF8Encoding($false)))
} else {
  $json
}

