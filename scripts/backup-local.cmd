@echo off
rem Daily local backup (Windows Task Scheduler). See docs/SYNC_SETUP_TH.md.
cd /d "%~dp0.."
if not exist backups mkdir backups
echo ==== %date% %time% >> backups\backup-local.log
node scripts\backup-local.mjs >> backups\backup-local.log 2>&1
