#!/usr/bin/env bash
# Stops whatever is listening on the four EQE ports (4000, 4100, 4101, 4200).
for p in 4000 4100 4101 4200; do
  if command -v lsof >/dev/null; then pids=$(lsof -ti tcp:$p -sTCP:LISTEN || true); [ -n "$pids" ] && kill $pids
  else fuser -k $p/tcp >/dev/null 2>&1 || true; fi
done
echo "EQE applications stopped."
