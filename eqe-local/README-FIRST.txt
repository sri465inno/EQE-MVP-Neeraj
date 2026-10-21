EQE platform - run it on your laptop
====================================

WHAT'S INSIDE
  EQE dashboard ........ http://localhost:4000
  StayEase 1.0 ......... http://localhost:4100  (mock hotel site, has 2 seeded defects)
  StayEase 1.1 ......... http://localhost:4101  (same site, defects fixed)
  Mock Jira ............ http://localhost:4200  (initiatives MGPP-1 and MGPP-2)

BEFORE YOU START
  - Node.js 22 LTS or newer (22.9+): https://nodejs.org
  - Internet for the one-time setup (about 400 MB of packages and browsers)
  - Ports 4000, 4100, 4101 and 4200 free

WINDOWS
  1. Unzip to a folder without special characters, for example C:\eqe-local
  2. Double-click setup.bat      (once; takes a few minutes)
  3. Double-click start-all.bat  (the dashboard opens in your browser)
  4. Double-click stop-all.bat   (when you are done)

MACOS / LINUX
  1. ./setup.sh
  2. ./start-all.sh
  3. ./stop-all.sh

AGENT ENGINES
  - Rule-based (offline): works straight away, no account needed.
  - Devin (AI): copy .env.example to .env and fill in DEVIN_API_KEY (cog_...),
    DEVIN_ORG_ID and DEVIN_API_URL
    (for this tenant: https://tcs-marriott-pilot.devinenterprise.com/api),
    then restart. Never share or commit the .env file.

DEMO MEMBERS (StayEase sign-in)
  ava.thompson@example.com / gold2026
  liam.carter@example.com  / platinum2026
  priya.nair@example.com   / ambassador2026

TROUBLESHOOTING
  - Logs are in the logs folder (dashboard.log, stayease.log, ...).
  - "port already in use": run stop-all, then start-all again.
  - Start fresh: stop everything and delete the data folder. Mock Jira re-seeds on the next start.
  - More detail: README.md and docs/DEVIN-INTEGRATION.md
