@echo off
setlocal EnableExtensions

set "WINDOW_TITLE=Loo国 Remote Dev"
set "WSL_ENTRY=/bin/bash /home/jkliu97/projects/portfolio-manager/scripts/windows-remote-dev-entry.sh"

where wt.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "" wt.exe new-tab --title "%WINDOW_TITLE%" wsl.exe -d Ubuntu -- %WSL_ENTRY%
  exit /b 0
)

title %WINDOW_TITLE%
wsl.exe -d Ubuntu -- %WSL_ENTRY%
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Loo国 launcher failed. The error above is the useful part.
  echo After fixing it, run this file again:
  echo %~f0
  echo.
  pause
  exit /b 1
)
