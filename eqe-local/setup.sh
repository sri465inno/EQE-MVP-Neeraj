#!/usr/bin/env bash
# One-time setup on macOS/Linux: installs the npm packages and the browsers Playwright needs.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Install Node.js 22 LTS or newer from https://nodejs.org."; exit 1; }
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=9)?0:1)" || { echo "Node.js 22.9 or newer is needed (you have $(node -v))."; exit 1; }
npm install --no-audit --no-fund
if [ "$(uname)" = "Linux" ]; then npx playwright install --with-deps chromium; else npx playwright install chromium; fi
npx @playwright/mcp install-browser chrome-for-testing || echo "Warning: the Playwright MCP browser did not install. Rule-based script generation may fail."
echo "Setup complete. Run ./start-all.sh to launch the applications."
