#!/usr/bin/env bash
# Starts StayEase 1.0 and 1.1, mock Jira and the EQE dashboard in the background. Logs go to ./logs.
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || { echo "First run ./setup.sh once."; exit 1; }
mkdir -p logs
(cd apps/stayease && nohup node server.js > ../../logs/stayease.log 2>&1 &)
(cd apps/stayease && STAYEASE_RELEASE=1.1 PORT=4101 DATA_DIR="$PWD/../../data/stayease-1.1" nohup node server.js > ../../logs/stayease-1.1.log 2>&1 &)
(cd apps/mock-jira && nohup node server.js > ../../logs/mock-jira.log 2>&1 &)
sleep 1
(cd dashboard && nohup node --env-file-if-exists=../.env server.js > ../logs/dashboard.log 2>&1 &)
echo "EQE dashboard http://localhost:4000 · StayEase 1.0 http://localhost:4100 · StayEase 1.1 http://localhost:4101 · Mock Jira http://localhost:4200"
echo "Stop with ./stop-all.sh"
