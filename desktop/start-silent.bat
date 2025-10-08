@echo off
:: Run Music Player silently without console window
start /min "" cmd /c "cd /d %~dp0 && npm start"
exit
