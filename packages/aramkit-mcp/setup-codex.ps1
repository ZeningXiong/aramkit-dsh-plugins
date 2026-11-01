param(
  [string]$NodePath,
  [string]$CodexPath,
  [string]$Lockfile
)
$ErrorActionPreference = 'Stop'

if (-not $NodePath) { $NodePath = (Get-Command node -ErrorAction Stop).Source }
if (-not $CodexPath) { $CodexPath = (Get-Command codex -ErrorAction Stop).Source }
$NodePath = (Resolve-Path -LiteralPath $NodePath).Path
$CodexPath = (Resolve-Path -LiteralPath $CodexPath).Path
$serverPath = Join-Path $PSScriptRoot 'server.js'
$versionText = & $NodePath --version
if ($LASTEXITCODE -ne 0 -or [int]($versionText.TrimStart('v').Split('.')[0]) -lt 22) {
  throw '需要 Node.js 22 或更新版本。'
}
if ($Lockfile -and (-not (Test-Path -LiteralPath $Lockfile -PathType Leaf) -or (Split-Path -Leaf $Lockfile) -ne 'lockfile')) {
  throw 'Lockfile 参数必须指向现有的 LeagueClient lockfile 文件。'
}

Push-Location -LiteralPath $PSScriptRoot
try {
  $sdkPath = Join-Path $PSScriptRoot 'node_modules\@modelcontextprotocol\sdk\package.json'
  if (-not (Test-Path -LiteralPath $sdkPath)) {
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
    $runtimePnpm = Join-Path (Split-Path (Split-Path $NodePath -Parent) -Parent) 'node_modules\pnpm\bin\pnpm.mjs'
    if ($pnpmCommand) {
      & $pnpmCommand.Source install --frozen-lockfile --ignore-scripts
    } elseif ($npmCommand) {
      & $npmCommand.Source install --ignore-scripts
    } elseif (Test-Path -LiteralPath $runtimePnpm) {
      & $NodePath $runtimePnpm install --frozen-lockfile --ignore-scripts
    } else {
      throw '找不到 npm/pnpm。请安装完整 Node.js，或先在此目录安装 package.json 中的依赖。'
    }
    if ($LASTEXITCODE -ne 0) { throw 'MCP 依赖安装失败。' }
  }

  $existingText = & $CodexPath mcp get aramkit --json 2>$null
  if ($LASTEXITCODE -eq 0) {
    $existing = ($existingText -join "`n") | ConvertFrom-Json
    $sameServer = $existing.transport.command -eq $NodePath -and $existing.transport.args.Count -eq 1 -and $existing.transport.args[0] -eq $serverPath
    $sameLockfile = -not $Lockfile -or $existing.transport.env.ARAMKIT_LCU_LOCKFILE -eq $Lockfile
    if (-not $sameServer -or -not $sameLockfile) {
      throw '已有不同的 aramkit MCP 配置。为保留原配置，本脚本没有覆盖它；请先在 Codex 设置中检查。'
    }
    Write-Output '现有 aramkit MCP 已指向本项目。'
  } else {
    $cliArguments = @('mcp', 'add', 'aramkit')
    if ($Lockfile) { $cliArguments += @('--env', "ARAMKIT_LCU_LOCKFILE=$Lockfile") }
    $cliArguments += @('--', $NodePath, $serverPath)
    & $CodexPath @cliArguments
    if ($LASTEXITCODE -ne 0) { throw '写入 Codex MCP 配置失败。' }
  }
  Write-Output '配置完成。重启 Codex 的 MCP 连接或重新打开 Codex，再在新聊天中使用海斗助手。'
} finally {
  Pop-Location
}
