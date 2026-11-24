@echo off
cd /d "%~dp0"
node scan-photos.js
node server.js
pause
