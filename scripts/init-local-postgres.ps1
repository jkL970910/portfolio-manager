param()

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$dataDir = Join-Path $PSScriptRoot "..\.local\postgres\data"
$logDir = Join-Path $PSScriptRoot "..\.local\postgres"
$logFile = Join-Path $logDir "postgres.log"
$port = 5433
$user = "portfolio_manager"
$dbName = "portfolio_manager"

New-Item -ItemType Directory -Force $logDir | Out-Null

if (-not (Test-Path (Join-Path $dataDir "PG_VERSION"))) {
  New-Item -ItemType Directory -Force $dataDir | Out-Null
  & "$pgBin\initdb.exe" -D $dataDir -U $user --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) {
    throw "initdb failed"
  }

  Add-Content -Path (Join-Path $dataDir "postgresql.conf") -Value "`nport = $port`nlisten_addresses = '127.0.0.1'`n"
}

& "$pgBin\pg_ctl.exe" -D $dataDir status | Out-Null
if ($LASTEXITCODE -ne 0) {
  & "$pgBin\pg_ctl.exe" -D $dataDir -l $logFile -o "-p $port -h 127.0.0.1" start
  if ($LASTEXITCODE -ne 0) {
    throw "pg_ctl start failed"
  }
}

& "$pgBin\pg_isready.exe" -h 127.0.0.1 -p $port -U $user | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "postgres is not ready"
}

& "$pgBin\psql.exe" -h 127.0.0.1 -p $port -U $user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbName'" | ForEach-Object { $_.Trim() } | Set-Variable dbExists
if ($dbExists -ne "1") {
  & "$pgBin\createdb.exe" -h 127.0.0.1 -p $port -U $user $dbName
  if ($LASTEXITCODE -ne 0) {
    throw "createdb failed"
  }
}

Write-Host "Local PostgreSQL is ready on port $port with database '$dbName'."
