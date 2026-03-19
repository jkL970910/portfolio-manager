param()

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$port = 5433
$user = "portfolio_manager"
$dbName = "portfolio_manager"
$sqlFile = Join-Path $PSScriptRoot "seed.sql"

& "$pgBin\psql.exe" -h 127.0.0.1 -p $port -U $user -d $dbName -f $sqlFile
if ($LASTEXITCODE -ne 0) {
  throw "seed failed"
}
