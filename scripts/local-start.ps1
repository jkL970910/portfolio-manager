param(
  [switch]$SkipDevServer,
  [switch]$ForceSeed
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  Write-Host "==> $Label"
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function New-RandomHex {
  param([int]$Bytes = 32)
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return ([System.BitConverter]::ToString($buffer)).Replace("-", "").ToLowerInvariant()
}

$root = Split-Path -Parent $PSScriptRoot
$nodeModules = Join-Path $root "node_modules"
$envLocal = Join-Path $root ".env.local"
$seedStampDir = Join-Path $root ".local"
$seedStamp = Join-Path $seedStampDir "seeded.flag"

Set-Location $root

if (-not (Test-Path $nodeModules)) {
  Invoke-Step "Installing npm dependencies" { npm install }
} else {
  Write-Host "==> npm dependencies already installed"
}

if (-not (Test-Path $envLocal)) {
  New-Item -ItemType Directory -Force $seedStampDir | Out-Null
  @"
AUTH_SECRET=$(New-RandomHex)
DATABASE_URL=postgresql://portfolio_manager@127.0.0.1:5433/portfolio_manager
REPOSITORY_MODE=postgres-drizzle
"@ | Set-Content -Path $envLocal -Encoding ASCII
  Write-Host "==> Created .env.local for local PostgreSQL runtime"
} else {
  Write-Host "==> Using existing .env.local"
}

Invoke-Step "Initializing local PostgreSQL" { npm run db:init }
Invoke-Step "Pushing Drizzle schema" { npm run db:push }

if ($ForceSeed -or -not (Test-Path $seedStamp)) {
  Invoke-Step "Seeding local database" { npm run db:seed }
  New-Item -ItemType Directory -Force $seedStampDir | Out-Null
  Set-Content -Path $seedStamp -Value (Get-Date).ToString("o") -Encoding ASCII
} else {
  Write-Host "==> Seed already applied; skipping db:seed"
}

if ($SkipDevServer) {
  Write-Host "==> Local environment is ready"
  exit 0
}

Write-Host "==> Starting Next.js dev server"
& npm run dev
exit $LASTEXITCODE
