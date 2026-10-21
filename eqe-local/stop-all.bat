@echo off
rem Stops whatever is listening on the four EQE ports (4000, 4100, 4101, 4200).
setlocal enabledelayedexpansion
set "STOPPED="
for %%P in (4000 4100 4101 4200) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
    taskkill /f /pid %%I >nul 2>&1 && set "STOPPED=1"
  )
)
if defined STOPPED (echo EQE applications stopped.) else (echo No EQE application was running.)
timeout /t 4 >nul
