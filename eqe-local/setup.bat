@echo off
rem One-time setup on Windows: installs the npm packages and the browsers Playwright needs.
cd /d "%~dp0"
call :checknode || goto :fail
echo [1/3] Installing npm packages...
call npm install --no-audit --no-fund || goto :fail
echo [2/3] Installing the Chromium browser for Playwright tests...
call npx playwright install chromium || goto :fail
echo [3/3] Installing the browser for Playwright MCP...
call npx @playwright/mcp install-browser chrome-for-testing
if errorlevel 1 echo Warning: the Playwright MCP browser did not install. Rule-based script generation may fail.
echo.
echo Setup complete. Double-click start-all.bat to launch the applications.
pause
exit /b 0

:checknode
where node >nul 2>&1 || (echo Node.js is not installed. Install Node.js 22 LTS or newer from https://nodejs.org and run setup.bat again. & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=9)?0:1)" || (echo Node.js 22.9 or newer is needed. You have & node -v & exit /b 1)
exit /b 0

:fail
echo.
echo Setup failed. See the messages above.
pause
exit /b 1
