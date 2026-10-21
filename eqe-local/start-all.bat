@echo off
rem Starts StayEase 1.0 and 1.1, mock Jira and the EQE dashboard, each in its own minimised window.
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo Node.js is not installed. Install Node.js 22 LTS or newer from https://nodejs.org. & pause & exit /b 1)
if not exist node_modules (echo First run setup.bat once. & pause & exit /b 1)
netstat -ano | findstr /r /c:":4000 .*LISTENING" >nul && (echo The EQE dashboard is already running. Opening it... & start "" http://localhost:4000 & exit /b 0)
if not exist logs mkdir logs

start "EQE - StayEase 1.0 (port 4100)" /min /d "%~dp0apps\stayease" cmd /c node server.js ^> "%~dp0logs\stayease.log" 2^>^&1
set "STAYEASE_RELEASE=1.1"
set "PORT=4101"
set "DATA_DIR=%~dp0data\stayease-1.1"
start "EQE - StayEase 1.1 (port 4101)" /min /d "%~dp0apps\stayease" cmd /c node server.js ^> "%~dp0logs\stayease-1.1.log" 2^>^&1
set "STAYEASE_RELEASE="
set "PORT="
set "DATA_DIR="
start "EQE - Mock Jira (port 4200)" /min /d "%~dp0apps\mock-jira" cmd /c node server.js ^> "%~dp0logs\mock-jira.log" 2^>^&1
timeout /t 2 /nobreak >nul
start "EQE - Dashboard (port 4000)" /min /d "%~dp0dashboard" cmd /c node --env-file-if-exists=..\.env server.js ^> "%~dp0logs\dashboard.log" 2^>^&1

echo Waiting for the dashboard to start...
node "%~dp0scripts\wait-for-url.js" http://localhost:4000 30
if errorlevel 1 (echo The dashboard did not respond. Check logs\dashboard.log. & pause & exit /b 1)

echo.
echo   EQE dashboard   http://localhost:4000
echo   StayEase 1.0    http://localhost:4100
echo   StayEase 1.1    http://localhost:4101
echo   Mock Jira       http://localhost:4200
echo.
echo The services run in the minimised "EQE - ..." windows. Logs are in the logs folder.
echo To stop everything, double-click stop-all.bat.
start "" http://localhost:4000
timeout /t 8 >nul
