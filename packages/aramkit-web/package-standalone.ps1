param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$outputRoot = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $outputRoot) { throw '目标目录已存在。请选择新目录，避免覆盖现有文件。' }
$runtimeFile = Join-Path $PSScriptRoot 'runtime\node.exe'
if (-not (Test-Path -LiteralPath $runtimeFile)) { throw '缺少独立 Node 运行程序。' }
$files = @(
  'LICENSE', '海斗助手.vbs',
  'packages\aramkit-web\package.json', 'packages\aramkit-web\server.js', 'packages\aramkit-web\launch.ps1',
  'packages\aramkit-web\ai-review.js', 'packages\aramkit-web\secret-store.js',
  'packages\aramkit-web\recent-postgame.js',
  'packages\aramkit-web\match-history.js',
  'packages\aramkit-web\public\index.html', 'packages\aramkit-web\public\app.js', 'packages\aramkit-web\public\style.css', 'packages\aramkit-web\public\icon.svg',
  'packages\aramkit-web\public\app.ico',
  'packages\aramkit-web\runtime\node.exe', 'packages\aramkit-web\runtime\NODE-LICENSE.txt',
  'packages\aramkit-core\package.json', 'packages\aramkit-core\service.js',
  'packages\aramkit-live\package.json', 'packages\aramkit-live\index.js', 'packages\aramkit-live\data.js', 'packages\aramkit-live\lcu.js'
)
foreach ($relativeFile in $files) {
  $sourceFile = Join-Path $repositoryRoot $relativeFile
  if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw "缺少文件：$relativeFile" }
}
foreach ($relativeFile in $files) {
  $targetFile = Join-Path $outputRoot $relativeFile
  [void](New-Item -ItemType Directory -Path (Split-Path $targetFile -Parent) -Force)
  Copy-Item -LiteralPath (Join-Path $repositoryRoot $relativeFile) -Destination $targetFile
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.md') -Destination (Join-Path $outputRoot '使用说明.md')
Write-Output "独立版已生成：$outputRoot"
Write-Output '不含 node_modules、MCP SDK 或 Codex 启动程序。双击海斗助手.vbs即可使用。'
