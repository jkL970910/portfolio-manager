param()

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$dataDir = Join-Path $PSScriptRoot "..\.local\postgres\data"

& "$pgBin\pg_ctl.exe" -D $dataDir stop
