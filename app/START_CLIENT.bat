@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
call npm run client
exit /b %ERRORLEVEL%