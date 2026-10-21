@echo off
rem Stops whatever is listening on the four EQE ports (4000, 4100, 4101, 4200).
powershell -NoProfile -Command "$ids = Get-NetTCPConnection -State Listen -LocalPort 4000,4100,4101,4200 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($ids) { $ids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Write-Host 'EQE applications stopped.' } else { Write-Host 'No EQE application was running.' }"
timeout /t 4 >nul
