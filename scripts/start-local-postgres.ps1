param()

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$dataDir = Join-Path $PSScriptRoot "..\.local\postgres\data"
$logFile = Join-Path $PSScriptRoot "..\.local\postgres\postgres.log"
$port = 5433

& "$pgBin\pg_ctl.exe" -D $dataDir status | Out-Null
if ($LASTEXITCODE -ne 0) {
  & "$pgBin\pg_ctl.exe" -D $dataDir -l $logFile -o "-p $port -h 127.0.0.1" start
}
