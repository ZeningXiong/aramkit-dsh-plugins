param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$webUrl = 'http://127.0.0.1:3210'
$nodeExecutable = Join-Path $PSScriptRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
  $availableNode = Get-Command node -ErrorAction SilentlyContinue
  if ($availableNode) { $nodeExecutable = $availableNode.Source }
  else { throw '未找到独立 Node 运行程序，请使用完整的海斗助手文件夹。' }
}
function Get-HelperHealth {
  try { return Invoke-RestMethod -Uri "$webUrl/api/health" -TimeoutSec 2 } catch { return $null }
}
$health = Get-HelperHealth
if ($health -and $health.app -ne 'aramkit-web') { throw '本机 3210 端口已被其他程序占用。' }
if (-not $health) {
  $logDirectory = Join-Path $PSScriptRoot '.local'
  [void](New-Item -ItemType Directory -Path $logDirectory -Force)
  $serverFile = Join-Path $PSScriptRoot 'server.js'
  Start-Process -FilePath $nodeExecutable -ArgumentList @(('"' + $serverFile + '"')) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'server.log') -RedirectStandardError (Join-Path $logDirectory 'error.log')
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 250
    $health = Get-HelperHealth
    if ($health.app -eq 'aramkit-web') { break }
  }
  if ($health.app -ne 'aramkit-web') { throw '海斗助手启动失败，请检查 packages\aramkit-web\.local\error.log。' }
}
if (-not $NoBrowser) { Start-Process $webUrl }
Write-Output "海斗助手已独立运行：$webUrl"
